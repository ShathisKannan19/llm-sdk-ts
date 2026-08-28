/**
 * Manual smoke check against real provider APIs.
 *
 * This is NOT part of `npm test` (it needs API keys and makes billed calls).
 * Run it explicitly:  `npm run check:live`
 * It reads OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY from the
 * environment and exercises every capability on each configured provider.
 */
import { existsSync, readFileSync } from "node:fs";

import { z } from "zod";

import {
  LLM,
  type CapabilityName,
  type ProviderRuntimeConfig,
} from "../src/llm/index.js";

const PROVIDERS = ["openai", "anthropic", "gemini"] as const;
type ProviderName = (typeof PROVIDERS)[number];
type TestStatus = "pass" | "fail" | "skip";

interface TestResult {
  readonly provider: ProviderName;
  readonly capability: CapabilityName;
  readonly status: TestStatus;
  readonly message?: string;
}

// `speech` is ordered before `audio` so its generated clip can feed transcription.
const CAPABILITIES: ReadonlyArray<CapabilityName> = [
  "text",
  "vision",
  "speech",
  "audio",
  "tools",
  "structured",
];

const DEFAULT_MODEL: Readonly<Record<ProviderName, string>> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-opus-4-8",
  gemini: "gemini-2.5-flash",
};

const DEFAULT_AUDIO_MODEL: Readonly<Record<ProviderName, string>> = {
  openai: "gpt-4o-transcribe",
  anthropic: "claude-opus-4-8",
  gemini: "gemini-2.5-flash",
};

const DEFAULT_SPEECH_MODEL: Readonly<Record<ProviderName, string>> = {
  openai: "gpt-4o-mini-tts",
  anthropic: "claude-opus-4-8",
  gemini: "gemini-3.1-flash-tts-preview",
};

// Vision accepts a public https URL or a `data:` URL.
const SAMPLE_IMAGE_URL =
  "https://images.unsplash.com/photo-1507838153414-b4b713384a76?ixid=M3w4MjcwNjd8MHwxfHNlYXJjaHwyfHxtdXNpY3xlbnwwfHx8fDE3ODc4NjY5OTJ8MA&ixlib=rb-4.1.0&fit=max&q=80";

// Audio transcription needs a `data:` URL or raw base64 — the SDK never reads
// files. Reuse the clip written by the `speech` check, which runs first.
const SAMPLE_SPEECH_FILE = "./generated-speech/openai-speech.mp3";

function loadSpeechSampleAsDataUrl(): string | null {
  if (!existsSync(SAMPLE_SPEECH_FILE)) {
    return null;
  }

  return `data:audio/mpeg;base64,${readFileSync(SAMPLE_SPEECH_FILE).toString("base64")}`;
}

function getEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function resolveProviderConfig(provider: ProviderName): ProviderRuntimeConfig | null {
  const apiKey =
    provider === "openai"
      ? getEnv("OPENAI_API_KEY")
      : provider === "anthropic"
        ? getEnv("ANTHROPIC_API_KEY")
        : getEnv("GEMINI_API_KEY");

  if (!apiKey) {
    return null;
  }

  const baseURL =
    provider === "openai"
      ? getEnv("OPENAI_BASE_URL")
      : provider === "anthropic"
        ? getEnv("ANTHROPIC_BASE_URL")
        : getEnv("GEMINI_BASE_URL");

  return {
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  };
}

function isSupported(provider: ProviderName, capability: CapabilityName): boolean {
  if (provider === "openai") {
    return true;
  }

  if (provider === "anthropic") {
    return capability !== "audio" && capability !== "speech";
  }

  return true;
}

async function runCapability(
  llm: LLM,
  provider: ProviderName,
  capability: CapabilityName,
): Promise<TestResult> {
  if (!isSupported(provider, capability)) {
    return {
      provider,
      capability,
      status: "skip",
      message: "Not supported by provider",
    };
  }

  try {
    if (capability === "text") {
      await llm.text.generate({
        provider,
        model: DEFAULT_MODEL[provider],
        prompt: "Explain clean architecture in 2 concise bullet points.",
        temperature: 0.2,
      });

      return { provider, capability, status: "pass" };
    }

    if (capability === "vision") {
      await llm.vision.generate({
        provider,
        model: DEFAULT_MODEL[provider],
        input: "Describe this image in one short paragraph.",
        images: [SAMPLE_IMAGE_URL],
      });

      return { provider, capability, status: "pass" };
    }

    if (capability === "audio") {
      const audio = loadSpeechSampleAsDataUrl();
      if (!audio) {
        return {
          provider,
          capability,
          status: "skip",
          message: `no sample clip at ${SAMPLE_SPEECH_FILE} (run the speech check first)`,
        };
      }

      await llm.audio.transcribe({
        provider,
        model: DEFAULT_AUDIO_MODEL[provider],
        audio,
        prompt: "Transcribe clearly.",
      });

      return { provider, capability, status: "pass" };
    }

    if (capability === "speech") {
      await llm.speech.synthesize({
        provider,
        model: DEFAULT_SPEECH_MODEL[provider],
        input: "The quick brown fox jumps over the lazy dog.",
        voice: provider === "openai" ? "alloy" : "Kore",
        instructions: "Speak clearly and naturally.",
        format: provider === "openai" ? "mp3" : undefined,
        outputPath:
          provider === "openai"
            ? "./generated-speech/openai-speech.mp3"
            : "./generated-speech/gemini-speech.wav",
      });

      return { provider, capability, status: "pass" };
    }

    if (capability === "tools") {
      await llm.tools.execute({
        provider,
        model: DEFAULT_MODEL[provider],
        prompt: "Use tools to get weather in Chennai and time in Asia/Kolkata.",
        toolChoice: "auto",
        tools: [
          {
            name: "get_weather",
            description: "Get weather by location",
            inputSchema: {
              type: "object",
              properties: {
                location: { type: "string" },
              },
              required: ["location"],
            },
          },
          {
            name: "get_time",
            description: "Get current time by timezone",
            inputSchema: {
              type: "object",
              properties: {
                timezone: { type: "string" },
              },
              required: ["timezone"],
            },
          },
        ],
      });

      return { provider, capability, status: "pass" };
    }

    if (capability === "structured") {
      await llm.structured.generate({
        provider,
        model: DEFAULT_MODEL[provider],
        prompt:
          "Return JSON only with keys level and risks. level must be beginner|intermediate|advanced and risks must be an array of strings.",
        outputSchema: z.object({
          level: z.enum(["beginner", "intermediate", "advanced"]),
          risks: z.array(z.string()).min(1),
        }),
      });

      return { provider, capability, status: "pass" };
    }

    return {
      provider,
      capability,
      status: "skip",
      message: "Unsupported capability",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      provider,
      capability,
      status: "fail",
      message,
    };
  }
}

async function main(): Promise<void> {
  const configuredProviders: Record<string, ProviderRuntimeConfig> = {};

  for (const provider of PROVIDERS) {
    const config = resolveProviderConfig(provider);
    if (config) {
      configuredProviders[provider] = config;
    }
  }

  const availableProviders = Object.keys(configuredProviders) as ProviderName[];
  if (availableProviders.length === 0) {
    throw new Error(
      "No provider API keys found. Set OPENAI_API_KEY and/or ANTHROPIC_API_KEY and/or GEMINI_API_KEY.",
    );
  }

  const defaultProvider = availableProviders[0];

  // Built-in openai / anthropic / gemini adapters are registered automatically.
  const llm = new LLM({
    defaultProvider,
    defaultModel: DEFAULT_MODEL[defaultProvider],
    timeoutMs: 30_000,
    retries: 1,
    providers: configuredProviders,
  });

  const results: TestResult[] = [];

  for (const provider of availableProviders) {
    for (const capability of CAPABILITIES) {
      const result = await runCapability(llm, provider, capability);
      results.push(result);

      const label = `${provider}:${capability}`;
      if (result.status === "pass") {
        process.stdout.write(`PASS ${label}\n`);
      } else if (result.status === "skip") {
        process.stdout.write(`SKIP ${label} - ${result.message ?? ""}\n`);
      } else {
        process.stdout.write(`FAIL ${label} - ${result.message ?? ""}\n`);
      }
    }
  }

  const passed = results.filter((result) => result.status === "pass").length;
  const failed = results.filter((result) => result.status === "fail").length;
  const skipped = results.filter((result) => result.status === "skip").length;

  process.stdout.write("\n=== LIVE CHECK SUMMARY ===\n");
  process.stdout.write(`providers: ${availableProviders.join(", ")}\n`);
  process.stdout.write(`passed: ${passed}\n`);
  process.stdout.write(`failed: ${failed}\n`);
  process.stdout.write(`skipped: ${skipped}\n`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`Live check failed: ${message}\n`);
  process.exitCode = 1;
});

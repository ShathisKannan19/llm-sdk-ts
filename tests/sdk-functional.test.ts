import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { z } from "zod";

import {
  LLM,
  CapabilityNotSupportedError,
  ConfigValidationError,
  RequestValidationError,
  AuthenticationExecutionError,
  RateLimitExecutionError,
  TimeoutExecutionError,
  ProviderExecutionError,
  type LlmProvider,
  type ProviderBuildContext,
  type ProviderExecutionContext,
  type ProviderRawResponse,
  type SpeechSynthesisResult,
  type StructuredOutputResult,
  type ToolExecutionResult,
  type AudioTranscribeRequest,
  type SpeechSynthesizeRequest,
  type StructuredGenerateRequest,
  type TextGenerateRequest,
  type ToolsExecuteRequest,
  type VisionGenerateRequest,
} from "../src/llm/index.js";

function createFullMockProvider(context: ProviderBuildContext): LlmProvider {
  return {
    name: context.name,
    text: {
      async generate(
        request: TextGenerateRequest,
        executionContext: ProviderExecutionContext,
      ): Promise<ProviderRawResponse<string>> {
        return {
          content: `text:${request.prompt}`,
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          finishReason: "stop",
          model: executionContext.model,
          metadata: { from: "mock" },
        };
      },
    },
    vision: {
      async generate(
        request: VisionGenerateRequest,
        executionContext: ProviderExecutionContext,
      ): Promise<ProviderRawResponse<string>> {
        return {
          content: `vision:${request.input}:${request.images.length}`,
          finishReason: "length",
          model: executionContext.model,
        };
      },
    },
    audio: {
      async transcribe(
        request: AudioTranscribeRequest,
        executionContext: ProviderExecutionContext,
      ): Promise<ProviderRawResponse<string>> {
        return {
          content: `audio:${request.prompt ?? "none"}`,
          model: executionContext.model,
        };
      },
    },
    speech: {
      async synthesize(
        request: SpeechSynthesizeRequest,
        executionContext: ProviderExecutionContext,
      ): Promise<ProviderRawResponse<SpeechSynthesisResult>> {
        return {
          content: {
            audio: Buffer.from(`speech:${request.input}`).toString("base64"),
            mimeType: "audio/mpeg",
          },
          model: executionContext.model,
          metadata: { provider: "mock" },
        };
      },
    },
    tools: {
      async execute(
        _request: ToolsExecuteRequest,
        executionContext: ProviderExecutionContext,
      ): Promise<ProviderRawResponse<ToolExecutionResult>> {
        return {
          content: {
            text: "tools:ok",
            calls: [
              {
                name: "get_weather",
                arguments: { city: "Chennai" },
              },
            ],
          },
          finishReason: "tool_call",
          model: executionContext.model,
        };
      },
    },
    structured: {
      async generate<TData>(
        _request: StructuredGenerateRequest<TData>,
        executionContext: ProviderExecutionContext,
      ): Promise<ProviderRawResponse<StructuredOutputResult<TData>>> {
        return {
          content: {
            data: { level: "beginner", risks: ["latency"] } as TData,
            text: "{\"level\":\"beginner\",\"risks\":[\"latency\"]}",
          },
          model: executionContext.model,
        };
      },
    },
    getSupportedCapabilities() {
      return ["text", "vision", "audio", "speech", "tools", "structured"] as const;
    },
  };
}

function buildSdkWithMock(providerName = "mock"): LLM {
  return new LLM(
    {
      defaultProvider: providerName,
      defaultModel: "mock-model",
      providers: {
        [providerName]: {
          apiKey: "test-key",
          model: "mock-model",
        },
      },
    },
    {
      providers: {
        [providerName]: createFullMockProvider,
      },
    },
  );
}

test("text capability works", async () => {
  const llm = buildSdkWithMock();
  const response = await llm.text.generate({ prompt: "hello" });

  assert.equal(response.capability, "text");
  assert.equal(response.content, "text:hello");
  assert.equal(response.model.provider, "mock");
  assert.equal(response.usage.totalTokens, 15);
});

test("vision capability works", async () => {
  const llm = buildSdkWithMock();
  const response = await llm.vision.generate({
    input: "describe",
    images: ["data:image/png;base64,AAAA"],
  });

  assert.equal(response.capability, "vision");
  assert.equal(response.content, "vision:describe:1");
  assert.equal(response.finishReason, "length");
});

test("audio capability works", async () => {
  const llm = buildSdkWithMock();
  const response = await llm.audio.transcribe({
    audio: "data:audio/wav;base64,AAAA",
    prompt: "transcribe",
  });

  assert.equal(response.capability, "audio");
  assert.equal(response.content, "audio:transcribe");
});

test("speech capability writes output file", async () => {
  const llm = buildSdkWithMock();
  const dir = await mkdtemp(join(tmpdir(), "llm-sdk-speech-"));
  const outputPath = join(dir, "speech.mp3");

  const response = await llm.speech.synthesize({
    input: "hello speech",
    outputPath,
  });

  const fileData = await readFile(outputPath);
  assert.ok(fileData.length > 0);
  assert.equal(response.capability, "speech");
  assert.equal(response.content.outputPath, outputPath);
});

test("speech capability rejects output paths outside allowed roots", async () => {
  const llm = buildSdkWithMock();
  const outsidePath = resolve(process.cwd(), "..", "blocked-output.mp3");

  await assert.rejects(
    async () => {
      await llm.speech.synthesize({
        input: "hello speech",
        outputPath: outsidePath,
      });
    },
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /outputPath must be within/i);
      return true;
    },
  );
});

test("tools capability returns tool calls", async () => {
  const llm = buildSdkWithMock();
  const response = await llm.tools.execute({
    prompt: "weather",
    tools: [
      {
        name: "get_weather",
        description: "Get weather by city",
      },
    ],
  });

  assert.equal(response.capability, "tools");
  assert.equal(response.content.calls.length, 1);
  assert.equal(response.content.calls[0]?.name, "get_weather");
});

test("structured capability validates output schema", async () => {
  const llm = buildSdkWithMock();
  const response = await llm.structured.generate({
    prompt: "return risk JSON",
    outputSchema: z.object({
      level: z.enum(["beginner", "intermediate", "advanced"]),
      risks: z.array(z.string()).min(1),
    }),
  });

  assert.equal(response.capability, "structured");
  assert.equal(response.content.data.level, "beginner");
  assert.equal(Array.isArray(response.content.data.risks), true);
});

test("request validation error is raised for invalid text request", async () => {
  const llm = buildSdkWithMock();

  await assert.rejects(
    async () => {
      await llm.text.generate({ prompt: "" });
    },
    (error: unknown) => {
      assert.ok(error instanceof RequestValidationError);
      return true;
    },
  );
});

test("configuration validation error is raised for invalid config", () => {
  assert.throws(
    () => {
      new LLM({
        defaultProvider: "missing-provider",
        providers: {
          mock: {},
        },
      });
    },
    (error: unknown) => {
      assert.ok(error instanceof ConfigValidationError);
      return true;
    },
  );
});

test("capability not supported error is raised when provider lacks vision", async () => {
  const llm = new LLM(
    {
      defaultProvider: "limited",
      defaultModel: "mock-model",
      providers: {
        limited: {
          apiKey: "test-key",
          model: "mock-model",
        },
      },
    },
    {
      providers: {
        limited: (context: ProviderBuildContext): LlmProvider => ({
          name: context.name,
          text: {
            async generate(
              request: TextGenerateRequest,
              executionContext: ProviderExecutionContext,
            ): Promise<ProviderRawResponse<string>> {
              return { content: request.prompt, model: executionContext.model };
            },
          },
          getSupportedCapabilities() {
            return ["text"] as const;
          },
        }),
      },
    },
  );

  await assert.rejects(
    async () => {
      await llm.vision.generate({
        input: "desc",
        images: ["data:image/png;base64,AAAA"],
      });
    },
    (error: unknown) => {
      assert.ok(error instanceof CapabilityNotSupportedError);
      return true;
    },
  );
});

test("error mapper converts provider auth/rate-limit/timeout errors", async () => {
  const llm = new LLM(
    {
      defaultProvider: "failing",
      defaultModel: "mock-model",
      providers: {
        failing: {
          apiKey: "test-key",
          model: "mock-model",
        },
      },
    },
    {
      providers: {
        failing: (context: ProviderBuildContext): LlmProvider => ({
          name: context.name,
          text: {
            async generate(
              request: TextGenerateRequest,
              _executionContext: ProviderExecutionContext,
            ): Promise<ProviderRawResponse<string>> {
              if (request.prompt === "auth") {
                const error = new Error("unauthorized") as Error & { status?: number };
                error.status = 401;
                throw error;
              }

              if (request.prompt === "rate") {
                const error = new Error("rate") as Error & { status?: number };
                error.status = 429;
                throw error;
              }

              if (request.prompt === "timeout") {
                const error = new Error("timeout") as Error & { code?: string };
                error.code = "ETIMEDOUT";
                throw error;
              }

              throw new Error("generic provider failure");
            },
          },
          getSupportedCapabilities() {
            return ["text"] as const;
          },
        }),
      },
    },
  );

  await assert.rejects(
    async () => {
      await llm.text.generate({ prompt: "auth" });
    },
    (error: unknown) => {
      assert.ok(error instanceof AuthenticationExecutionError);
      return true;
    },
  );

  await assert.rejects(
    async () => {
      await llm.text.generate({ prompt: "rate" });
    },
    (error: unknown) => {
      assert.ok(error instanceof RateLimitExecutionError);
      return true;
    },
  );

  await assert.rejects(
    async () => {
      await llm.text.generate({ prompt: "timeout" });
    },
    (error: unknown) => {
      assert.ok(error instanceof TimeoutExecutionError);
      return true;
    },
  );

  await assert.rejects(
    async () => {
      await llm.text.generate({ prompt: "generic" });
    },
    (error: unknown) => {
      assert.ok(error instanceof ProviderExecutionError);
      return true;
    },
  );
});

test("retry behavior succeeds after transient network error", async () => {
  let attempts = 0;

  const llm = new LLM(
    {
      defaultProvider: "retryable",
      defaultModel: "mock-model",
      retries: 1,
      providers: {
        retryable: {
          apiKey: "test-key",
          model: "mock-model",
        },
      },
    },
    {
      providers: {
        retryable: (context: ProviderBuildContext): LlmProvider => ({
          name: context.name,
          text: {
            async generate(
              _request: TextGenerateRequest,
              executionContext: ProviderExecutionContext,
            ): Promise<ProviderRawResponse<string>> {
              attempts += 1;

              if (attempts === 1) {
                const error = new Error("reset") as Error & { code?: string };
                error.code = "ECONNRESET";
                throw error;
              }

              return {
                content: "recovered",
                model: executionContext.model,
              };
            },
          },
          getSupportedCapabilities() {
            return ["text"] as const;
          },
        }),
      },
    },
  );

  const response = await llm.text.generate({ prompt: "retry" });
  assert.equal(response.content, "recovered");
  assert.equal(attempts, 2);
});

test("abort signal cancels in-flight request", async () => {
  const llm = new LLM(
    {
      defaultProvider: "abortable",
      defaultModel: "mock-model",
      timeoutMs: 10,
      providers: {
        abortable: {
          apiKey: "test-key",
          model: "mock-model",
        },
      },
    },
    {
      providers: {
        abortable: (context: ProviderBuildContext): LlmProvider => ({
          name: context.name,
          text: {
            async generate(
              _request: TextGenerateRequest,
              executionContext: ProviderExecutionContext,
            ): Promise<ProviderRawResponse<string>> {
              await new Promise((resolve) => {
                setTimeout(resolve, executionContext.timeoutMs);
              });

              return {
                content: "late-response",
                model: executionContext.model,
              };
            },
          },
          getSupportedCapabilities() {
            return ["text"] as const;
          },
        }),
      },
    },
  );

  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    async () => {
      await llm.text.generate({ prompt: "abort", signal: controller.signal });
    },
    (error: unknown) => {
      assert.ok(error instanceof ProviderExecutionError);
      assert.match(error.message, /aborted/i);
      return true;
    },
  );
});

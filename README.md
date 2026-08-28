# llm-sdk-ts

[![npm version](https://img.shields.io/npm/v/llm-sdk-ts.svg)](https://www.npmjs.com/package/llm-sdk-ts)
[![CI](https://github.com/ShathisKannan19/llm-sdk-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/ShathisKannan19/llm-sdk-ts/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/node/v/llm-sdk-ts.svg)](https://www.npmjs.com/package/llm-sdk-ts)
[![types included](https://img.shields.io/npm/types/llm-sdk-ts.svg)](https://www.npmjs.com/package/llm-sdk-ts)
[![license](https://img.shields.io/npm/l/llm-sdk-ts.svg)](./LICENSE)

One small, typed API for the things you actually ask an LLM to do — text, vision,
transcription, speech, tool calling, and structured output — across **OpenAI**,
**Anthropic**, and **Google Gemini**. Switch providers by changing one string.

```ts
const llm = new LLM({ defaultProvider: "openai", providers: { openai: { apiKey, model: "gpt-4o-mini" } } });

const { content } = await llm.text.generate({ prompt: "Say hi in one word." });
```

## Contents

- [Why](#why)
- [Capabilities by provider](#capabilities-by-provider)
- [Install](#install)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Capabilities](#capabilities)
- [Custom providers](#custom-providers)
- [Error handling](#error-handling)
- [API keys](#api-keys)
- [Requirements](#requirements)
- [Contributing](#contributing)
- [License](#license)

## Why

- **One interface, many providers.** `llm.text.generate(...)` is the same call
  whether it runs on GPT, Claude, or Gemini. `provider` is a per-call override.
- **Typed end to end.** Requests and config are validated with
  [Zod](https://zod.dev); responses and errors are fully typed.
- **Predictable failures.** Provider quirks are mapped to a small, stable error
  hierarchy with `code` and `context` — no guessing what a 429 means this week.
- **Batteries included, not locked in.** OpenAI, Anthropic, and Gemini adapters
  ship in the box. Add your own by implementing one interface; it can even
  replace a built-in.
- **Small surface.** One class, six capability namespaces, no framework.

## Capabilities by provider

| Capability            | OpenAI | Anthropic | Gemini |
| --------------------- | :----: | :-------: | :----: |
| `text`                |   ✅   |    ✅     |   ✅   |
| `vision`              |   ✅   |    ✅     |   ✅   |
| `tools`               |   ✅   |    ✅     |   ✅   |
| `structured`          |   ✅   |    ✅     |   ✅   |
| `audio` (speech→text) |   ✅   |    ❌     |   ✅   |
| `speech` (text→speech)|   ✅   |    ❌     |   ✅   |

Calling an unsupported capability throws `CapabilityNotSupportedError` before any
network request.

## Install

```bash
npm install llm-sdk-ts
```

The OpenAI, Anthropic, and Gemini SDKs are bundled as dependencies — there is
nothing extra to install to use any of the three.

## Quick start

```ts
import { LLM } from "llm-sdk-ts";

const llm = new LLM({
  defaultProvider: "openai",
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY as string,
      model: "gpt-4o-mini",
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY as string,
      model: "claude-opus-4-8",
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY as string,
      model: "gemini-2.5-flash",
    },
  },
});

// Uses defaultProvider ("openai")
const a = await llm.text.generate({ prompt: "Explain clean architecture in 3 bullets." });
console.log(a.content);

// Same call, different provider
const b = await llm.text.generate({ provider: "anthropic", prompt: "Same, but terser." });
console.log(b.content);
```

Every response has the same shape:

```ts
interface LlmResponse<TContent> {
  requestId: string;
  capability: "text" | "vision" | "audio" | "speech" | "tools" | "structured";
  content: TContent;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  finishReason: "stop" | "length" | "tool_call" | "content_filter" | "error" | "other";
  model: { id: string; provider: string };
  metadata: Record<string, unknown>;
}
```

## Configuration

```ts
new LLM(config, options?)
```

### `config`

| Field             | Type                                    | Default   | Notes                                                        |
| ----------------- | --------------------------------------- | --------- | ----------------------------------------------------------- |
| `defaultProvider` | `string`                                | —         | Required. Must be a key in `providers`.                      |
| `providers`       | `Record<string, ProviderRuntimeConfig>` | —         | Required. At least the `defaultProvider` entry.              |
| `defaultModel`    | `string`                                | —         | Fallback model when a provider/request does not set one.     |
| `timeoutMs`       | `number`                                | `30000`   | 1–120000.                                                    |
| `retries`         | `number`                                | `1`       | 0–5. Retries only transient errors, with backoff + jitter.   |
| `logger`          | `LlmLogger`                             | console   | `{ log(level, message, meta?) }`. Pass your own to redirect. |

`ProviderRuntimeConfig`: `{ apiKey?, baseURL?, model?, timeoutMs?, retries?, headers? }`.
Model resolution order per call: **request `model`** → **provider `model`** →
**`defaultModel`**. If none is set, `ConfigValidationError` is thrown.

### Per-call overrides

Every capability call accepts: `provider`, `model`, `timeoutMs`, `retries`,
`signal` (`AbortSignal`), and `metadata`.

```ts
const controller = new AbortController();
const res = await llm.text.generate({
  provider: "gemini",
  model: "gemini-2.5-flash",
  prompt: "Stream-of-consciousness haiku.",
  timeoutMs: 8000,
  retries: 0,
  signal: controller.signal,
});
```

## Capabilities

### Text

```ts
const res = await llm.text.generate({
  prompt: "Write a one-line release note.",
  systemPrompt: "You are a terse changelog bot.",
  temperature: 0.2,
  maxTokens: 60,
});
console.log(res.content); // string
```

### Vision

```ts
const res = await llm.vision.generate({
  provider: "gemini",
  input: "Describe this image.",
  images: ["data:image/png;base64,<BASE64_IMAGE>"], // data URL or a public URL
});
console.log(res.content); // string
```

### Audio (speech → text)

```ts
const res = await llm.audio.transcribe({
  provider: "openai",
  model: "gpt-4o-transcribe",
  audio: "data:audio/wav;base64,<BASE64_AUDIO>",
  prompt: "Proper nouns: llm-sdk-ts.", // optional decoding hint
});
console.log(res.content); // string
```

### Speech (text → speech)

```ts
const res = await llm.speech.synthesize({
  provider: "openai",
  model: "gpt-4o-mini-tts",
  input: "Hello from llm-sdk-ts.",
  voice: "alloy",
  format: "mp3",
  outputPath: "./out/hello.mp3", // optional
});

console.log(res.content.mimeType);   // "audio/mpeg"
console.log(res.content.audio);      // base64 string
console.log(res.content.outputPath); // "./out/hello.mp3" when written
```

`outputPath` must resolve inside the current working directory or the OS temp
directory. Writing Gemini output to `.mp3` requires [`ffmpeg`](https://ffmpeg.org)
on `PATH`; `.wav` and raw base64 do not.

### Tools (function calling)

```ts
const res = await llm.tools.execute({
  provider: "anthropic",
  prompt: "What's the weather in Chennai?",
  toolChoice: "auto", // "auto" | "required" | "none"
  tools: [
    {
      name: "get_weather",
      description: "Get weather by city",
      inputSchema: {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      },
    },
  ],
});

for (const call of res.content.calls) {
  console.log(call.name, call.arguments); // "get_weather" { city: "Chennai" }
}
console.log(res.content.text); // assistant text, if any
```

The SDK returns the model's requested calls; running them and feeding results
back is up to you.

### Structured output

```ts
import { z } from "zod";

const Task = z.object({
  title: z.string(),
  priority: z.enum(["low", "medium", "high"]),
});

const res = await llm.structured.generate({
  provider: "openai",
  prompt: "Create a task for fixing the login bug.",
  outputSchema: Task,
});

const task = res.content.data; // typed as z.infer<typeof Task>
console.log(task.priority);
console.log(res.content.text); // raw JSON string
```

The response is parsed and validated against your schema; a mismatch throws.

## Custom providers

A provider is a factory that returns an object implementing the capabilities it
supports. Register it through the second argument; a name that matches a built-in
(`openai`, `anthropic`, `gemini`) replaces it.

```ts
import { LLM, type ProviderCreator } from "llm-sdk-ts";

const echoProvider: ProviderCreator = (ctx) => ({
  name: ctx.name,
  text: {
    async generate(request, execCtx) {
      return { content: `echo: ${request.prompt}`, model: execCtx.model };
    },
  },
  getSupportedCapabilities() {
    return ["text"] as const;
  },
});

const llm = new LLM(
  { defaultProvider: "echo", providers: { echo: { model: "n/a" } } },
  { providers: { echo: echoProvider } },
);
```

The built-in creators are also exported (`openAiProviderCreator`,
`anthropicProviderCreator`, `geminiProviderCreator`, `builtInProviderCreators`)
if you want to wrap or re-register them explicitly.

## Error handling

Everything the SDK throws extends `LlmError` and carries a stable `code` plus a
`context` (`{ provider, capability, requestId, details }`).

```ts
import {
  LlmError,
  RequestValidationError,
  AuthenticationExecutionError,
  RateLimitExecutionError,
  TimeoutExecutionError,
  CapabilityNotSupportedError,
} from "llm-sdk-ts";

try {
  await llm.text.generate({ prompt: "hello" });
} catch (err) {
  if (err instanceof RateLimitExecutionError) {
    // back off and retry later
  } else if (err instanceof AuthenticationExecutionError) {
    // bad or missing API key
  } else if (err instanceof LlmError) {
    console.error(err.code, err.context.requestId);
  }
}
```

| Error class                    | `code`                     | When                                            |
| ------------------------------ | -------------------------- | ----------------------------------------------- |
| `ConfigValidationError`        | `CONFIG_VALIDATION`        | Bad `new LLM(...)` config or unresolvable model |
| `RequestValidationError`       | `REQUEST_VALIDATION`       | A capability call failed schema validation      |
| `ProviderNotFoundError`        | `PROVIDER_NOT_FOUND`       | Unknown provider name                           |
| `CapabilityNotSupportedError`  | `CAPABILITY_NOT_SUPPORTED` | Provider does not implement the capability      |
| `AuthenticationExecutionError` | `AUTHENTICATION`           | 401 / 403 from the provider                     |
| `RateLimitExecutionError`      | `RATE_LIMIT`               | 429 from the provider                           |
| `TimeoutExecutionError`        | `TIMEOUT`                  | Request exceeded the timeout                    |
| `ProviderExecutionError`       | `PROVIDER_EXECUTION`       | Any other provider-side failure (see `cause`)   |
| `InternalLlmError`             | `INTERNAL`                 | Unexpected SDK bug                              |

## API keys

The SDK **does not read environment variables**. Pass keys explicitly in
`providers[name].apiKey`. Reading from `process.env` (as the examples do) is your
choice, and the names below are just a convention used by `.env.example` and the
`npm run check:live` script:

```dotenv
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
```

Never commit real keys. `.env` is git-ignored; `.env.example` is the template.

## Requirements

- Node.js **18+**
- ESM only (`"type": "module"` or `.mjs`)
- `ffmpeg` on `PATH` — only for Gemini `speech` output written as `.mp3`

## Contributing

Issues and PRs are welcome. Branch from `develop` and open the PR against
`develop`; run `npm run verify` first and add tests for behaviour changes. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the checklist, [RELEASING.md](RELEASING.md)
for the branching model and release process, and [CHANGELOG.md](CHANGELOG.md) for
release notes.

## License

[MIT](LICENSE) © Shathis Kannan V

import OpenAI, { toFile } from "openai";
import type {
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions/completions";

import type {
  ProviderCreator,
  LlmProvider,
  ProviderBuildContext,
  ProviderExecutionContext,
  ProviderRawResponse,
  AudioTranscribeRequest,
  StructuredGenerateRequest,
  SpeechSynthesizeRequest,
  TextGenerateRequest,
  ToolsExecuteRequest,
  VisionGenerateRequest,
  StructuredOutputResult,
  SpeechSynthesisResult,
  ToolCall,
  ToolExecutionResult,
} from "../index.js";
import {
  parseDataUrl,
  safeParseJsonObject,
  toOpenAiUsage,
  zodSchemaToJsonSchema,
} from "./shared/provider-utils.js";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_AUDIO_MODEL = "gpt-4o-transcribe";
const DEFAULT_OPENAI_TTS_MODEL = "gpt-4o-mini-tts";

function resolveOpenAiBaseUrl(value: string | undefined): string {
  const raw = value?.trim();

  if (!raw) {
    return DEFAULT_OPENAI_BASE_URL;
  }

  const unquoted = raw.replace(/^['\"](.*)['\"]$/, "$1");

  if (unquoted === "/v1" || unquoted === "v1") {
    return DEFAULT_OPENAI_BASE_URL;
  }

  return unquoted.endsWith("/") ? unquoted.slice(0, -1) : unquoted;
}

function audioExtensionFromMimeType(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case "audio/mpeg":
      return "mp3";
    case "audio/wav":
      return "wav";
    case "audio/mp4":
      return "m4a";
    case "audio/ogg":
      return "ogg";
    case "audio/webm":
      return "webm";
    default:
      return "wav";
  }
}

function speechMimeTypeFromFormat(format: string): string {
  switch (format) {
    case "mp3":
      return "audio/mpeg";
    case "opus":
      return "audio/opus";
    case "aac":
      return "audio/aac";
    case "flac":
      return "audio/flac";
    case "wav":
    case "pcm":
      return "audio/wav";
    default:
      return "audio/mpeg";
  }
}

function createClient(
  providerContext: ProviderBuildContext,
  executionContext: ProviderExecutionContext,
): OpenAI {
  const apiKey = providerContext.config.apiKey;
  if (!apiKey) {
    throw new Error("OpenAI provider requires config.apiKey");
  }

  return new OpenAI({
    apiKey,
    baseURL: resolveOpenAiBaseUrl(providerContext.config.baseURL),
    timeout: executionContext.timeoutMs,
    maxRetries: executionContext.retries,
    defaultHeaders: providerContext.config.headers,
  });
}

function parseToolCalls(toolCalls: unknown): ReadonlyArray<ToolCall> {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    return [];
  }

  const calls: ToolCall[] = [];

  for (const call of toolCalls) {
    if (typeof call !== "object" || call === null) {
      continue;
    }

    const maybe = call as {
      readonly function?: {
        readonly name?: unknown;
        readonly arguments?: unknown;
      };
    };

    const name = typeof maybe.function?.name === "string" ? maybe.function.name : undefined;
    if (!name) {
      continue;
    }

    const rawArgs =
      typeof maybe.function?.arguments === "string" ? maybe.function.arguments : "{}";
    const args = safeParseJsonObject(rawArgs);

    calls.push({
      name,
      arguments: args,
    });
  }

  return calls;
}

function buildTextMessages(request: TextGenerateRequest): ChatCompletionMessageParam[] {
  const messages: ChatCompletionMessageParam[] = [];

  if (request.systemPrompt) {
    messages.push({
      role: "system",
      content: request.systemPrompt,
    });
  }

  messages.push({
    role: "user",
    content: request.prompt,
  });

  return messages;
}

function buildVisionMessages(request: VisionGenerateRequest): ChatCompletionMessageParam[] {
  const content: ChatCompletionContentPart[] = [{ type: "text", text: request.input }];

  for (const image of request.images) {
    content.push({
      type: "image_url",
      image_url: { url: image },
    });
  }

  return [
    {
      role: "user",
      content,
    },
  ];
}

function textFromChoice(choice: { readonly message?: { readonly content?: string | null } } | undefined): string {
  return choice?.message?.content ?? "";
}

async function transcribeAudio(
  providerContext: ProviderBuildContext,
  executionContext: ProviderExecutionContext,
  request: AudioTranscribeRequest,
): Promise<ProviderRawResponse<string>> {
  const client = createClient(providerContext, executionContext);
  const media = parseDataUrl(request.audio);
  const mimeType = media?.mimeType ?? request.mimeType ?? "audio/wav";
  const base64Data = media?.data ?? request.audio;
  const buffer = Buffer.from(base64Data, "base64");

  const transcription = await client.audio.transcriptions.create({
    file: await toFile(buffer, `audio.${audioExtensionFromMimeType(mimeType)}`, {
      type: mimeType,
    }),
    model: executionContext.model || DEFAULT_OPENAI_AUDIO_MODEL,
    prompt: request.prompt,
  });

  return {
    content: transcription.text ?? "",
    model: executionContext.model,
    metadata: {
      requestId: executionContext.requestId,
    },
  };
}

async function synthesizeSpeech(
  providerContext: ProviderBuildContext,
  executionContext: ProviderExecutionContext,
  request: SpeechSynthesizeRequest,
): Promise<ProviderRawResponse<SpeechSynthesisResult>> {
  const client = createClient(providerContext, executionContext);
  const format = request.format ?? "mp3";

  const response = await client.audio.speech.create({
    model: executionContext.model || DEFAULT_OPENAI_TTS_MODEL,
    voice: request.voice ?? "alloy",
    input: request.input,
    instructions: request.instructions,
    response_format: format,
  });

  const buffer = Buffer.from(await response.arrayBuffer());

  return {
    content: {
      audio: buffer.toString("base64"),
      mimeType: speechMimeTypeFromFormat(format),
    },
    model: executionContext.model,
    metadata: {
      requestId: executionContext.requestId,
    },
  };
}

export function createOpenAiProvider(context: ProviderBuildContext): LlmProvider {
  return {
    name: context.name,

    text: {
      async generate(
        request: TextGenerateRequest,
        executionContext: ProviderExecutionContext,
      ): Promise<ProviderRawResponse<string>> {
        const client = createClient(context, executionContext);

        const response = await client.chat.completions.create({
          model: executionContext.model,
          messages: buildTextMessages(request),
          temperature: request.temperature,
          max_tokens: request.maxTokens,
        });

        const choice = response.choices?.[0];

        return {
          content: textFromChoice(choice),
          usage: toOpenAiUsage(response.usage),
          finishReason: choice?.finish_reason,
          model: response.model,
          metadata: {
            requestId: executionContext.requestId,
          },
        };
      },
    },

    vision: {
      async generate(
        request: VisionGenerateRequest,
        executionContext: ProviderExecutionContext,
      ): Promise<ProviderRawResponse<string>> {
        const client = createClient(context, executionContext);

        const response = await client.chat.completions.create({
          model: executionContext.model,
          messages: buildVisionMessages(request),
        });

        const choice = response.choices?.[0];

        return {
          content: textFromChoice(choice),
          usage: toOpenAiUsage(response.usage),
          finishReason: choice?.finish_reason,
          model: response.model,
          metadata: {
            requestId: executionContext.requestId,
          },
        };
      },
    },

    audio: {
      transcribe(request, executionContext) {
        return transcribeAudio(context, executionContext, request);
      },
    },

    speech: {
      synthesize(request, executionContext) {
        return synthesizeSpeech(context, executionContext, request);
      },
    },

    tools: {
      async execute(
        request: ToolsExecuteRequest,
        executionContext: ProviderExecutionContext,
      ): Promise<ProviderRawResponse<ToolExecutionResult>> {
        const client = createClient(context, executionContext);

        const response = await client.chat.completions.create({
          model: executionContext.model,
          messages: [{ role: "user", content: request.prompt }],
          tools: request.tools.map((tool) => ({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema ?? {
                type: "object",
                additionalProperties: true,
              },
            },
          })),
          tool_choice: request.toolChoice === "required" ? "required" : request.toolChoice,
        });

        const choice = response.choices?.[0];

        return {
          content: {
            text: textFromChoice(choice) || undefined,
            calls: parseToolCalls(choice?.message?.tool_calls),
          },
          usage: toOpenAiUsage(response.usage),
          finishReason: choice?.finish_reason,
          model: response.model,
          metadata: {
            requestId: executionContext.requestId,
          },
        };
      },
    },

    structured: {
      async generate<TData>(
        request: StructuredGenerateRequest<TData>,
        executionContext: ProviderExecutionContext,
      ): Promise<ProviderRawResponse<StructuredOutputResult<TData>>> {
        const client = createClient(context, executionContext);
        const jsonSchema = zodSchemaToJsonSchema(request.outputSchema);

        const response = await client.chat.completions.create({
          model: executionContext.model,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "structured_output",
              strict: true,
              schema: jsonSchema,
            },
          },
          messages: [
            {
              role: "system",
              content: "Return only schema-valid JSON.",
            },
            {
              role: "user",
              content: request.prompt,
            },
          ],
        });

        const choice = response.choices?.[0];
        const text = textFromChoice(choice);
        const data = request.outputSchema.parse(safeParseJsonObject(text));

        return {
          content: {
            data,
            text,
          },
          usage: toOpenAiUsage(response.usage),
          finishReason: choice?.finish_reason,
          model: response.model,
          metadata: {
            requestId: executionContext.requestId,
          },
        };
      },
    },

    getSupportedCapabilities() {
      return ["text", "vision", "audio", "speech", "tools", "structured"] as const;
    },
  };
}

export const openAiProviderCreator: ProviderCreator = createOpenAiProvider;

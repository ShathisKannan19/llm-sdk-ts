import { GoogleGenAI } from "@google/genai";
import type { Content } from "@google/genai";

import type {
  LlmProvider,
  ProviderBuildContext,
  ProviderCreator,
  ProviderExecutionContext,
  ProviderRawResponse,
  StructuredOutputResult,
  ToolCall,
  ToolExecutionResult,
  StructuredGenerateRequest,
  SpeechSynthesizeRequest,
  TextGenerateRequest,
  ToolsExecuteRequest,
  VisionGenerateRequest,
  SpeechSynthesisResult,
} from "../index.js";
import { parseDataUrl, safeParseJsonObject, zodSchemaToJsonSchema } from "./shared/provider-utils.js";

const DEFAULT_MAX_OUTPUT_TOKENS = 2048;
const DEFAULT_GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";

type GeminiPart =
  | { readonly text: string }
  | {
      readonly inlineData: {
        readonly mimeType: string;
        readonly data: string;
      };
    };

function normalizeGeminiAudioMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase();

  if (normalized === "audio/mpeg") {
    return "audio/mp3";
  }

  return mimeType;
}

function createClient(context: ProviderBuildContext): GoogleGenAI {
  const apiKey = context.config.apiKey;
  if (!apiKey) {
    throw new Error("Gemini provider requires config.apiKey");
  }

  return new GoogleGenAI({ apiKey });
}

function usageFromGemini(value: {
  readonly promptTokenCount?: number;
  readonly candidatesTokenCount?: number;
  readonly totalTokenCount?: number;
} | null | undefined): ProviderRawResponse<never>["usage"] {
  if (!value) {
    return undefined;
  }

  const inputTokens = value.promptTokenCount ?? 0;
  const outputTokens = value.candidatesTokenCount ?? 0;
  const totalTokens = value.totalTokenCount ?? inputTokens + outputTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

function extractTextFromParts(parts: ReadonlyArray<{ readonly text?: string }> | undefined): string {
  if (!parts) {
    return "";
  }

  return parts
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}

function extractFunctionCalls(calls: unknown): ReadonlyArray<ToolCall> {
  if (!Array.isArray(calls)) {
    return [];
  }

  const mapped: ToolCall[] = [];

  for (const call of calls) {
    if (typeof call !== "object" || call === null) {
      continue;
    }

    const maybe = call as {
      readonly name?: unknown;
      readonly args?: unknown;
    };

    if (typeof maybe.name !== "string") {
      continue;
    }

    if (typeof maybe.args !== "object" || maybe.args === null || Array.isArray(maybe.args)) {
      continue;
    }

    mapped.push({
      name: maybe.name,
      arguments: maybe.args as Readonly<Record<string, unknown>>,
    });
  }

  return mapped;
}

function mapFinishReason(reason: string | undefined): string | undefined {
  if (!reason) {
    return undefined;
  }

  const normalized = reason.toLowerCase();
  if (normalized === "stop") {
    return "stop";
  }
  if (normalized === "max_tokens") {
    return "length";
  }
  if (normalized === "tool_calls") {
    return "tool_call";
  }

  return normalized;
}

function mapVisionParts(request: VisionGenerateRequest): ReadonlyArray<GeminiPart> {
  const parts: GeminiPart[] = [{ text: request.input }];

  for (const image of request.images) {
    const parsed = parseDataUrl(image);
    if (!parsed) {
      throw new Error("Gemini vision currently requires base64 data URLs");
    }

    parts.push({
      inlineData: {
        mimeType: parsed.mimeType,
        data: parsed.data,
      },
    });
  }

  return parts;
}

function mapAudioParts(
  audio: string,
  mimeType?: string,
  prompt?: string,
): ReadonlyArray<GeminiPart> {
  const parsed = parseDataUrl(audio);
  if (!parsed) {
    throw new Error("Gemini audio currently requires base64 data URLs");
  }

  return [
    ...(prompt
      ? [
          {
            text: prompt,
          },
        ]
      : []),
    {
      inlineData: {
        mimeType: normalizeGeminiAudioMimeType(mimeType ?? parsed.mimeType),
        data: parsed.data,
      },
    },
  ];
}

function mapTtsPrompt(input: string, instructions?: string): string {
  if (!instructions) {
    return `Speak the following text aloud:\n${input}`;
  }

  return `${instructions}\n\nSpeak the following text aloud:\n${input}`;
}

function mapToolConfig(choice: ToolsExecuteRequest["toolChoice"]): Readonly<Record<string, unknown>> | undefined {
  if (!choice || choice === "auto") {
    return undefined;
  }

  if (choice === "none") {
    return {
      functionCallingConfig: {
        mode: "NONE",
      },
    };
  }

  return {
    functionCallingConfig: {
      mode: "ANY",
    },
  };
}

export function createGeminiProvider(context: ProviderBuildContext): LlmProvider {
  return {
    name: context.name,

    text: {
      async generate(
        request: TextGenerateRequest,
        executionContext: ProviderExecutionContext,
      ): Promise<ProviderRawResponse<string>> {
        const client = createClient(context);

        const response = await client.models.generateContent({
          model: executionContext.model,
          contents: request.prompt,
          config: {
            temperature: request.temperature,
            maxOutputTokens: request.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
            systemInstruction: request.systemPrompt,
          },
        });

        const firstCandidate = response.candidates?.[0];

        return {
          content:
            response.text ??
            extractTextFromParts(firstCandidate?.content?.parts as ReadonlyArray<{ readonly text?: string }>),
          usage: usageFromGemini(response.usageMetadata),
          finishReason: mapFinishReason(firstCandidate?.finishReason),
          model: response.modelVersion ?? executionContext.model,
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
        const client = createClient(context);

        const response = await client.models.generateContent({
          model: executionContext.model,
          contents: [{ role: "user", parts: mapVisionParts(request) }] as Content[],
        });

        const firstCandidate = response.candidates?.[0];

        return {
          content:
            response.text ??
            extractTextFromParts(firstCandidate?.content?.parts as ReadonlyArray<{ readonly text?: string }>),
          usage: usageFromGemini(response.usageMetadata),
          finishReason: mapFinishReason(firstCandidate?.finishReason),
          model: response.modelVersion ?? executionContext.model,
          metadata: {
            requestId: executionContext.requestId,
          },
        };
      },
    },

    audio: {
      async transcribe(
        request: { readonly audio: string; readonly mimeType?: string; readonly prompt?: string },
        executionContext: ProviderExecutionContext,
      ): Promise<ProviderRawResponse<string>> {
        const client = createClient(context);

        const response = await client.models.generateContent({
          model: executionContext.model,
          contents: [
            {
              role: "user",
              parts: mapAudioParts(request.audio, request.mimeType, request.prompt ?? "Generate a transcription of this audio."),
            },
          ] as Content[],
          config: {
            maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
          },
        });

        const firstCandidate = response.candidates?.[0];

        return {
          content:
            response.text ??
            extractTextFromParts(firstCandidate?.content?.parts as ReadonlyArray<{ readonly text?: string }>),
          usage: usageFromGemini(response.usageMetadata),
          finishReason: mapFinishReason(firstCandidate?.finishReason),
          model: response.modelVersion ?? executionContext.model,
          metadata: {
            requestId: executionContext.requestId,
          },
        };
      },
    },

    speech: {
      async synthesize(
        request: SpeechSynthesizeRequest,
        executionContext: ProviderExecutionContext,
      ): Promise<ProviderRawResponse<SpeechSynthesisResult>> {
        const client = createClient(context);

        const interaction = (await client.interactions.create({
          model: executionContext.model || DEFAULT_GEMINI_TTS_MODEL,
          input: mapTtsPrompt(request.input, request.instructions),
          response_format: { type: "audio" },
          generation_config: {
            speech_config: [
              {
                voice: request.voice ?? "Kore",
              },
            ],
          },
        })) as {
          readonly output_audio?: {
            readonly data?: string;
            readonly mime_type?: string;
          };
        };

        const outputAudio = interaction.output_audio;
        const audio = outputAudio?.data;

        if (!audio) {
          throw new Error("Gemini speech generation did not return audio");
        }

        return {
          content: {
            audio,
            mimeType: outputAudio?.mime_type ?? "audio/wav",
          },
          model: executionContext.model,
          metadata: {
            requestId: executionContext.requestId,
          },
        };
      },
    },

    tools: {
      async execute(
        request: ToolsExecuteRequest,
        executionContext: ProviderExecutionContext,
      ): Promise<ProviderRawResponse<ToolExecutionResult>> {
        const client = createClient(context);

        const response = await client.models.generateContent({
          model: executionContext.model,
          contents: request.prompt,
          config: {
            tools: [
              {
                functionDeclarations: request.tools.map((tool) => ({
                  name: tool.name,
                  description: tool.description,
                  parametersJsonSchema: tool.inputSchema ?? {
                    type: "object",
                    additionalProperties: true,
                  },
                })),
              },
            ],
            toolConfig: mapToolConfig(request.toolChoice),
          },
        });

        const firstCandidate = response.candidates?.[0];

        return {
          content: {
            text: (
              response.text ??
              extractTextFromParts(
                firstCandidate?.content?.parts as ReadonlyArray<{ readonly text?: string }>,
              )
            ) || undefined,
            calls: extractFunctionCalls((response as { readonly functionCalls?: unknown }).functionCalls),
          },
          usage: usageFromGemini(response.usageMetadata),
          finishReason: mapFinishReason(firstCandidate?.finishReason),
          model: response.modelVersion ?? executionContext.model,
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
        const client = createClient(context);
        const jsonSchema = zodSchemaToJsonSchema(request.outputSchema);

        const response = await client.models.generateContent({
          model: executionContext.model,
          contents: request.prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: jsonSchema,
          },
        });

        const firstCandidate = response.candidates?.[0];
        const text =
          response.text ??
          extractTextFromParts(firstCandidate?.content?.parts as ReadonlyArray<{ readonly text?: string }>);
        const data = request.outputSchema.parse(safeParseJsonObject(text));

        return {
          content: {
            data,
            text,
          },
          usage: usageFromGemini(response.usageMetadata),
          finishReason: mapFinishReason(firstCandidate?.finishReason),
          model: response.modelVersion ?? executionContext.model,
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

export const geminiProviderCreator: ProviderCreator = createGeminiProvider;

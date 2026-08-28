import Anthropic from "@anthropic-ai/sdk";

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
  TextGenerateRequest,
  ToolsExecuteRequest,
  VisionGenerateRequest,
} from "../index.js";
import { parseDataUrl, safeParseJsonObject, zodSchemaToJsonSchema } from "./shared/provider-utils.js";

const DEFAULT_MAX_TOKENS = 1024;
const ANTHROPIC_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
type AnthropicImageMimeType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function toAnthropicImageMimeType(mimeType: string): AnthropicImageMimeType {
  if (!ANTHROPIC_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error("Anthropic vision supports only image/jpeg, image/png, image/gif, image/webp data URLs");
  }

  return mimeType as AnthropicImageMimeType;
}

function createClient(
  context: ProviderBuildContext,
  executionContext: ProviderExecutionContext,
): Anthropic {
  const apiKey = context.config.apiKey;
  if (!apiKey) {
    throw new Error("Anthropic provider requires config.apiKey");
  }

  return new Anthropic({
    apiKey,
    baseURL: context.config.baseURL,
    timeout: executionContext.timeoutMs,
    maxRetries: executionContext.retries,
    defaultHeaders: context.config.headers,
  });
}

function usageFromAnthropic(value: {
  readonly input_tokens?: number;
  readonly output_tokens?: number;
} | null | undefined): ProviderRawResponse<never>["usage"] {
  if (!value) {
    return undefined;
  }

  const inputTokens = value.input_tokens ?? 0;
  const outputTokens = value.output_tokens ?? 0;

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

function extractText(blocks: ReadonlyArray<{ readonly type: string; readonly text?: string }> | undefined): string {
  if (!blocks) {
    return "";
  }

  return blocks
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n")
    .trim();
}

function extractToolCalls(
  blocks: ReadonlyArray<{ readonly type: string; readonly name?: string; readonly input?: unknown }> | undefined,
): ReadonlyArray<ToolCall> {
  if (!blocks) {
    return [];
  }

  const calls: ToolCall[] = [];

  for (const block of blocks) {
    if (block.type !== "tool_use" || !block.name) {
      continue;
    }

    const input = block.input;
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      continue;
    }

    calls.push({
      name: block.name,
      arguments: input as Readonly<Record<string, unknown>>,
    });
  }

  return calls;
}

function mapToolChoice(
  choice: ToolsExecuteRequest["toolChoice"],
): { readonly type: "auto" | "any" } | undefined {
  if (!choice || choice === "auto") {
    return { type: "auto" };
  }

  if (choice === "required") {
    return { type: "any" };
  }

  return undefined;
}

function normalizeAnthropicInputSchema(
  inputSchema: Readonly<Record<string, unknown>> | undefined,
): { readonly type: "object"; readonly [key: string]: unknown } {
  if (!inputSchema) {
    return {
      type: "object",
      additionalProperties: true,
    };
  }

  const { type: _ignoredType, ...rest } = inputSchema;

  return {
    type: "object",
    ...rest,
  };
}

function mapVisionImages(
  images: ReadonlyArray<string>,
): ReadonlyArray<{
  readonly type: "image";
  readonly source: {
    readonly type: "base64";
    readonly media_type: AnthropicImageMimeType;
    readonly data: string;
  };
}> {
  return images.map((image) => {
    const parsed = parseDataUrl(image);
    if (!parsed) {
      throw new Error("Anthropic vision currently requires base64 data URLs");
    }

    return {
      type: "image",
      source: {
        type: "base64",
        media_type: toAnthropicImageMimeType(parsed.mimeType),
        data: parsed.data,
      },
    };
  });
}

export function createAnthropicProvider(context: ProviderBuildContext): LlmProvider {
  return {
    name: context.name,

    text: {
      async generate(
        request: TextGenerateRequest,
        executionContext: ProviderExecutionContext,
      ): Promise<ProviderRawResponse<string>> {
        const client = createClient(context, executionContext);

        const response = await client.messages.create({
          model: executionContext.model,
          max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
          system: request.systemPrompt,
          messages: [{ role: "user", content: request.prompt }],
        });

        return {
          content: extractText(response.content),
          usage: usageFromAnthropic(response.usage),
          finishReason: response.stop_reason ?? undefined,
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

        const response = await client.messages.create({
          model: executionContext.model,
          max_tokens: DEFAULT_MAX_TOKENS,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: request.input,
                },
                ...mapVisionImages(request.images),
              ],
            },
          ],
        });

        return {
          content: extractText(response.content),
          usage: usageFromAnthropic(response.usage),
          finishReason: response.stop_reason ?? undefined,
          model: response.model,
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
        const client = createClient(context, executionContext);

        const response = await client.messages.create({
          model: executionContext.model,
          max_tokens: DEFAULT_MAX_TOKENS,
          messages: [{ role: "user", content: request.prompt }],
          tools: request.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: normalizeAnthropicInputSchema(tool.inputSchema),
          })),
          tool_choice: mapToolChoice(request.toolChoice),
        });

        return {
          content: {
            text: extractText(response.content) || undefined,
            calls: extractToolCalls(response.content),
          },
          usage: usageFromAnthropic(response.usage),
          finishReason: response.stop_reason ?? undefined,
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

        const response = await client.messages.create({
          model: executionContext.model,
          max_tokens: DEFAULT_MAX_TOKENS,
          messages: [
            {
              role: "user",
              content: request.prompt,
            },
          ],
          output_config: {
            format: {
              type: "json_schema",
              schema: normalizeAnthropicInputSchema(jsonSchema),
            },
          },
        });

        const text = extractText(response.content);
        const data = request.outputSchema.parse(safeParseJsonObject(text));

        return {
          content: {
            data,
            text,
          },
          usage: usageFromAnthropic(response.usage),
          finishReason: response.stop_reason ?? undefined,
          model: response.model,
          metadata: {
            requestId: executionContext.requestId,
          },
        };
      },
    },

    getSupportedCapabilities() {
      return ["text", "vision", "tools", "structured"] as const;
    },
  };
}

export const anthropicProviderCreator: ProviderCreator = createAnthropicProvider;

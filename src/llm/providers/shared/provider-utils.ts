import type { ProviderRawResponse } from "../../types/common.js";
import { z, type ZodType } from "zod";

export interface DataUrlPayload {
  readonly mimeType: string;
  readonly data: string;
}

export function parseDataUrl(input: string): DataUrlPayload | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(input.trim());
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    data: match[2],
  };
}

export function toOpenAiUsage(value: {
  readonly prompt_tokens?: number;
  readonly completion_tokens?: number;
  readonly total_tokens?: number;
} | null | undefined): ProviderRawResponse<never>["usage"] {
  if (!value) {
    return undefined;
  }

  const inputTokens = value.prompt_tokens ?? 0;
  const outputTokens = value.completion_tokens ?? 0;
  const totalTokens = value.total_tokens ?? inputTokens + outputTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

export function safeParseJsonObject(input: string): Readonly<Record<string, unknown>> {
  const parsed = JSON.parse(input) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object response");
  }
  return parsed as Readonly<Record<string, unknown>>;
}

export function zodSchemaToJsonSchema(schema: ZodType): Readonly<Record<string, unknown>> {
  const converted = z.toJSONSchema(schema) as Record<string, unknown>;
  const { $schema: _ignoredSchema, ...providerFriendlySchema } = converted;
  return providerFriendlySchema;
}

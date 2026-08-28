import type { CapabilityName } from "../enums/capability-name.js";
import type { LlmFinishReason, LlmResponse, LlmUsage, ProviderRawResponse } from "../types/common.js";

function normalizeFinishReason(input?: string): LlmFinishReason {
  if (!input) {
    return "other";
  }

  if (input === "stop" || input === "length" || input === "tool_call" || input === "content_filter") {
    return input;
  }

  if (input === "error") {
    return "error";
  }

  return "other";
}

function normalizeUsage(usage?: Partial<LlmUsage>): LlmUsage {
  const inputTokens = usage?.inputTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;
  const totalTokens = usage?.totalTokens ?? inputTokens + outputTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

/**
 * Converts provider output into a unified SDK response model.
 */
export class ResponseNormalizer {
  normalize<TContent>(
    raw: ProviderRawResponse<TContent>,
    context: {
      requestId: string;
      provider: string;
      capability: CapabilityName;
      model: string;
    },
  ): LlmResponse<TContent> {
    return {
      requestId: context.requestId,
      capability: context.capability,
      content: raw.content,
      usage: normalizeUsage(raw.usage),
      finishReason: normalizeFinishReason(raw.finishReason),
      model: {
        id: raw.model ?? context.model,
        provider: context.provider,
      },
      metadata: raw.metadata ?? {},
    };
  }
}

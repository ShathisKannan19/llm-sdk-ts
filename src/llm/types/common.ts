import type { CapabilityName } from "../enums/capability-name.js";

export type LlmFinishReason =
  | "stop"
  | "length"
  | "tool_call"
  | "content_filter"
  | "error"
  | "other";

export interface LlmUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

export interface LlmModelInfo {
  readonly id: string;
  readonly provider: string;
}

export interface LlmResponse<TContent> {
  readonly requestId: string;
  readonly capability: CapabilityName;
  readonly content: TContent;
  readonly usage: LlmUsage;
  readonly finishReason: LlmFinishReason;
  readonly model: LlmModelInfo;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ToolCall {
  readonly name: string;
  readonly arguments: Readonly<Record<string, unknown>>;
}

export interface ToolExecutionResult {
  readonly text?: string;
  readonly calls: ReadonlyArray<ToolCall>;
}

export interface StructuredOutputResult<TData> {
  readonly data: TData;
  readonly text?: string;
}

export interface SpeechSynthesisResult {
  readonly audio: string;
  readonly mimeType: string;
  readonly outputPath?: string;
}

export interface ProviderRawResponse<TContent> {
  readonly content: TContent;
  readonly usage?: Partial<LlmUsage>;
  readonly finishReason?: string;
  readonly model?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

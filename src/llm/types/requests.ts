import type { ZodType } from "zod";

export interface BaseCapabilityRequest {
  readonly provider?: string;
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly retries?: number;
  readonly signal?: AbortSignal;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface TextGenerateRequest extends BaseCapabilityRequest {
  readonly prompt: string;
  readonly systemPrompt?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
}

export interface VisionGenerateRequest extends BaseCapabilityRequest {
  readonly input: string;
  readonly images: ReadonlyArray<string>;
}

export interface AudioTranscribeRequest extends BaseCapabilityRequest {
  readonly audio: string;
  readonly mimeType?: string;
  readonly prompt?: string;
}

export interface SpeechSynthesizeRequest extends BaseCapabilityRequest {
  readonly input: string;
  readonly voice?: string;
  readonly instructions?: string;
  readonly format?: "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm";
  readonly outputPath?: string;
}

export interface LlmTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema?: Readonly<Record<string, unknown>>;
}

export interface ToolsExecuteRequest extends BaseCapabilityRequest {
  readonly prompt: string;
  readonly tools: ReadonlyArray<LlmTool>;
  readonly toolChoice?: "auto" | "required" | "none";
}

export interface StructuredGenerateRequest<TData = unknown>
  extends BaseCapabilityRequest {
  readonly prompt: string;
  readonly outputSchema: ZodType<TData>;
}

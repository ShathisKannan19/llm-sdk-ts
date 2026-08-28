import type { CapabilityName } from "../enums/capability-name.js";
import type { ProviderRuntimeConfig } from "./config.js";
import type {
  AudioTranscribeRequest,
  StructuredGenerateRequest,
  SpeechSynthesizeRequest,
  TextGenerateRequest,
  ToolsExecuteRequest,
  VisionGenerateRequest,
} from "./requests.js";
import type {
  ProviderRawResponse,
  StructuredOutputResult,
  SpeechSynthesisResult,
  ToolExecutionResult,
} from "./common.js";
import type { LlmLogger } from "./logger.js";

export interface ProviderExecutionContext {
  readonly requestId: string;
  readonly model: string;
  readonly timeoutMs: number;
  readonly retries: number;
  readonly signal?: AbortSignal;
}

export interface TextProvider {
  generate(
    request: TextGenerateRequest,
    context: ProviderExecutionContext,
  ): Promise<ProviderRawResponse<string>>;
}

export interface VisionProvider {
  generate(
    request: VisionGenerateRequest,
    context: ProviderExecutionContext,
  ): Promise<ProviderRawResponse<string>>;
}

export interface AudioProvider {
  transcribe(
    request: AudioTranscribeRequest,
    context: ProviderExecutionContext,
  ): Promise<ProviderRawResponse<string>>;
}

export interface SpeechProvider {
  synthesize(
    request: SpeechSynthesizeRequest,
    context: ProviderExecutionContext,
  ): Promise<ProviderRawResponse<SpeechSynthesisResult>>;
}

export interface ToolsProvider {
  execute(
    request: ToolsExecuteRequest,
    context: ProviderExecutionContext,
  ): Promise<ProviderRawResponse<ToolExecutionResult>>;
}

export interface StructuredProvider {
  generate<TData>(
    request: StructuredGenerateRequest<TData>,
    context: ProviderExecutionContext,
  ): Promise<ProviderRawResponse<StructuredOutputResult<TData>>>;
}

export interface LlmProvider {
  readonly name: string;
  readonly text?: TextProvider;
  readonly vision?: VisionProvider;
  readonly audio?: AudioProvider;
  readonly speech?: SpeechProvider;
  readonly tools?: ToolsProvider;
  readonly structured?: StructuredProvider;
  getSupportedCapabilities(): ReadonlyArray<CapabilityName>;
}

export interface ProviderBuildContext {
  readonly name: string;
  readonly config: ProviderRuntimeConfig;
  readonly logger?: LlmLogger;
}

export type ProviderCreator = (context: ProviderBuildContext) => LlmProvider;

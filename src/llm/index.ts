export { LLM, type LlmConstructionOptions } from "./client.js";

export type { LlmConfigInput, LlmConfig, ProviderRuntimeConfig } from "./types/config.js";
export type { LlmLogger, LlmLogLevel } from "./types/logger.js";
export type {
  LlmResponse,
  LlmUsage,
  LlmFinishReason,
  LlmModelInfo,
  ProviderRawResponse,
  ToolExecutionResult,
  ToolCall,
  StructuredOutputResult,
  SpeechSynthesisResult,
} from "./types/common.js";
export type {
  BaseCapabilityRequest,
  TextGenerateRequest,
  VisionGenerateRequest,
  AudioTranscribeRequest,
  SpeechSynthesizeRequest,
  LlmTool,
  ToolsExecuteRequest,
  StructuredGenerateRequest,
} from "./types/requests.js";
export type {
  LlmProvider,
  ProviderCreator,
  ProviderBuildContext,
  ProviderExecutionContext,
  TextProvider,
  VisionProvider,
  AudioProvider,
  SpeechProvider,
  ToolsProvider,
  StructuredProvider,
} from "./types/provider.js";
export {
  LlmError,
  ConfigValidationError,
  RequestValidationError,
  ProviderNotFoundError,
  CapabilityNotSupportedError,
  ProviderExecutionError,
  TimeoutExecutionError,
  RateLimitExecutionError,
  AuthenticationExecutionError,
  InternalLlmError,
} from "./errors/llm-error.js";

export { CAPABILITY_NAMES, type CapabilityName } from "./enums/capability-name.js";

export {
  openAiProviderCreator,
  anthropicProviderCreator,
  geminiProviderCreator,
  builtInProviderCreators,
} from "./providers/index.js";

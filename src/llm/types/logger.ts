export type LlmLogLevel = "debug" | "info" | "warn" | "error";

export interface LlmLogger {
  log(level: LlmLogLevel, message: string, context?: Record<string, unknown>): void;
}

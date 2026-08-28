import type { LlmLogger } from "./logger.js";

export interface ProviderRuntimeConfig {
  readonly apiKey?: string;
  readonly baseURL?: string;
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly retries?: number;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface LlmConfigInput {
  readonly defaultProvider: string;
  readonly defaultModel?: string;
  readonly timeoutMs?: number;
  readonly retries?: number;
  readonly providers: Readonly<Record<string, ProviderRuntimeConfig>>;
  readonly logger?: LlmLogger;
}

export interface LlmConfig {
  readonly defaultProvider: string;
  readonly defaultModel?: string;
  readonly timeoutMs: number;
  readonly retries: number;
  readonly providers: Readonly<Record<string, ProviderRuntimeConfig>>;
  readonly logger?: LlmLogger;
}

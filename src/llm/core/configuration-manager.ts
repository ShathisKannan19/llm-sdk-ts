import { ZodError } from "zod";
import { ConfigValidationError } from "../errors/llm-error.js";
import { llmConfigSchema } from "../schemas/config-schema.js";
import type { LlmConfig, LlmConfigInput, ProviderRuntimeConfig } from "../types/config.js";

function freezeProviders(
  providers: Readonly<Record<string, ProviderRuntimeConfig>>,
): Readonly<Record<string, ProviderRuntimeConfig>> {
  const normalized: Record<string, ProviderRuntimeConfig> = {};

  for (const [provider, config] of Object.entries(providers)) {
    normalized[provider] = Object.freeze({ ...config });
  }

  return Object.freeze(normalized);
}

/**
 * Validates and normalizes SDK runtime configuration.
 */
export class ConfigurationManager {
  readonly config: LlmConfig;

  constructor(input: LlmConfigInput) {
    this.config = this.parse(input);
  }

  getProviderConfig(provider: string): ProviderRuntimeConfig {
    return this.config.providers[provider] ?? {};
  }

  resolveProvider(explicitProvider?: string): string {
    return explicitProvider ?? this.config.defaultProvider;
  }

  resolveModel(provider: string, explicitModel?: string): string {
    const model =
      explicitModel ??
      this.getProviderConfig(provider).model ??
      this.config.defaultModel;

    if (!model) {
      throw new ConfigValidationError(
        `No model resolved for provider '${provider}'. Set 'model' on the provider config, a top-level 'defaultModel', or pass 'model' in the request.`,
      );
    }

    return model;
  }

  resolveTimeout(provider: string, explicitTimeoutMs?: number): number {
    if (explicitTimeoutMs !== undefined) {
      return explicitTimeoutMs;
    }

    const providerTimeoutMs = this.getProviderConfig(provider).timeoutMs;
    if (providerTimeoutMs !== undefined) {
      return providerTimeoutMs;
    }

    return this.config.timeoutMs;
  }

  resolveRetries(provider: string, explicitRetries?: number): number {
    if (explicitRetries !== undefined) {
      return explicitRetries;
    }

    const providerRetries = this.getProviderConfig(provider).retries;
    if (providerRetries !== undefined) {
      return providerRetries;
    }

    return this.config.retries;
  }

  private parse(input: LlmConfigInput): LlmConfig {
    try {
      const parsed = llmConfigSchema.parse(input);

      return Object.freeze({
        defaultProvider: parsed.defaultProvider,
        defaultModel: parsed.defaultModel,
        timeoutMs: parsed.timeoutMs,
        retries: parsed.retries,
        providers: freezeProviders(parsed.providers),
        logger: parsed.logger,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ConfigValidationError("Invalid LLM configuration", error.flatten());
      }

      throw error;
    }
  }
}

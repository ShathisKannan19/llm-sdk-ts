import { ProviderNotFoundError } from "../errors/llm-error.js";
import type { ProviderRuntimeConfig } from "../types/config.js";
import type { LlmLogger } from "../types/logger.js";
import type { LlmProvider, ProviderCreator } from "../types/provider.js";
import { ProviderFactory } from "./provider-factory.js";

/**
 * Registry that tracks provider creators and lazily built provider instances.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, LlmProvider>();

  constructor(
    private readonly factory: ProviderFactory,
    private readonly providerConfigs: Readonly<Record<string, ProviderRuntimeConfig>>,
    private readonly logger?: LlmLogger,
  ) {}

  register(name: string, creator: ProviderCreator): void {
    this.factory.register(name, creator);
  }

  get(name: string): LlmProvider {
    const existing = this.providers.get(name);
    if (existing) {
      return existing;
    }

    const config = this.providerConfigs[name];
    if (!config) {
      throw new ProviderNotFoundError(name);
    }

    const provider = this.factory.create(name, config, this.logger);
    this.providers.set(name, provider);
    return provider;
  }

  hasRegisteredCreator(name: string): boolean {
    return this.factory.has(name);
  }

  initialize(name: string): void {
    this.get(name);
  }
}

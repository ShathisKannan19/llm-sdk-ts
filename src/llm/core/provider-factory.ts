import type { ProviderRuntimeConfig } from "../types/config.js";
import type { LlmLogger } from "../types/logger.js";
import type { LlmProvider, ProviderCreator } from "../types/provider.js";
import { ProviderNotFoundError } from "../errors/llm-error.js";

/**
 * Factory that creates provider instances from registered creators.
 */
export class ProviderFactory {
  private readonly creators = new Map<string, ProviderCreator>();

  register(name: string, creator: ProviderCreator): void {
    this.creators.set(name, creator);
  }

  has(name: string): boolean {
    return this.creators.has(name);
  }

  create(name: string, config: ProviderRuntimeConfig, logger?: LlmLogger): LlmProvider {
    const creator = this.creators.get(name);
    if (!creator) {
      throw new ProviderNotFoundError(name);
    }

    return creator({
      name,
      config,
      logger,
    });
  }
}

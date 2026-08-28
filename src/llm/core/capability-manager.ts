import { CapabilityNotSupportedError } from "../errors/llm-error.js";
import type { CapabilityName } from "../enums/capability-name.js";
import type { ProviderRegistry } from "./provider-registry.js";

/**
 * Central capability support checks independent of provider internals.
 */
export class CapabilityManager {
  constructor(private readonly providerRegistry: ProviderRegistry) {}

  assertSupported(providerName: string, capability: CapabilityName): void {
    const provider = this.providerRegistry.get(providerName);
    const supportedCapabilities = provider.getSupportedCapabilities();

    if (!supportedCapabilities.includes(capability)) {
      throw new CapabilityNotSupportedError(providerName, capability);
    }
  }
}

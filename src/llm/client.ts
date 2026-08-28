import { AudioCapability } from "./capabilities/audio-capability.js";
import { StructuredCapability } from "./capabilities/structured-capability.js";
import { SpeechCapability } from "./capabilities/speech-capability.js";
import { TextCapability } from "./capabilities/text-capability.js";
import { ToolsCapability } from "./capabilities/tools-capability.js";
import { VisionCapability } from "./capabilities/vision-capability.js";
import { CapabilityManager } from "./core/capability-manager.js";
import { ConfigurationManager } from "./core/configuration-manager.js";
import { ErrorMapper } from "./core/error-mapper.js";
import { ProviderFactory } from "./core/provider-factory.js";
import { ProviderRegistry } from "./core/provider-registry.js";
import { RequestRouter } from "./core/request-router.js";
import { ResponseNormalizer } from "./core/response-normalizer.js";
import { builtInProviderCreators } from "./providers/index.js";
import type { LlmConfigInput } from "./types/config.js";
import type { ProviderCreator } from "./types/provider.js";
import { defaultLlmLogger } from "./utils/default-logger.js";

export interface LlmConstructionOptions {
  readonly providers?: Readonly<Record<string, ProviderCreator>>;
}

/**
 * Stable public SDK entry point for all LLM capabilities.
 * Providers must be registered via the options parameter.
 */
export class LLM {
  readonly text: TextCapability;
  readonly vision: VisionCapability;
  readonly audio: AudioCapability;
  readonly speech: SpeechCapability;
  readonly tools: ToolsCapability;
  readonly structured: StructuredCapability;

  private readonly configurationManager: ConfigurationManager;
  private readonly providerRegistry: ProviderRegistry;

  constructor(configInput: LlmConfigInput, options?: LlmConstructionOptions) {
    this.configurationManager = new ConfigurationManager({
      ...configInput,
      logger: configInput.logger ?? defaultLlmLogger,
    });

    const providerFactory = new ProviderFactory();
    this.providerRegistry = new ProviderRegistry(
      providerFactory,
      this.configurationManager.config.providers,
      this.configurationManager.config.logger,
    );

    // Register the bundled OpenAI / Anthropic / Gemini adapters by default.
    for (const [providerName, creator] of Object.entries(builtInProviderCreators)) {
      this.providerRegistry.register(providerName, creator);
    }

    // User-supplied creators are registered last so they can override a
    // built-in adapter (or add an entirely new provider).
    if (options?.providers) {
      for (const [providerName, creator] of Object.entries(options.providers)) {
        this.providerRegistry.register(providerName, creator);
      }
    }

    const capabilityManager = new CapabilityManager(this.providerRegistry);
    const errorMapper = new ErrorMapper();
    const responseNormalizer = new ResponseNormalizer();
    const requestRouter = new RequestRouter(
      this.configurationManager,
      this.providerRegistry,
      capabilityManager,
      responseNormalizer,
      errorMapper,
      this.configurationManager.config,
    );

    this.text = new TextCapability(requestRouter);
    this.vision = new VisionCapability(requestRouter);
    this.audio = new AudioCapability(requestRouter);
    this.speech = new SpeechCapability(requestRouter);
    this.tools = new ToolsCapability(requestRouter);
    this.structured = new StructuredCapability(requestRouter);

    this.initializeProviders();
  }

  registerProvider(name: string, creator: ProviderCreator): void {
    this.providerRegistry.register(name, creator);
  }

  private initializeProviders(): void {
    const providers = Object.keys(this.configurationManager.config.providers);

    for (const providerName of providers) {
      if (this.providerRegistry.hasRegisteredCreator(providerName)) {
        this.providerRegistry.initialize(providerName);
      }
    }
  }
}

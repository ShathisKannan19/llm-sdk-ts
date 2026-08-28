import type { CapabilityName } from "../enums/capability-name.js";
import type { LlmConfig } from "../types/config.js";
import type {
  ProviderRawResponse,
  StructuredOutputResult,
} from "../types/common.js";
import type {
  AudioTranscribeRequest,
  StructuredGenerateRequest,
  SpeechSynthesizeRequest,
  TextGenerateRequest,
  ToolsExecuteRequest,
  VisionGenerateRequest,
} from "../types/requests.js";
import type { LlmProvider, ProviderExecutionContext } from "../types/provider.js";
import { ErrorMapper } from "./error-mapper.js";
import { ResponseNormalizer } from "./response-normalizer.js";
import { ProviderRegistry } from "./provider-registry.js";
import { ConfigurationManager } from "./configuration-manager.js";
import { CapabilityManager } from "./capability-manager.js";
import { createRequestId } from "../utils/request-id.js";
import type { SpeechSynthesisResult } from "../types/common.js";

const BASE_RETRY_DELAY_MS = 100;
const MAX_RETRY_DELAY_MS = 2_000;
const RETRY_JITTER_RATIO = 0.2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function computeRetryDelayMs(retryAttempt: number): number {
  const exponentialDelay = Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * (2 ** (retryAttempt - 1)));
  const jitterSpan = exponentialDelay * RETRY_JITTER_RATIO;
  const jitter = (Math.random() * 2 - 1) * jitterSpan;
  return Math.max(0, Math.round(exponentialDelay + jitter));
}

interface RouteRequest {
  readonly provider?: string;
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly retries?: number;
  readonly signal?: AbortSignal;
}

function createAbortError(): Error & { code: string } {
  const error = new Error("LLM request aborted") as Error & { code: string };
  error.name = "AbortError";
  error.code = "ABORT_ERR";
  return error;
}

async function runWithAbortSignal<T>(
  operation: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) {
    return operation;
  }

  if (signal.aborted) {
    throw createAbortError();
  }

  return await new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(createAbortError());
    };

    signal.addEventListener("abort", onAbort, { once: true });

    operation.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

/**
 * Executes validated capability requests through providers with shared lifecycle.
 */
export class RequestRouter {
  constructor(
    private readonly configurationManager: ConfigurationManager,
    private readonly providerRegistry: ProviderRegistry,
    private readonly capabilityManager: CapabilityManager,
    private readonly responseNormalizer: ResponseNormalizer,
    private readonly errorMapper: ErrorMapper,
    private readonly config: LlmConfig,
  ) {}

  routeText(request: TextGenerateRequest) {
    return this.route<string, TextGenerateRequest>("text", request, (provider, req, context) =>
      provider.text!.generate(req, context),
    );
  }

  routeVision(request: VisionGenerateRequest) {
    return this.route<string, VisionGenerateRequest>("vision", request, (provider, req, context) =>
      provider.vision!.generate(req, context),
    );
  }

  routeAudio(request: AudioTranscribeRequest) {
    return this.route<string, AudioTranscribeRequest>("audio", request, (provider, req, context) =>
      provider.audio!.transcribe(req, context),
    );
  }

  routeSpeech(request: SpeechSynthesizeRequest) {
    return this.route<SpeechSynthesisResult, SpeechSynthesizeRequest>(
      "speech",
      request,
      (provider, req, context) => provider.speech!.synthesize(req, context),
    );
  }

  routeTools<TContent>(
    request: ToolsExecuteRequest,
  ) {
    return this.route<TContent, ToolsExecuteRequest>("tools", request, (provider, req, context) =>
      provider.tools!.execute(req, context) as Promise<ProviderRawResponse<TContent>>,
    );
  }

  routeStructured<TData>(request: StructuredGenerateRequest<TData>) {
    return this.route<StructuredOutputResult<TData>, StructuredGenerateRequest<TData>>(
      "structured",
      request,
      (provider, req, context) =>
        provider.structured!.generate(req, context) as Promise<
          ProviderRawResponse<StructuredOutputResult<TData>>
        >,
    );
  }

  private async route<TContent, TRequest extends RouteRequest>(
    capability: CapabilityName,
    request: TRequest,
    execute: (
      provider: LlmProvider,
      request: TRequest,
      context: ProviderExecutionContext,
    ) => Promise<ProviderRawResponse<TContent>>,
  ) {
    const providerName = this.configurationManager.resolveProvider(request.provider);
    this.capabilityManager.assertSupported(providerName, capability);

    const requestId = createRequestId();
    const model = this.configurationManager.resolveModel(providerName, request.model);
    const retries = this.configurationManager.resolveRetries(providerName, request.retries);
    const timeoutMs = this.configurationManager.resolveTimeout(
      providerName,
      request.timeoutMs,
    );

    const provider = this.providerRegistry.get(providerName);
    const context: ProviderExecutionContext = {
      requestId,
      model,
      retries,
      timeoutMs,
      signal: request.signal,
    };

    const startedAt = Date.now();
    let retryCount = 0;

    try {
      let attempt = 0;
      while (true) {
        try {
          const raw = await runWithAbortSignal(execute(provider, request, context), request.signal);
          const normalized = this.responseNormalizer.normalize(raw, {
            requestId,
            provider: providerName,
            capability,
            model,
          });

          this.config.logger?.log("info", "llm request success", {
            provider: providerName,
            capability,
            requestId,
            durationMs: Date.now() - startedAt,
            retryCount: attempt,
            usage: normalized.usage,
          });

          return normalized;
        } catch (error) {
          if (attempt < retries && this.errorMapper.isRetryable(error)) {
            attempt += 1;
            retryCount = attempt;
            await sleep(computeRetryDelayMs(attempt));
            continue;
          }
          throw error;
        }
      }
    } catch (error) {
      const mapped = this.errorMapper.map(error, {
        provider: providerName,
        capability,
        requestId,
      });

      this.config.logger?.log("error", "llm request failed", {
        provider: providerName,
        capability,
        requestId,
        durationMs: Date.now() - startedAt,
        retryCount,
        errorCode: mapped.code,
        errorMessage: mapped.message,
      });

      throw mapped;
    }
  }
}

import type { CapabilityName } from "../enums/capability-name.js";

export type LlmErrorCode =
  | "CONFIG_VALIDATION"
  | "REQUEST_VALIDATION"
  | "PROVIDER_NOT_FOUND"
  | "CAPABILITY_NOT_SUPPORTED"
  | "PROVIDER_EXECUTION"
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "AUTHENTICATION"
  | "INTERNAL";

export interface LlmErrorContext {
  readonly provider?: string;
  readonly capability?: CapabilityName;
  readonly requestId?: string;
  readonly details?: unknown;
}

export class LlmError extends Error {
  readonly code: LlmErrorCode;
  readonly context: LlmErrorContext;

  constructor(
    message: string,
    options: {
      code: LlmErrorCode;
      context?: LlmErrorContext;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.code = options.code;
    this.context = options.context ?? {};
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ConfigValidationError extends LlmError {
  constructor(message: string, details?: unknown) {
    super(message, {
      code: "CONFIG_VALIDATION",
      context: { details },
    });
  }
}

export class RequestValidationError extends LlmError {
  constructor(capability: CapabilityName, details?: unknown) {
    super("Invalid request", {
      code: "REQUEST_VALIDATION",
      context: { capability, details },
    });
  }
}

export class ProviderNotFoundError extends LlmError {
  constructor(provider: string) {
    super(`Provider '${provider}' is not registered`, {
      code: "PROVIDER_NOT_FOUND",
      context: { provider },
    });
  }
}

export class CapabilityNotSupportedError extends LlmError {
  constructor(provider: string, capability: CapabilityName) {
    super(`Capability '${capability}' is not supported by provider '${provider}'`, {
      code: "CAPABILITY_NOT_SUPPORTED",
      context: { provider, capability },
    });
  }
}

export class ProviderExecutionError extends LlmError {
  constructor(
    message: string,
    options: {
      provider: string;
      capability: CapabilityName;
      requestId: string;
      cause?: unknown;
      details?: unknown;
    },
  ) {
    super(message, {
      code: "PROVIDER_EXECUTION",
      cause: options.cause,
      context: {
        provider: options.provider,
        capability: options.capability,
        requestId: options.requestId,
        details: options.details,
      },
    });
  }
}

export class TimeoutExecutionError extends LlmError {
  constructor(provider: string, capability: CapabilityName, requestId: string) {
    super("Provider request timed out", {
      code: "TIMEOUT",
      context: { provider, capability, requestId },
    });
  }
}

export class RateLimitExecutionError extends LlmError {
  constructor(provider: string, capability: CapabilityName, requestId: string) {
    super("Provider rate limit exceeded", {
      code: "RATE_LIMIT",
      context: { provider, capability, requestId },
    });
  }
}

export class AuthenticationExecutionError extends LlmError {
  constructor(provider: string, capability: CapabilityName, requestId: string) {
    super("Provider authentication failed", {
      code: "AUTHENTICATION",
      context: { provider, capability, requestId },
    });
  }
}

export class InternalLlmError extends LlmError {
  constructor(message = "Unexpected LLM core error", cause?: unknown) {
    super(message, {
      code: "INTERNAL",
      cause,
    });
  }
}

import {
  AuthenticationExecutionError,
  type LlmError,
  ProviderExecutionError,
  RateLimitExecutionError,
  TimeoutExecutionError,
} from "../errors/llm-error.js";
import type { CapabilityName } from "../enums/capability-name.js";

const RETRYABLE_CODES = new Set(["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED"]);

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const status = (error as { status?: unknown; statusCode?: unknown }).status;
  if (typeof status === "number") {
    return status;
  }

  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === "number" ? statusCode : undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Provider execution failed";
}

/**
 * Maps unknown provider errors into stable SDK errors.
 */
export class ErrorMapper {
  map(
    error: unknown,
    context: {
      provider: string;
      capability: CapabilityName;
      requestId: string;
    },
  ): LlmError {
    if (this.isLlmError(error)) {
      return error;
    }

    const status = getErrorStatus(error);
    const code = getErrorCode(error);

    if (status === 401 || status === 403) {
      return new AuthenticationExecutionError(
        context.provider,
        context.capability,
        context.requestId,
      );
    }

    if (status === 429) {
      return new RateLimitExecutionError(
        context.provider,
        context.capability,
        context.requestId,
      );
    }

    if (code === "ETIMEDOUT" || status === 408) {
      return new TimeoutExecutionError(
        context.provider,
        context.capability,
        context.requestId,
      );
    }

    return new ProviderExecutionError(getErrorMessage(error), {
      provider: context.provider,
      capability: context.capability,
      requestId: context.requestId,
      cause: error,
      details: {
        code,
        status,
      },
    });
  }

  isRetryable(error: unknown): boolean {
    const status = getErrorStatus(error);
    const code = getErrorCode(error);

    return status === 429 || status === 503 || (code !== undefined && RETRYABLE_CODES.has(code));
  }

  private isLlmError(error: unknown): error is LlmError {
    return error instanceof Error && "code" in error && "context" in error;
  }
}

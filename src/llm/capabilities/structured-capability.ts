import { ZodError } from "zod";
import { RequestValidationError } from "../errors/llm-error.js";
import { structuredGenerateRequestSchema } from "../schemas/request-schemas.js";
import type { LlmResponse, StructuredOutputResult } from "../types/common.js";
import type { StructuredGenerateRequest } from "../types/requests.js";
import { RequestRouter } from "../core/request-router.js";

/**
 * Structured output capability service.
 */
export class StructuredCapability {
  constructor(private readonly requestRouter: RequestRouter) {}

  async generate<TData>(
    request: StructuredGenerateRequest<TData>,
  ): Promise<LlmResponse<StructuredOutputResult<TData>>> {
    try {
      const parsedRequest = structuredGenerateRequestSchema.parse(request);
      const rawResponse = await this.requestRouter.routeStructured<TData>(
        parsedRequest as StructuredGenerateRequest<TData>,
      );

      // Enforce consumer schema at the capability boundary.
      const data = request.outputSchema.parse(rawResponse.content.data);
      return {
        ...rawResponse,
        content: {
          ...rawResponse.content,
          data,
        },
      };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new RequestValidationError("structured", error.flatten());
      }
      throw error;
    }
  }
}

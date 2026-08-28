import { ZodError } from "zod";
import { RequestValidationError } from "../errors/llm-error.js";
import { textGenerateRequestSchema } from "../schemas/request-schemas.js";
import type { LlmResponse } from "../types/common.js";
import type { TextGenerateRequest } from "../types/requests.js";
import { RequestRouter } from "../core/request-router.js";

/**
 * Text generation capability service.
 */
export class TextCapability {
  constructor(private readonly requestRouter: RequestRouter) {}

  async generate(request: TextGenerateRequest): Promise<LlmResponse<string>> {
    try {
      const parsedRequest = textGenerateRequestSchema.parse(request);
      return await this.requestRouter.routeText(parsedRequest);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new RequestValidationError("text", error.flatten());
      }
      throw error;
    }
  }
}

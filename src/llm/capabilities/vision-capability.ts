import { ZodError } from "zod";
import { RequestValidationError } from "../errors/llm-error.js";
import { visionGenerateRequestSchema } from "../schemas/request-schemas.js";
import type { LlmResponse } from "../types/common.js";
import type { VisionGenerateRequest } from "../types/requests.js";
import { RequestRouter } from "../core/request-router.js";

/**
 * Vision (image-to-text) capability service.
 */
export class VisionCapability {
  constructor(private readonly requestRouter: RequestRouter) {}

  async generate(request: VisionGenerateRequest): Promise<LlmResponse<string>> {
    try {
      const parsedRequest = visionGenerateRequestSchema.parse(request);
      return await this.requestRouter.routeVision(parsedRequest);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new RequestValidationError("vision", error.flatten());
      }
      throw error;
    }
  }
}

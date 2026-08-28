import { ZodError } from "zod";
import { RequestValidationError } from "../errors/llm-error.js";
import { toolsExecuteRequestSchema } from "../schemas/request-schemas.js";
import type { LlmResponse, ToolExecutionResult } from "../types/common.js";
import type { ToolsExecuteRequest } from "../types/requests.js";
import { RequestRouter } from "../core/request-router.js";

/**
 * Tool calling capability service.
 */
export class ToolsCapability {
  constructor(private readonly requestRouter: RequestRouter) {}

  async execute(request: ToolsExecuteRequest): Promise<LlmResponse<ToolExecutionResult>> {
    try {
      const parsedRequest = toolsExecuteRequestSchema.parse(request);
      return await this.requestRouter.routeTools<ToolExecutionResult>(parsedRequest);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new RequestValidationError("tools", error.flatten());
      }
      throw error;
    }
  }
}

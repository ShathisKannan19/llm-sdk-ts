import { ZodError } from "zod";
import { RequestValidationError } from "../errors/llm-error.js";
import { audioTranscribeRequestSchema } from "../schemas/request-schemas.js";
import type { LlmResponse } from "../types/common.js";
import type { AudioTranscribeRequest } from "../types/requests.js";
import { RequestRouter } from "../core/request-router.js";

/**
 * Audio transcription capability service.
 */
export class AudioCapability {
  constructor(private readonly requestRouter: RequestRouter) {}

  async transcribe(request: AudioTranscribeRequest): Promise<LlmResponse<string>> {
    try {
      const parsedRequest = audioTranscribeRequestSchema.parse(request);
      return await this.requestRouter.routeAudio(parsedRequest);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new RequestValidationError("audio", error.flatten());
      }
      throw error;
    }
  }
}

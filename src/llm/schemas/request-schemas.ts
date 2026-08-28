import { z } from "zod";

const baseRequestSchema = z
  .object({
    provider: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    timeoutMs: z.coerce.number().int().positive().max(120000).optional(),
    retries: z.coerce.number().int().min(0).max(5).optional(),
    signal: z.custom<AbortSignal>(
      (value) => typeof AbortSignal !== "undefined" && value instanceof AbortSignal,
      "signal must be an AbortSignal",
    ).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const textGenerateRequestSchema = baseRequestSchema
  .extend({
    prompt: z.string().min(1),
    systemPrompt: z.string().min(1).optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.coerce.number().int().positive().optional(),
  })
  .strict();

export const visionGenerateRequestSchema = baseRequestSchema
  .extend({
    input: z.string().min(1),
    images: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const audioTranscribeRequestSchema = baseRequestSchema
  .extend({
    audio: z.string().min(1),
    mimeType: z.string().min(1).optional(),
    prompt: z.string().min(1).optional(),
  })
  .strict();

export const speechSynthesizeRequestSchema = baseRequestSchema
  .extend({
    input: z.string().min(1),
    voice: z.string().min(1).optional(),
    instructions: z.string().min(1).optional(),
    format: z.enum(["mp3", "opus", "aac", "flac", "wav", "pcm"]).optional(),
    outputPath: z.string().min(1).optional(),
  })
  .strict();

const llmToolSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    inputSchema: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const toolsExecuteRequestSchema = baseRequestSchema
  .extend({
    prompt: z.string().min(1),
    tools: z.array(llmToolSchema).min(1),
    toolChoice: z.enum(["auto", "required", "none"]).default("auto"),
  })
  .strict();

export const structuredGenerateRequestSchema = baseRequestSchema
  .extend({
    prompt: z.string().min(1),
    outputSchema: z.custom<object>(
      (value) => Boolean(value) && typeof (value as { parse?: unknown }).parse === "function",
      "outputSchema must be a Zod schema",
    ),
  })
  .strict();

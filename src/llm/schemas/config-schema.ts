import { z } from "zod";

const providerRuntimeConfigSchema = z
  .object({
    apiKey: z.string().min(1).optional(),
    baseURL: z.string().url().optional(),
    model: z.string().min(1).optional(),
    timeoutMs: z.coerce.number().int().positive().max(120000).optional(),
    retries: z.coerce.number().int().min(0).max(5).optional(),
    headers: z.record(z.string(), z.string()).optional(),
  })
  .strict();

export const llmConfigSchema = z
  .object({
    defaultProvider: z.string().min(1),
    defaultModel: z.string().min(1).optional(),
    timeoutMs: z.coerce.number().int().positive().max(120000).default(30000),
    retries: z.coerce.number().int().min(0).max(5).default(1),
    providers: z.record(z.string(), providerRuntimeConfigSchema),
    logger: z
      .object({
        log: z.function({
          input: [z.string(), z.string(), z.record(z.string(), z.unknown()).optional()],
          output: z.void(),
        }),
      })
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!Object.hasOwn(value.providers, value.defaultProvider)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultProvider"],
        message: "defaultProvider must be defined in providers",
      });
    }
  });

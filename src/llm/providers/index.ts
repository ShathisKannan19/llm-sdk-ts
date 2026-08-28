import type { ProviderCreator } from "../types/provider.js";
import { openAiProviderCreator } from "./openai-provider.js";
import { anthropicProviderCreator } from "./anthropic-provider.js";
import { geminiProviderCreator } from "./gemini-provider.js";

export { openAiProviderCreator } from "./openai-provider.js";
export { anthropicProviderCreator } from "./anthropic-provider.js";
export { geminiProviderCreator } from "./gemini-provider.js";

/**
 * Adapters registered automatically by `new LLM(...)`.
 * A creator passed through `LlmConstructionOptions.providers` with the same
 * name overrides the built-in.
 */
export const builtInProviderCreators: Readonly<Record<string, ProviderCreator>> = {
  openai: openAiProviderCreator,
  anthropic: anthropicProviderCreator,
  gemini: geminiProviderCreator,
};

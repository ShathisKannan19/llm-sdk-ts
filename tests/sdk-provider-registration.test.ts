import test from "node:test";
import assert from "node:assert/strict";

import {
  LLM,
  LlmError,
  ProviderNotFoundError,
  builtInProviderCreators,
} from "../src/llm/index.js";

test("built-in provider creators are exported for openai, anthropic, gemini", () => {
  assert.deepEqual(
    Object.keys(builtInProviderCreators).sort(),
    ["anthropic", "gemini", "openai"],
  );
});

// Regression guard: `new LLM(config)` with no second argument must still be
// able to resolve the bundled adapters. Before they were auto-registered, the
// first capability call threw ProviderNotFoundError.
//
// Each adapter throws synchronously when `apiKey` is missing, so this proves
// the adapter was found and invoked without making any network call.
for (const provider of ["openai", "anthropic", "gemini"] as const) {
  test(`built-in ${provider} adapter is registered without explicit options`, async () => {
    const llm = new LLM({
      defaultProvider: provider,
      defaultModel: "test-model",
      retries: 0,
      providers: {
        [provider]: { model: "test-model" },
      },
    });

    await assert.rejects(
      () => llm.text.generate({ prompt: "ping" }),
      (error: unknown) => {
        assert.ok(error instanceof LlmError, "expected a typed LlmError");
        assert.ok(
          !(error instanceof ProviderNotFoundError),
          "adapter should be registered, not missing",
        );
        assert.equal(error.code, "PROVIDER_EXECUTION");
        assert.match(String(error.cause), /requires config\.apiKey/i);
        return true;
      },
    );
  });
}

test("a user-supplied creator overrides the built-in of the same name", async () => {
  const llm = new LLM(
    {
      defaultProvider: "openai",
      defaultModel: "test-model",
      providers: { openai: { apiKey: "test-key", model: "test-model" } },
    },
    {
      providers: {
        openai: (context) => ({
          name: context.name,
          text: {
            async generate(request, executionContext) {
              return {
                content: `override:${request.prompt}`,
                model: executionContext.model,
              };
            },
          },
          getSupportedCapabilities() {
            return ["text"] as const;
          },
        }),
      },
    },
  );

  const response = await llm.text.generate({ prompt: "hi" });
  assert.equal(response.content, "override:hi");
});

# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-08-28

### Added

- First public release.
- Unified `LLM` client with six capabilities: `text`, `vision`, `audio`
  (speech-to-text), `speech` (text-to-speech), `tools` (tool/function calling),
  and `structured` (schema-validated JSON output).
- Bundled adapters for **OpenAI**, **Anthropic**, and **Google Gemini**,
  registered automatically by `new LLM(config)`.
- Bring-your-own-provider support via the `ProviderCreator` interface and
  `new LLM(config, { providers })`; a custom creator overrides a built-in of
  the same name.
- Zod-validated configuration and per-request input validation.
- Typed error hierarchy (`LlmError` + `ConfigValidationError`,
  `RequestValidationError`, `ProviderNotFoundError`,
  `CapabilityNotSupportedError`, `ProviderExecutionError`,
  `TimeoutExecutionError`, `RateLimitExecutionError`,
  `AuthenticationExecutionError`, `InternalLlmError`), each carrying a stable
  `code` and a `context` object.
- Per-call `provider`, `model`, `timeoutMs`, `retries`, and `AbortSignal`
  overrides.
- Exponential-backoff retries with jitter for transient provider failures.
- Pluggable structured logger (`LlmLogger`).

[Unreleased]: https://github.com/ShathisKannan19/llm-sdk-ts/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/ShathisKannan19/llm-sdk-ts/releases/tag/v1.0.0

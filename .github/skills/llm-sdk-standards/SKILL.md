---
name: llm-sdk-standards
description: 'Validate and enforce the LLM SDK project engineering standards (architecture, TypeScript, validation, error handling, logging, configuration, testing, coding standards). Use when writing, reviewing, or refactoring SDK code; when asked to "check standards", "review against guidelines", "validate architecture", or before merging changes. Ensures provider-agnostic design, SOLID principles, Zod validation, centralized errors, structured logging, and strict typing.'
argument-hint: '[file or folder to validate, e.g. src/llm/capabilities/text]'
---

# LLM SDK Standards & Validation

Package of the project's engineering guidelines plus a repeatable checklist for
validating code against them. Use this whenever you author or review SDK code so
every change stays provider-agnostic, strongly typed, and production ready.

## When to Use

- Writing new capabilities, providers, schemas, or utilities in `src/llm/`.
- Reviewing or refactoring existing SDK code before committing.
- The user asks to "check standards", "validate", "review against guidelines",
  or "make sure this follows the architecture".
- Adding a new provider or capability and confirming no existing public API changes.

## Reference Guidelines

Each area has a dedicated reference doc. Load the ones relevant to the change:

| Area | Reference | Validate that... |
|------|-----------|------------------|
| Architecture | [architecture.md](./references/architecture.md) | Layers are separated; business logic never calls provider SDKs directly; new features add code rather than modify existing code. |
| TypeScript | [typescript.md](./references/typescript.md) | Strict typing; no `any`; `unknown` where needed; explicit return types; async handled safely. |
| Validation | [validation.md](./references/validation.md) | All external input validated with Zod before business logic; consistent validation errors. |
| Error handling | [error-handling.md](./references/error-handling.md) | Centralized error hierarchy; provider exceptions mapped to SDK errors; no silent catches. |
| Logging | [logging.md](./references/logging.md) | Structured logs only (pino); no `console.log`; no secrets/API keys logged. |
| Configuration | [configuration.md](./references/configuration.md) | Single config object; validated with Zod; no hardcoded secrets; sensible defaults. |
| Testing | [testing.md](./references/testing.md) | Provider SDKs mocked; capabilities independently testable; deterministic tests. |
| Coding standards | [coding-standards.md](./references/coding-standards.md) | Small focused functions; one responsibility per file/class; no duplication; kebab-case files. |

## Validation Procedure

1. **Identify scope.** Determine which files/folders changed (or the target passed
   as an argument). Read them fully before judging.
2. **Load relevant references.** From the table above, read only the docs that
   apply to the change to keep context focused.
3. **Run the checklist.** Walk through the [validation checklist](./references/validation-checklist.md)
   and record each item as Pass / Fail / N-A with a short reason.
4. **Report findings.** Group issues by severity:
   - **Blocker** — violates architecture (e.g. capability imports a provider SDK,
     raw provider error leaks, `console.log`, `any` in public API, missing Zod validation).
   - **Warning** — style or maintainability issues (long function, duplication, missing return type).
   - **Suggestion** — optional improvements.
5. **Fix or advise.** If the user asked for fixes, apply the minimal changes needed
   to reach compliance and re-validate. Otherwise list the required changes.

## Key Invariants (never violate)

- Business logic must never import or call OpenAI, Anthropic, Gemini, or any provider SDK directly.
- Providers only build requests, call the SDK, normalize responses, and map exceptions.
- Capabilities own validation, defaults, coordination, and response normalization.
- Every public method validates input with Zod and returns a unified SDK model.
- All provider errors are mapped into the SDK error hierarchy — never expose raw exceptions.
- Structured logging only; never log API keys or sensitive user data.
- Adding a provider or capability must not modify existing capability implementations.

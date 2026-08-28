# Validation Checklist

Walk through each item for the code under review. Mark **Pass**, **Fail**, or
**N/A** with a one-line reason. Any Fail on an Architecture or Error/Logging item
is a **Blocker**.

## Architecture

- [ ] Business logic does not import or call a provider SDK (OpenAI/Anthropic/Gemini) directly.
- [ ] Provider implementations only build requests, call the SDK, normalize responses, and map errors.
- [ ] Capability owns validation, defaults, coordination, and response normalization.
- [ ] New feature adds code without modifying existing capability implementations.
- [ ] Dependencies point to interfaces/abstractions, not concrete implementations.
- [ ] No circular dependencies introduced.
- [ ] Public API remains stable and provider-agnostic.

## TypeScript

- [ ] No `any`; `unknown` used where the type is genuinely unknown.
- [ ] Every exported function/method has an explicit return type.
- [ ] Discriminated unions / generics used appropriately, not overused.
- [ ] `null` and `undefined` handled explicitly; no unsafe non-null assertions (`!`).
- [ ] Only required symbols are exported; internal types stay private.
- [ ] `async/await` used; all promises awaited or handled.

## Validation

- [ ] All external input validated with Zod before any business logic runs.
- [ ] Invalid input rejected early with a consistent `ValidationError`.
- [ ] Validation schemas live close to their models and are reused, not duplicated.

## Error Handling

- [ ] Errors use the centralized SDK error hierarchy (no generic `Error` thrown to callers).
- [ ] Provider exceptions are caught and mapped to SDK errors; raw exceptions never leak.
- [ ] Error messages are actionable and expose no internal implementation details.
- [ ] Errors are caught at boundaries; nothing is silently suppressed.

## Logging

- [ ] Structured logging (pino) only — no `console.log`.
- [ ] Logs include provider, model, capability, request id, duration, retries, token usage where relevant.
- [ ] No API keys, secrets, or sensitive user data are logged.
- [ ] Appropriate log level used (debug/info/warn/error/critical).

## Configuration

- [ ] Single configuration object; no long positional argument lists.
- [ ] Configuration validated with Zod and fails fast on invalid values.
- [ ] No hardcoded secrets or environment-specific values.
- [ ] Reasonable defaults provided.

## Testing

- [ ] Provider SDKs are mocked; internal logic is not over-mocked.
- [ ] Each capability is independently testable with no hidden state.
- [ ] Tests are deterministic (no flakiness), covering critical paths, edge cases, and failures.

## Coding Standards

- [ ] Functions are small, single-purpose, and avoid deep nesting (early returns).
- [ ] One responsibility per file and per class; no "God" classes.
- [ ] No duplicated logic; shared code extracted into utilities.
- [ ] Files use kebab-case; classes PascalCase; functions camelCase; constants UPPER_SNAKE_CASE.
- [ ] Files stay within ~300–400 lines; larger ones split into modules.
- [ ] Comments explain intent only where code cannot; exported classes documented.

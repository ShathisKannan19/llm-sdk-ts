import type { LlmLogLevel, LlmLogger } from "../types/logger.js";

const REDACT_PATTERN = /(?:^|[^a-z])(api[-_]?key|token|secret|password|authorization)(?:$|[^a-z])/i;
const MAX_SANITIZE_DEPTH = 6;

function sanitizeValue(
  key: string,
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
): unknown {
  if (REDACT_PATTERN.test(key)) {
    return "[REDACTED]";
  }

  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }

  if (depth >= MAX_SANITIZE_DEPTH) {
    return "[TRUNCATED]";
  }

  if (seen.has(value)) {
    return "[CIRCULAR]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(key, entry, seen, depth + 1));
  }

  const cleanObject: Record<string, unknown> = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    cleanObject[childKey] = sanitizeValue(childKey, childValue, seen, depth + 1);
  }

  return cleanObject;
}

function sanitize(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) {
    return undefined;
  }

  const seen = new WeakSet<object>();
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    clean[key] = sanitizeValue(key, value, seen, 0);
  }

  return clean;
}

function write(level: LlmLogLevel, message: string, context?: Record<string, unknown>): void {
  const line = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...(sanitize(context) ?? {}),
  });

  const stream = level === "error" || level === "warn" ? process.stderr : process.stdout;
  stream.write(`${line}\n`);
}

export const defaultLlmLogger: LlmLogger = {
  log(level, message, context) {
    write(level, message, context);
  },
};

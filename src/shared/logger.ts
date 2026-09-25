/**
 * Minimal structured logger — one JSON object per line on stdout/stderr, which
 * is what Vercel's runtime logs and log drains index. Pure (no DB, no
 * framework), so it's safe to import from anywhere, including instrumentation.
 *
 * Redaction is on by default, not opt-in: log context goes through `redact()`
 * before serialization, so a caller who passes a whole object "for debugging"
 * can't leak an email, token, or password into a third-party log store.
 * Prefer IDs (userId, uploadId) over personal fields in log context anyway.
 */

type Level = "info" | "warn" | "error";
export type LogContext = Record<string, unknown>;

const REDACTED = "[redacted]";

/** Keys whose values are personal data or secrets — matched case-insensitively as substrings. */
const SENSITIVE_KEY_RE =
  /email|password|passwd|secret|token|authorization|cookie|session|phone|name|address|code|otp|apikey|api_key|dsn/i;
/** ID-shaped keys that contain a sensitive substring but are safe to log. */
const SAFE_KEYS = new Set(["userId", "uploadId", "experienceId", "matchId", "groupId", "requestId", "digest", "routeType", "routePath", "method", "path"]);

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;

function redactString(value: string): string {
  return value.replace(EMAIL_RE, "[email]").replace(BEARER_RE, "Bearer [redacted]");
}

function serializeError(error: Error, depth: number): LogContext {
  const out: LogContext = { name: error.name, message: redactString(error.message) };
  if (error.stack) out.stack = redactString(error.stack);
  const code = (error as NodeJS.ErrnoException).code;
  if (typeof code === "string") out.code = code;
  if ("digest" in error && typeof error.digest === "string") out.digest = error.digest;
  if (error.cause !== undefined && depth < 3) out.cause = redact(error.cause, depth + 1);
  return out;
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[truncated]";
  if (typeof value === "string") return redactString(value);
  if (value instanceof Error) return serializeError(value, depth);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value && typeof value === "object") {
    const out: LogContext = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = !SAFE_KEYS.has(key) && SENSITIVE_KEY_RE.test(key) ? REDACTED : redact(inner, depth + 1);
    }
    return out;
  }
  return value;
}

export function formatLogLine(level: Level, message: string, context?: LogContext): string {
  const redacted = context ? (redact(context) as LogContext) : {};
  return JSON.stringify({ level, time: new Date().toISOString(), msg: redactString(message), ...redacted });
}

function write(level: Level, message: string, context?: LogContext): void {
  const line = formatLogLine(level, message, context);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context),
};

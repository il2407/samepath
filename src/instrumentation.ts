import type { Instrumentation } from "next";
import { logger } from "@/shared/logger";

/**
 * Next.js calls this for every uncaught server error (Server Components,
 * route handlers, Server Actions, proxy). It's the single place unhandled
 * errors get a structured log line; the `digest` matches the reference the
 * user sees on the error page, so a support report can be traced back here.
 *
 * The query string is dropped — it can carry tokens (magic links, OAuth
 * `code`) — and headers/body are never logged.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  logger.error("unhandled request error", {
    error,
    digest: error instanceof Error && "digest" in error ? error.digest : undefined,
    method: request.method,
    path: request.path.split("?")[0],
    routePath: context.routePath,
    routeType: context.routeType,
    routerKind: context.routerKind,
  });
};

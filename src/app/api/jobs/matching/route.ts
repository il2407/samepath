import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/shared/env";
import { runMatchingJob } from "@/modules/matching/job";
import { isAuthorizedRequest } from "@/modules/matching/scheduler-auth";

/**
 * Scheduler-triggered endpoint for the automatic matching job — see
 * docs/scheduled-jobs.md for how to call this locally (curl) and how a real
 * deployment should wire an external cron service to it. This route itself
 * intentionally contains no scheduling logic (no interval, no timer, no
 * queue) — per this codebase's existing "interface + documented real-world
 * adapter, fake/local impl only" pattern (Mailer/Storage/PaymentProvider),
 * the adapter here is simply "the operator configures an external HTTP-
 * calling scheduler"; nothing about *when* to call this is decided in code.
 *
 * Auth: NOT session-based, unlike every other route in this app — the
 * caller is an external scheduler (a cron service, a deploy-pipeline curl),
 * not a logged-in browser, so there is no session to check (contrast
 * src/app/api/account/export/route.ts). Instead this checks a shared
 * secret (JOB_SCHEDULER_SECRET) against either an `Authorization: Bearer
 * <secret>` header or a plain `x-job-scheduler-secret` header — see
 * matching/scheduler-auth.ts (a pure, separately-unit-tested module) for
 * the actual comparison. A missing/misconfigured secret (empty string, the
 * default) makes every request fail closed with 401 — it never silently
 * "allows all" just because nobody's set it up yet.
 */

async function handleTrigger(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedRequest(request.headers, env.JOB_SCHEDULER_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runMatchingJob();

    if (summary.status === "SKIPPED_ALREADY_RUNNING") {
      // Not an error — this is the overlap guard working as intended. 409
      // Conflict lets a monitoring dashboard tell "another run owns this
      // right now" apart from a real failure without parsing the body.
      return NextResponse.json(summary, { status: 409 });
    }
    if (summary.status === "FAILURE") {
      return NextResponse.json(summary, { status: 500 });
    }
    return NextResponse.json(summary, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "job execution failed", detail: err instanceof Error ? err.message : "unknown error" },
      { status: 500 },
    );
  }
}

// Both methods are accepted and behave identically: POST is the more
// semantically correct verb for "trigger a job execution" (this is not an
// idempotent, cacheable read), but plenty of simple cron/webhook services
// can only issue GET requests, so GET is supported too for compatibility.
// See docs/scheduled-jobs.md for examples of both.
export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleTrigger(request);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleTrigger(request);
}

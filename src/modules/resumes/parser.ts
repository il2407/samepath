import "server-only";
import { env } from "@/shared/env";
import { parseResumeText, type ExtractedResumeText, type KnownLabel } from "@/modules/resumes/deterministic-parser";

/**
 * Everything a ResumeParser needs to resolve free text into this
 * deployment's actual reference-data taxonomy (skills/domains, languages,
 * target roles, regions). Passed in by the caller (resumes/service.ts, which
 * already owns the Prisma queries) rather than looked up internally, so a
 * parser implementation never needs its own DB access — deterministic or
 * AI-backed, it's just given text in and structured labels out.
 */
export interface ResumeParserContext {
  knownTags: KnownLabel[];
  knownLanguages: KnownLabel[];
  knownTargetRoles: KnownLabel[];
  knownRegions: KnownLabel[];
}

/**
 * Provider-agnostic résumé structured-extraction boundary — the same shape
 * as this codebase's other swappable adapters (`Mailer`, `Storage`,
 * `PaymentProvider`, `MalwareScanner`): a small interface, a real wired
 * default implementation, and a documented (not silently missing) path to a
 * fancier one. Selected via `RESUME_PARSER` (`.env.example`), exactly like
 * `MAIL_ADAPTER`/`STORAGE_ADAPTER` select their own implementations.
 *
 * ## Evaluation: deterministic vs. AI-backed extraction
 *
 * Options considered — deterministic regex/heuristic parsing (this file's
 * wired implementation), a local/self-hosted AI model, an in-browser AI
 * model, the Claude API, and a hybrid (deterministic first, AI for the
 * fields it left empty). Full writeup: `docs/resume-extraction-approach.md`
 * (includes the OCR/scanned-PDF evaluation too). Summary:
 *
 * - **Cost & latency**: deterministic parsing is free and runs in
 *   milliseconds, inline in the same request that already has to handle the
 *   upload — consistent with this codebase's "no background job queue, run
 *   due-date work inline" architecture (`docs/architecture-decisions.md`
 *   #9). Every AI option adds real per-request latency (seconds) and, for a
 *   hosted API, a per-call cost with no billing/plan model in this MVP to
 *   absorb it.
 * - **Privacy**: the product's own premise is discretion (README: "a
 *   discreet professional community"). Sending a résumé's employment
 *   history, titles, and dates to a third-party AI API is a real privacy
 *   cost the deterministic parser (which never leaves this process) simply
 *   doesn't have — `ResumeUploadCard` already tells users their file "is
 *   not sent to any third-party service"; a real AI call would make that
 *   false.
 * - **Accuracy**: an AI parser would likely do better on messy/unusual
 *   résumés and could plausibly fill fields the deterministic parser
 *   structurally can't (education, a genuinely abstractive summary) — a
 *   real advantage, not a strawman. But every extraction here is a *draft*
 *   the user reviews before it ever touches their real profile
 *   (`ResumeDraftReview` → `ProfileStepOneForm`), so the deterministic
 *   parser's lower recall just costs the user "fill in one more field,"
 *   while an AI parser's failure mode is a wrong-looking, *confident* value
 *   that's easier to skim past unverified — a worse failure mode for a
 *   product whose match quality depends on people trusting the data
 *   (see the account-wide "never present hallucinated information as fact"
 *   rule this module also follows). Deterministic parsing is also
 *   exhaustively unit-testable with zero mocked network calls and never
 *   crashes or degrades unpredictably on adversarial/malformed input.
 * - **On-device/in-browser AI**: solves the privacy objection but means
 *   shipping a real inference runtime (client-side model download, or a
 *   server-side one) — genuine new infra/ops this MVP's "no second process
 *   to operate" philosophy explicitly avoids elsewhere.
 * - **Hybrid**: the most promising *future* direction — keep the common
 *   case free/local/instant, and only pay AI cost + latency + privacy
 *   exposure for the fields the deterministic pass left empty (education, a
 *   real summary) on résumés that need it. Not implemented here: it still
 *   needs a real provider, a budget, and an explicit user-facing disclosure
 *   ("this field was filled in with the help of an AI service") that
 *   doesn't exist in this MVP.
 *
 * **Recommendation**: keep deterministic as the wired default; invest
 * further effort in its heuristics and test coverage (this pass added
 * target-role, region, and short-intro-summary detection — see
 * `deterministic-parser.ts`) rather than reaching for AI. `AiResumeParser`
 * below is a documented, swappable placeholder for whenever a real
 * provider, a budget, and a privacy-disclosure story exist — matching
 * `RESUME_AI_API_KEY`'s existing placeholder in `.env.example`. It is not
 * wired to anything network-capable, and this pass adds no AI-provider
 * dependency.
 */
export interface ResumeParser {
  parse(text: string, context: ResumeParserContext): ExtractedResumeText | Promise<ExtractedResumeText>;
}

/** The real, wired implementation — see the module doc comment above for why. */
class DeterministicResumeParser implements ResumeParser {
  parse(text: string, context: ResumeParserContext): ExtractedResumeText {
    return parseResumeText(text, context.knownTags, context.knownLanguages, context.knownTargetRoles, context.knownRegions);
  }
}

/**
 * Documented, NOT wired, NOT network-capable placeholder — throws on
 * construction exactly like `S3Storage` (`src/shared/storage.ts`) throws
 * until a real implementation exists, rather than silently returning empty
 * or fabricated data. This means flipping `RESUME_PARSER=ai` before a real
 * implementation exists fails loudly and immediately instead of causing a
 * silent accuracy regression (or, worse, a real API call nobody reviewed).
 *
 * To make this real: implement `parse()` against an actual provider (e.g.
 * the Claude API — see `docs/resume-extraction-approach.md`), read the key
 * from `env.RESUME_AI_API_KEY`, add a user-facing disclosure that an AI
 * service saw the résumé's content, and get an explicit product decision to
 * enable it — this is a real privacy-relevant capability change, not a
 * drop-in swap.
 */
class AiResumeParser implements ResumeParser {
  constructor() {
    throw new Error(
      "AiResumeParser is not implemented. See the ResumeParser doc comment in src/modules/resumes/parser.ts " +
        "and docs/resume-extraction-approach.md before wiring RESUME_PARSER=ai to anything real.",
    );
  }
  parse(): ExtractedResumeText {
    throw new Error("unreachable");
  }
}

let parser: ResumeParser | null = null;

export function getResumeParser(): ResumeParser {
  if (!parser) {
    parser = env.RESUME_PARSER === "ai" ? new AiResumeParser() : new DeterministicResumeParser();
  }
  return parser;
}

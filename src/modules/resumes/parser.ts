import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/shared/env";
import {
  parseResumeText,
  extractPhoneGuess,
  extractLinkedInGuess,
  type ExtractedResumeText,
  type CandidatePosition,
  type KnownLabel,
} from "@/modules/resumes/deterministic-parser";

/**
 * Everything a ResumeParser needs to resolve free text into this
 * deployment's actual reference-data taxonomy (skills/domains, target roles,
 * regions). Passed in by the caller (resumes/service.ts, which
 * already owns the Prisma queries) rather than looked up internally, so a
 * parser implementation never needs its own DB access — deterministic or
 * AI-backed, it's just given text in and structured labels out.
 */
export interface ResumeParserContext {
  knownTags: KnownLabel[];
  knownTargetRoles: KnownLabel[];
  knownRegions: KnownLabel[];
}

/**
 * Provider-agnostic résumé structured-extraction boundary — the same shape
 * as this codebase's other swappable adapters (`Mailer`, `Storage`,
 * `PaymentProvider`, `MalwareScanner`): a small interface, a real wired
 * default implementation, and a documented alternative. Selected via
 * `RESUME_PARSER` (`.env.example`), exactly like `MAIL_ADAPTER`/
 * `STORAGE_ADAPTER` select their own implementations.
 *
 * Wired default is `AiResumeParser` (Claude API, tool-use for structured
 * output) — a product decision to fully replace the deterministic parser for
 * every upload, in exchange for handling the wide variety of real-world
 * résumé layouts far better than a fixed set of regexes can. This does send
 * the résumé's text content to Anthropic's API; `ResumeUploadCard`'s
 * in-product copy reflects that. `DeterministicResumeParser` (regex/heuristic,
 * no network call, see `deterministic-parser.ts`) remains available and
 * fully tested — set `RESUME_PARSER=deterministic` to use it instead, e.g.
 * for an environment with no `RESUME_AI_API_KEY` or that wants zero
 * third-party data exposure. Full evaluation of the tradeoffs:
 * `docs/resume-extraction-approach.md`.
 *
 * Every extraction — deterministic or AI — is still only ever a *draft* the
 * user reviews and can freely edit before it touches a real profile
 * (`ResumeDraftReview` → `ProfileStepOneForm`); nothing here is applied
 * automatically. `AiResumeParser` additionally constrains every matched
 * tag/target-role/region id to the known-label sets passed in via
 * `ResumeParserContext` (ids outside those sets are dropped, not trusted),
 * so it can suggest free-text fields (company, title, a summary sentence)
 * but can never invent a reference-data id that doesn't exist — matching the
 * account-wide "never present hallucinated information as fact" rule.
 */
export interface ResumeParser {
  parse(text: string, context: ResumeParserContext): ExtractedResumeText | Promise<ExtractedResumeText>;
}

/** No-network fallback/alternative — see the module doc comment above for when to use it instead. */
class DeterministicResumeParser implements ResumeParser {
  parse(text: string, context: ResumeParserContext): ExtractedResumeText {
    return parseResumeText(text, context.knownTags, context.knownTargetRoles, context.knownRegions);
  }
}

// Same caps as the deterministic parser (deterministic-parser.ts) — applied
// here too so a verbose AI response can't blow past what the profile-review
// UI is designed to render, and so prompts stay bounded regardless of how
// many active tags/roles/regions this deployment ends up with.
const MAX_POSITIONS = 8;
const MAX_MATCHED_TAGS = 15;
const MAX_MATCHED_TARGET_ROLES = 4;
// A résumé this long is already far past anything realistic; truncating
// protects against pathological input inflating request cost/latency rather
// than reflecting any real document we expect to see.
const MAX_INPUT_CHARS = 20_000;

const AI_MODEL = "claude-sonnet-5";

const EXTRACTION_TOOL_NAME = "extract_resume_data";

function labelListForPrompt(labels: KnownLabel[]): string {
  return labels.map((l) => `${l.id}: ${l.labelHe} / ${l.labelEn}`).join("\n");
}

function buildExtractionTool(context: ResumeParserContext): Anthropic.Tool {
  return {
    name: EXTRACTION_TOOL_NAME,
    description:
      "Records structured data extracted from a résumé's text: employment history, current role, and any of the given " +
      "known skill/domain, target-role, and region labels that genuinely appear in the résumé.",
    input_schema: {
      type: "object",
      properties: {
        positions: {
          type: "array",
          description: "Employment history, most recent first. Omit positions you can't find a real company and title for — never invent one.",
          items: {
            type: "object",
            properties: {
              companyRaw: { type: "string", description: "Employer name exactly as written in the résumé." },
              title: { type: "string", description: "Job title exactly as written in the résumé." },
              startYear: { type: "integer" },
              startMonth: { type: "integer", description: "1-12. Use 1 if only a year is given." },
              endYear: { type: ["integer", "null"], description: "null if this is the current/ongoing position." },
              endMonth: { type: ["integer", "null"] },
              isCurrent: { type: "boolean", description: "True only if the résumé explicitly marks this as present/ongoing (e.g. \"present\", \"כיום\", \"הווה\")." },
            },
            required: ["companyRaw", "title", "startYear", "startMonth", "endYear", "endMonth", "isCurrent"],
          },
        },
        currentRoleTitleGuess: {
          type: ["string", "null"],
          description: "The title of the current/most recent position, or null if unclear.",
        },
        matchedTagIds: {
          type: "array",
          items: { type: "string" },
          description: `Ids (from the list below, verbatim — never a label or an invented id) of skills/domains genuinely evidenced by the résumé:\n${labelListForPrompt(context.knownTags)}`,
        },
        matchedTargetRoleIds: {
          type: "array",
          items: { type: "string" },
          description: `Ids (from the list below, verbatim) of target roles this résumé's experience matches:\n${labelListForPrompt(context.knownTargetRoles)}`,
        },
        matchedRegionId: {
          type: ["string", "null"],
          description: `Id (from the list below, verbatim) of the single best-matching region the candidate is based in/near, or null if none is indicated:\n${labelListForPrompt(context.knownRegions)}`,
        },
        shortIntroGuess: {
          type: ["string", "null"],
          description:
            "A single sentence (max 400 characters), in the résumé's own language, drawn from an existing self-written " +
            "summary/about-me section — not composed or paraphrased by you. null if the résumé has no such section.",
        },
        aiSummaryGuess: {
          type: ["string", "null"],
          description:
            "A single warm, light, casual-sounding sentence (max 400 characters), written in first person, ALWAYS in " +
            "Hebrew regardless of what language the résumé itself is written in — this text is shown directly to other " +
            "real users on a professional-matching profile, so it must read like a natural, friendly Hebrew " +
            "self-introduction a person would actually write about themselves, not a stiff translated résumé summary. " +
            "Unlike shortIntroGuess, this one you DO compose/paraphrase yourself (in Hebrew) based on the résumé's " +
            "overall content (role, experience, focus areas) — it does not need to be quoted from an existing summary " +
            "section, and does not need to preserve the résumé's original wording or language. Still ground it only in " +
            "what the résumé actually supports; null if the résumé is too sparse to responsibly compose one.",
        },
        fullNameGuess: {
          type: ["string", "null"],
          description: "The candidate's full name, exactly as written in the résumé (e.g. a header line or a \"Name:\" label). null if not stated.",
        },
        phoneGuess: {
          type: ["string", "null"],
          description: "The candidate's phone number exactly as written in the résumé. null if none is present.",
        },
        linkedInUrlGuess: {
          type: ["string", "null"],
          description: "The candidate's LinkedIn profile URL exactly as written in the résumé. null if none is present.",
        },
      },
      required: [
        "positions",
        "currentRoleTitleGuess",
        "matchedTagIds",
        "matchedTargetRoleIds",
        "matchedRegionId",
        "shortIntroGuess",
        "aiSummaryGuess",
        "fullNameGuess",
        "phoneGuess",
        "linkedInUrlGuess",
      ],
    },
  };
}

const SYSTEM_PROMPT =
  "You extract structured data from résumé/CV text for a job-matching product. Only report information that is " +
  "actually present in the text — never infer, guess, or fabricate a company, title, date, or skill that isn't " +
  "there. When uncertain, omit the field (use null or leave it out of an array) rather than guessing. Every id you " +
  "return for a matched tag/target-role/region must be copied verbatim from the id list given for that " +
  "field — never a label, and never an id you weren't given.";

function isKnownId(id: unknown, labels: KnownLabel[]): id is string {
  return typeof id === "string" && labels.some((l) => l.id === id);
}

function coercePosition(raw: unknown): CandidatePosition | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.companyRaw !== "string" || !p.companyRaw.trim()) return null;
  if (typeof p.title !== "string") return null;
  if (typeof p.startYear !== "number" || typeof p.startMonth !== "number") return null;
  return {
    companyRaw: p.companyRaw.trim(),
    title: p.title.trim(),
    startYear: p.startYear,
    startMonth: Math.min(12, Math.max(1, p.startMonth)),
    endYear: typeof p.endYear === "number" ? p.endYear : null,
    endMonth: typeof p.endMonth === "number" ? Math.min(12, Math.max(1, p.endMonth)) : null,
    isCurrent: p.isCurrent === true,
  };
}

/** Turns the tool-use input Claude returned into a trustworthy ExtractedResumeText — every array/id is capped and validated against the known-label sets rather than trusted as-is (the tool schema and system prompt constrain the model, this is the actual enforcement). */
function toExtractedResumeText(input: unknown, context: ResumeParserContext): ExtractedResumeText {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  const positions = (Array.isArray(raw.positions) ? raw.positions : [])
    .map(coercePosition)
    .filter((p): p is CandidatePosition => p !== null)
    .slice(0, MAX_POSITIONS);

  const matchedTagIds = [
    ...new Set((Array.isArray(raw.matchedTagIds) ? raw.matchedTagIds : []).filter((id) => isKnownId(id, context.knownTags))),
  ].slice(0, MAX_MATCHED_TAGS);

  const matchedTargetRoleIds = [
    ...new Set(
      (Array.isArray(raw.matchedTargetRoleIds) ? raw.matchedTargetRoleIds : []).filter((id) =>
        isKnownId(id, context.knownTargetRoles),
      ),
    ),
  ].slice(0, MAX_MATCHED_TARGET_ROLES);

  const matchedRegionId = isKnownId(raw.matchedRegionId, context.knownRegions) ? raw.matchedRegionId : null;

  const shortIntroGuess = typeof raw.shortIntroGuess === "string" && raw.shortIntroGuess.trim() ? raw.shortIntroGuess.trim().slice(0, 400) : null;

  const aiSummaryGuess = typeof raw.aiSummaryGuess === "string" && raw.aiSummaryGuess.trim() ? raw.aiSummaryGuess.trim().slice(0, 400) : null;

  const currentRoleTitleGuess = typeof raw.currentRoleTitleGuess === "string" && raw.currentRoleTitleGuess.trim() ? raw.currentRoleTitleGuess.trim() : null;

  const fullNameGuess = typeof raw.fullNameGuess === "string" && raw.fullNameGuess.trim() ? raw.fullNameGuess.trim().slice(0, 100) : null;

  // Re-validate against the same strict digit-pattern/URL-pattern checks the
  // deterministic parser uses, rather than trusting Claude's raw string
  // as-is — the model can copy a number/URL wrong just as easily as it can
  // fabricate one, and these fields are treated as sensitive by the privacy
  // engine once shared.
  const phoneGuess = typeof raw.phoneGuess === "string" ? extractPhoneGuess(raw.phoneGuess) : null;
  const linkedInUrlGuess = typeof raw.linkedInUrlGuess === "string" ? extractLinkedInGuess(raw.linkedInUrlGuess) : null;

  return {
    positions,
    currentRoleTitleGuess,
    matchedTagIds,
    matchedTargetRoleIds,
    matchedRegionId,
    shortIntroGuess,
    aiSummaryGuess,
    fullNameGuess,
    phoneGuess,
    linkedInUrlGuess,
  };
}

/**
 * The wired default: sends the résumé's plain text (plus this deployment's
 * known label lists) to the Claude API and asks it to call
 * `extract_resume_data` (tool-use / forced function-calling) with structured
 * output, rather than parsing free-form prose — see the module doc comment
 * above for the privacy/accuracy tradeoff this represents and
 * `docs/resume-extraction-approach.md` for the full comparison.
 *
 * The Anthropic client is injectable (constructor param) purely so tests can
 * supply a fake with no real network call — mirroring how `MalwareScanner`/
 * `Storage` are structured for testability elsewhere in this codebase.
 */
export class AiResumeParser implements ResumeParser {
  constructor(private readonly client: Anthropic = new Anthropic({ apiKey: env.RESUME_AI_API_KEY })) {}

  async parse(text: string, context: ResumeParserContext): Promise<ExtractedResumeText> {
    const truncated = text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;

    const response = await this.client.messages.create({
      model: AI_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [buildExtractionTool(context)],
      tool_choice: { type: "tool", name: EXTRACTION_TOOL_NAME },
      messages: [{ role: "user", content: `Résumé text:\n\n${truncated}` }],
    });

    const toolUse = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
    if (!toolUse) throw new Error("AiResumeParser: Claude response contained no tool_use block");

    return toExtractedResumeText(toolUse.input, context);
  }
}

let parser: ResumeParser | null = null;

export function getResumeParser(): ResumeParser {
  if (!parser) {
    parser = env.RESUME_PARSER === "deterministic" ? new DeterministicResumeParser() : new AiResumeParser();
  }
  return parser;
}

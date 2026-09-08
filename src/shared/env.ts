import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters (use a random hex string)"),

  // Key material for encrypting stored Google OAuth refresh tokens at rest
  // (see src/modules/auth/crypto.ts#encryptSecret) — separate from
  // SESSION_SECRET since it protects a different class of secret and needs
  // to stay stable even if SESSION_SECRET is ever rotated (rotating it would
  // strand every stored refresh token, forcing every user to reconnect).
  GOOGLE_TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(32, "GOOGLE_TOKEN_ENCRYPTION_KEY must be at least 32 characters (use a random hex string)")
    .optional()
    .default("dev-only-insecure-google-token-encryption-key-change-me"),

  MAIL_ADAPTER: z.enum(["console", "smtp"]).default("console"),
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASSWORD: z.string().optional().default(""),
  MAIL_FROM: z.string().default("SamePath <no-reply@samepath.local>"),

  STORAGE_ADAPTER: z.enum(["local", "s3"]).default("local"),
  S3_ENDPOINT: z.string().optional().default(""),
  S3_REGION: z.string().optional().default("auto"),
  S3_BUCKET: z.string().optional().default(""),
  S3_ACCESS_KEY_ID: z.string().optional().default(""),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(""),

  PAYMENT_PROVIDER: z.enum(["fake"]).default("fake"),

  GOOGLE_OAUTH_ADAPTER: z.enum(["fake", "google"]).default("google"),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),

  RESUME_PARSER: z.enum(["deterministic", "ai"]).default("deterministic"),
  RESUME_AI_API_KEY: z.string().optional().default(""),

  RATE_LIMIT_ADAPTER: z.enum(["memory"]).default("memory"),

  // Shared secret an external scheduler presents to POST/GET
  // /api/jobs/matching. Optional at the env-schema level (so environments
  // that haven't set it up yet don't fail validation) but the route itself
  // refuses every request with 401 while this is empty — see
  // src/app/api/jobs/matching/route.ts and docs/scheduled-jobs.md.
  JOB_SCHEDULER_SECRET: z.string().optional().default(""),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration. Check .env against .env.example:\n${issues}`,
    );
  }
  return parsed.data;
}

// Validated once at module load; every module should import `env` from here
// instead of reading `process.env` directly.
export const env = loadEnv();

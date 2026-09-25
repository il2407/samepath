-- Language is no longer a matching/profile/group factor anywhere in the app.

-- Scoring bucket is now timezone + connection style only; keep existing values.
ALTER TABLE "match_score_breakdowns" RENAME COLUMN "languageScore" TO "styleScore";

-- Groups
ALTER TABLE "groups" DROP CONSTRAINT "groups_languageId_fkey";
ALTER TABLE "groups" DROP COLUMN "languageId";

-- Profiles
DROP TABLE "profile_languages";

-- Reference data
DROP TABLE "languages";

-- AlterTable
ALTER TABLE "identity_disclosure_preferences" DROP COLUMN "preMatchDisplayMode",
DROP COLUMN "aliasText",
DROP COLUMN "firstName";

-- DropEnum
DROP TYPE "DisplayNamePreference";

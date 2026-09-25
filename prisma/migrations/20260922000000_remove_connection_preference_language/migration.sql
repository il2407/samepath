-- DropForeignKey
ALTER TABLE "connection_preferences" DROP CONSTRAINT "connection_preferences_languageId_fkey";

-- AlterTable
ALTER TABLE "connection_preferences" DROP COLUMN "languageId";

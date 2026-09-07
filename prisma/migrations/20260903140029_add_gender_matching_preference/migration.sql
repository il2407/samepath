-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "GenderPreference" AS ENUM ('MALE', 'FEMALE', 'BOTH');

-- AlterTable
ALTER TABLE "connection_preferences" ADD COLUMN     "genderPreference" "GenderPreference" NOT NULL DEFAULT 'BOTH';

-- AlterTable
ALTER TABLE "professional_profiles" ADD COLUMN     "gender" "Gender";

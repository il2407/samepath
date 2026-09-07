-- AlterEnum
ALTER TYPE "AuthProviderType" ADD VALUE 'GOOGLE';

-- AlterEnum
ALTER TYPE "VerificationPurpose" ADD VALUE 'PASSWORD_RESET';

-- AlterTable
ALTER TABLE "email_verifications" DROP COLUMN "codeHash";

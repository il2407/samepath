-- CreateEnum
CREATE TYPE "GuideStepRole" AS ENUM ('PRESENTER', 'LISTENER', 'BOTH');

-- AlterTable
ALTER TABLE "connections" ADD COLUMN     "selectedGuideId" TEXT;

-- AlterTable
ALTER TABLE "session_guide_steps" ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "role" "GuideStepRole" NOT NULL DEFAULT 'BOTH';

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_selectedGuideId_fkey" FOREIGN KEY ("selectedGuideId") REFERENCES "session_guides"("id") ON DELETE SET NULL ON UPDATE CASCADE;

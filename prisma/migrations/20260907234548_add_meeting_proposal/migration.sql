-- CreateEnum
CREATE TYPE "MeetingProposalStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'DECLINED', 'COUNTER_PROPOSED');

-- CreateTable
CREATE TABLE "meeting_proposals" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "status" "MeetingProposalStatus" NOT NULL DEFAULT 'PROPOSED',
    "proposedByUserId" TEXT NOT NULL,
    "respondedByUserId" TEXT,
    "respondedAt" TIMESTAMP(3),
    "sessionType" "ConnectionReason",
    "meetLink" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "previousProposalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meeting_proposals_previousProposalId_key" ON "meeting_proposals"("previousProposalId");

-- CreateIndex
CREATE INDEX "meeting_proposals_connectionId_createdAt_idx" ON "meeting_proposals"("connectionId", "createdAt");

-- AddForeignKey
ALTER TABLE "meeting_proposals" ADD CONSTRAINT "meeting_proposals_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_proposals" ADD CONSTRAINT "meeting_proposals_proposedByUserId_fkey" FOREIGN KEY ("proposedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_proposals" ADD CONSTRAINT "meeting_proposals_respondedByUserId_fkey" FOREIGN KEY ("respondedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_proposals" ADD CONSTRAINT "meeting_proposals_previousProposalId_fkey" FOREIGN KEY ("previousProposalId") REFERENCES "meeting_proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ConnectionReason" ADD VALUE 'PROJECT_PITCH';
ALTER TYPE "ConnectionReason" ADD VALUE 'BEHAVIORAL_INTERVIEW';
ALTER TYPE "ConnectionReason" ADD VALUE 'MENTAL_SUPPORT';

-- CreateTable
CREATE TABLE "connection_session_type_selections" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionTypes" "ConnectionReason"[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connection_session_type_selections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "connection_session_type_selections_connectionId_userId_key" ON "connection_session_type_selections"("connectionId", "userId");

-- AddForeignKey
ALTER TABLE "connection_session_type_selections" ADD CONSTRAINT "connection_session_type_selections_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_session_type_selections" ADD CONSTRAINT "connection_session_type_selections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

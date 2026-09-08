-- CreateEnum
CREATE TYPE "IntroMeetingStance" AS ENUM ('REQUIRED', 'NOT_REQUIRED');

-- CreateTable
CREATE TABLE "connection_intro_requirements" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stance" "IntroMeetingStance" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connection_intro_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "connection_intro_requirements_connectionId_userId_key" ON "connection_intro_requirements"("connectionId", "userId");

-- AddForeignKey
ALTER TABLE "connection_intro_requirements" ADD CONSTRAINT "connection_intro_requirements_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_intro_requirements" ADD CONSTRAINT "connection_intro_requirements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

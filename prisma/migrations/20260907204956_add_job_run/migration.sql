-- CreateEnum
CREATE TYPE "JobRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILURE');

-- CreateTable
CREATE TABLE "job_runs" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "status" "JobRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "usersProcessed" INTEGER NOT NULL DEFAULT 0,
    "matchesCreated" INTEGER NOT NULL DEFAULT 0,
    "notificationsSent" INTEGER NOT NULL DEFAULT 0,
    "failedUserCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" VARCHAR(4000),

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_runs_jobName_status_idx" ON "job_runs"("jobName", "status");

-- CreateIndex
CREATE INDEX "job_runs_jobName_startedAt_idx" ON "job_runs"("jobName", "startedAt");

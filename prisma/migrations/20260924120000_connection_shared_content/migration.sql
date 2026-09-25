ALTER TABLE "connections" ADD COLUMN "pendingContentKey" TEXT, ADD COLUMN "contentProposedBy" TEXT, ADD COLUMN "agreedContentKey" TEXT, ADD COLUMN "contentRevision" INTEGER NOT NULL DEFAULT 0;

-- AlterEnum
ALTER TYPE "ConnectionReason" ADD VALUE 'INTRO_VIDEO_CALL';

-- DataMigration
-- Recategorizes the pre-existing "היכרות ראשונה" guide (seed id
-- seed-guide-first-meeting) from its old free-text category "היכרות" into
-- the "intro" practice-session category, so it's the guide auto-suggested
-- when a connection picks the new INTRO_VIDEO_CALL session type (see
-- prisma/seed/guides.ts and src/modules/connections/ConnectionRoom.tsx).
-- seed/guides.ts's upsertGuide() never updates existing rows (update: {}),
-- so re-running the seed script alone would not apply this on an already-
-- seeded database — hence doing it here.
UPDATE "session_guides" SET "category" = 'intro' WHERE "id" = 'seed-guide-first-meeting' AND "category" = 'היכרות';

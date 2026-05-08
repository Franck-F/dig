-- Mentora cycle (cohort) — drives the admin pilotage banner + reporting.
-- Phase + status are admin-driven enums; no auto-progression in v1.
-- IF NOT EXISTS guards keep the migration idempotent for envs that
-- already saw a `prisma db push` round-trip.

DO $$ BEGIN
  CREATE TYPE "CyclePhase" AS ENUM ('ONBOARDING', 'MATCHING', 'SESSIONS', 'RECAP');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "Cycle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "phase" "CyclePhase" NOT NULL DEFAULT 'ONBOARDING',
    "status" "CycleStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cycle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Cycle_slug_key" ON "Cycle"("slug");
CREATE INDEX IF NOT EXISTS "Cycle_status_phase_idx" ON "Cycle"("status", "phase");
CREATE INDEX IF NOT EXISTS "Cycle_startsAt_idx" ON "Cycle"("startsAt");

DO $$ BEGIN
  ALTER TABLE "Cycle" ADD CONSTRAINT "Cycle_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

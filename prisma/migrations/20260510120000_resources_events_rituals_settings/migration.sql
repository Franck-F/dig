-- Resources, Events, Rituals, governance singletons.
-- Adds the editorial + admin-config models that back the static stub
-- pages added in the design pass (manifesto, newsletter, resources,
-- events, animation, admin settings).
--
-- Idempotent: every CREATE TYPE / TABLE is wrapped so repeated runs
-- on a partially-applied DB are no-ops.

-- ── Enums ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "ResourceKind" AS ENUM ('PDF', 'REPLAY', 'TEMPLATE', 'ARTICLE', 'TOOL', 'NOTION');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ResourceCategory" AS ENUM ('UX_UI', 'CAREER', 'CAREER_CHANGE', 'TECH', 'SOFT_SKILLS', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ResourceAudience" AS ENUM ('MENTORA', 'COMMUNITY', 'BOTH');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CommunityEventKind" AS ENUM ('LIVE', 'WORKSHOP', 'HACKATHON', 'DEMO', 'TALK', 'MEETUP', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CommunityEventFormat" AS ENUM ('REMOTE_VIDEO', 'IN_PERSON', 'HYBRID');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── Resource ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Resource" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "title"         TEXT NOT NULL,
  "description"   TEXT,
  "url"           TEXT NOT NULL,
  "coverImageUrl" TEXT,
  "kind"          "ResourceKind" NOT NULL,
  "category"      "ResourceCategory" NOT NULL DEFAULT 'OTHER',
  "audience"      "ResourceAudience" NOT NULL DEFAULT 'MENTORA',
  "isFeatured"    BOOLEAN NOT NULL DEFAULT false,
  "isPinned"      BOOLEAN NOT NULL DEFAULT false,
  "downloadCount" INTEGER NOT NULL DEFAULT 0,
  "pillLabel"     TEXT,
  "authorId"      TEXT NOT NULL,
  "archivedAt"    TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Resource_authorId_fkey" FOREIGN KEY ("authorId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Resource_audience_archivedAt_createdAt_idx"
  ON "Resource"("audience", "archivedAt", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Resource_category_archivedAt_idx"
  ON "Resource"("category", "archivedAt");
CREATE INDEX IF NOT EXISTS "Resource_authorId_idx"
  ON "Resource"("authorId");
CREATE INDEX IF NOT EXISTS "Resource_isFeatured_audience_idx"
  ON "Resource"("isFeatured", "audience");

-- ── CommunityEvent + Registration ────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CommunityEvent" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "kind"        "CommunityEventKind" NOT NULL,
  "format"      "CommunityEventFormat" NOT NULL DEFAULT 'REMOTE_VIDEO',
  "startsAt"    TIMESTAMP(3) NOT NULL,
  "durationMin" INTEGER NOT NULL DEFAULT 60,
  "location"    TEXT,
  "meetingUrl"  TEXT,
  "isLive"      BOOLEAN NOT NULL DEFAULT false,
  "capacity"    INTEGER,
  "hostId"      TEXT NOT NULL,
  "cancelledAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommunityEvent_hostId_fkey" FOREIGN KEY ("hostId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CommunityEvent_startsAt_cancelledAt_idx"
  ON "CommunityEvent"("startsAt", "cancelledAt");
CREATE INDEX IF NOT EXISTS "CommunityEvent_kind_startsAt_idx"
  ON "CommunityEvent"("kind", "startsAt");
CREATE INDEX IF NOT EXISTS "CommunityEvent_hostId_idx"
  ON "CommunityEvent"("hostId");

CREATE TABLE IF NOT EXISTS "CommunityEventRegistration" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "eventId"      TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cancelledAt"  TIMESTAMP(3),

  CONSTRAINT "CommunityEventRegistration_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "CommunityEvent"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CommunityEventRegistration_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

DO $$ BEGIN
  ALTER TABLE "CommunityEventRegistration"
    ADD CONSTRAINT "CommunityEventRegistration_eventId_userId_key"
    UNIQUE ("eventId", "userId");
EXCEPTION WHEN duplicate_table THEN null; WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "CommunityEventRegistration_userId_registeredAt_idx"
  ON "CommunityEventRegistration"("userId", "registeredAt" DESC);

-- ── CommunityRitual ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CommunityRitual" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "dayOfWeek"   INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "durationMin" INTEGER NOT NULL DEFAULT 60,
  "colorHex"    TEXT NOT NULL DEFAULT '#7301FF',
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommunityRitual_createdById_fkey" FOREIGN KEY ("createdById")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CommunityRitual_dayOfWeek_startMinute_idx"
  ON "CommunityRitual"("dayOfWeek", "startMinute");

-- ── CommunitySettings (singleton) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CommunitySettings" (
  "id"                  TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
  "charterVersion"      TEXT NOT NULL DEFAULT 'v1.0',
  "charterPublishedAt"  TIMESTAMP(3),
  "requireCharterAccept" BOOLEAN NOT NULL DEFAULT false,
  "autoSanctionThreshold" INTEGER NOT NULL DEFAULT 3,
  "openToVisitors"      BOOLEAN NOT NULL DEFAULT false,
  "noIndex"             BOOLEAN NOT NULL DEFAULT false,
  "quarantineDays"      INTEGER NOT NULL DEFAULT 0,
  "bannedWords"         TEXT,
  "updatedById"         TEXT,
  "updatedAt"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommunitySettings_updatedById_fkey" FOREIGN KEY ("updatedById")
    REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Seed the singleton row so the read path never returns null.
INSERT INTO "CommunitySettings" ("id", "updatedAt")
VALUES ('singleton', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- ── MentoraProgrammeSettings (singleton) ─────────────────────────────

CREATE TABLE IF NOT EXISTS "MentoraProgrammeSettings" (
  "id"                  TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
  "capacityMin"         INTEGER NOT NULL DEFAULT 16,
  "capacityMax"         INTEGER NOT NULL DEFAULT 32,
  "matchingDimensions"  INTEGER NOT NULL DEFAULT 6,
  "applicationOpensAt"  TIMESTAMP(3),
  "applicationClosesAt" TIMESTAMP(3),
  "require2faAdmin"     BOOLEAN NOT NULL DEFAULT true,
  "menteeRetentionYears" INTEGER NOT NULL DEFAULT 3,
  "updatedById"         TEXT,
  "updatedAt"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MentoraProgrammeSettings_updatedById_fkey" FOREIGN KEY ("updatedById")
    REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "MentoraProgrammeSettings" ("id", "updatedAt")
VALUES ('singleton', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

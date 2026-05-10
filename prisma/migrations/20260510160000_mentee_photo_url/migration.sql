-- Mirror MentorProfile.photoUrl on MenteeProfile so onboarded mentees
-- can upload an avatar in Step 1 of /mentora/onboarding (parity with
-- the mentor application wizard). Optional column — pre-existing
-- mentees keep null and get the gradient-initials fallback in the UI.
--
-- Idempotent: skip if column already exists.

DO $$ BEGIN
  ALTER TABLE "MenteeProfile" ADD COLUMN "photoUrl" TEXT;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- RGPD Art. 8 — declared birth year on User.
-- Nullable: existing users keep null; new sign-ups will be required to
-- supply it via the `signUp` action. The column is INT (4 bytes), no
-- additional index needed since lookups are always by user id.
ALTER TABLE "User" ADD COLUMN "birthYear" INTEGER;

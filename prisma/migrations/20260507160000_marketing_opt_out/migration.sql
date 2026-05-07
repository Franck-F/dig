-- Marketing opt-out flag for RGPD-compliant 1-click unsubscribe.
-- Defaults to TRUE: existing users keep receiving newsletters; the
-- /email/unsubscribe page flips them to FALSE. Transactional emails
-- (verification codes, password resets, session reminders) ignore
-- this flag and always send.

ALTER TABLE "User" ADD COLUMN "marketingEmailsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Partial index — most queries select WHERE marketingEmailsEnabled = true.
-- Indexing only the rare false rows keeps the index tiny.
CREATE INDEX "User_marketingEmailsEnabled_idx" ON "User"("marketingEmailsEnabled") WHERE "marketingEmailsEnabled" = false;

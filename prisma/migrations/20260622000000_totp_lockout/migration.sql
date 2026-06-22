-- Anti-brute-force on 2FA verification. Two columns on User:
--   failedTotpAttempts : consecutive failed TOTP/backup-code attempts.
--   totpLockedUntil    : when set and in the future, verification is blocked.
-- Reset on a successful verification (see src/lib/auth/totp-lockout.ts).
ALTER TABLE "User" ADD COLUMN "failedTotpAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "totpLockedUntil" TIMESTAMP(3);

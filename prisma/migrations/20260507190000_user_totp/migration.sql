-- 2FA / TOTP support on User. Three columns:
--   totpSecret           : base32 secret (RFC 6238). NULL means 2FA disabled.
--   totpEnabledAt        : timestamp the user confirmed setup.
--   totpBackupCodeHashes : bcrypt hashes of 10 single-use recovery codes.
ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "totpEnabledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "totpBackupCodeHashes" TEXT[] DEFAULT ARRAY[]::TEXT[];

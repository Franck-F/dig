'use server';

import { randomInt } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import { z } from 'zod';
import { UserRole, VerificationPurpose } from '@prisma/client';
import { signIn as nextAuthSignIn } from '@/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email/resend';
import { verificationCodeEmail } from '@/lib/email/templates/verification-code';
import { passwordResetEmail } from '@/lib/email/templates/password-reset';
import {
  AUTH_RATE_LIMIT_ERROR,
  checkAuthRateLimit,
} from '@/lib/rate-limit/auth-limiter';

/**
 * Discriminated state for `useActionState` consumers. The shape is shared by
 * every action so the UI can render banners + step transitions uniformly.
 *
 * `pending_verification` is signup-specific: the user typed a valid email +
 * password but cannot sign in until the 6-digit code is confirmed via
 * `verifyEmailCode`. The form switches to a modal when this state is seen.
 */
export type AuthState =
  | { status: 'idle' }
  | { status: 'success'; message?: string; redirectTo?: string }
  | { status: 'pending_verification'; email: string }
  | { status: 'error'; error: string };

const CODE_TTL_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Pre-computed bcrypt hash of a random secret nobody knows. Used by the
 * `signIn` flow to keep the wall-clock cost of "user does not exist"
 * indistinguishable from "user exists, password wrong." Generated once at
 * cost 12 (same as the real `hash(password, 12)` calls below) — DO NOT
 * regenerate at lower cost or the timing channel reopens.
 *
 * The plaintext that produced this hash is irrelevant: bcrypt.compare()
 * over any input will spend the same ~100ms before returning false.
 */
const DUMMY_BCRYPT_HASH =
  '$2b$12$XqKSb0s6M1W39muJsR4L9.uqi4iuCQ4rwdvo2vBocH8FBdTqlpWYG';

/* ──────────────────────────────────────────────────────────────────────
   Schemas
   ────────────────────────────────────────────────────────────────────── */

const signInSchema = z.object({
  email: z.string().email('emailInvalid'),
  password: z.string().min(1, 'passwordRequired'),
});

const CURRENT_YEAR = new Date().getFullYear();
const MIN_AGE_YEARS = 15; // RGPD Art. 8 — French digital consent floor.
const MAX_BIRTH_YEAR = CURRENT_YEAR - MIN_AGE_YEARS;
const MIN_BIRTH_YEAR = CURRENT_YEAR - 120;

const signUpSchema = z.object({
  firstName: z.string().min(1, 'firstNameRequired').max(80),
  lastName: z.string().min(1, 'lastNameRequired').max(80),
  email: z.string().email('emailInvalid').max(200),
  password: z.string().min(8, 'passwordTooShort').max(200),
  role: z.nativeEnum(UserRole),
  // Year of birth is parsed separately so we can return distinct error
  // codes for "missing", "below 15", and "implausible" (the form needs to
  // tell the user what to fix, and we don't want a single generic
  // `invalidBirthYear` to mask the parental-consent message).
  birthYear: z
    .coerce
    .number()
    .int()
    .min(MIN_BIRTH_YEAR, 'invalidBirthYear')
    .max(MAX_BIRTH_YEAR, 'belowMinAge'),
});

const codeSchema = z
  .string()
  .regex(/^\d{6}$/, 'invalid');

const verifyEmailSchema = z.object({
  email: z.string().email('emailInvalid'),
  code: codeSchema,
});

const resendSchema = z.object({
  email: z.string().email('emailInvalid'),
});

const requestResetSchema = z.object({
  email: z.string().email('emailInvalid'),
});

const confirmResetSchema = z.object({
  email: z.string().email('emailInvalid'),
  code: codeSchema,
  newPassword: z.string().min(8, 'passwordTooShort').max(200),
});

/* ──────────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────────── */

function generateCode(): string {
  // crypto.randomInt is uniform; pad to 6 chars in case of leading zero.
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Validate a `next=` redirect target. Only accepts same-origin paths
 * (must start with a single `/`, not `//` which could be a
 * protocol-relative URL like `//evil.com/path` and bypass our origin).
 *
 * Length-capped at 200 chars to avoid DoS via huge query strings being
 * stored in audit logs.
 *
 * Returns the validated path or null when input is unsafe / missing.
 */
function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return null;
  if (!trimmed.startsWith('/')) return null;
  if (trimmed.startsWith('//')) return null;
  // Reject anything that decodes to a different origin via tricks like
  // `\/evil.com`. Browsers normalise some of these; we belt-and-suspenders.
  if (/[\\\r\n]/.test(trimmed)) return null;
  return trimmed;
}

async function issueCode(email: string, purpose: VerificationPurpose): Promise<string> {
  const code = generateCode();
  const codeHash = await hash(code, 10);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);

  // Invalidate any previously-pending codes of the same purpose for this
  // email so a single email/purpose pair never has more than one live row.
  await prisma.verificationCode.updateMany({
    where: { email, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });

  await prisma.verificationCode.create({
    data: { email, codeHash, purpose, expiresAt },
  });

  return code;
}

/* ──────────────────────────────────────────────────────────────────────
   signIn — credentials login
   Adds an email-verification gate on top of the previous behaviour:
   credentials users with a non-null passwordHash but no `emailVerified`
   timestamp are rejected with a dedicated error key the UI maps to
   `t('login.errors.emailNotVerified')`.
   ────────────────────────────────────────────────────────────────────── */

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { status: 'error', error: parsed.error.issues[0]?.message ?? 'invalid' };
  }

  const { email, password } = parsed.data;

  // Rate-limit before any DB / bcrypt work — a brute-force attempt
  // shouldn't be cheap to run.
  const rl = await checkAuthRateLimit('signIn', email);
  if (!rl.ok) return { status: 'error', error: AUTH_RATE_LIMIT_ERROR };

  const user = await prisma.user.findUnique({ where: { email } });
  // Anti-enumeration via timing: bcrypt is deliberately slow, and
  // skipping the compare for non-existent users gave attackers a clear
  // ~100ms response-time gap between "this email doesn't exist" and
  // "this email exists, password wrong." We run a constant-cost compare
  // against a fixed dummy hash whenever there is no match, so the wall
  // clock looks the same either way.
  if (!user || !user.passwordHash) {
    await compare(password, DUMMY_BCRYPT_HASH);
    return { status: 'error', error: 'invalidCredentials' };
  }
  // Soft-deleted accounts: present a generic invalid-credentials error so
  // we don't leak that the account was deleted (the user is presumed to
  // know — but their stalker / abuser might not).
  if (user.deletedAt) {
    await compare(password, DUMMY_BCRYPT_HASH);
    return { status: 'error', error: 'invalidCredentials' };
  }
  // Anti-enumeration: we used to short-circuit here on
  // `passwordHash && !emailVerified` and return `emailNotVerified`. That
  // gave attackers a free yes/no oracle on email existence (just guess
  // any password — a verified email would fail with `invalidCredentials`
  // while an unverified one would say `emailNotVerified`). We now run
  // the bcrypt compare unconditionally and only surface the
  // `emailNotVerified` hint AFTER a successful password match — so the
  // only way to learn the verification status of an email is to know
  // its password.
  if (!user.emailVerified) {
    const ok = await compare(password, user.passwordHash);
    if (!ok) return { status: 'error', error: 'invalidCredentials' };
    // Password is right but the account is unverified — surface the hint
    // so the UI can re-open the verification modal.
    return { status: 'error', error: 'emailNotVerified' };
  }

  try {
    await nextAuthSignIn('credentials', { email, password, redirect: false });
    // Resolve the post-login destination based on the role we just verified.
    // ADMINs land directly on the pilotage dashboard; everyone else on the
    // hub. The `next=` query string takes precedence when it's a safe
    // same-origin path — that's how anon users redirected to /login from
    // a SaaS page get back to where they intended.
    const fresh = await prisma.user.findUnique({
      where: { email },
      select: { role: true },
    });
    const requestedNext = safeNextPath(formData.get('next'));
    const roleDefault = fresh?.role === 'ADMIN' ? '/mentora/admin' : '/app';
    // Admins always land on /mentora/admin even if `next` is set —
    // they're typically signing in to do admin work, not to return to a
    // public page. Non-admins respect their `next`.
    const redirectTo =
      fresh?.role === 'ADMIN' ? roleDefault : (requestedNext ?? roleDefault);
    return { status: 'success', message: 'signedIn', redirectTo };
  } catch (err) {
    // Auth.js v5 surfaces credential failures as `CredentialsSignin`. The
    // message frequently embeds only the lowercase docs URL
    // (`errors.authjs.dev#credentialssignin`) — older substring matching
    // missed it. We now check both `err.name` and the message lowercased.
    const errorName = err instanceof Error ? err.name : '';
    const msg = err instanceof Error ? err.message : 'invalidCredentials';
    const lower = msg.toLowerCase();
    const isCredentialsError =
      errorName === 'CredentialsSignin' ||
      lower.includes('credentialssignin') ||
      lower.includes('credentials');

    if (process.env.NODE_ENV !== 'production') {
      // Surface the raw error to the dev terminal so devs can debug DB /
      // adapter / config issues that would otherwise look like "generic".
      console.error('[auth.signIn] caught error', { errorName, msg, err });
    }

    return {
      status: 'error',
      error: isCredentialsError ? 'invalidCredentials' : 'generic',
    };
  }
}

/* ──────────────────────────────────────────────────────────────────────
   signUp — creates user (or refreshes pending one) and emails a 6-digit code.
   Decision: when an unverified account already exists, signup is allowed
   to overwrite name + passwordHash. This is intentional — it lets a user
   who lost their first code retry signup with the same email and pick a
   new password without admin intervention. Verified accounts (emailVerified
   not null) cannot be overwritten and produce `emailAlreadyExists`.
   ────────────────────────────────────────────────────────────────────── */

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  // Honey-pot: a hidden field bots love to fill. If `website` arrives with
  // any value, drop the request silently with a generic-looking error so
  // the bot can't tell whether its retry pattern is working. We don't
  // even hit the DB.
  const honey = formData.get('website');
  if (typeof honey === 'string' && honey.trim().length > 0) {
    return { status: 'error', error: 'generic' };
  }

  // RGPD age gate: data subjects under 15 in France need parental consent
  // (article 8). We don't have that flow yet, so we require an explicit
  // self-declaration here. Server-side because client-side validation is
  // bypassable.
  const ageOver15 = formData.get('ageOver15');
  if (!ageOver15) {
    return { status: 'error', error: 'ageRequired' };
  }

  const parsed = signUpSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    password: formData.get('password'),
    role: formData.get('role'),
    birthYear: formData.get('birthYear'),
  });
  if (!parsed.success) {
    return { status: 'error', error: parsed.error.issues[0]?.message ?? 'invalid' };
  }

  const { firstName, lastName, email, password, role, birthYear } = parsed.data;

  const rl = await checkAuthRateLimit('signUp', email);
  if (!rl.ok) return { status: 'error', error: AUTH_RATE_LIMIT_ERROR };

  const passwordHash = await hash(password, 12);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.emailVerified) {
    return { status: 'error', error: 'emailAlreadyExists' };
  }

  if (existing) {
    // Pre-existing unverified user: refresh credentials.
    await prisma.user.update({
      where: { email },
      data: {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        passwordHash,
        role,
        // Credentials signup picked a role inline — bypass the OAuth
        // /welcome/role gate. (Default in schema is true anyway, but be
        // explicit so the contract is unambiguous.)
        roleConfirmed: true,
        birthYear,
      },
    });
  } else {
    await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        passwordHash,
        role,
        roleConfirmed: true,
        emailVerified: null,
        birthYear,
      },
    });
  }

  const code = await issueCode(email, VerificationPurpose.EMAIL_VERIFICATION);

  const tpl = verificationCodeEmail({ code });
  // Failure of the email send must NOT silently strand the user — propagate.
  const sent = await sendEmail({ to: email, ...tpl });
  if (!sent.ok) {
    return { status: 'error', error: 'emailSendFailed' };
  }

  return { status: 'pending_verification', email };
}

/* ──────────────────────────────────────────────────────────────────────
   verifyEmailCode — consume a 6-digit code, mark User.emailVerified
   ────────────────────────────────────────────────────────────────────── */

export async function verifyEmailCode(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = verifyEmailSchema.safeParse({
    email: formData.get('email'),
    code: formData.get('code'),
  });
  if (!parsed.success) {
    return { status: 'error', error: 'invalid' };
  }
  const { email, code } = parsed.data;

  const rl = await checkAuthRateLimit('verifyEmailCode', email);
  if (!rl.ok) return { status: 'error', error: AUTH_RATE_LIMIT_ERROR };

  const record = await prisma.verificationCode.findFirst({
    where: {
      email,
      purpose: VerificationPurpose.EMAIL_VERIFICATION,
      consumedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) return { status: 'error', error: 'invalid' };
  if (record.expiresAt.getTime() < Date.now()) {
    return { status: 'error', error: 'expired' };
  }

  // Bump attempts BEFORE compare so an early throw doesn't grant a free try.
  const updated = await prisma.verificationCode.update({
    where: { id: record.id },
    data: { attempts: { increment: 1 } },
  });

  if (updated.attempts > MAX_CODE_ATTEMPTS) {
    await prisma.verificationCode.updateMany({
      where: { email, purpose: VerificationPurpose.EMAIL_VERIFICATION, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return { status: 'error', error: 'tooManyAttempts' };
  }

  const ok = await compare(code, record.codeHash);
  if (!ok) return { status: 'error', error: 'invalid' };

  await prisma.$transaction([
    prisma.verificationCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { email },
      data: { emailVerified: new Date() },
    }),
  ]);

  return { status: 'success', message: 'verified' };
}

/* ──────────────────────────────────────────────────────────────────────
   resendVerificationCode — rate-limited (1/min/email)
   ────────────────────────────────────────────────────────────────────── */

export async function resendVerificationCode(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = resendSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { status: 'error', error: 'invalid' };
  const { email } = parsed.data;

  // Belt: per-IP + per-email bucket. Suspenders: 60 s DB cooldown below.
  const rl = await checkAuthRateLimit('resendVerificationCode', email);
  if (!rl.ok) return { status: 'error', error: AUTH_RATE_LIMIT_ERROR };

  // Rate limit: refuse if a code was issued in the last 60s.
  const recent = await prisma.verificationCode.findFirst({
    where: { email, purpose: VerificationPurpose.EMAIL_VERIFICATION },
    orderBy: { createdAt: 'desc' },
  });
  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1_000) {
    return { status: 'error', error: 'rateLimited' };
  }

  // Don't leak whether the user exists, but issuing a code for a
  // non-existent email is a noop the user can't observe.
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerified) {
    // Pretend success — same UX shape as the happy path.
    return { status: 'success', message: 'resent' };
  }

  const code = await issueCode(email, VerificationPurpose.EMAIL_VERIFICATION);
  const tpl = verificationCodeEmail({ code });
  const sent = await sendEmail({ to: email, ...tpl });
  if (!sent.ok) return { status: 'error', error: 'emailSendFailed' };

  return { status: 'success', message: 'resent' };
}

/* ──────────────────────────────────────────────────────────────────────
   requestPasswordReset — ALWAYS returns success to avoid email enumeration
   ────────────────────────────────────────────────────────────────────── */

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = requestResetSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    // Treat malformed input as success too — no enumeration leak.
    return { status: 'success', message: 'resetSent' };
  }
  const { email } = parsed.data;

  // Rate-limit BEFORE the DB lookup. We still return success on rate-limit
  // to keep the enumeration story consistent — leaking "rate-limited"
  // would tell an attacker which emails exist (the limiter only ticks for
  // valid emails in their flood). Instead silently swallow.
  const rl = await checkAuthRateLimit('requestPasswordReset', email);
  if (!rl.ok) return { status: 'success', message: 'resetSent' };

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.passwordHash) {
    const code = await issueCode(email, VerificationPurpose.PASSWORD_RESET);
    const tpl = passwordResetEmail({ code });
    await sendEmail({ to: email, ...tpl }); // best-effort; never reveal failure
  }

  return { status: 'success', message: 'resetSent' };
}

/* ──────────────────────────────────────────────────────────────────────
   confirmPasswordReset — validates code, updates passwordHash
   ────────────────────────────────────────────────────────────────────── */

export async function confirmPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = confirmResetSchema.safeParse({
    email: formData.get('email'),
    code: formData.get('code'),
    newPassword: formData.get('newPassword'),
  });
  if (!parsed.success) {
    return { status: 'error', error: parsed.error.issues[0]?.message ?? 'invalid' };
  }
  const { email, code, newPassword } = parsed.data;

  const rl = await checkAuthRateLimit('confirmPasswordReset', email);
  if (!rl.ok) return { status: 'error', error: AUTH_RATE_LIMIT_ERROR };

  const record = await prisma.verificationCode.findFirst({
    where: {
      email,
      purpose: VerificationPurpose.PASSWORD_RESET,
      consumedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) return { status: 'error', error: 'invalid' };
  if (record.expiresAt.getTime() < Date.now()) {
    return { status: 'error', error: 'expired' };
  }

  const updated = await prisma.verificationCode.update({
    where: { id: record.id },
    data: { attempts: { increment: 1 } },
  });
  if (updated.attempts > MAX_CODE_ATTEMPTS) {
    await prisma.verificationCode.updateMany({
      where: { email, purpose: VerificationPurpose.PASSWORD_RESET, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return { status: 'error', error: 'tooManyAttempts' };
  }

  const ok = await compare(code, record.codeHash);
  if (!ok) return { status: 'error', error: 'invalid' };

  const passwordHash = await hash(newPassword, 12);
  await prisma.$transaction([
    prisma.verificationCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        // Reset implicitly proves email ownership — verify if not already.
        emailVerified: new Date(),
      },
    }),
  ]);

  return { status: 'success', message: 'passwordReset' };
}

/* ──────────────────────────────────────────────────────────────────────
   signInWithProvider — OAuth entry point used by social buttons.
   The wrapping form action receives `provider` via `.bind` from the UI,
   so the runtime signature is `(provider, formData) => Promise<void>`.
   NextAuth performs the redirect itself; this function never returns
   under normal execution.
   ────────────────────────────────────────────────────────────────────── */

export async function signInWithProvider(
  provider: 'google' | 'discord' | 'github',
  next?: string,
) {
  try {
    // `next` may be passed from the LoginForm when the user came via a
    // gated route. Validate the same way signIn does — never accept an
    // off-origin URL into NextAuth's redirectTo callback.
    const safeNext = safeNextPath(next);
    await nextAuthSignIn(provider, { redirectTo: safeNext ?? '/app' });
  } catch (err) {
    // Next.js redirect throws a `NEXT_REDIRECT` error to perform the
    // navigation — that's expected, not a failure. Re-throw so Next can
    // handle it. Anything else is a real configuration / network error
    // (callback URL mismatch, invalid client, provider down) — log it so
    // the dev terminal shows what's wrong instead of a silent no-op.
    const isRedirect = err instanceof Error && err.message?.includes('NEXT_REDIRECT');
    if (isRedirect) throw err;
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[auth.signInWithProvider:${provider}] error`, err);
    }
    throw err;
  }
}

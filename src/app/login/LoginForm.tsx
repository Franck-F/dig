'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  signIn,
  signUp,
  verifyEmailCode,
  resendVerificationCode,
  requestPasswordReset,
  confirmPasswordReset,
  signInWithProvider,
  type AuthState,
} from '@/lib/actions/auth';

// Each tuple: [translation key for label, UserRole enum value sent to server]
const ROLES = [
  ['learner', 'STUDENT'],
  ['mentor', 'MENTOR'],
  ['partner', 'PARTNER'],
] as const;
type RoleValue = (typeof ROLES)[number][1];

const initialState: AuthState = { status: 'idle' };

type OAuthEnabled = { google: boolean; discord: boolean; github: boolean };
type ProviderKey = 'google' | 'discord' | 'github';

/* ------------------------------------------------------------------
   Brand & UI icons (decorative — aria-hidden).
   ------------------------------------------------------------------ */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.07.56 4.21 1.65l3.16-3.16C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);

const DiscordIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2" aria-hidden>
    <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const GitHubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-.99-.02-1.95-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.21-1.49 3.18-1.18 3.18-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.4-5.25 5.68.41.35.78 1.05.78 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.21.66.8.55 4.57-1.52 7.85-5.83 7.85-10.91C23.5 5.65 18.35.5 12 .5z" />
  </svg>
);

const EyeIcon = ({ off = false }: { off?: boolean }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {off ? (
      <>
        <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" />
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <line x1="2" y1="2" x2="22" y2="22" />
      </>
    ) : (
      <>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

/* ------------------------------------------------------------------
   PasswordField — input with show/hide toggle.
   ------------------------------------------------------------------ */
type PasswordFieldProps = {
  id: string;
  name: string;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  showLabel: string;
  hideLabel: string;
};

function PasswordField({
  id,
  name,
  placeholder,
  autoComplete,
  minLength,
  required,
  showLabel,
  hideLabel,
}: PasswordFieldProps) {
  const [show, setShow] = useState(false);
  const label = show ? hideLabel : showLabel;

  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        name={name}
        type={show ? 'text' : 'password'}
        className="dz-input"
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        style={{ paddingRight: 46, width: '100%' }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={label}
        aria-pressed={show ? 'true' : 'false'}
        title={label}
        tabIndex={0}
        style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--brand-violet, #7301FF)',
          width: 32,
          height: 32,
          borderRadius: 8,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          transition: 'background 0.18s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(115,1,255,0.08)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }}
      >
        <EyeIcon off={show} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------
   Social provider buttons. When OAuth env is missing for a provider the
   button stays disabled with a "bientôt" title; when configured, the
   button calls the `signInWithProvider` server action through a
   transition (NextAuth performs the redirect).
   ------------------------------------------------------------------ */
const PROVIDERS: ReadonlyArray<{
  key: ProviderKey;
  label: string;
  Icon: () => React.JSX.Element;
  tint: string;        // brand color for hover glow + icon halo
  ring: string;        // subtle ring accent on hover
}> = [
  { key: 'google',  label: 'Google',  Icon: GoogleIcon,  tint: 'rgba(66, 133, 244, 0.20)',  ring: 'rgba(66, 133, 244, 0.45)' },
  { key: 'discord', label: 'Discord', Icon: DiscordIcon, tint: 'rgba(88, 101, 242, 0.20)',  ring: 'rgba(88, 101, 242, 0.50)' },
  { key: 'github',  label: 'GitHub',  Icon: GitHubIcon,  tint: 'rgba(36, 41, 47, 0.18)',    ring: 'rgba(36, 41, 47, 0.40)' },
] as const;

function SocialButtons({
  enabled,
  disabledLabel,
  next,
}: {
  enabled: OAuthEnabled;
  disabledLabel: string;
  next?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<ProviderKey | null>(null);
  const [hoverKey, setHoverKey] = useState<ProviderKey | null>(null);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
      {PROVIDERS.map(({ key, label, Icon, tint, ring }) => {
        const isEnabled = enabled[key];
        const isPending = pending && pendingKey === key;
        const isHover = hoverKey === key && isEnabled && !pending;
        return (
          <button
            key={key}
            type="button"
            disabled={!isEnabled || pending}
            aria-label={isEnabled ? label : `${label} (${disabledLabel})`}
            title={isEnabled ? label : disabledLabel}
            onMouseEnter={() => setHoverKey(key)}
            onMouseLeave={() => setHoverKey(null)}
            onFocus={() => setHoverKey(key)}
            onBlur={() => setHoverKey(null)}
            onClick={() => {
              if (!isEnabled) return;
              setPendingKey(key);
              startTransition(() => {
                void signInWithProvider(key, next);
              });
            }}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '18px 10px',
              borderRadius: 18,
              cursor: isEnabled && !pending ? 'pointer' : 'not-allowed',
              opacity: !isEnabled ? 0.55 : isPending ? 0.7 : 1,
              // Glassmorphism layering
              background: isHover
                ? `linear-gradient(135deg, ${tint}, rgba(255,255,255,0.55))`
                : 'rgba(255, 255, 255, 0.55)',
              backdropFilter: 'blur(28px) saturate(180%)',
              WebkitBackdropFilter: 'blur(28px) saturate(180%)',
              border: `1px solid ${isHover ? ring : 'rgba(255, 255, 255, 0.6)'}`,
              boxShadow: isHover
                ? `0 12px 32px ${tint}, 0 1px 0 rgba(255,255,255,0.7) inset`
                : '0 8px 24px rgba(115, 1, 255, 0.10), 0 1px 0 rgba(255,255,255,0.6) inset',
              transition: 'transform .22s cubic-bezier(.2,.7,.3,1), box-shadow .22s, border-color .22s, background .22s',
              transform: isHover ? 'translateY(-2px)' : 'translateY(0)',
              fontFamily: 'inherit',
              color: 'var(--ink)',
              fontWeight: 600,
              fontSize: 13,
              letterSpacing: '0.01em',
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.7)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 8px rgba(36,18,80,0.10)',
              }}
            >
              <Icon />
            </span>
            <span>{isPending ? '…' : label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------
   Modal shell — minimal accessible dialog. Reused by both verify + reset.
   ------------------------------------------------------------------ */
function Modal({
  open,
  onClose,
  title,
  closeLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(20, 12, 40, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="dz-glass-strong"
        style={{
          width: '100%',
          maxWidth: 460,
          padding: 32,
          borderRadius: 22,
          background: 'rgba(255,255,255,0.98)',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          title={closeLabel}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: 10,
            border: 'none',
            background: 'transparent',
            color: '#1a1a2e',
            cursor: 'pointer',
            fontSize: 20,
            lineHeight: 1,
          }}
        >
          ×
        </button>
        <h3 className="dz-h2" style={{ fontSize: 22, marginBottom: 8 }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   VerificationModal — signup step 2.
   States: idle → submitting → success (auto-close + flip to login tab).
   ------------------------------------------------------------------ */
function VerificationModal({
  open,
  email,
  onClose,
  onVerified,
}: {
  open: boolean;
  email: string;
  onClose: () => void;
  onVerified: (email: string) => void;
}) {
  const t = useTranslations('login.verifyModal');
  const tErr = useTranslations('login.verifyModal.errors');
  const [verifyState, verifyAction, verifyPending] = useActionState(verifyEmailCode, initialState);
  const [resendState, resendAction, resendPending] = useActionState(
    resendVerificationCode,
    initialState,
  );
  const [cooldown, setCooldown] = useState(0);

  // Start initial cooldown on first open (signup just sent a code).
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      wasOpenRef.current = true;
      setCooldown(60);
    }
    if (!open) wasOpenRef.current = false;
  }, [open]);

  // Cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Reset cooldown on successful resend.
  useEffect(() => {
    if (resendState.status === 'success') setCooldown(60);
  }, [resendState]);

  // On verify success, hand off to parent (parent flips tab + pre-fills email).
  useEffect(() => {
    if (verifyState.status === 'success') {
      onVerified(email);
    }
  }, [verifyState, email, onVerified]);

  const errKey = verifyState.status === 'error' ? verifyState.error : null;
  const errText = errKey
    ? (['invalid', 'expired', 'tooManyAttempts'].includes(errKey)
        ? tErr(errKey as 'invalid' | 'expired' | 'tooManyAttempts')
        : tErr('generic'))
    : null;

  return (
    <Modal open={open} onClose={onClose} title={t('title')} closeLabel={t('close')}>
      <p className="dz-small" style={{ marginBottom: 18 }}>
        {t('subtitle', { email })}
      </p>

      <form action={verifyAction}>
        <input type="hidden" name="email" value={email} />
        <label htmlFor="verify-code" className="dz-label">{t('codeLabel')}</label>
        <input
          id="verify-code"
          name="code"
          className="dz-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          minLength={6}
          pattern="[0-9]{6}"
          placeholder={t('codePlaceholder')}
          required
          style={{
            letterSpacing: 6,
            fontFamily: '"SF Mono","Monaco","Consolas",monospace',
            fontSize: 20,
            textAlign: 'center',
            width: '100%',
            marginTop: 6,
          }}
        />
        <button
          type="submit"
          disabled={verifyPending}
          className="dz-btn dz-btn-primary dz-btn-lg"
          style={{ width: '100%', marginTop: 18, opacity: verifyPending ? 0.7 : 1 }}
        >
          {verifyPending ? t('submittingButton') : t('submitButton')}
        </button>
      </form>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
        {cooldown > 0 ? (
          <span className="dz-small" style={{ color: '#6b6b8a' }}>
            {t('resendCountdown', { seconds: cooldown })}
          </span>
        ) : (
          <form action={resendAction}>
            <input type="hidden" name="email" value={email} />
            <button
              type="submit"
              disabled={resendPending}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#7301FF',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 14,
                padding: 0,
              }}
            >
              {resendPending ? t('resending') : t('resendLink')}
            </button>
          </form>
        )}
      </div>

      {resendState.status === 'success' && (
        <div role="status" style={{ marginTop: 12, fontSize: 13, color: '#108a48', textAlign: 'center' }}>
          {t('resendSuccess')}
        </div>
      )}
      {errText && (
        <div role="alert" style={{ marginTop: 12, padding: 10, borderRadius: 10, background: 'rgba(217,78,146,0.10)', color: '#a8235e', fontSize: 13 }}>
          {errText}
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------
   ResetModal — two-step password reset (request code → confirm).
   ------------------------------------------------------------------ */
function ResetModal({
  open,
  initialEmail,
  onClose,
  onCompleted,
}: {
  open: boolean;
  initialEmail: string;
  onClose: () => void;
  onCompleted: (email: string) => void;
}) {
  const t = useTranslations('login.resetModal');
  const tErr = useTranslations('login.resetModal.errors');
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState(initialEmail);

  const [reqState, reqAction, reqPending] = useActionState(requestPasswordReset, initialState);
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmPasswordReset,
    initialState,
  );

  // Reset state when reopened.
  useEffect(() => {
    if (open) {
      setStep(1);
      setEmail(initialEmail);
    }
  }, [open, initialEmail]);

  // Step 1 success → advance to step 2.
  useEffect(() => {
    if (reqState.status === 'success') setStep(2);
  }, [reqState]);

  // Step 2 success → tell parent + close.
  useEffect(() => {
    if (confirmState.status === 'success') {
      onCompleted(email);
    }
  }, [confirmState, email, onCompleted]);

  const errKey =
    step === 1 && reqState.status === 'error'
      ? reqState.error
      : step === 2 && confirmState.status === 'error'
        ? confirmState.error
        : null;
  const errText = errKey
    ? (['invalid', 'expired', 'tooManyAttempts'].includes(errKey)
        ? tErr(errKey as 'invalid' | 'expired' | 'tooManyAttempts')
        : tErr('generic'))
    : null;

  return (
    <Modal open={open} onClose={onClose} title={t('title')} closeLabel={t('close')}>
      {step === 1 ? (
        <>
          <p className="dz-small" style={{ marginBottom: 18 }}>{t('step1.subtitle')}</p>
          <form action={reqAction}>
            <label htmlFor="reset-email" className="dz-label">{t('step1.emailLabel')}</label>
            <input
              id="reset-email"
              name="email"
              type="email"
              className="dz-input"
              required
              autoComplete="email"
              placeholder={t('step1.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', marginTop: 6 }}
            />
            <button
              type="submit"
              disabled={reqPending}
              className="dz-btn dz-btn-primary dz-btn-lg"
              style={{ width: '100%', marginTop: 18, opacity: reqPending ? 0.7 : 1 }}
            >
              {reqPending ? t('step1.submittingButton') : t('step1.submitButton')}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="dz-small" style={{ marginBottom: 18 }}>{t('step2.subtitle')}</p>
          <form action={confirmAction}>
            <input type="hidden" name="email" value={email} />
            <label htmlFor="reset-code" className="dz-label">{t('step2.codeLabel')}</label>
            <input
              id="reset-code"
              name="code"
              className="dz-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              minLength={6}
              pattern="[0-9]{6}"
              placeholder={t('step2.codePlaceholder')}
              required
              style={{
                letterSpacing: 6,
                fontFamily: '"SF Mono","Monaco","Consolas",monospace',
                fontSize: 20,
                textAlign: 'center',
                width: '100%',
                marginTop: 6,
                marginBottom: 14,
              }}
            />
            <label htmlFor="reset-newpw" className="dz-label">{t('step2.newPasswordLabel')}</label>
            <PasswordField
              id="reset-newpw"
              name="newPassword"
              placeholder={t('step2.newPasswordPlaceholder')}
              minLength={8}
              required
              autoComplete="new-password"
              showLabel="Afficher le mot de passe"
              hideLabel="Masquer le mot de passe"
            />
            <button
              type="submit"
              disabled={confirmPending}
              className="dz-btn dz-btn-primary dz-btn-lg"
              style={{ width: '100%', marginTop: 18, opacity: confirmPending ? 0.7 : 1 }}
            >
              {confirmPending ? t('step2.submittingButton') : t('step2.submitButton')}
            </button>
          </form>
        </>
      )}

      {errText && (
        <div role="alert" style={{ marginTop: 12, padding: 10, borderRadius: 10, background: 'rgba(217,78,146,0.10)', color: '#a8235e', fontSize: 13 }}>
          {errText}
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------
   Main login / signup component.
   ------------------------------------------------------------------ */
export default function LoginForm({ oauthEnabled }: { oauthEnabled: OAuthEnabled }) {
  const t = useTranslations('login');
  const tErr = useTranslations('login.errors');
  const router = useRouter();
  const searchParams = useSearchParams();
  // `?next=` carries the original gated-route URL when the user was
  // bounced here from a SaaS page. Sanitised both client-side here
  // (cosmetic — never used in a redirect) and server-side via the
  // safeNextPath() helper in src/lib/actions/auth.ts.
  const rawNext = searchParams?.get('next') ?? '';
  const nextPath =
    rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '';
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [role, setRole] = useState<RoleValue>('STUDENT');

  const [loginState, loginAction, loginPending] = useActionState(signIn, initialState);
  const [signupState, signupAction, signupPending] = useActionState(signUp, initialState);

  const state = tab === 'login' ? loginState : signupState;

  // Modals
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [resetSeedEmail, setResetSeedEmail] = useState('');
  const [postVerifyBanner, setPostVerifyBanner] = useState<string | null>(null);
  const [postResetBanner, setPostResetBanner] = useState<string | null>(null);
  const [prefillEmail, setPrefillEmail] = useState<string>('');

  // After a successful sign-in, refresh server components and redirect.
  // The server action now returns a role-aware `redirectTo` (admins land on
  // the pilotage dashboard, everyone else on the hub). We fall back to /app
  // for older states without that field.
  useEffect(() => {
    if (loginState.status === 'success') {
      router.refresh();
      router.push(loginState.redirectTo ?? '/app');
    }
  }, [loginState, router]);

  // Signup pending verification → open the verify modal.
  useEffect(() => {
    if (signupState.status === 'pending_verification') {
      setVerifyEmail(signupState.email);
      setVerifyOpen(true);
    }
  }, [signupState]);

  // Translate error keys coming back from server actions to FR copy.
  const translateError = (raw: string): string => {
    const knownKeys = [
      'emailNotVerified',
      'emailAlreadyExists',
      'invalidCredentials',
      'emailInvalid',
      'passwordRequired',
      'passwordTooShort',
      'firstNameRequired',
      'lastNameRequired',
      'emailSendFailed',
      'oauthDisabled',
      'rateLimited',
      'ageRequired',
      'belowMinAge',
      'invalidBirthYear',
      'generic',
    ] as const;
    type ErrKey = (typeof knownKeys)[number];
    return (knownKeys as readonly string[]).includes(raw)
      ? tErr(raw as ErrKey)
      : tErr('generic');
  };

  const showPasswordLabel = 'Afficher le mot de passe';
  const hidePasswordLabel = 'Masquer le mot de passe';

  return (
    <div className="dz-glass-strong" style={{ padding: 48, borderRadius: 28, display: 'flex', flexDirection: 'column' }}>
      <div className="dz-seg" style={{ alignSelf: 'flex-start', marginBottom: 28 }}>
        <button type="button" className={tab === 'login' ? '--on' : ''} onClick={() => setTab('login')}>
          {t('tabs.login')}
        </button>
        <button type="button" className={tab === 'signup' ? '--on' : ''} onClick={() => setTab('signup')}>
          {t('tabs.signup')}
        </button>
      </div>

      {tab === 'login' ? (
        <form action={loginAction}>
          {/* Carry the original gated-route URL through so the server
              action can return us to it after auth. The hidden input
              is sanitised server-side via safeNextPath() — anything
              off-origin is dropped. */}
          {nextPath && <input type="hidden" name="next" value={nextPath} />}
          <h2 className="dz-h2" style={{ fontSize: 32 }}>
            {t('loginForm.title')} <span className="dz-grad-text">{t('loginForm.titleHighlight')}</span>
          </h2>
          <p className="dz-small" style={{ marginTop: 8 }}>{t('loginForm.subtitle')}</p>
          <div style={{ display: 'grid', gap: 16, marginTop: 28 }}>
            <div>
              <label htmlFor="login-email" className="dz-label">{t('loginForm.email')}</label>
              <input
                id="login-email"
                name="email"
                type="email"
                className="dz-input"
                placeholder={t('loginForm.emailPlaceholder')}
                required
                autoComplete="email"
                defaultValue={prefillEmail}
              />
            </div>
            <div>
              <label htmlFor="login-password" className="dz-label">{t('loginForm.password')}</label>
              <PasswordField
                id="login-password"
                name="password"
                placeholder={t('loginForm.passwordPlaceholder')}
                required
                autoComplete="current-password"
                showLabel={showPasswordLabel}
                hideLabel={hidePasswordLabel}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', fontSize: 13 }}>
              <button
                type="button"
                onClick={() => {
                  setResetSeedEmail(prefillEmail);
                  setResetOpen(true);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  color: '#7301FF',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                {t('loginForm.forgot')}
              </button>
            </div>
            <button type="submit" disabled={loginPending} className="dz-btn dz-btn-primary dz-btn-lg" style={{ width: '100%', opacity: loginPending ? 0.7 : 1 }}>
              {loginPending ? t('loginForm.submitting') : t('loginForm.submit')}
            </button>
          </div>
          <div className="dz-divider"><span className="dz-small">{t('loginForm.or')}</span></div>
          <SocialButtons enabled={oauthEnabled} disabledLabel={t("oauth.disabled")} next={nextPath} />
        </form>
      ) : (
        <form action={signupAction}>
          <h2 className="dz-h2" style={{ fontSize: 32 }}>
            {t('signupForm.title')} <span className="dz-grad-text">{t('signupForm.titleHighlight')}</span>
          </h2>
          <p className="dz-small" style={{ marginTop: 8 }}>{t('signupForm.subtitle')}</p>
          <div style={{ display: 'grid', gap: 14, marginTop: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label htmlFor="signup-firstname" className="dz-label">{t('signupForm.firstName')}</label>
                <input id="signup-firstname" name="firstName" className="dz-input" required maxLength={80} autoComplete="given-name" />
              </div>
              <div>
                <label htmlFor="signup-lastname" className="dz-label">{t('signupForm.lastName')}</label>
                <input id="signup-lastname" name="lastName" className="dz-input" required maxLength={80} autoComplete="family-name" />
              </div>
            </div>
            <div>
              <label htmlFor="signup-email" className="dz-label">{t('signupForm.email')}</label>
              <input id="signup-email" name="email" type="email" className="dz-input" placeholder={t('signupForm.emailPlaceholder')} required autoComplete="email" />
            </div>
            <div>
              <label htmlFor="signup-password" className="dz-label">{t('signupForm.password')}</label>
              <PasswordField
                id="signup-password"
                name="password"
                placeholder={t('signupForm.passwordPlaceholder')}
                required
                minLength={8}
                autoComplete="new-password"
                showLabel={showPasswordLabel}
                hideLabel={hidePasswordLabel}
              />
            </div>
            <div>
              <span className="dz-label">{t('signupForm.iAm')}</span>
              <input type="hidden" name="role" value={role} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {ROLES.map(([labelKey, value]) => (
                  <button key={value} type="button" onClick={() => setRole(value)} className={`dz-btn dz-btn-sm ${value === role ? 'dz-btn-primary' : 'dz-btn-ghost'}`}>
                    {t(`signupForm.roles.${labelKey}`)}
                  </button>
                ))}
              </div>
            </div>
            {/* Honey-pot — invisible to humans, magnetic to naive bots that
                fill every input by name. Server rejects on any non-empty
                value. Real users never see this; aria-hidden + tabIndex=-1
                keep assistive tech away. */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: '-9999px',
                width: 1,
                height: 1,
                overflow: 'hidden',
              }}
            >
              <label htmlFor="signup-website">Site web</label>
              <input
                id="signup-website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            {/* Age gate. Two-layer defence on RGPD Art. 8 (French digital
                consent age = 15):
                  1. Numeric `birthYear` — server validates the declared
                     year is 1906..currentYear-15 and rejects with
                     `belowMinAge` if too recent.
                  2. Self-declaration checkbox — same idea, dual signal in
                     case the user mistypes the year. Both flags are
                     enforced server-side; the input + checkbox are pure
                     UX. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              <div>
                <label htmlFor="signup-birthyear" className="dz-label">
                  {t('signupForm.birthYearLabel')}
                </label>
                <input
                  id="signup-birthyear"
                  name="birthYear"
                  type="number"
                  inputMode="numeric"
                  className="dz-input"
                  required
                  min={1906}
                  max={new Date().getFullYear() - 15}
                  step={1}
                  placeholder={t('signupForm.birthYearPlaceholder')}
                  autoComplete="bday-year"
                  style={{ width: '100%' }}
                />
                <span className="dz-small" style={{ display: 'block', marginTop: 4, fontSize: 12, color: '#6b6b8a' }}>
                  {t('signupForm.birthYearHelper')}
                </span>
              </div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  cursor: 'pointer',
                  fontSize: 13,
                  color: '#3a2960',
                }}
              >
                <input
                  type="checkbox"
                  name="ageOver15"
                  value="1"
                  required
                  style={{ marginTop: 3 }}
                />
                <span>{t('signupForm.ageDeclaration')}</span>
              </label>
            </div>
            <button type="submit" disabled={signupPending} className="dz-btn dz-btn-primary dz-btn-lg" style={{ width: '100%', marginTop: 8, opacity: signupPending ? 0.7 : 1 }}>
              {signupPending ? t('signupForm.submitting') : t('signupForm.submit')}
            </button>
            <div className="dz-small" style={{ textAlign: 'center' }}>
              {t('signupForm.terms')}
            </div>
          </div>
          <div className="dz-divider"><span className="dz-small">{t('loginForm.or')}</span></div>
          <SocialButtons enabled={oauthEnabled} disabledLabel={t("oauth.disabled")} next={nextPath} />
        </form>
      )}

      {state.status === 'success' && state.message && (
        <div role="status" style={{ marginTop: 16, padding: 12, borderRadius: 10, background: 'rgba(35,197,94,0.10)', color: '#108a48', fontSize: 14 }}>
          {t('feedback.successPrefix')}{state.message}
        </div>
      )}
      {(postVerifyBanner || postResetBanner) && (
        <div role="status" style={{ marginTop: 16, padding: 12, borderRadius: 10, background: 'rgba(35,197,94,0.10)', color: '#108a48', fontSize: 14 }}>
          {t('feedback.successPrefix')}{postVerifyBanner ?? postResetBanner}
        </div>
      )}
      {state.status === 'error' && (
        <div role="alert" style={{ marginTop: 16, padding: 12, borderRadius: 10, background: 'rgba(217,78,146,0.10)', color: '#a8235e', fontSize: 14 }}>
          {t('feedback.errorPrefix')}{translateError(state.error)}
          {state.error === 'emailNotVerified' && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => {
                  // Re-open the verification modal seeded from the login form.
                  const input = document.querySelector<HTMLInputElement>('#login-email');
                  if (input?.value) {
                    setVerifyEmail(input.value);
                    setVerifyOpen(true);
                  }
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  color: '#7301FF',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: 14,
                }}
              >
                {t('verifyModal.title')}
              </button>
            </>
          )}
        </div>
      )}

      <VerificationModal
        open={verifyOpen}
        email={verifyEmail}
        onClose={() => setVerifyOpen(false)}
        onVerified={(email) => {
          setVerifyOpen(false);
          setTab('login');
          setPrefillEmail(email);
          setPostVerifyBanner(t('verifyModal.successMessage'));
          setPostResetBanner(null);
          // Auto-clear banner after a few seconds so it doesn't stick.
          setTimeout(() => setPostVerifyBanner(null), 6000);
        }}
      />

      <ResetModal
        open={resetOpen}
        initialEmail={resetSeedEmail}
        onClose={() => setResetOpen(false)}
        onCompleted={(email) => {
          setResetOpen(false);
          setTab('login');
          setPrefillEmail(email);
          setPostResetBanner(t('resetModal.successMessage'));
          setPostVerifyBanner(null);
          setTimeout(() => setPostResetBanner(null), 6000);
        }}
      />
    </div>
  );
}

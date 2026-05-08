'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { useFocusTrap } from '@/hooks/useFocusTrap';
import {
  startTotpSetup,
  confirmTotpSetup,
  disableTotp,
  regenerateBackupCodes,
  type TotpSetupState,
  type TotpDisableState,
} from '@/lib/actions/two-factor';

/**
 * Two-factor authentication card + modal — replaces the previous
 * navigation to /account/2fa with an in-place dialog. Sized to its
 * own content: ~520px when 2FA is disabled (status + activate CTA),
 * grows to ~720px when in setup mode (QR + secret + verification form).
 *
 * State machine:
 *   closed
 *     ├── click card → open
 *     │     ├── if enabled  → "manage" view (status + regen + disable)
 *     │     │     └── click "Activer le mode setup" → "setup" view
 *     │     └── if disabled → "intro" view → click "Activer" → setup
 *     └── click ✕ / Escape / backdrop → closed
 *
 *   setup view: server action `startTotpSetup` is called the FIRST
 *   time we enter setup, the response is cached in state for the
 *   rest of the modal lifetime so the secret stays stable as the
 *   user retries the code input.
 */

export type TwoFactorCardProps = {
  enabled: boolean;
  totpEnabledAtIso: string | null;
  backupCodesRemaining: number;
  isPrivileged: boolean;
  privilegedReason: 'admin' | 'moderator' | 'mentor' | null;
  dpoEmail: string;
};

type View = 'manage' | 'setup' | 'success';

export default function TwoFactorCard(props: TwoFactorCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: 18,
          width: '100%',
          textAlign: 'left',
          borderRadius: 18,
          background: 'rgba(115,1,255,0.04)',
          border: '1px solid rgba(115,1,255,0.20)',
          color: 'inherit',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'background 160ms ease, border-color 160ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(115,1,255,0.07)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(115,1,255,0.04)';
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#7301FF' }}>
            Sécurité
          </div>
          <h3 style={{ margin: '4px 0 2px', fontSize: 16, fontWeight: 800, color: '#1a1f3a' }}>
            Double authentification (2FA)
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: '#3a2960' }}>
            {props.enabled
              ? 'Active. Tu peux régénérer tes codes de secours ou désactiver depuis le panneau.'
              : 'Active une 2FA TOTP pour protéger ton compte au-delà du mot de passe.'}
          </p>
        </div>
        <div
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px 10px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            background: props.enabled ? 'rgba(35,197,94,0.12)' : 'rgba(115,1,255,0.10)',
            color: props.enabled ? '#0e8a4a' : '#7301FF',
          }}
        >
          {props.enabled ? 'Active' : 'Désactivée'}
        </div>
      </button>

      {open && <TwoFactorDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

/* ============================================================
   Dialog
   ============================================================ */

function TwoFactorDialog({
  enabled,
  totpEnabledAtIso,
  backupCodesRemaining,
  isPrivileged,
  privilegedReason,
  dpoEmail,
  onClose,
}: TwoFactorCardProps & { onClose: () => void }) {
  const router = useRouter();
  const dialogRef = useFocusTrap<HTMLDivElement>(true);

  // The default landing view depends on current 2FA state. If the
  // user clicks "Activer" we switch to setup; success swaps in
  // when verification confirms.
  const [view, setView] = useState<View>(enabled ? 'manage' : 'manage');

  // ── Setup state (lazy fetched on first transition to 'setup') ──
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [setupOtpUri, setSetupOtpUri] = useState<string | null>(null);
  const [setupErr, setSetupErr] = useState<string | null>(null);
  const [bootingSetup, startBootSetup] = useTransition();

  const enterSetup = () => {
    if (setupSecret && setupOtpUri) {
      setView('setup');
      return;
    }
    startBootSetup(async () => {
      const res = await startTotpSetup();
      if (res.status === 'pending') {
        setSetupSecret(res.secret);
        setSetupOtpUri(res.otpauthUri);
        setView('setup');
      } else if (res.status === 'enabled') {
        setView('success');
      } else if (res.status === 'error') {
        setSetupErr(res.error);
      }
    });
  };

  // Close on Escape (keyboard accessibility — useFocusTrap handles tab,
  // we still want Esc to dismiss the way every native modal does).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const dateFmt = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Width adapts to the active view — narrow for status/intro, wider
  // for the QR + form pair so the QR has breathing room.
  const maxWidth = view === 'setup' ? 760 : 520;

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(15, 10, 46, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '64px 16px 24px',
        overflowY: 'auto',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dz-2fa-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth,
          background: 'white',
          borderRadius: 22,
          padding: 0,
          boxShadow: '0 32px 80px -20px rgba(36,18,80,0.35)',
          maxHeight: 'calc(100vh - 88px)',
          overflowY: 'auto',
          transition: 'max-width 240ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            padding: '24px 28px 14px',
            borderBottom: '1px solid rgba(115,1,255,0.08)',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                color: '#7301FF',
                marginBottom: 4,
              }}
            >
              Sécurité du compte
            </div>
            <h2
              id="dz-2fa-modal-title"
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                color: '#1a1f3a',
                letterSpacing: '-0.01em',
              }}
            >
              Double authentification
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            title="Fermer"
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '1px solid rgba(115,1,255,0.18)',
              background: 'rgba(115,1,255,0.04)',
              color: '#7301FF',
              cursor: 'pointer',
              fontSize: 18,
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </header>

        {/* Body */}
        <div style={{ padding: '20px 28px 24px' }}>
          {view === 'manage' && (
            <ManageView
              enabled={enabled}
              totpEnabledAtIso={totpEnabledAtIso}
              backupCodesRemaining={backupCodesRemaining}
              isPrivileged={isPrivileged}
              privilegedReason={privilegedReason}
              dpoEmail={dpoEmail}
              dateFmt={dateFmt}
              onActivate={enterSetup}
              activateBusy={bootingSetup}
              activateError={setupErr}
              onClose={onClose}
              onAfterDisable={() => {
                onClose();
                router.refresh();
              }}
            />
          )}
          {view === 'setup' && setupSecret && setupOtpUri && (
            <SetupView
              secret={setupSecret}
              otpauthUri={setupOtpUri}
              onCancel={() => setView('manage')}
              onSuccess={() => {
                setView('success');
                router.refresh();
              }}
            />
          )}
          {view === 'success' && (
            <SuccessView
              onClose={() => {
                onClose();
                router.refresh();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Manage view (status + regen + disable / privileged-lock)
   ============================================================ */

function ManageView({
  enabled,
  totpEnabledAtIso,
  backupCodesRemaining,
  isPrivileged,
  privilegedReason,
  dpoEmail,
  dateFmt,
  onActivate,
  activateBusy,
  activateError,
  onAfterDisable,
}: {
  enabled: boolean;
  totpEnabledAtIso: string | null;
  backupCodesRemaining: number;
  isPrivileged: boolean;
  privilegedReason: 'admin' | 'moderator' | 'mentor' | null;
  dpoEmail: string;
  dateFmt: Intl.DateTimeFormat;
  onActivate: () => void;
  activateBusy: boolean;
  activateError: string | null;
  onClose: () => void;
  onAfterDisable: () => void;
}) {
  if (!enabled) {
    return (
      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ margin: 0, fontSize: 14, color: '#3a2960', lineHeight: 1.6 }}>
          Active la 2FA pour ajouter une deuxième barrière en cas de mot de passe compromis. La
          configuration prend une minute avec n&apos;importe quelle app authenticator (Google
          Authenticator, 1Password, Authy…).
        </p>
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            display: 'grid',
            gap: 10,
          }}
        >
          {[
            { n: '01', l: 'Scanner', d: 'Tu scanneras un QR avec ton app.' },
            { n: '02', l: 'Confirmer', d: 'Tu saisiras un code à 6 chiffres pour valider.' },
            { n: '03', l: 'Sauvegarder', d: '10 codes de secours à conserver.' },
          ].map((s) => (
            <li
              key={s.n}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: 12,
                alignItems: 'baseline',
                padding: '10px 14px',
                background: 'rgba(115,1,255,0.04)',
                border: '1px solid rgba(115,1,255,0.10)',
                borderRadius: 12,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', color: '#7301FF' }}>
                {s.n}
              </span>
              <span>
                <strong style={{ fontSize: 14, color: '#1a1f3a' }}>{s.l}</strong>
                <span style={{ display: 'block', fontSize: 12.5, color: '#545b7a', marginTop: 2 }}>
                  {s.d}
                </span>
              </span>
            </li>
          ))}
        </ul>
        {activateError && (
          <div
            role="alert"
            style={{
              padding: 10,
              borderRadius: 10,
              background: 'rgba(217,78,146,0.10)',
              color: '#a8235e',
              fontSize: 13,
            }}
          >
            {activateError === 'already_enabled'
              ? 'La 2FA est déjà activée pour ce compte.'
              : 'Une erreur est survenue. Réessaie.'}
          </div>
        )}
        <button
          type="button"
          onClick={onActivate}
          disabled={activateBusy}
          className="dz-btn dz-btn-primary dz-btn-lg"
          style={{ width: '100%', opacity: activateBusy ? 0.7 : 1 }}
        >
          {activateBusy ? 'Préparation…' : 'Activer la 2FA'}
        </button>
      </section>
    );
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          padding: 16,
          borderRadius: 14,
          background: 'rgba(35,197,94,0.06)',
          border: '1px solid rgba(35,197,94,0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '3px 10px',
            borderRadius: 999,
            background: 'rgba(35,197,94,0.10)',
            color: '#0e8a4a',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            alignSelf: 'flex-start',
          }}
        >
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: '#23c55e' }} />
          Authentification active
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#3a2960' }}>
          Activée le{' '}
          {totpEnabledAtIso ? dateFmt.format(new Date(totpEnabledAtIso)) : '—'}.
        </p>
        <p style={{ margin: 0, fontSize: 13, color: '#3a2960' }}>
          <strong>{backupCodesRemaining}</strong> code
          {backupCodesRemaining > 1 ? 's' : ''} de secours restant
          {backupCodesRemaining > 1 ? 's' : ''}.
        </p>
      </div>

      <RegenerateBackupCodesInline remaining={backupCodesRemaining} />

      {isPrivileged ? (
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: 'rgba(217,78,146,0.06)',
            border: '1px solid rgba(217,78,146,0.20)',
            fontSize: 13,
            color: '#3a2960',
            lineHeight: 1.6,
          }}
        >
          <strong>
            2FA verrouillée pour{' '}
            {privilegedReason === 'admin'
              ? 'les administrateurs'
              : privilegedReason === 'moderator'
                ? 'les modérateurs et modératrices'
                : 'les mentors actifs'}
            .
          </strong>{' '}
          Pour désactiver ou réinitialiser, demande à un⋅e administrateur⋅trice ou contacte{' '}
          {dpoEmail}.
        </div>
      ) : (
        <DisableInline onAfterSuccess={onAfterDisable} />
      )}
    </section>
  );
}

/* ============================================================
   Regenerate backup codes (inline mini-form)
   ============================================================ */

function RegenerateBackupCodesInline({ remaining }: { remaining: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState('');

  if (codes) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 14,
          background: 'rgba(115,1,255,0.04)',
          border: '1px dashed rgba(115,1,255,0.30)',
        }}
      >
        <strong style={{ fontSize: 14, color: '#1a1f3a' }}>Nouveaux codes de secours</strong>
        <p style={{ margin: '4px 0 12px', fontSize: 12, color: '#545b7a' }}>
          Conserve-les en lieu sûr. Les anciens codes sont invalidés.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4px 24px',
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontSize: 13,
            userSelect: 'all',
            color: '#1a1f3a',
            letterSpacing: '0.04em',
          }}
        >
          {codes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(codes.join('\n'));
          }}
          className="dz-btn dz-btn-ghost dz-btn-sm"
          style={{ marginTop: 12 }}
        >
          Copier la liste
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="dz-btn dz-btn-ghost"
        style={{ alignSelf: 'flex-start', fontSize: 13 }}
      >
        Régénérer mes codes de secours ({remaining} restants)
      </button>
    );
  }

  const onSubmit = (formData: FormData) => {
    setErr(null);
    startTransition(async () => {
      const res = await regenerateBackupCodes(formData);
      if (res.status === 'success') {
        setCodes(res.backupCodes);
        router.refresh();
      } else if (res.status === 'error') {
        setErr(res.error);
      }
    });
  };

  return (
    <form
      action={onSubmit}
      style={{
        padding: 14,
        borderRadius: 12,
        background: 'white',
        border: '1px solid rgba(115,1,255,0.18)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ fontSize: 13, color: '#3a2960' }}>
        Saisis un code à 6 chiffres frais pour confirmer la régénération.
      </div>
      <input
        name="code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        minLength={6}
        maxLength={6}
        pattern="[0-9]{6}"
        placeholder="123 456"
        className="dz-input"
        style={{
          width: '100%',
          letterSpacing: 6,
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontSize: 18,
          textAlign: 'center',
        }}
      />
      {err && (
        <div role="alert" style={{ fontSize: 12, color: '#a8235e' }}>
          {err === 'invalid_code' ? 'Code invalide.' : 'Erreur. Réessaie.'}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setCode('');
            setErr(null);
          }}
          className="dz-btn dz-btn-ghost dz-btn-sm"
          disabled={pending}
        >
          Annuler
        </button>
        <button
          type="submit"
          className="dz-btn dz-btn-primary dz-btn-sm"
          disabled={pending || code.length !== 6}
        >
          {pending ? '…' : 'Régénérer'}
        </button>
      </div>
    </form>
  );
}

/* ============================================================
   Disable inline (non-privileged users)
   ============================================================ */

function DisableInline({ onAfterSuccess }: { onAfterSuccess: () => void }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [state, setState] = useState<TotpDisableState>({ status: 'idle' });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          alignSelf: 'flex-start',
          padding: '8px 16px',
          borderRadius: 10,
          border: '1px solid rgba(217,78,146,0.40)',
          background: 'transparent',
          color: '#a8235e',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Désactiver la 2FA
      </button>
    );
  }

  const onSubmit = (formData: FormData) => {
    startTransition(async () => {
      const res = await disableTotp(formData);
      setState(res);
      if (res.status === 'success') {
        onAfterSuccess();
      }
    });
  };

  const errKey = state.status === 'error' ? state.error : null;

  return (
    <form
      action={onSubmit}
      style={{
        padding: 14,
        borderRadius: 12,
        background: 'rgba(217,78,146,0.04)',
        border: '1px solid rgba(217,78,146,0.25)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: '#a8235e', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Confirmation requise
      </div>
      <p style={{ margin: 0, fontSize: 13, color: '#3a2960', lineHeight: 1.55 }}>
        Saisis un code à 6 chiffres frais pour prouver la possession du second facteur. La
        désactivation supprime aussi tes codes de secours.
      </p>
      <input
        name="code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        minLength={6}
        maxLength={6}
        pattern="[0-9]{6}"
        placeholder="123 456"
        className="dz-input"
        style={{
          width: '100%',
          letterSpacing: 6,
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontSize: 18,
          textAlign: 'center',
        }}
      />
      {errKey && (
        <div role="alert" style={{ fontSize: 12, color: '#a8235e' }}>
          {errKey === 'invalid_code'
            ? 'Code invalide. Réessaie.'
            : errKey === 'is_admin'
              ? 'Les administrateurs ne peuvent pas désactiver la 2FA eux-mêmes.'
              : errKey === 'not_enabled'
                ? '2FA déjà désactivée.'
                : 'Erreur. Réessaie.'}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setCode('');
            setState({ status: 'idle' });
          }}
          className="dz-btn dz-btn-ghost dz-btn-sm"
          disabled={pending}
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={pending || code.length !== 6}
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            border: 'none',
            background: pending
              ? 'rgba(217,78,146,0.30)'
              : 'linear-gradient(135deg, #d94e92, #a8235e)',
            color: 'white',
            fontSize: 13,
            fontWeight: 700,
            cursor: pending ? 'wait' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {pending ? 'Désactivation…' : 'Confirmer'}
        </button>
      </div>
    </form>
  );
}

/* ============================================================
   Setup view (QR + secret + verification form)
   ============================================================ */

function SetupView({
  secret,
  otpauthUri,
  onCancel,
  onSuccess,
}: {
  secret: string;
  otpauthUri: string;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<TotpSetupState>({ status: 'idle' });
  const [code, setCode] = useState('');
  const [secretCopied, setSecretCopied] = useState(false);
  const [acked, setAcked] = useState(false);

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(otpauthUri)}`;

  const onSubmit = (formData: FormData) => {
    startTransition(async () => {
      const res = await confirmTotpSetup(formData);
      setState(res);
    });
  };

  // Once enabled with backup codes returned, show them inline and
  // require ack before letting the user close the modal.
  if (state.status === 'enabled') {
    const codes = state.backupCodes ?? [];
    return (
      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 12px',
            borderRadius: 999,
            background: 'rgba(35,197,94,0.10)',
            color: '#0e8a4a',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            alignSelf: 'flex-start',
          }}
        >
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: '#23c55e' }} />
          Authentification active
        </div>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1a1f3a' }}>
          Codes de secours
        </h3>
        <p style={{ margin: 0, fontSize: 13.5, color: '#545b7a', lineHeight: 1.55 }}>
          Conserve ces 10 codes dans un endroit sûr (gestionnaire de mots de passe, coffre-fort
          numérique). Chacun n&apos;est valable qu&apos;une seule fois et te dépanne si tu perds
          ton téléphone. La liste ne sera plus affichée après cette page.
        </p>
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            background: 'rgba(115,1,255,0.04)',
            border: '1px dashed rgba(115,1,255,0.30)',
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontSize: 14,
            lineHeight: 1.9,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '6px 24px',
            color: '#1a1f3a',
            userSelect: 'all',
          }}
        >
          {codes.map((c) => (
            <span key={c} style={{ letterSpacing: '0.06em' }}>{c}</span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(codes.join('\n'));
          }}
          className="dz-btn dz-btn-ghost dz-btn-sm"
          style={{ alignSelf: 'flex-start', fontSize: 13 }}
        >
          Copier la liste
        </button>
        <label
          style={{
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            fontSize: 13,
            color: '#3a2960',
            cursor: 'pointer',
            background: 'rgba(115,1,255,0.04)',
            border: '1px solid rgba(115,1,255,0.12)',
            borderRadius: 12,
          }}
        >
          <input
            type="checkbox"
            checked={acked}
            onChange={(e) => setAcked(e.target.checked)}
            style={{ marginTop: 3, accentColor: '#7301FF' }}
          />
          <span>
            J&apos;ai sauvegardé ces codes en lieu sûr. Je comprends qu&apos;ils ne seront plus
            affichés.
          </span>
        </label>
        <button
          type="button"
          disabled={!acked}
          onClick={onSuccess}
          className="dz-btn dz-btn-primary dz-btn-lg"
          style={{ width: '100%', opacity: acked ? 1 : 0.45, cursor: acked ? 'pointer' : 'not-allowed' }}
        >
          Terminer
        </button>
      </section>
    );
  }

  const errKey = state.status === 'error' ? state.error : null;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Step 1 — Scan + manual key */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr',
          gap: 22,
          padding: 18,
          borderRadius: 14,
          border: '1px solid rgba(115,1,255,0.14)',
          alignItems: 'center',
        }}
        className="dz-2fa-modal-scan"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrSrc}
          alt="Code QR pour l'application d'authentification"
          width={220}
          height={220}
          style={{
            borderRadius: 12,
            background: 'white',
            padding: 6,
            border: '1px solid rgba(115,1,255,0.10)',
            display: 'block',
          }}
        />
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#7301FF',
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Étape 1
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#1a1f3a' }}>
            Scanne le QR avec ton authenticator
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: '#545b7a', lineHeight: 1.55 }}>
            Ouvre Google Authenticator (ou ton app équivalente) et utilise « Ajouter un compte →
            Scanner un QR code ». Ou saisis le secret manuellement&nbsp;:
          </p>
          <code
            style={{
              display: 'block',
              marginTop: 10,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(115,1,255,0.05)',
              border: '1px solid rgba(115,1,255,0.15)',
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              fontSize: 12.5,
              color: '#1a1f3a',
              userSelect: 'all',
              wordBreak: 'break-all',
            }}
          >
            {secret}
          </code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(secret);
              setSecretCopied(true);
              setTimeout(() => setSecretCopied(false), 2000);
            }}
            style={{
              marginTop: 8,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              background: 'transparent',
              color: '#7301FF',
              border: '1px solid rgba(115,1,255,0.25)',
              borderRadius: 8,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {secretCopied ? 'Copié' : 'Copier le secret'}
          </button>
        </div>
      </div>

      {/* Step 2 — Code form */}
      <form
        action={onSubmit}
        style={{
          padding: 18,
          borderRadius: 14,
          border: '1px solid rgba(115,1,255,0.14)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <input type="hidden" name="secret" value={secret} />
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#7301FF',
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
          }}
        >
          Étape 2
        </div>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1a1f3a' }}>
          Saisis le code généré
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: '#545b7a', lineHeight: 1.55 }}>
          Le code change toutes les 30 secondes. Si la vérification échoue, vérifie l&apos;heure
          de ton téléphone (paramètres système).
        </p>
        <input
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          minLength={6}
          maxLength={6}
          pattern="[0-9]{6}"
          placeholder="000 000"
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid rgba(115,1,255,0.20)',
            background: 'white',
            color: '#1a1f3a',
            letterSpacing: 8,
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontSize: 22,
            textAlign: 'center',
            fontWeight: 600,
          }}
        />
        {errKey && (
          <div
            role="alert"
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              background: 'rgba(217,78,146,0.08)',
              border: '1px solid rgba(217,78,146,0.20)',
              color: '#a8235e',
              fontSize: 12.5,
            }}
          >
            {errKey === 'invalid_code'
              ? "Code invalide. Vérifie l'heure de ton téléphone et réessaie."
              : errKey === 'already_enabled'
                ? 'La 2FA est déjà activée.'
                : 'Erreur. Réessaie.'}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            className="dz-btn dz-btn-ghost dz-btn-sm"
            disabled={pending}
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={pending || code.length !== 6}
            className="dz-btn dz-btn-primary"
            style={{ opacity: pending ? 0.7 : 1 }}
          >
            {pending ? 'Vérification…' : 'Activer la 2FA'}
          </button>
        </div>
      </form>

      <style>{`
        @media (max-width: 640px) {
          .dz-2fa-modal-scan { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

/* ============================================================
   Success view (after backup codes acked, transient)
   ============================================================ */

function SuccessView({ onClose }: { onClose: () => void }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 12px',
          borderRadius: 999,
          background: 'rgba(35,197,94,0.10)',
          color: '#0e8a4a',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: '#23c55e' }} />
        2FA active
      </div>
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1a1f3a' }}>
        Tout est prêt
      </h3>
      <p style={{ margin: 0, fontSize: 13.5, color: '#545b7a', lineHeight: 1.55 }}>
        À ta prochaine connexion, un code à 6 chiffres te sera demandé après ton mot de passe.
      </p>
      <button type="button" onClick={onClose} className="dz-btn dz-btn-primary" style={{ alignSelf: 'flex-end' }}>
        Fermer
      </button>
    </section>
  );
}

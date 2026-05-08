'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { confirmTotpSetup, type TotpSetupState } from '@/lib/actions/two-factor';

/**
 * Two-step form: (1) "I scanned the QR" → reveal code input, (2) submit
 * code. After success we surface the backup codes once and only once,
 * with a checkbox the user must tick before being allowed to leave.
 *
 * The QR rendering uses the public api.qrserver.com endpoint as a
 * lightweight image source — we never POST the secret, the URI in the
 * GET query has the same trust boundary as the QR an authenticator
 * would scan offline. Swappable for a self-hosted QR lib later.
 */
export default function SetupForm({
  secret,
  otpauthUri,
  nextPath,
}: {
  secret: string;
  otpauthUri: string;
  nextPath: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<TotpSetupState>({ status: 'idle' });
  const [acked, setAcked] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const [codesCopied, setCodesCopied] = useState(false);

  const onSubmit = (formData: FormData) => {
    startTransition(async () => {
      const res = await confirmTotpSetup(formData);
      setState(res);
    });
  };

  // ── Success state — surface backup codes ──────────────────────────────
  if (state.status === 'enabled') {
    const codes = state.backupCodes ?? [];
    return (
      <section
        aria-label="2FA activée"
        style={{
          padding: '28px 28px 24px',
          borderRadius: 18,
          background: 'white',
          border: '1px solid rgba(115,1,255,0.18)',
          boxShadow: '0 18px 48px -28px rgba(36,18,80,0.18)',
        }}
      >
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
            marginBottom: 12,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#23c55e',
            }}
          />
          Authentification active
        </div>

        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            color: '#1a1f3a',
            letterSpacing: '-0.01em',
          }}
        >
          Codes de secours
        </h2>
        <p
          style={{
            margin: '6px 0 18px',
            fontSize: 14,
            color: '#545b7a',
            lineHeight: 1.6,
          }}
        >
          Conserve ces 10 codes dans un endroit sûr (gestionnaire de mots de passe, coffre-fort
          numérique). Chacun n&apos;est valable qu&apos;une seule fois et te dépanne si tu perds ton
          téléphone. La liste ne sera plus affichée après cette page — tu pourras la régénérer
          depuis Paramètres → Sécurité.
        </p>

        <div
          style={{
            padding: 18,
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
            <span key={c} style={{ letterSpacing: '0.06em' }}>
              {c}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(codes.join('\n'));
              setCodesCopied(true);
              setTimeout(() => setCodesCopied(false), 2000);
            }}
            className="dz-btn dz-btn-ghost"
            style={{ fontSize: 13 }}
          >
            {codesCopied ? 'Copié' : 'Copier la liste'}
          </button>
          <span style={{ fontSize: 12, color: '#8b91ad' }}>10 codes · à usage unique</span>
        </div>

        <label
          style={{
            marginTop: 22,
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            fontSize: 13.5,
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
          onClick={() => {
            router.push(nextPath);
            router.refresh();
          }}
          className="dz-btn dz-btn-primary dz-btn-lg"
          style={{
            marginTop: 16,
            width: '100%',
            opacity: acked ? 1 : 0.45,
            cursor: acked ? 'pointer' : 'not-allowed',
          }}
        >
          Continuer
        </button>
      </section>
    );
  }

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(otpauthUri)}`;
  const errKey = state.status === 'error' ? state.error : null;

  // ── Setup state — scan + confirm ──────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Card 1 — Scan / manual key */}
      <section
        aria-label="Scanner le QR code"
        style={{
          padding: '24px 24px 22px',
          borderRadius: 18,
          background: 'white',
          border: '1px solid rgba(115,1,255,0.14)',
          boxShadow: '0 14px 38px -28px rgba(36,18,80,0.18)',
          display: 'grid',
          gridTemplateColumns: '240px 1fr',
          gap: 28,
          alignItems: 'center',
        }}
        className="dz-2fa-scan"
      >
        {/* External QR endpoint — Next/Image would require allowlisting
            and pre-render at build time, neither makes sense for a
            per-secret QR generated at session time. Plain <img> with
            explicit width/height to avoid CLS. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrSrc}
          alt="Code QR pour l'application d'authentification"
          width={240}
          height={240}
          style={{
            borderRadius: 14,
            background: 'white',
            padding: 8,
            border: '1px solid rgba(115,1,255,0.10)',
            display: 'block',
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#7301FF',
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Étape 1
          </div>
          <h3
            style={{
              margin: '0 0 8px',
              fontSize: 18,
              fontWeight: 800,
              color: '#1a1f3a',
            }}
          >
            Scanne ce QR avec ton authenticator
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              color: '#545b7a',
              lineHeight: 1.6,
            }}
          >
            Ouvre Google Authenticator (ou ton app équivalente) et utilise « Ajouter un compte →
            Scanner un QR code ». Tu peux aussi saisir le secret manuellement&nbsp;:
          </p>

          <div style={{ marginTop: 14 }}>
            <code
              style={{
                display: 'block',
                padding: '12px 14px',
                borderRadius: 10,
                background: 'rgba(115,1,255,0.05)',
                border: '1px solid rgba(115,1,255,0.15)',
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                fontSize: 13,
                color: '#1a1f3a',
                userSelect: 'all',
                wordBreak: 'break-all',
                letterSpacing: '0.04em',
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
      </section>

      {/* Card 2 — confirmation form */}
      <form
        action={onSubmit}
        aria-label="Confirmer avec le code"
        style={{
          padding: '24px 24px 22px',
          borderRadius: 18,
          background: 'white',
          border: '1px solid rgba(115,1,255,0.14)',
          boxShadow: '0 14px 38px -28px rgba(36,18,80,0.18)',
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
            marginBottom: 6,
          }}
        >
          Étape 2
        </div>
        <h3
          style={{
            margin: '0 0 6px',
            fontSize: 18,
            fontWeight: 800,
            color: '#1a1f3a',
          }}
        >
          Saisis le code généré par ton app
        </h3>
        <p
          style={{
            margin: '0 0 14px',
            fontSize: 13.5,
            color: '#545b7a',
            lineHeight: 1.6,
          }}
        >
          Le code change toutes les 30 secondes. Si la vérification échoue, vérifie l&apos;heure de
          ton téléphone (paramètres système).
        </p>

        <label
          htmlFor="totp-code"
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 700,
            color: '#3a2960',
            letterSpacing: '0.04em',
            marginBottom: 6,
          }}
        >
          Code à 6 chiffres
        </label>
        <input
          id="totp-code"
          name="code"
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
            padding: '14px 16px',
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
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(217,78,146,0.08)',
              border: '1px solid rgba(217,78,146,0.20)',
              color: '#a8235e',
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {errKey === 'invalid_code'
              ? "Code invalide. Vérifie l'heure de ton téléphone et réessaie."
              : errKey === 'already_enabled'
                ? 'La 2FA est déjà activée pour ce compte.'
                : 'Une erreur est survenue. Réessaie.'}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="dz-btn dz-btn-primary dz-btn-lg"
          style={{
            width: '100%',
            marginTop: 16,
            opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? 'Vérification…' : 'Activer la double authentification'}
        </button>
      </form>

      <style>{`
        @media (max-width: 720px) {
          .dz-2fa-scan {
            grid-template-columns: 1fr !important;
            justify-items: center;
            text-align: center;
          }
          .dz-2fa-scan > div { text-align: left; }
        }
      `}</style>
    </div>
  );
}

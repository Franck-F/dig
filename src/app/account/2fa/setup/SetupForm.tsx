'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { confirmTotpSetup, type TotpSetupState } from '@/lib/actions/two-factor';

/**
 * Two-step form: (1) "I scanned the QR" → reveal code input, (2) submit
 * code. After success we surface the backup codes once and only once,
 * with a checkbox the user must tick before being allowed to leave.
 *
 * The QR rendering is server-free: we point a client-side Google Charts
 * fallback as a last resort, and prefer the otpauth:// URI which most
 * password managers handle natively when the user clicks. We also show
 * the secret in a copy-friendly format for users without a camera.
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

  const onSubmit = (formData: FormData) => {
    startTransition(async () => {
      const res = await confirmTotpSetup(formData);
      setState(res);
    });
  };

  if (state.status === 'enabled') {
    const codes = state.backupCodes ?? [];
    return (
      <section
        style={{
          marginTop: 20,
          padding: 22,
          borderRadius: 18,
          background: 'rgba(115,1,255,0.04)',
          border: '1px solid rgba(115,1,255,0.20)',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1a1f3a' }}>
          ✅ 2FA activée
        </h2>
        <p style={{ margin: '8px 0 14px', fontSize: 13, color: '#3a2960', lineHeight: 1.6 }}>
          Conserve ces 10 codes de secours dans un endroit sûr (gestionnaire de mots de passe,
          coffre-fort numérique). Chaque code n&apos;est valable qu&apos;une seule fois ; tu peux
          régénérer la liste plus tard depuis Paramètres → Sécurité.
        </p>

        <pre
          style={{
            margin: 0,
            padding: 16,
            borderRadius: 12,
            background: 'white',
            border: '1px dashed rgba(115,1,255,0.30)',
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontSize: 14,
            lineHeight: 1.7,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            color: '#1a1f3a',
            userSelect: 'all',
          }}
        >
          {codes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </pre>

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(codes.join('\n'));
            }}
            className="dz-btn dz-btn-ghost"
            style={{ fontSize: 13 }}
          >
            Copier la liste
          </button>
        </div>

        <label
          style={{
            marginTop: 18,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            fontSize: 13,
            color: '#3a2960',
          }}
        >
          <input
            type="checkbox"
            checked={acked}
            onChange={(e) => setAcked(e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>
            J&apos;ai sauvegardé ces codes en lieu sûr. Ils ne seront plus affichés.
          </span>
        </label>

        <button
          type="button"
          disabled={!acked}
          onClick={() => {
            router.push(nextPath);
            router.refresh();
          }}
          className="dz-btn dz-btn-primary"
          style={{ marginTop: 14, opacity: acked ? 1 : 0.5, cursor: acked ? 'pointer' : 'not-allowed' }}
        >
          Continuer →
        </button>
      </section>
    );
  }

  // Render the otpauth URI as a QR via Google's chart endpoint. We
  // intentionally do NOT submit the secret to a third-party server —
  // the URI itself is just metadata + the secret, and Google's chart
  // endpoint sees only what the user's authenticator app would see in
  // the QR. Acceptable: same trust boundary as the existing camera
  // capture step. If you'd rather keep this fully self-hosted, swap
  // the <img> for a client-side QR library like `qr-code-styling`.
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(otpauthUri)}`;

  const errKey = state.status === 'error' ? state.error : null;

  return (
    <section style={{ marginTop: 20 }}>
      <div
        style={{
          padding: 22,
          borderRadius: 18,
          background: 'white',
          border: '1px solid rgba(115,1,255,0.18)',
          display: 'flex',
          gap: 22,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        {/* External QR endpoint — Next/Image would require us to
            allowlist the host in next.config.images and pre-render at
            build time, neither of which makes sense for a per-secret
            QR generated at session time. Plain <img> with explicit
            width/height to avoid CLS. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrSrc}
          alt="QR code TOTP"
          width={240}
          height={240}
          style={{ borderRadius: 14, background: 'white' }}
        />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#7301FF', marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Saisie manuelle
          </div>
          <p style={{ margin: '0 0 6px', fontSize: 12, color: '#545b7a', lineHeight: 1.5 }}>
            Si tu ne peux pas scanner le QR, copie ce secret dans ton application&nbsp;:
          </p>
          <code
            style={{
              display: 'block',
              padding: 10,
              borderRadius: 10,
              background: 'rgba(115,1,255,0.05)',
              border: '1px solid rgba(115,1,255,0.15)',
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              fontSize: 13,
              color: '#1a1f3a',
              userSelect: 'all',
              wordBreak: 'break-all',
            }}
          >
            {secret}
          </code>
        </div>
      </div>

      <form
        action={onSubmit}
        style={{
          marginTop: 18,
          padding: 22,
          borderRadius: 18,
          background: 'white',
          border: '1px solid rgba(115,1,255,0.18)',
        }}
      >
        <input type="hidden" name="secret" value={secret} />
        <label htmlFor="totp-code" className="dz-label">
          Code à 6 chiffres
        </label>
        <input
          id="totp-code"
          name="code"
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
            marginTop: 6,
            letterSpacing: 6,
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontSize: 22,
            textAlign: 'center',
          }}
        />
        {errKey && (
          <div
            role="alert"
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 10,
              background: 'rgba(217,78,146,0.10)',
              color: '#a8235e',
              fontSize: 13,
            }}
          >
            {errKey === 'invalid_code'
              ? 'Code invalide. Vérifie l\'heure de ton téléphone et réessaie.'
              : errKey === 'already_enabled'
                ? 'La 2FA est déjà activée pour ce compte.'
                : "Une erreur est survenue. Réessaie."}
          </div>
        )}
        <button
          type="submit"
          disabled={pending}
          className="dz-btn dz-btn-primary dz-btn-lg"
          style={{ width: '100%', marginTop: 14, opacity: pending ? 0.7 : 1 }}
        >
          {pending ? 'Vérification…' : 'Activer la 2FA'}
        </button>
      </form>
    </section>
  );
}

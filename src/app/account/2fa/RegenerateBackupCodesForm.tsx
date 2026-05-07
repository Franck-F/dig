'use client';

import { useState, useTransition } from 'react';

import { regenerateBackupCodes, type TotpRegenerateBackupState } from '@/lib/actions/two-factor';

/**
 * Lets the user mint a new set of 10 backup codes after proving
 * possession of the second factor with a fresh TOTP code. Any
 * remaining old codes are invalidated unconditionally — we don't
 * keep a "rolling pool" because the user explicitly asked to
 * regenerate (typically because the old list was lost or leaked).
 */
export default function RegenerateBackupCodesForm({
  remaining,
}: {
  remaining: number;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<TotpRegenerateBackupState>({ status: 'idle' });
  const [acked, setAcked] = useState(false);

  if (state.status === 'success') {
    const codes = state.backupCodes;
    return (
      <section
        style={{
          marginTop: 14,
          padding: 18,
          borderRadius: 14,
          background: 'rgba(115,1,255,0.06)',
          border: '1px solid rgba(115,1,255,0.20)',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: '#7301FF',
            marginBottom: 6,
          }}
        >
          Nouveaux codes de secours
        </div>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1a1f3a' }}>
          ✅ 10 nouveaux codes générés
        </h3>
        <p style={{ margin: '6px 0 12px', fontSize: 13, color: '#3a2960', lineHeight: 1.6 }}>
          Conserve-les en lieu sûr. Tes anciens codes sont définitivement invalidés.
        </p>
        <pre
          style={{
            margin: 0,
            padding: 14,
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
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(codes.join('\n'))}
          className="dz-btn dz-btn-ghost"
          style={{ marginTop: 10, fontSize: 13 }}
        >
          Copier la liste
        </button>
        <label
          style={{
            marginTop: 14,
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
            J&apos;ai sauvegardé ces codes en lieu sûr.
          </span>
        </label>
        <button
          type="button"
          disabled={!acked}
          onClick={() => {
            setOpen(false);
            setState({ status: 'idle' });
            setAcked(false);
          }}
          className="dz-btn dz-btn-primary"
          style={{
            marginTop: 12,
            opacity: acked ? 1 : 0.5,
            cursor: acked ? 'pointer' : 'not-allowed',
          }}
        >
          Fermer
        </button>
      </section>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          marginTop: 14,
          padding: '8px 14px',
          borderRadius: 10,
          border: '1px solid rgba(115,1,255,0.30)',
          background: 'white',
          color: '#7301FF',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Régénérer mes codes de secours
      </button>
    );
  }

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          const res = await regenerateBackupCodes(formData);
          setState(res);
        });
      }}
      style={{
        marginTop: 14,
        padding: 16,
        borderRadius: 14,
        background: 'white',
        border: '1px solid rgba(115,1,255,0.20)',
      }}
    >
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
        Confirmation
      </div>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1a1f3a' }}>
        Régénérer 10 nouveaux codes
      </h3>
      <p style={{ margin: '6px 0 10px', fontSize: 13, color: '#3a2960', lineHeight: 1.6 }}>
        Saisis un code à 6 chiffres frais (depuis ton appli) pour confirmer la régénération.
        {remaining > 0
          ? ` Les ${remaining} code${remaining > 1 ? 's' : ''} de secours actuel${remaining > 1 ? 's' : ''} ${remaining > 1 ? 'seront' : 'sera'} invalidé${remaining > 1 ? 's' : ''}.`
          : ' Tous tes codes de secours actuels seront invalidés.'}
      </p>
      <input
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
          letterSpacing: 6,
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontSize: 20,
          textAlign: 'center',
        }}
      />
      {state.status === 'error' && (
        <div
          role="alert"
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 10,
            background: 'rgba(217,78,146,0.10)',
            color: '#a8235e',
            fontSize: 13,
          }}
        >
          {state.error === 'invalid_code' && 'Code invalide. Vérifie l\'horloge ou réessaie.'}
          {state.error === 'not_enabled' && '2FA non activée — rien à régénérer.'}
          {(state.error === 'unauthenticated' || state.error === 'unknown') && "Erreur. Réessaie."}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setState({ status: 'idle' });
          }}
          disabled={pending}
          className="dz-btn dz-btn-ghost"
          style={{ fontSize: 13 }}
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={pending}
          className="dz-btn dz-btn-primary"
          style={{ fontSize: 13, opacity: pending ? 0.7 : 1 }}
        >
          {pending ? 'Régénération…' : 'Confirmer'}
        </button>
      </div>
    </form>
  );
}

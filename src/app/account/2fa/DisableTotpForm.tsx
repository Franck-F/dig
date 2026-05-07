'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { disableTotp, type TotpDisableState } from '@/lib/actions/two-factor';

export default function DisableTotpForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<TotpDisableState>({ status: 'idle' });
  const [open, setOpen] = useState(false);

  const onSubmit = (formData: FormData) => {
    startTransition(async () => {
      const res = await disableTotp(formData);
      setState(res);
      if (res.status === 'success') {
        router.refresh();
      }
    });
  };

  if (state.status === 'success') {
    return (
      <section
        style={{
          marginTop: 22,
          padding: 16,
          borderRadius: 14,
          background: 'rgba(35,197,94,0.06)',
          border: '1px solid rgba(35,197,94,0.20)',
          fontSize: 13,
          color: '#108a48',
        }}
      >
        2FA désactivée. Tu peux la réactiver à tout moment depuis cette page.
      </section>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          marginTop: 22,
          padding: '10px 18px',
          borderRadius: 10,
          border: '1px solid rgba(217,78,146,0.40)',
          background: 'transparent',
          color: '#a8235e',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Désactiver la 2FA
      </button>
    );
  }

  const errKey = state.status === 'error' ? state.error : null;

  return (
    <form
      action={onSubmit}
      style={{
        marginTop: 22,
        padding: 22,
        borderRadius: 18,
        background: 'white',
        border: '1px solid rgba(217,78,146,0.30)',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: '#a8235e', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Confirmation requise
      </div>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1a1f3a' }}>
        Désactiver la 2FA
      </h2>
      <p style={{ margin: '6px 0 12px', fontSize: 13, color: '#3a2960', lineHeight: 1.6 }}>
        Saisis un code à 6 chiffres frais (depuis ton application) pour prouver la possession
        du second facteur. La désactivation supprime aussi tes codes de secours.
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
          fontSize: 22,
          textAlign: 'center',
        }}
      />
      {errKey && (
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
          {errKey === 'invalid_code'
            ? 'Code invalide. Réessaie.'
            : errKey === 'is_admin'
              ? 'Les administrateurs ne peuvent pas désactiver la 2FA eux-mêmes.'
              : errKey === 'not_enabled'
                ? '2FA déjà désactivée.'
                : 'Une erreur est survenue.'}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
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
          style={{
            padding: '10px 18px',
            borderRadius: 10,
            border: 'none',
            background: pending ? 'rgba(217,78,146,0.30)' : 'linear-gradient(135deg, #d94e92, #a8235e)',
            color: 'white',
            fontSize: 13,
            fontWeight: 700,
            cursor: pending ? 'wait' : 'pointer',
          }}
        >
          {pending ? 'Désactivation…' : 'Confirmer la désactivation'}
        </button>
      </div>
    </form>
  );
}

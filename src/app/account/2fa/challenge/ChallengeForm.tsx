'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { verifyTotpChallenge, type TotpChallengeState } from '@/lib/actions/two-factor';

export default function ChallengeForm({ next }: { next: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<TotpChallengeState>({ status: 'idle' });
  const [mode, setMode] = useState<'totp' | 'backup'>('totp');

  const onSubmit = (formData: FormData) => {
    startTransition(async () => {
      const res = await verifyTotpChallenge(formData);
      setState(res);
      if (res.status === 'success') {
        router.push(next);
        router.refresh();
      }
    });
  };

  const errKey = state.status === 'error' ? state.error : null;

  return (
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
      <input type="hidden" name="mode" value={mode} />
      <label htmlFor="totp-code" className="dz-label">
        {mode === 'totp' ? 'Code à 6 chiffres' : 'Code de secours'}
      </label>
      <input
        id="totp-code"
        name="code"
        inputMode={mode === 'totp' ? 'numeric' : 'text'}
        autoComplete="one-time-code"
        required
        autoFocus
        placeholder={mode === 'totp' ? '123 456' : 'xxxxx-xxxxx'}
        className="dz-input"
        style={{
          width: '100%',
          marginTop: 6,
          letterSpacing: mode === 'totp' ? 6 : 2,
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontSize: 20,
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
            ? 'Code incorrect. Vérifie l\'horloge ou utilise un code de secours.'
            : errKey === 'not_enabled'
              ? '2FA non configurée. Termine d\'abord la configuration.'
              : 'Une erreur est survenue. Réessaie.'}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="dz-btn dz-btn-primary dz-btn-lg"
        style={{ width: '100%', marginTop: 14, opacity: pending ? 0.7 : 1 }}
      >
        {pending ? 'Vérification…' : 'Confirmer'}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === 'totp' ? 'backup' : 'totp'));
          setState({ status: 'idle' });
        }}
        style={{
          width: '100%',
          marginTop: 10,
          background: 'transparent',
          border: 'none',
          color: '#7301FF',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          padding: 8,
        }}
      >
        {mode === 'totp' ? 'Utiliser un code de secours →' : '← Revenir au code TOTP'}
      </button>
    </form>
  );
}

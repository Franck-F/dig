'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { adminResetUserTotp, type TotpAdminResetState } from '@/lib/actions/two-factor';

/**
 * ADMIN-only panel: reset another admin/mod's 2FA when they lose their
 * device. Hidden from mods (the parent page only renders this for the
 * `viewerIsAdmin` branch). Always asks for a typed reason so the audit
 * trail captures *why* a privileged account was downgraded.
 */
export default function TwoFactorResetPanel({
  targetUserId,
  targetHandle,
  totpEnabledAt,
  isSelf,
}: {
  targetUserId: string;
  targetHandle: string;
  totpEnabledAt: Date | null;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [state, setState] = useState<TotpAdminResetState>({ status: 'idle' });

  const enabled = Boolean(totpEnabledAt);

  if (isSelf) {
    return (
      <div
        style={{
          marginTop: 8,
          padding: 12,
          borderRadius: 12,
          background: 'rgba(115,1,255,0.04)',
          border: '1px solid rgba(115,1,255,0.15)',
          fontSize: 13,
          color: '#3a2960',
          lineHeight: 1.6,
        }}
      >
        Pour gérer ta propre 2FA, va dans{' '}
        <a href="/account/2fa" style={{ color: '#7301FF', fontWeight: 600 }}>
          Paramètres → Sécurité
        </a>
        . Le reset depuis l&apos;admin n&apos;est pas autorisé sur soi-même.
      </div>
    );
  }

  if (!enabled) {
    return (
      <div
        style={{
          marginTop: 8,
          padding: 12,
          borderRadius: 12,
          background: 'rgba(115,1,255,0.04)',
          border: '1px solid rgba(115,1,255,0.15)',
          fontSize: 13,
          color: '#3a2960',
          lineHeight: 1.6,
        }}
      >
        2FA non activée pour @{targetHandle} — rien à réinitialiser.
      </div>
    );
  }

  if (state.status === 'success') {
    return (
      <div
        style={{
          marginTop: 8,
          padding: 14,
          borderRadius: 12,
          background: 'rgba(35,197,94,0.08)',
          border: '1px solid rgba(35,197,94,0.25)',
          fontSize: 13,
          color: '#108a48',
          lineHeight: 1.6,
        }}
      >
        ✅ 2FA réinitialisée pour @{targetHandle}. La prochaine connexion à
        l&apos;admin déclenchera le flow de configuration.
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 12,
        padding: 16,
        borderRadius: 14,
        background: 'rgba(217,78,146,0.04)',
        border: '1px solid rgba(217,78,146,0.20)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: '#a8235e',
          marginBottom: 4,
        }}
      >
        Réinitialiser la 2FA · ADMIN
      </div>
      <p style={{ margin: 0, fontSize: 13, color: '#3a2960', lineHeight: 1.6 }}>
        Efface le secret TOTP et les codes de secours de @{targetHandle}. Cette action est
        traçée dans l&apos;audit log avec ton motif.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            marginTop: 12,
            padding: '8px 14px',
            borderRadius: 10,
            border: '1px solid rgba(217,78,146,0.40)',
            background: 'transparent',
            color: '#a8235e',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Réinitialiser la 2FA
        </button>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <label htmlFor="totp-reset-reason" style={{ fontSize: 12, fontWeight: 700, color: '#3a2960' }}>
            Motif (5-500 caractères, traçé dans l&apos;audit log)
          </label>
          <textarea
            id="totp-reset-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Ex. l'utilisateur a perdu son téléphone et a confirmé son identité par email."
            style={{
              padding: 10,
              borderRadius: 10,
              border: '1px solid rgba(217,78,146,0.30)',
              background: 'white',
              fontSize: 13,
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
          {state.status === 'error' && (
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
              {state.error === 'reason_required' && 'Le motif doit faire entre 5 et 500 caractères.'}
              {state.error === 'not_admin' && 'Action réservée aux administrateurs.'}
              {state.error === 'self_target' && 'Impossible de cibler son propre compte.'}
              {state.error === 'not_found' && 'Utilisateur introuvable.'}
              {state.error === 'not_enabled' && '2FA déjà désactivée pour cet utilisateur.'}
              {(state.error === 'unauthenticated' || state.error === 'unknown') && "Erreur. Réessaie ou contacte l'équipe."}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setReason('');
                setState({ status: 'idle' });
              }}
              disabled={pending}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: '1px solid rgba(115,1,255,0.20)',
                background: 'white',
                color: '#3a2960',
                fontSize: 13,
                fontWeight: 600,
                cursor: pending ? 'wait' : 'pointer',
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                startTransition(async () => {
                  const res = await adminResetUserTotp(targetUserId, reason);
                  setState(res);
                  if (res.status === 'success') {
                    router.refresh();
                  }
                });
              }}
              disabled={pending || reason.trim().length < 5}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: 'none',
                background:
                  pending || reason.trim().length < 5
                    ? 'rgba(217,78,146,0.30)'
                    : 'linear-gradient(135deg, #d94e92, #a8235e)',
                color: 'white',
                fontSize: 13,
                fontWeight: 700,
                cursor: pending || reason.trim().length < 5 ? 'not-allowed' : 'pointer',
              }}
            >
              {pending ? 'Réinitialisation…' : 'Confirmer le reset'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

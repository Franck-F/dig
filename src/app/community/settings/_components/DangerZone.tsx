'use client';

import { useState, useTransition } from 'react';
import { requestSelfDelete } from '@/lib/actions/account';

const CONFIRM_PHRASE = 'SUPPRIMER';

/**
 * Account-deletion danger zone for the settings page. Two-step confirmation:
 *   1. Click "Supprimer mon compte" → opens an inline confirm panel.
 *   2. User types the literal word `SUPPRIMER` and clicks the final button.
 *
 * On submit the server action soft-deletes + signs the user out + redirects
 * to the home page with a `?account_deleted=1` query so the homepage can
 * show a confirmation banner (deferred to a follow-up task).
 *
 * Why client-side? We need the typed-confirmation gate which requires
 * controlled input + button enable/disable.
 */
export default function DangerZone() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSubmit = confirm.trim() === CONFIRM_PHRASE;

  const onSubmit = () => {
    setError(null);
    startTransition(async () => {
      const res = await requestSelfDelete(reason.trim() || undefined);
      // requestSelfDelete throws a redirect on success — we only land here
      // on error.
      if (res.status === 'error') {
        if (res.error === 'unauthenticated') {
          setError('Session expirée. Reconnectez-vous puis recommencez.');
        } else if (res.error === 'already_deleted') {
          setError('Ce compte est déjà en cours de suppression.');
        } else {
          setError("Une erreur est survenue. L'équipe Digizelle a été alertée — réessayez dans quelques minutes.");
        }
      }
    });
  };

  return (
    <div
      style={{
        marginTop: 32,
        padding: 24,
        borderRadius: 18,
        background: 'rgba(217,78,146,0.04)',
        border: '1px solid rgba(217,78,146,0.30)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: '#a8235e',
          marginBottom: 6,
        }}
      >
        Zone à risque · RGPD Art. 17
      </div>
      <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#1a1f3a' }}>
        Supprimer mon compte
      </h3>
      <p style={{ margin: 0, fontSize: 13, color: '#3a2960', lineHeight: 1.6 }}>
        Avant de continuer, pensez à <strong>télécharger vos données</strong> dans la section
        au-dessus si vous voulez en garder une copie.
      </p>

      <div
        style={{
          marginTop: 16,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}
        className="dz-danger-grid"
      >
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: 'rgba(217,78,146,0.08)',
            border: '1px solid rgba(217,78,146,0.20)',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#a8235e', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Anonymisé immédiatement
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#3a2960', lineHeight: 1.7 }}>
            <li>Email, prénom, nom, photo de profil</li>
            <li>Profil mentor / mentee, bio, parcours</li>
            <li>Connexions OAuth (Google, GitHub, Discord)</li>
            <li>Codes de vérification email</li>
          </ul>
        </div>
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: 'rgba(115,1,255,0.06)',
            border: '1px solid rgba(115,1,255,0.20)',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7301FF', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Conservé sous forme anonyme
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#3a2960', lineHeight: 1.7 }}>
            <li>Posts, commentaires (auteur remplacé par « Compte supprimé »)</li>
            <li>Sessions de mentorat (preuve civile, 3 ans)</li>
            <li>Avis publiés sur des mentors</li>
            <li>Décisions de modération vous concernant (5 ans, audit)</li>
          </ul>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: 12,
          borderRadius: 10,
          background: 'rgba(115,1,255,0.04)',
          border: '1px solid rgba(115,1,255,0.15)',
          fontSize: 12,
          color: '#3a2960',
          lineHeight: 1.6,
        }}
      >
        <strong>Délai de grâce de 30 jours.</strong> Pendant ce délai, vous pouvez restaurer votre
        compte en contactant <a href="mailto:dpo@calebasse.com" style={{ color: '#7301FF' }}>dpo@calebasse.com</a>{' '}
        avec une preuve d&apos;identité. Au-delà, la purge est définitive et irréversible (RGPD
        Art. 17).
      </div>

      <style>{`
        @media (max-width: 720px) {
          .dz-danger-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            marginTop: 16,
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
          Supprimer mon compte
        </button>
      ) : (
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label
              htmlFor="delete-reason"
              style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#3a2960', marginBottom: 6 }}
            >
              Motif (optionnel — aide à améliorer la plateforme)
            </label>
            <textarea
              id="delete-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Ex. je n'utilise plus la communauté, je veux nettoyer mes données…"
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 10,
                border: '1px solid rgba(115,1,255,0.20)',
                background: 'white',
                fontSize: 13,
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>
          <div>
            <label
              htmlFor="delete-confirm"
              style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#3a2960', marginBottom: 6 }}
            >
              Tapez <code style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'rgba(217,78,146,0.10)', color: '#a8235e' }}>{CONFIRM_PHRASE}</code> pour confirmer.
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 10,
                border: '1px solid rgba(217,78,146,0.40)',
                background: 'white',
                fontSize: 14,
                fontFamily: 'ui-monospace, monospace',
                outline: 'none',
              }}
            />
          </div>

          {error && (
            <div
              role="alert"
              style={{
                padding: 12,
                borderRadius: 10,
                background: 'rgba(217,78,146,0.10)',
                color: '#a8235e',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirm('');
                setReason('');
                setError(null);
              }}
              disabled={pending}
              style={{
                padding: '10px 18px',
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
              onClick={onSubmit}
              disabled={!canSubmit || pending}
              style={{
                padding: '10px 18px',
                borderRadius: 10,
                border: 'none',
                background:
                  !canSubmit || pending
                    ? 'rgba(217,78,146,0.30)'
                    : 'linear-gradient(135deg, #d94e92, #a8235e)',
                color: 'white',
                fontSize: 13,
                fontWeight: 700,
                cursor: !canSubmit || pending ? 'not-allowed' : 'pointer',
              }}
            >
              {pending ? 'Suppression…' : 'Supprimer définitivement'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

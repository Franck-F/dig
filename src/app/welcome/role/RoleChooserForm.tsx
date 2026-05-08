'use client';

import { useState, useTransition } from 'react';

import { confirmRole } from '@/lib/actions/welcome';

type Choice = 'STUDENT' | 'MENTOR';

const ERROR_LABEL: Record<string, string> = {
  unauthorized: 'Ta session a expiré. Reconnecte-toi pour continuer.',
  invalid_role: 'Choix invalide.',
  already_confirmed: 'Ton rôle est déjà défini. Direction le tableau de bord.',
  forbidden: 'Cette action n’est pas disponible pour ton compte.',
};

/**
 * Two big radio cards — Apprenant·e or Mentor — wired to the
 * `confirmRole` server action. The action redirects to the right next
 * step on success, so we only render error feedback inline. The
 * `useTransition` keeps the page interactive while the request is in
 * flight (rare — the action only does an UPDATE + redirect).
 */
export default function RoleChooserForm() {
  const [picked, setPicked] = useState<Choice | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!picked) return;
    setError(null);
    startTransition(async () => {
      const res = await confirmRole({ role: picked });
      // confirmRole throws a redirect on success — if we get here at all
      // it's an error path.
      if (res?.status === 'error') {
        setError(ERROR_LABEL[res.error] ?? 'Erreur — réessaie dans un instant.');
      }
    });
  };

  return (
    <>
      <div
        role="radiogroup"
        aria-label="Rôle Digizelle"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 18,
          marginTop: 36,
        }}
      >
        <RoleCard
          id="role-student"
          value="STUDENT"
          picked={picked === 'STUDENT'}
          onPick={() => setPicked('STUDENT')}
          icon="✦"
          accent="#7301FF"
          accent2="#A34BF5"
          title="Apprenant·e"
          subtitle="Je viens apprendre"
          bullets={[
            'Trouver un mentor adapté à mes objectifs',
            'Sessions en visio, agenda partagé, messagerie',
            'Accès à la communauté + ateliers',
          ]}
        />
        <RoleCard
          id="role-mentor"
          value="MENTOR"
          picked={picked === 'MENTOR'}
          onPick={() => setPicked('MENTOR')}
          icon="☷"
          accent="#F46FB1"
          accent2="#A34BF5"
          title="Mentor"
          subtitle="Je viens transmettre"
          bullets={[
            'Définir mes disponibilités et compétences',
            'Recevoir des demandes de mentorat ciblées',
            'Suivre ma progression et celle de mes mentorées',
          ]}
        />
      </div>

      <div
        style={{
          marginTop: 32,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={submit}
          disabled={!picked || isPending}
          style={{
            padding: '14px 32px',
            borderRadius: 12,
            border: 'none',
            background: picked
              ? 'linear-gradient(135deg, #7301FF, #F46FB1)'
              : 'rgba(255,255,255,0.10)',
            color: 'white',
            fontSize: 15,
            fontWeight: 700,
            cursor: picked && !isPending ? 'pointer' : 'not-allowed',
            opacity: !picked || isPending ? 0.55 : 1,
            transition: 'opacity 0.15s ease, transform 0.15s ease',
            boxShadow: picked
              ? '0 18px 40px rgba(115,1,255,0.45), 0 8px 20px rgba(244,111,177,0.30)'
              : 'none',
            minWidth: 240,
          }}
          aria-disabled={!picked || isPending}
        >
          {isPending
            ? 'Création de ton espace…'
            : picked === 'MENTOR'
              ? 'Continuer en tant que mentor →'
              : picked === 'STUDENT'
                ? 'Continuer en tant qu’apprenant·e →'
                : 'Choisis un rôle pour continuer'}
        </button>
        {error && (
          <p
            role="alert"
            style={{
              margin: 0,
              fontSize: 12,
              color: '#ffb3c8',
              fontWeight: 600,
            }}
          >
            {error}
          </p>
        )}
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Role card
   ────────────────────────────────────────────────────────────────── */

function RoleCard({
  id,
  value,
  picked,
  onPick,
  icon,
  accent,
  accent2,
  title,
  subtitle,
  bullets,
}: {
  id: string;
  value: Choice;
  picked: boolean;
  onPick: () => void;
  icon: string;
  accent: string;
  accent2: string;
  title: string;
  subtitle: string;
  bullets: string[];
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={picked}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-subtitle`}
      onClick={onPick}
      style={{
        position: 'relative',
        textAlign: 'left',
        padding: '24px 24px 22px',
        borderRadius: 22,
        border: picked
          ? `2px solid ${accent}`
          : '1px solid rgba(255,255,255,0.14)',
        background: picked
          ? `linear-gradient(160deg, ${accent}33 0%, ${accent2}22 100%)`
          : 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(8px)',
        color: 'white',
        cursor: 'pointer',
        transition:
          'border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
        boxShadow: picked
          ? `0 24px 60px ${accent}40, inset 0 1px 0 rgba(255,255,255,0.14)`
          : '0 12px 30px rgba(0,0,0,0.18)',
        transform: picked ? 'translateY(-2px)' : 'none',
        // Important: a button inherits the page font but ditches its
        // default text-align centering. We undo both quirks here.
        fontFamily: 'inherit',
        font: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {picked && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: 'white',
            color: accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 14,
            boxShadow: '0 6px 14px rgba(0,0,0,0.25)',
          }}
        >
          ✓
        </span>
      )}
      <div
        aria-hidden
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: `linear-gradient(135deg, ${accent}, ${accent2})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 22,
          fontWeight: 700,
          boxShadow: `0 12px 26px ${accent}55`,
        }}
      >
        {icon}
      </div>
      <div>
        <div id={`${id}-subtitle`} style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.62)' }}>
          {subtitle}
        </div>
        <div id={`${id}-title`} style={{ fontSize: 24, fontWeight: 800, marginTop: 2, letterSpacing: '-0.01em' }}>
          {title}
        </div>
      </div>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {bullets.map((b) => (
          <li
            key={b}
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              fontSize: 13,
              color: 'rgba(255,255,255,0.86)',
              lineHeight: 1.45,
            }}
          >
            <span
              aria-hidden
              style={{
                marginTop: 6,
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: accent,
                flexShrink: 0,
              }}
            />
            {b}
          </li>
        ))}
      </ul>
      <input
        type="radio"
        name="role"
        value={value}
        checked={picked}
        onChange={onPick}
        // Hidden — the visible button is the actual control. We keep the
        // radio input so AT users using form-aware tools still see the
        // group structure.
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
        tabIndex={-1}
      />
    </button>
  );
}

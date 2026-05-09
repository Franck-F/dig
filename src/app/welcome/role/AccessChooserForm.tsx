'use client';

import { useState, useTransition } from 'react';

import { confirmAccess } from '@/lib/actions/welcome';

type MentoraSub = 'STUDENT' | 'MENTOR';

const ERROR_LABEL: Record<string, string> = {
  unauthorized: 'Ta session a expiré. Reconnecte-toi pour continuer.',
  invalid_input: 'Choix invalide.',
  invalid_role: 'Choix invalide.',
  pick_at_least_one: 'Active au moins un espace pour continuer.',
  already_confirmed: 'Tes accès sont déjà définis. Direction le tableau de bord.',
  forbidden: 'Cette action n’est pas disponible pour ton compte.',
  server_error: 'Erreur serveur — réessaie dans un instant.',
};

/**
 * Two big toggle cards — Mentora (with sub-role radio) and Community.
 * The user can pick any non-empty combination. The "Continuer" button
 * stays disabled until at least one card is on.
 *
 * On submit, `confirmAccess` redirects to the right next step:
 *   - Mentora MENTOR (alone or with community)  → /mentora/become-a-mentor
 *   - Mentora STUDENT (alone or with community) → /mentora/onboarding
 *   - Community only                            → /community
 */
export default function AccessChooserForm() {
  const [mentoraOn, setMentoraOn] = useState(false);
  const [mentoraSub, setMentoraSub] = useState<MentoraSub>('STUDENT');
  const [communityOn, setCommunityOn] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canSubmit = mentoraOn || communityOn;

  const submit = () => {
    if (!canSubmit) {
      setError(ERROR_LABEL.pick_at_least_one);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await confirmAccess({
          mentora: mentoraOn ? mentoraSub : null,
          community: communityOn,
        });
        if (res?.status === 'error') {
          setError(ERROR_LABEL[res.error] ?? 'Erreur — réessaie dans un instant.');
        }
      } catch (e) {
        // Next.js's `redirect()` intentionally throws NEXT_REDIRECT —
        // the framework handles it, so we re-throw to let it through.
        // Anything else is a real failure and we surface a friendly
        // message instead of triggering the global error boundary.
        if (
          e instanceof Error &&
          (e.message.includes('NEXT_REDIRECT') ||
            (e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT'))
        ) {
          throw e;
        }
        console.error('[chooser] action threw', e);
        setError('Erreur — réessaie dans un instant.');
      }
    });
  };

  return (
    <>
      <div
        role="group"
        aria-label="Accès Digizelle"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 18,
          marginTop: 36,
          textAlign: 'left',
        }}
      >
        <ProductCard
          on={mentoraOn}
          onToggle={() => setMentoraOn((v) => !v)}
          accent="#7301FF"
          accent2="#A34BF5"
          icon="✦"
          title="Mentora"
          subtitle="Mentorat 1-to-1"
          description="Mise en relation algorithmique mentor / mentoré·e, sessions en visio, agenda partagé, messagerie, suivi d'objectifs."
          bullets={[
            'Trouve un mentor expert ou accompagne quelqu’un',
            'Sessions visio + agenda partagé',
            'Messagerie et suivi de progression',
          ]}
        >
          {mentoraOn && (
            <div
              role="radiogroup"
              aria-label="Rôle Mentora"
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: '1px solid rgba(255,255,255,0.12)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
              }}
            >
              <SubRoleButton
                checked={mentoraSub === 'STUDENT'}
                onPick={() => setMentoraSub('STUDENT')}
                label="Apprenant·e"
                hint="Je viens apprendre"
              />
              <SubRoleButton
                checked={mentoraSub === 'MENTOR'}
                onPick={() => setMentoraSub('MENTOR')}
                label="Mentor"
                hint="Je viens transmettre"
              />
            </div>
          )}
        </ProductCard>

        <ProductCard
          on={communityOn}
          onToggle={() => setCommunityOn((v) => !v)}
          accent="#F46FB1"
          accent2="#A34BF5"
          icon="☷"
          title="Communauté"
          subtitle="Forum, canaux, défis"
          description="Rejoins les salons thématiques, participe aux défis, gagne des badges, échange avec les autres digizelliennes."
          bullets={[
            'Salons thématiques et fil d’actualité',
            'Défis hebdomadaires et badges',
            'Membres actifs · entraide quotidienne',
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
          disabled={!canSubmit || isPending}
          style={{
            padding: '14px 32px',
            borderRadius: 12,
            border: 'none',
            background: canSubmit
              ? 'linear-gradient(135deg, #7301FF, #F46FB1)'
              : 'rgba(255,255,255,0.10)',
            color: 'white',
            fontSize: 15,
            fontWeight: 700,
            cursor: canSubmit && !isPending ? 'pointer' : 'not-allowed',
            opacity: !canSubmit || isPending ? 0.55 : 1,
            transition: 'opacity 0.15s ease, transform 0.15s ease',
            boxShadow: canSubmit
              ? '0 18px 40px rgba(115,1,255,0.45), 0 8px 20px rgba(244,111,177,0.30)'
              : 'none',
            minWidth: 240,
          }}
          aria-disabled={!canSubmit || isPending}
        >
          {isPending ? 'Création de ton espace…' : ctaLabel(mentoraOn, communityOn, mentoraSub)}
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

function ctaLabel(mentoraOn: boolean, communityOn: boolean, mentoraSub: MentoraSub): string {
  if (!mentoraOn && !communityOn) return 'Active un espace pour continuer';
  if (mentoraOn && communityOn) {
    return mentoraSub === 'MENTOR'
      ? 'Continuer en mentor + communauté →'
      : 'Continuer en apprenant·e + communauté →';
  }
  if (mentoraOn) {
    return mentoraSub === 'MENTOR'
      ? 'Continuer en tant que mentor →'
      : 'Continuer en tant qu’apprenant·e →';
  }
  return 'Continuer dans la communauté →';
}

/* ──────────────────────────────────────────────────────────────────
   Product card
   ────────────────────────────────────────────────────────────────── */

function ProductCard({
  on,
  onToggle,
  accent,
  accent2,
  icon,
  title,
  subtitle,
  description,
  bullets,
  children,
}: {
  on: boolean;
  onToggle: () => void;
  accent: string;
  accent2: string;
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  bullets: string[];
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: 'relative',
        padding: '24px 24px 22px',
        borderRadius: 22,
        border: on ? `2px solid ${accent}` : '1px solid rgba(255,255,255,0.14)',
        background: on
          ? `linear-gradient(160deg, ${accent}33 0%, ${accent2}22 100%)`
          : 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        color: 'white',
        transition:
          'border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
        boxShadow: on
          ? `0 24px 60px ${accent}40, inset 0 1px 0 rgba(255,255,255,0.14)`
          : '0 12px 30px rgba(0,0,0,0.18)',
        transform: on ? 'translateY(-2px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Whole card is clickable for the toggle, but children (sub-radios)
          stop propagation so they don't bubble back into a re-toggle. */}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          // Sit BEHIND content so the sub-buttons stay clickable.
          zIndex: 0,
        }}
        aria-label={`${on ? 'Désactiver' : 'Activer'} ${title}`}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, position: 'relative', zIndex: 1, pointerEvents: 'none' }}>
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
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        {/* Toggle dot (visual only — the surrounding button drives state). */}
        <span
          aria-hidden
          style={{
            width: 44,
            height: 24,
            borderRadius: 999,
            background: on ? accent : 'rgba(255,255,255,0.14)',
            position: 'relative',
            transition: 'background 0.2s ease',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: on ? 22 : 2,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'white',
              transition: 'left 0.2s ease',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            }}
          />
        </span>
      </div>
      <div style={{ position: 'relative', zIndex: 1, pointerEvents: 'none' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.62)',
          }}
        >
          {subtitle}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, marginTop: 2, letterSpacing: '-0.01em' }}>
          {title}
        </div>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: 'rgba(255,255,255,0.78)',
          lineHeight: 1.5,
          position: 'relative',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        {description}
      </p>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          position: 'relative',
          zIndex: 1,
          pointerEvents: 'none',
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
      {/* Children (sub-radio block, when shown) sit above the toggle
          backdrop so they capture their own clicks. */}
      {children && (
        <div style={{ position: 'relative', zIndex: 2 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function SubRoleButton({
  checked,
  onPick,
  label,
  hint,
}: {
  checked: boolean;
  onPick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
      style={{
        padding: '10px 12px',
        borderRadius: 10,
        border: checked ? '1px solid rgba(255,255,255,0.65)' : '1px solid rgba(255,255,255,0.14)',
        background: checked ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)',
        color: 'white',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        fontWeight: 600,
        fontSize: 13,
        transition: 'background 0.15s ease, border-color 0.15s ease',
      }}
    >
      <div>{label}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.62)', fontWeight: 500 }}>{hint}</div>
    </button>
  );
}

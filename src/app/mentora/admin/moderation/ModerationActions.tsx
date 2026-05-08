'use client';

import { useState, useTransition } from 'react';

import {
  closeMentorship,
  markReviewHandled,
  pingMentorship,
  reactivateMentor,
  sendMentorReminder,
  suspendMentor,
} from '@/lib/actions/mentora/moderation';

type Variant = 'mentor-inactive' | 'mentor-suspended' | 'mentorship-stale' | 'review-low';

type FlashState =
  | { tone: 'info'; message: string }
  | { tone: 'error'; message: string }
  | null;

const ERROR_LABEL: Record<string, string> = {
  forbidden: 'Action réservée aux administrateurs.',
  not_found: 'Cible introuvable (peut-être déjà supprimée).',
  invalid_input: 'Paramètres invalides.',
  already_suspended: 'Le mentor est déjà suspendu.',
  already_active: 'Le mentor est déjà actif.',
  already_closed: 'Le mentorship est déjà clôturé.',
  server_error: 'Erreur serveur — réessayez dans un instant.',
};

function describe(code: string): string {
  return ERROR_LABEL[code] ?? `Erreur (${code}).`;
}

/**
 * Client-side quick-action strip rendered next to each moderation row.
 * Uses `useTransition` so the button shows a pending state without
 * blocking the rest of the UI, and surfaces success/error inline so the
 * admin doesn't have to hunt for feedback in a toast layer.
 */
export default function ModerationActions({
  variant,
  id,
  pingDisabled,
  reviewHandled,
}: {
  variant: Variant;
  id: string;
  pingDisabled?: boolean;
  reviewHandled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [flash, setFlash] = useState<FlashState>(null);
  const [done, setDone] = useState(reviewHandled ?? false);

  const run = (
    label: string,
    fn: () => Promise<{ status: 'success' } | { status: 'error'; error: string }>,
    confirmMessage?: string,
    onSuccess?: () => void,
  ) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    startTransition(async () => {
      const res = await fn();
      if (res.status === 'success') {
        setFlash({ tone: 'info', message: `${label} ✓` });
        onSuccess?.();
      } else {
        setFlash({ tone: 'error', message: describe(res.error) });
      }
    });
  };

  const btn = (txt: string, onClick: () => void, primary = false): React.ReactElement => (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      style={{
        padding: '4px 10px',
        borderRadius: 7,
        border: primary ? 'none' : '1px solid rgba(115,1,255,0.20)',
        background: primary ? 'linear-gradient(135deg, #7301FF, #A34BF5)' : 'transparent',
        color: primary ? 'white' : '#7301FF',
        fontSize: 11,
        fontWeight: 700,
        cursor: isPending ? 'wait' : 'pointer',
        opacity: isPending ? 0.6 : 1,
      }}
    >
      {txt}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {variant === 'mentor-inactive' && (
          <>
            {btn('✉ Rappel', () =>
              run('Rappel envoyé', () => sendMentorReminder({ id })),
            )}
            {btn(
              '⏸ Suspendre',
              () =>
                run(
                  'Mentor suspendu',
                  () => suspendMentor({ id }),
                  'Suspendre ce mentor ? Il ne sera plus visible dans les recherches.',
                ),
              true,
            )}
          </>
        )}
        {variant === 'mentor-suspended' && (
          <>
            {btn('▶ Réactiver', () => run('Mentor réactivé', () => reactivateMentor({ id })), true)}
          </>
        )}
        {variant === 'mentorship-stale' && (
          <>
            {!pingDisabled &&
              btn('✉ Relancer les deux', () =>
                run('Relance envoyée', () => pingMentorship({ id })),
              )}
            {btn(
              '⏹ Clore',
              () =>
                run(
                  'Mentorship clôturé',
                  () => closeMentorship({ id }),
                  'Clôturer ce mentorship en tant que COMPLÉTÉ ? Cette action peut être inversée par le mentor/mentorée.',
                ),
              true,
            )}
          </>
        )}
        {variant === 'review-low' && (
          <>
            {done ? (
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 7,
                  background: 'rgba(35,197,94,0.12)',
                  color: '#138c4c',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                ✓ Examiné
              </span>
            ) : (
              btn(
                '✓ Marquer examiné',
                () =>
                  run(
                    'Avis marqué comme examiné',
                    () => markReviewHandled({ id }),
                    undefined,
                    () => setDone(true),
                  ),
                true,
              )
            )}
          </>
        )}
      </div>
      {flash && (
        <span
          role="status"
          style={{
            fontSize: 10,
            color: flash.tone === 'error' ? '#dc2626' : '#138c4c',
            fontWeight: 600,
          }}
        >
          {flash.message}
        </span>
      )}
    </div>
  );
}

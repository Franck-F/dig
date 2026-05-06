'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { addMentorshipGoal, toggleMentorshipGoalAchieved } from '@/lib/actions/mentora/mentorships';

type Goal = {
  id: string;
  description: string;
  isAchieved: boolean;
  achievedAt: string | null;
  skillName: string | null;
};

/**
 * Client island for goals. Calls server actions and refreshes the parent RSC
 * on success. The parent owns reading `MentorshipGoal` rows so this stays
 * stateless beyond the in-flight transitions.
 */
export default function GoalsClient({
  mentorshipId,
  goals,
  isLocked,
}: {
  mentorshipId: string;
  goals: Goal[];
  isLocked: boolean;
}) {
  const t = useTranslations('mentora.mentorships.detail');
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    const description = draft.trim();
    if (description.length < 3 || description.length > 500) {
      setError(t('addGoalLabel'));
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await addMentorshipGoal({ mentorshipId, description });
        setDraft('');
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      }
    });
  }

  function handleToggle(goalId: string, current: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        await toggleMentorshipGoalAchieved({ goalId, isAchieved: !current });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      }
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {goals.length === 0 ? (
        <p className="dz-body">{t('goalsEmpty')}</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {goals.map((g) => (
            <li
              key={g.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: 10,
                borderRadius: 10,
                border: '1px solid rgba(115,1,255,0.10)',
                background: g.isAchieved ? 'rgba(35,197,94,0.06)' : 'transparent',
              }}
            >
              <input
                type="checkbox"
                checked={g.isAchieved}
                onChange={() => handleToggle(g.id, g.isAchieved)}
                disabled={pending || isLocked}
                aria-label={g.isAchieved ? t('markUnachieved') : t('markAchieved')}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    textDecoration: g.isAchieved ? 'line-through' : 'none',
                    opacity: g.isAchieved ? 0.65 : 1,
                  }}
                >
                  {g.description}
                </div>
                <div className="dz-small" style={{ marginTop: 2 }}>
                  {g.skillName && <span style={{ marginRight: 8 }}>#{g.skillName}</span>}
                  {g.isAchieved && g.achievedAt && t('achievedAt', { date: g.achievedAt })}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!isLocked && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="dz-label" htmlFor={`new-goal-${mentorshipId}`}>{t('addGoalLabel')}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id={`new-goal-${mentorshipId}`}
              className="dz-input"
              maxLength={500}
              minLength={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={pending || draft.trim().length === 0}
              className="dz-btn dz-btn-primary dz-btn-sm"
            >
              {t('addGoalCta')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: 'rgba(217,78,146,0.10)',
            color: '#a8235e',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { prisma } from '@/lib/prisma';
import { computeTrainingProgress, trainingsFor } from '@/lib/mentora/trainings';

/**
 * Onboarding trainings with overall progress (Entourage-style
 * "Votre progression X % complété"). `full` sits at the top of Ressources;
 * `compact` is the home-page widget (progress + next modules + link).
 */
export default async function TrainingsPanel({
  userId,
  role,
  variant = 'full',
}: {
  userId: string;
  role: 'mentor' | 'mentee';
  variant?: 'full' | 'compact';
}) {
  const [t, rows] = await Promise.all([
    getTranslations('mentora.trainings'),
    prisma.mentoraTrainingCompletion.findMany({ where: { userId }, select: { moduleSlug: true } }),
  ]);
  const modules = trainingsFor(role);
  const completed = new Set(rows.map((r) => r.moduleSlug));
  const progress = computeTrainingProgress(modules, completed);
  // Compact widget leads with what's left to do.
  const shown =
    variant === 'compact'
      ? [...modules.filter((m) => !completed.has(m.slug)), ...modules.filter((m) => completed.has(m.slug))].slice(0, 3)
      : modules;

  return (
    <section className="dz-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 className="dz-h3" style={{ fontSize: variant === 'compact' ? 18 : 22, margin: 0 }}>
            {t('title')}
          </h2>
          {variant === 'full' && (
            <p className="dz-small" style={{ marginTop: 6 }}>{t('subtitle')}</p>
          )}
        </div>
        {variant === 'compact' && (
          <Link href="/mentora/dashboard/resources" className="dz-small" style={{ color: '#7301FF', fontWeight: 700 }}>
            {t('seeAll')} →
          </Link>
        )}
      </header>

      <div>
        <div className="dz-small" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontWeight: 700 }}>{t('progressLabel')}</span>
          <span>{t('percentDone', { percent: progress.percent })}</span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
          aria-label={t('progressLabel')}
          style={{ height: 8, borderRadius: 999, background: 'rgba(115,1,255,0.10)', overflow: 'hidden' }}
        >
          <div
            style={{
              width: `${progress.percent}%`,
              height: '100%',
              borderRadius: 999,
              background: 'linear-gradient(90deg, #7301FF, #A34BF5)',
            }}
          />
        </div>
        {progress.total > 0 && progress.done === progress.total && (
          <p className="dz-small" style={{ marginTop: 8 }}>{t('allDone')}</p>
        )}
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {shown.map((m) => {
          const isDone = completed.has(m.slug);
          return (
            <li
              key={m.slug}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid rgba(36,50,95,0.10)',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 28,
                  height: 28,
                  flexShrink: 0,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  background: isDone ? '#16A34A' : 'rgba(115,1,255,0.10)',
                  color: isDone ? 'white' : '#7301FF',
                }}
              >
                {isDone ? '✓' : '▸'}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{m.title}</div>
                {variant === 'full' && <div className="dz-small" style={{ marginTop: 2 }}>{m.summary}</div>}
                <div className="dz-small" style={{ marginTop: 2, fontSize: 12 }}>
                  {t('duration', { minutes: m.durationMin })}
                  {isDone ? ` · ${t('done')}` : ''}
                </div>
              </div>
              <Link
                href={`/mentora/dashboard/resources/formations/${m.slug}`}
                className={`dz-btn dz-btn-sm ${isDone ? 'dz-btn-ghost' : 'dz-btn-primary'}`}
                style={{ flexShrink: 0 }}
              >
                {isDone ? t('review') : t('start')}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

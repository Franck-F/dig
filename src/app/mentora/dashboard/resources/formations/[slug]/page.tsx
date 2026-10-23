import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentRoleProfile } from '@/lib/mentora/current-profile';
import { trainingsFor } from '@/lib/mentora/trainings';
import MarkDoneButton from './MarkDoneButton';

export const dynamic = 'force-dynamic';

/**
 * `/mentora/dashboard/resources/formations/[slug]` — one onboarding module.
 * Unknown slugs and modules meant for the other role 404.
 */
export default async function TrainingModulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?next=/mentora/dashboard/resources/formations/${encodeURIComponent(slug)}`);
  }
  const userId = session.user.id;

  const profile = await getCurrentRoleProfile(userId);
  const role = profile.kind === 'mentor' ? 'mentor' : 'mentee';
  const modules = trainingsFor(role);
  const index = modules.findIndex((m) => m.slug === slug);
  if (index === -1) notFound();
  const mod = modules[index];

  const [t, completion] = await Promise.all([
    getTranslations('mentora.trainings'),
    prisma.mentoraTrainingCompletion.findUnique({
      where: { userId_moduleSlug: { userId, moduleSlug: slug } },
      select: { completedAt: true },
    }),
  ]);
  const next = modules[index + 1];
  const nextHref = next ? `/mentora/dashboard/resources/formations/${next.slug}` : '/mentora/dashboard/resources';

  return (
    <article style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760 }}>
      <Link href="/mentora/dashboard/resources" className="dz-small" style={{ color: '#7301FF', fontWeight: 700 }}>
        ← {t('back')}
      </Link>

      <header>
        <span className="dz-small">{t('duration', { minutes: mod.durationMin })}</span>
        <h1 className="dz-h2" style={{ fontSize: 28, margin: '6px 0 0' }}>{mod.title}</h1>
        <p className="dz-body" style={{ marginTop: 8 }}>{mod.summary}</p>
      </header>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {mod.steps.map((step, i) => (
          <li key={step.heading} className="dz-card" style={{ padding: 20, display: 'flex', gap: 14 }}>
            <span
              aria-hidden
              style={{
                width: 30,
                height: 30,
                flexShrink: 0,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                background: 'rgba(115,1,255,0.10)',
                color: '#7301FF',
              }}
            >
              {i + 1}
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{step.heading}</h2>
              <p className="dz-body" style={{ margin: '6px 0 0' }}>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <footer style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {completion ? (
          <>
            <span className="dz-chip" style={{ background: 'rgba(22,163,74,0.12)', color: '#15803D' }}>
              ✓ {t('done')}
            </span>
            {next && (
              <Link href={nextHref} className="dz-btn dz-btn-primary">
                {t('next')} →
              </Link>
            )}
          </>
        ) : (
          <MarkDoneButton slug={mod.slug} nextHref={nextHref} />
        )}
      </footer>
    </article>
  );
}

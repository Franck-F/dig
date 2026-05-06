import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { auth } from '@/auth';
import { breadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonld';
import { prisma } from '@/lib/prisma';

import ChallengeCard, { type ChallengeCardData } from './_components/ChallengeCard';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('community.challenges');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

/**
 * `/community/challenges` — public list of all visible challenges grouped into
 * three sections: Active (currently OPEN or VOTING), Upcoming (still DRAFT
 * with a future submissionOpensAt — so admins can preview; we filter to
 * non-DRAFT only here per spec), and Past (CLOSED).
 *
 * Spec §4.1 says "all challenges grouped by status". We filter out DRAFT for
 * the public route — DRAFT is admin-only via `/community/admin/challenges`.
 */
export default async function ChallengesIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/community/challenges');

  const t = await getTranslations('community.challenges');

  const all = await prisma.challenge.findMany({
    where: { status: { in: ['OPEN', 'VOTING', 'CLOSED'] } },
    orderBy: [{ submissionOpensAt: 'desc' }],
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      prize: true,
      coverImageUrl: true,
      status: true,
      submissionOpensAt: true,
      submissionClosesAt: true,
      votingClosesAt: true,
      _count: { select: { submissions: true } },
    },
  });

  const now = new Date();
  const map = (c: (typeof all)[number]): ChallengeCardData => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    description: c.description,
    prize: c.prize,
    coverImageUrl: c.coverImageUrl,
    status: c.status,
    submissionOpensAt: c.submissionOpensAt,
    submissionClosesAt: c.submissionClosesAt,
    votingClosesAt: c.votingClosesAt,
    submissionsCount: c._count.submissions,
  });

  const active = all.filter((c) => c.status === 'OPEN' || c.status === 'VOTING').map(map);
  const upcoming = all
    .filter((c) => c.status === 'OPEN' && c.submissionOpensAt > now)
    .map(map);
  const past = all.filter((c) => c.status === 'CLOSED').map(map);

  // Active should not double-list the upcoming (which haven't opened yet).
  const upcomingIds = new Set(upcoming.map((c) => c.id));
  const activeFinal = active.filter((c) => !upcomingIds.has(c.id));

  return (
    <>
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: 'Communauté', url: '/community' },
            { name: t('metaTitle'), url: '/community/challenges' },
          ]),
        )}
      />

      <section className="dz-section" style={{ paddingTop: 48 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h1 className="dz-h1">
            {t('title')} <span className="dz-grad-text">{t('titleHighlight')}</span>
          </h1>
          <p className="dz-body" style={{ fontSize: 17, marginTop: 14, maxWidth: 720 }}>
            {t('intro')}
          </p>
        </div>
      </section>

      <section className="dz-section" style={{ paddingTop: 24, paddingBottom: 80 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gap: 40 }}>
          <ChallengeGroup title={t('tabs.active')} items={activeFinal} emptyLabel={t('empty')} />
          {upcoming.length > 0 ? (
            <ChallengeGroup title={t('tabs.upcoming')} items={upcoming} emptyLabel={null} />
          ) : null}
          {past.length > 0 ? (
            <ChallengeGroup title={t('tabs.past')} items={past} emptyLabel={null} />
          ) : null}
        </div>
      </section>
    </>
  );
}

async function ChallengeGroup({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: ChallengeCardData[];
  emptyLabel: string | null;
}) {
  return (
    <div>
      <h2 className="dz-h2" style={{ fontSize: 22, marginBottom: 16 }}>
        {title}
      </h2>
      {items.length === 0 ? (
        emptyLabel ? (
          <p className="dz-small" style={{ fontSize: 14 }}>{emptyLabel}</p>
        ) : null
      ) : (
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          }}
        >
          {items.map((c) => (
            <ChallengeCard key={c.id} challenge={c} />
          ))}
        </div>
      )}
    </div>
  );
}

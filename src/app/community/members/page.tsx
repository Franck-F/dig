import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { Prisma } from '@prisma/client';

import { auth } from '@/auth';
import { breadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonld';
import { prisma } from '@/lib/prisma';
import Pagination from '@/components/admin/Pagination';

import MemberCard, { type MemberCardData } from '../_components/MemberCard';
import MemberFilters from '../_components/MemberFilters';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const PAGE_SIZE = 24;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('community.members');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

type SearchParams = {
  q?: string;
  role?: string;
  channel?: string;
  page?: string;
};

export default async function MembersDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/community/members');

  const t = await getTranslations('community.members');
  const sp = await searchParams;

  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where: Prisma.CommunityMemberWhereInput = {
    status: 'ACTIVE',
  };

  if (sp.q?.trim()) {
    const q = sp.q.trim();
    where.OR = [
      { handle: { contains: q, mode: 'insensitive' } },
      { displayName: { contains: q, mode: 'insensitive' } },
      { bio: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (sp.role) {
    if (sp.role === 'founder') where.isFounder = true;
    else if (sp.role === 'coreTeam') where.isCoreTeam = true;
    else where.user = { role: sp.role as 'STUDENT' | 'MENTOR' | 'PARTNER' | 'ADMIN' };
  }
  if (sp.channel) {
    where.channelMemberships = {
      some: { channel: { slug: sp.channel }, status: 'ACTIVE' },
    };
  }

  const [members, total, channels] = await Promise.all([
    prisma.communityMember.findMany({
      where,
      orderBy: [
        { isFounder: 'desc' },
        { isCoreTeam: 'desc' },
        { joinedAt: 'asc' },
      ],
      include: {
        user: { select: { role: true } },
      },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.communityMember.count({ where }),
    prisma.channel.findMany({
      where: { archivedAt: null, type: { in: ['PUBLIC', 'RESTRICTED'] } },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: { slug: true, name: true },
    }),
  ]);

  const cards: MemberCardData[] = members.map((m) => ({
    id: m.id,
    handle: m.handle,
    displayName: m.displayName,
    bio: m.bio,
    avatarUrl: m.avatarUrl,
    bannerColor: m.bannerColor,
    isFounder: m.isFounder,
    isCoreTeam: m.isCoreTeam,
    isModerator: m.isModerator,
    postCount: m.postCount,
    commentCount: m.commentCount,
    // Pass the reaction counters too — MemberCard derives a synthetic
    // XP / level from the full set, so the directory shows the real
    // engagement signal rather than just post + comment volume.
    reactionsReceivedCount: m.reactionsReceivedCount,
    reactionsGivenCount: m.reactionsGivenCount,
    user: m.user ? { role: m.user.role } : null,
  }));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(p: number): string {
    const next = new URLSearchParams();
    if (sp.q) next.set('q', sp.q);
    if (sp.role) next.set('role', sp.role);
    if (sp.channel) next.set('channel', sp.channel);
    next.set('page', String(p));
    return `/community/members?${next.toString()}`;
  }

  return (
    <>
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: 'Communauté', url: '/community' },
            { name: t('metaTitle'), url: '/community/members' },
          ]),
        )}
      />

      <section className="dz-section" style={{ paddingTop: 40 }}>
        <h1 className="dz-h1">
          {t('title')} <span className="dz-grad-text">{t('titleHighlight')}</span>
        </h1>
        <p className="dz-body" style={{ fontSize: 17, marginTop: 14, maxWidth: 640 }}>
          {t('intro')}
        </p>
      </section>

      <section className="dz-section" style={{ paddingTop: 0 }}>
        {/* Wrap grid + filters + count inside a single dz-card to match
            the handoff design ("Membres · 1 248" header above a 4-col
            centred grid). Filters stay at the top of the card; the
            grid below auto-fills 4 columns on desktop. */}
        <div className="dz-card" style={{ padding: 22 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 16,
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                {t('directoryTitle', { count: total })}
              </h2>
              <p className="dz-small" style={{ margin: '2px 0 0', fontSize: 12 }}>
                {t('directorySubtitle')}
              </p>
            </div>
            <MemberFilters channels={channels} />
          </div>

          {cards.length === 0 ? (
            <p className="dz-body" style={{ margin: 0 }}>
              {t('empty')}
            </p>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 14,
                }}
              >
                {cards.map((m) => (
                  <MemberCard key={m.id} member={m} />
                ))}
              </div>

              <div style={{ marginTop: 24 }}>
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  total={total}
                  buildHref={pageHref}
                />
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}

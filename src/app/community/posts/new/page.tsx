import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { breadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonld';
import { prisma } from '@/lib/prisma';

import PostComposer, { type PostComposerChannel } from '../../_components/PostComposer';
import { getCommunityViewer } from '../../_components/viewer';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('community.post.composer');
  return { title: t('metaTitle') };
}

type SearchParams = { channel?: string };

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const t = await getTranslations('community.post.composer');
  const sp = await searchParams;
  const viewer = await getCommunityViewer();

  if (viewer.kind === 'guest') {
    redirect('/login?next=/community/posts/new');
  }
  if (viewer.kind === 'logged-in-no-member') {
    redirect('/community/onboarding');
  }
  if (viewer.member.status !== 'ACTIVE') {
    redirect('/community');
  }

  // Channels the viewer can post in: PUBLIC + ANNOUNCEMENT (admin only) +
  // RESTRICTED/PRIVATE where they have ACTIVE membership.
  const memberships = await prisma.channelMembership.findMany({
    where: { memberId: viewer.member.id, status: 'ACTIVE' },
    select: { channelId: true },
  });
  const memberChannelIds = memberships.map((m) => m.channelId);

  const channels = await prisma.channel.findMany({
    where: {
      archivedAt: null,
      OR: [
        { type: 'PUBLIC' },
        ...(viewer.isAdmin || viewer.isModerator ? [{ type: 'ANNOUNCEMENT' as const }] : []),
        { id: { in: memberChannelIds }, type: { in: ['RESTRICTED', 'PRIVATE'] as const } },
      ],
    },
    orderBy: [{ isDefault: 'desc' }, { position: 'asc' }, { name: 'asc' }],
    select: { slug: true, name: true, emoji: true },
  });

  const initialChannelSlug =
    sp.channel && channels.some((c) => c.slug === sp.channel)
      ? sp.channel
      : (channels[0]?.slug ?? '');

  const composerChannels: PostComposerChannel[] = channels.map((c) => ({
    slug: c.slug,
    name: c.name,
    emoji: c.emoji,
  }));

  return (
    <>
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: 'Communauté', url: '/community' },
            { name: t('metaTitle'), url: '/community/posts/new' },
          ]),
        )}
      />
      <section
        className="dz-section"
        style={{ paddingTop: 16, paddingBottom: 32, maxWidth: 1240, margin: '0 auto' }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 18,
          }}
        >
          <div>
            <span
              style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: 999,
                background: 'rgba(115,1,255,0.08)',
                color: '#7301FF',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              ✎ Nouveau post
            </span>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#1a1f3a' }}>
              {t('title')} <span className="dz-grad-text">{t('titleHighlight')}</span>
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#545b7a' }}>
              Astuce : utilise la barre d&apos;outils pour mettre en gras, ajouter une image ou un lien.
              Le rendu apparaît en aperçu à droite.
            </p>
          </div>
        </header>

        <PostComposer
          mode="create"
          channels={composerChannels}
          initial={
            initialChannelSlug
              ? { channelSlug: initialChannelSlug, title: '', body: '' }
              : undefined
          }
        />
      </section>
    </>
  );
}

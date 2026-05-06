import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { breadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonld';
import { prisma } from '@/lib/prisma';

import PostComposer, {
  type PostComposerChannel,
} from '../../../_components/PostComposer';
import { getCommunityViewer } from '../../../_components/viewer';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('community.post.composer');
  return { title: t('editTitle') };
}

type Params = { id: string };

const EDIT_WINDOW_MS = 15 * 60 * 1000;

export default async function EditPostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const t = await getTranslations('community.post.composer');
  const viewer = await getCommunityViewer();

  if (viewer.kind === 'guest') {
    redirect(`/login?next=/community/posts/${id}/edit`);
  }
  if (viewer.kind === 'logged-in-no-member') {
    redirect('/community/onboarding');
  }

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      channel: { select: { slug: true, name: true, emoji: true } },
    },
  });
  if (!post) notFound();

  // Author-only — admins do not edit content; they can only remove.
  if (post.authorId !== viewer.member.id) {
    redirect(`/community/posts/${id}`);
  }

  const publishedAtMs = post.publishedAt?.getTime() ?? post.createdAt.getTime();
  const requireEditReason = Date.now() - publishedAtMs > EDIT_WINDOW_MS;

  const channels: PostComposerChannel[] = [
    {
      slug: post.channel.slug,
      name: post.channel.name,
      emoji: post.channel.emoji,
    },
  ];

  return (
    <>
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: 'Communauté', url: '/community' },
            { name: post.channel.name, url: `/community/c/${post.channel.slug}` },
            { name: 'Publication', url: `/community/posts/${post.id}` },
            { name: t('editTitle'), url: `/community/posts/${post.id}/edit` },
          ]),
        )}
      />

      <section className="dz-section" style={{ paddingTop: 40, maxWidth: 760, margin: '0 auto' }}>
        <h1 className="dz-h1">{t('editTitle')}</h1>
        <div style={{ marginTop: 24 }}>
          <PostComposer
            mode="edit"
            channels={channels}
            initial={{
              id: post.id,
              channelSlug: post.channel.slug,
              title: post.title ?? '',
              body: post.body,
            }}
            requireEditReason={requireEditReason}
          />
        </div>
      </section>
    </>
  );
}

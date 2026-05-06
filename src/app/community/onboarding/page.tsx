import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { prisma } from '@/lib/prisma';

import { getCommunityViewer } from '../_components/viewer';
import OnboardingWizard, { type DefaultChannel } from './OnboardingWizard';

/**
 * Community onboarding entry point. Auth-gated by `src/auth.config.ts`
 * (the matcher includes `/community/onboarding`). If the viewer is not signed
 * in, NextAuth bounces to /login. If they already have a CommunityMember row,
 * we redirect to /community.
 *
 * Otherwise we load the channels marked `isDefault = true` (pre-checked in
 * step 3 of the wizard) and render the client wizard.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('community.onboarding');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function CommunityOnboardingPage() {
  const t = await getTranslations('community.onboarding');
  const viewer = await getCommunityViewer();

  if (viewer.kind === 'guest') {
    redirect('/login?next=/community/onboarding');
  }
  // Already a member? Bounce to feed.
  if (viewer.kind === 'member') {
    redirect('/community');
  }

  // Default channels for the third step. Excludes PRIVATE (no auto-join) and
  // archived channels.
  const defaultChannels = await prisma.channel.findMany({
    where: { archivedAt: null, isDefault: true, type: { not: 'PRIVATE' } },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    select: { slug: true, name: true, emoji: true, type: true },
  });

  // Always make sure annonces + general are there if seed shape differs —
  // best-effort fallback. Match by slug.
  const ensuredSlugs = new Set(['annonces', 'general']);
  const channels: DefaultChannel[] = defaultChannels.map((c) => ({
    slug: c.slug,
    name: c.name,
    emoji: c.emoji,
  }));
  if (channels.length === 0) {
    const fallback = await prisma.channel.findMany({
      where: { archivedAt: null, slug: { in: Array.from(ensuredSlugs) } },
      select: { slug: true, name: true, emoji: true },
    });
    channels.push(...fallback.map((c) => ({ slug: c.slug, name: c.name, emoji: c.emoji })));
  }

  const suggestedHandle = viewer.user.name
    ? viewer.user.name
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 30)
    : '';

  return (
    <section className="dz-section" style={{ paddingTop: 48, paddingBottom: 80 }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 className="dz-h1">
          {t('title')} <span className="dz-grad-text">{t('titleHighlight')}</span>
        </h1>
        <p className="dz-body" style={{ fontSize: 17, marginTop: 14 }}>
          {t('subtitle')}
        </p>
      </div>

      <div style={{ maxWidth: 720, margin: '32px auto 0' }}>
        <OnboardingWizard
          channels={channels}
          suggestedHandle={suggestedHandle && /^[a-z0-9_]{3,30}$/.test(suggestedHandle) ? suggestedHandle : ''}
          defaultDisplayName={viewer.user.name ?? ''}
        />
      </div>
    </section>
  );
}

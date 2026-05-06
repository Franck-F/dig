import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { prisma } from '@/lib/prisma';

import { getCommunityViewer } from '../../_components/viewer';
import ChannelEditor from './_components/ChannelEditor';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('community.admin.channels');
  return { title: t('title') };
}

/**
 * `/community/admin/channels` — table of all channels (including archived) +
 * inline create/edit/delete controls (the `ChannelEditor` client island).
 *
 *  Server actions called by the client island:
 *   - `createChannel`  (admin/channels.ts)
 *   - `updateChannel`  (admin/channels.ts)
 *   - `archiveChannel` (admin/channels.ts) — used as soft-delete
 */
export default async function AdminChannelsPage() {
  const viewer = await getCommunityViewer();
  if (viewer.kind !== 'member' || !viewer.isModerator) redirect('/community');

  const t = await getTranslations('community.admin.channels');

  const channels = await prisma.channel.findMany({
    orderBy: [{ archivedAt: 'asc' }, { position: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      emoji: true,
      coverColor: true,
      type: true,
      isDefault: true,
      position: true,
      archivedAt: true,
      _count: { select: { memberships: true } },
    },
  });

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div>
        <h2 className="dz-h2" style={{ fontSize: 22, marginBottom: 4 }}>
          {t('title')}
        </h2>
        <p className="dz-small" style={{ fontSize: 13 }}>{t('subtitle')}</p>
      </div>
      <ChannelEditor
        initialChannels={channels.map((c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          description: c.description,
          emoji: c.emoji,
          coverColor: c.coverColor,
          type: c.type,
          isDefault: c.isDefault,
          position: c.position,
          archivedAt: c.archivedAt ? c.archivedAt.toISOString() : null,
          memberCount: c._count.memberships,
        }))}
      />
    </div>
  );
}

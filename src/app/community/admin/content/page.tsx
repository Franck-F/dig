import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { getCommunitySettings } from '@/lib/actions/platform-settings';

import { getCommunityViewer } from '../../_components/viewer';
import ContentQueueRow from './_components/ContentQueueRow';
import AutoFiltersPanel from './_components/AutoFiltersPanel';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Contenu · Admin Communauté',
};

/**
 * `/community/admin/content` — implements the **Contenu** tab from the
 * handoff (`community-admin-tabs.jsx#Content` — "Modération & mise en
 * avant").
 *
 *  - Left card (2/3): "File de modération" — posts in REPORTED status OR
 *    with `reportCount > 0`, plus "first post" detection (members with
 *    only 1 published post). Each row exposes 3 actions:
 *      ✓ Approuver  → flips REPORTED → PUBLISHED, clears reportCount
 *      ★ À la une   → pins the post on its channel (max 3 pinned)
 *      ✕ Refuser    → soft-removes via `removePost`
 *
 *  - Right card (1/3): "Filtres automatiques" — toggles for the rules
 *    persisted on `CommunitySettings` (banned-words, link-blocking,
 *    quarantine, etc.). Wired through `updateCommunitySettings`.
 *
 * Distinct from `/community/admin/moderation` which handles user-submitted
 * `Report` rows. This page is the proactive editorial layer.
 */
export default async function ContentAdminPage() {
  const viewer = await getCommunityViewer();
  if (viewer.kind !== 'member' || !viewer.isModerator) redirect('/community');

  // Pull the moderation queue:
  //   1. REPORTED posts (highest priority, capped at 30)
  //   2. PUBLISHED posts with reportCount > 0 (escalations not yet
  //      flagged), capped at 20
  //   3. PUBLISHED posts that are the author's first ever post — surfaced
  //      as "Premier post du membre" so admins can welcome / coach.
  //      Capped at 10. Cheap heuristic via the denormalised author counter.
  // We dedupe by id and slice to 12 total so the page stays scannable.
  const [reportedPosts, escalatedPosts, firstPosts, settings] = await Promise.all([
    prisma.post.findMany({
      where: { status: 'REPORTED' },
      orderBy: { reportCount: 'desc' },
      take: 30,
      include: postRowSelect,
    }),
    prisma.post.findMany({
      where: { status: 'PUBLISHED', reportCount: { gt: 0 } },
      orderBy: { reportCount: 'desc' },
      take: 20,
      include: postRowSelect,
    }),
    prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        author: { postCount: { lte: 1 } },
        reportCount: 0,
        publishedAt: { gte: thirtyDaysAgo() },
      },
      orderBy: { publishedAt: 'desc' },
      take: 10,
      include: postRowSelect,
    }),
    getCommunitySettings(),
  ]);

  // Merge + dedupe (REPORTED wins over PUBLISHED because the row tag
  // we render leans on `status`).
  const seen = new Set<string>();
  const queue: Array<QueueItem> = [];
  for (const p of reportedPosts) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    queue.push({ post: p, kind: 'reported' });
  }
  for (const p of escalatedPosts) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    queue.push({ post: p, kind: 'escalated' });
  }
  for (const p of firstPosts) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    queue.push({ post: p, kind: 'first' });
  }

  const limited = queue.slice(0, 12);

  return (
    <>
      <section style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>
          Contenu <span className="dz-grad-text">à modérer</span>
        </h2>
        <p className="dz-small" style={{ marginTop: 6, fontSize: 13 }}>
          Modération éditoriale et mise en avant. Distinct des signalements
          utilisateurs (
          <Link href="/community/admin/moderation" style={{ color: '#7301FF' }}>
            voir la file
          </Link>
          ).
        </p>
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: 18,
          alignItems: 'start',
        }}
        className="dz-content-grid"
      >
        {/* ── File de modération ───────────────────────────────────── */}
        <div className="dz-card" style={{ padding: 22 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1a1f3a' }}>
              File de modération · {limited.length}
            </h3>
            {queue.length > 12 && (
              <span className="dz-small" style={{ fontSize: 11 }}>
                {queue.length - 12} de plus en attente
              </span>
            )}
          </div>

          {limited.length === 0 ? (
            <p className="dz-body" style={{ margin: 0 }}>
              Aucun contenu à modérer pour le moment. Les posts signalés ou
              en première publication apparaîtront ici.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {limited.map((q) => (
                <ContentQueueRow
                  key={q.post.id}
                  postId={q.post.id}
                  channelId={q.post.channelId}
                  channelSlug={q.post.channel.slug}
                  channelName={q.post.channel.name}
                  authorHandle={q.post.author.handle}
                  authorDisplayName={q.post.author.displayName}
                  excerpt={excerpt(q.post.title, q.post.body)}
                  kind={q.kind}
                  isPinned={q.post.isPinned}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Filtres automatiques ─────────────────────────────────── */}
        <div className="dz-card" style={{ padding: 22 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: '#1a1f3a' }}>
            Filtres automatiques
          </h3>
          <AutoFiltersPanel
            initial={{
              requireCharterAccept: settings.requireCharterAccept,
              quarantineDays: settings.quarantineDays,
              hasBannedWords: Boolean(settings.bannedWords && settings.bannedWords.trim().length > 0),
              autoSanctionThreshold: settings.autoSanctionThreshold,
            }}
          />
        </div>
      </div>

      {/* Responsive override: stack the two panes on tablet/mobile. */}
      <style>{`
        @media (max-width: 960px) {
          .dz-content-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

const postRowSelect = {
  channel: { select: { id: true, slug: true, name: true } },
  author: { select: { handle: true, displayName: true, postCount: true } },
} as const;

type QueueItem = {
  post: {
    id: string;
    channelId: string;
    title: string | null;
    body: string;
    isPinned: boolean;
    channel: { id: string; slug: string; name: string };
    author: { handle: string; displayName: string | null; postCount: number };
  };
  kind: 'reported' | 'escalated' | 'first';
};

function thirtyDaysAgo(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
}

function excerpt(title: string | null, body: string): string {
  const flat = (title ? `${title} — ` : '') + body.replace(/\s+/g, ' ').trim();
  const max = 200;
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

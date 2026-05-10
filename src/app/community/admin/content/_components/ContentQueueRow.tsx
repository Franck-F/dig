'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { approvePostContent } from '@/lib/actions/community/admin/moderation';
import { pinPost, unpinPost } from '@/lib/actions/community/admin/channels';
import { removePost } from '@/lib/actions/community/posts';

type Kind = 'reported' | 'escalated' | 'first';

type Props = {
  postId: string;
  channelId: string;
  channelSlug: string;
  channelName: string;
  authorHandle: string;
  authorDisplayName: string | null;
  excerpt: string;
  kind: Kind;
  isPinned: boolean;
};

const KIND_TAG: Record<Kind, { label: string; color: string }> = {
  reported: { label: 'Signalé', color: '#F46FB1' },
  escalated: { label: 'Escalade', color: '#FFB823' },
  first: { label: 'Premier post du membre', color: '#7301FF' },
};

const ACCENT_PALETTE = ['#7301FF', '#A34BF5', '#F46FB1', '#3B7BFF', '#FFB823', '#23c55e'];

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return ACCENT_PALETTE[h % ACCENT_PALETTE.length];
}

function initialsFor(displayName: string | null, handle: string): string {
  const cleaned = (displayName ?? '').trim();
  if (cleaned) {
    const parts = cleaned.split(/\s+/).slice(0, 2);
    const out = parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
    if (out) return out;
  }
  return handle.slice(0, 2).toUpperCase();
}

/**
 * Editorial moderation row used in `/community/admin/content`.
 *
 * Three actions in the handoff:
 *   - ✓ Approuver  → flips REPORTED → PUBLISHED, clears reportCount,
 *                    dismisses pending reports (admin server action).
 *   - ★ À la une   → pins the post on its channel (max 3 enforced
 *                    by `pinPost`). Toggles to "✦ Retirer mise en avant"
 *                    when already pinned.
 *   - ✕ Refuser    → soft-removes via `removePost`.
 *
 * Optimistic UI: the row fades & disables on action, and we router.refresh()
 * after success so the queue re-fetches from the server (no client-side
 * cache to drift).
 */
export default function ContentQueueRow({
  postId,
  channelId,
  channelSlug,
  channelName,
  authorHandle,
  authorDisplayName,
  excerpt,
  kind,
  isPinned: initialPinned,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pinned, setPinned] = useState(initialPinned);

  const tag = KIND_TAG[kind];
  const accent = colorFor(authorHandle);
  const displayName = authorDisplayName ?? `@${authorHandle}`;

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      const res = await approvePostContent({ postId });
      if (res.status === 'success') router.refresh();
      else setError(humanError(res.error));
    });
  };

  const handlePinToggle = () => {
    setError(null);
    startTransition(async () => {
      const res = pinned
        ? await unpinPost({ channelId, postId })
        : await pinPost({ channelId, postId });
      if (res.status === 'success') {
        setPinned(!pinned);
        router.refresh();
      } else {
        setError(humanError(res.error));
      }
    });
  };

  const handleRemove = () => {
    if (!window.confirm('Refuser ce contenu ? Le post sera masqué et l’auteur·e notifié·e.')) return;
    setError(null);
    startTransition(async () => {
      const res = await removePost({ id: postId, reason: 'Refusé en modération éditoriale.' });
      if (res.status === 'success') router.refresh();
      else setError(humanError(res.error));
    });
  };

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        background: '#faf7ff',
        border: '1px solid rgba(115,1,255,0.06)',
        opacity: pending ? 0.6 : 1,
        transition: 'opacity 120ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div
          aria-hidden
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: accent,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 11,
            flexShrink: 0,
          }}
        >
          {initialsFor(authorDisplayName, authorHandle)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#1a1f3a',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {displayName}
          </div>
          <div className="dz-small" style={{ fontSize: 10 }}>
            #{channelName}
          </div>
        </div>
        <span
          style={{
            padding: '3px 8px',
            borderRadius: 999,
            background: `${tag.color}15`,
            color: tag.color,
            fontSize: 10,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {tag.label}
        </span>
      </div>

      <p
        style={{
          margin: '0 0 12px',
          fontSize: 13,
          color: '#1a1f3a',
          lineHeight: 1.55,
          wordBreak: 'break-word',
        }}
      >
        {excerpt}
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          onClick={handleApprove}
          disabled={pending}
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: 'none',
            background: '#23c55e',
            color: 'white',
            fontSize: 11,
            fontWeight: 700,
            cursor: pending ? 'wait' : 'pointer',
          }}
        >
          ✓ Approuver
        </button>
        <button
          type="button"
          onClick={handlePinToggle}
          disabled={pending}
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: 'none',
            background: pinned ? '#7301FF' : 'rgba(115,1,255,0.10)',
            color: pinned ? 'white' : '#7301FF',
            fontSize: 11,
            fontWeight: 700,
            cursor: pending ? 'wait' : 'pointer',
          }}
        >
          {pinned ? '✦ Retirer la une' : '★ À la une'}
        </button>
        <button
          type="button"
          onClick={handleRemove}
          disabled={pending}
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: 'none',
            background: 'rgba(244,111,177,0.15)',
            color: '#d94e92',
            fontSize: 11,
            fontWeight: 700,
            cursor: pending ? 'wait' : 'pointer',
          }}
        >
          ✕ Refuser
        </button>
        <a
          href={`/community/c/${channelSlug}`}
          target="_blank"
          rel="noopener"
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            fontWeight: 700,
            color: '#7301FF',
            textDecoration: 'none',
          }}
        >
          Voir le canal →
        </a>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 10,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(239,68,68,0.08)',
            color: '#991b1b',
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

function humanError(code: string): string {
  switch (code) {
    case 'unauthorized':
    case 'forbidden':
      return 'Action réservée aux modérateurs.';
    case 'notFound':
      return 'Ce post n’existe plus.';
    case 'invalidInput':
      return 'Action invalide.';
    default:
      return 'Une erreur est survenue. Réessayez.';
  }
}

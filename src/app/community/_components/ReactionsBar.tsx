'use client';

import { useTransition, useState } from 'react';
import { useTranslations } from 'next-intl';

// Imported from Agent 3B-2's actions package. Module-not-found until 3B-2
// publishes its stubs; that is documented in §10 of the spec.
import { toggleReaction } from '@/lib/actions/community/reactions';

type TargetType = 'POST' | 'COMMENT';

const EMOJIS: Array<
  'THUMBS_UP' | 'HEART' | 'PARTY' | 'THINKING' | 'ROCKET' | 'FIRE' | 'CLAP' | 'EYES'
> = ['THUMBS_UP', 'HEART', 'PARTY', 'THINKING', 'ROCKET', 'FIRE', 'CLAP', 'EYES'];

const GLYPHS: Record<(typeof EMOJIS)[number], string> = {
  THUMBS_UP: '👍',
  HEART: '❤️',
  PARTY: '🎉',
  THINKING: '🤔',
  ROCKET: '🚀',
  FIRE: '🔥',
  CLAP: '👏',
  EYES: '👀',
};

type Props = {
  targetType: TargetType;
  targetId: string;
  /** Per-emoji counts as currently displayed. */
  counts?: Partial<Record<(typeof EMOJIS)[number], number>>;
  /** Viewer's current reaction (one per target), if any. */
  myEmoji?: (typeof EMOJIS)[number] | null;
  /** When false, renders disabled buttons + nudges to login. */
  canReact: boolean;
};

/**
 * 8-emoji reaction bar with optimistic toggle. One reaction per (member, target).
 */
export default function ReactionsBar({
  targetType,
  targetId,
  counts = {},
  myEmoji = null,
  canReact,
}: Props) {
  const t = useTranslations('community.post.actions');
  const [pending, startTransition] = useTransition();
  const [optimisticCounts, setOptimisticCounts] = useState(counts);
  const [optimisticMine, setOptimisticMine] = useState<typeof myEmoji>(myEmoji);

  function onClick(emoji: (typeof EMOJIS)[number]) {
    if (!canReact || pending) return;

    // Optimistic update: if same emoji → remove; if different → swap; else add.
    setOptimisticCounts((prev) => {
      const next = { ...prev };
      if (optimisticMine === emoji) {
        next[emoji] = Math.max(0, (next[emoji] ?? 1) - 1);
      } else {
        if (optimisticMine) {
          next[optimisticMine] = Math.max(0, (next[optimisticMine] ?? 1) - 1);
        }
        next[emoji] = (next[emoji] ?? 0) + 1;
      }
      return next;
    });
    setOptimisticMine((cur) => (cur === emoji ? null : emoji));

    startTransition(async () => {
      try {
        const fn = toggleReaction as unknown as (
          input: { targetType: TargetType; targetId: string; emoji: string },
        ) => Promise<{ status?: string }>;
        const res = await fn({ targetType, targetId, emoji });
        // The action returns `ActionResult` (no throw on most failures
        // — rate-limit, validation, target-not-found all come back as
        // `{ status: 'error' }`). Roll back optimistic state if the
        // server didn't accept the change.
        if (res?.status === 'error') {
          setOptimisticCounts(counts);
          setOptimisticMine(myEmoji);
        }
      } catch {
        // Network or unexpected throw — same rollback path.
        setOptimisticCounts(counts);
        setOptimisticMine(myEmoji);
      }
    });
  }

  return (
    <div
      role="toolbar"
      aria-label="Réactions"
      style={{
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      {EMOJIS.map((emoji) => {
        const count = optimisticCounts[emoji] ?? 0;
        const mine = optimisticMine === emoji;
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onClick(emoji)}
            disabled={!canReact || pending}
            aria-pressed={mine}
            aria-label={t(`reactionEmojiLabels.${emoji}`)}
            title={t(`reactionEmojiLabels.${emoji}`)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 999,
              border: mine
                ? '1px solid #7301FF'
                : '1px solid rgba(115,1,255,0.2)',
              background: mine ? 'rgba(115,1,255,0.12)' : 'transparent',
              cursor: canReact ? 'pointer' : 'not-allowed',
              opacity: canReact ? 1 : 0.55,
              fontSize: 14,
              transition: 'background 120ms ease',
            }}
          >
            <span aria-hidden>{GLYPHS[emoji]}</span>
            {count > 0 && (
              <span style={{ fontSize: 12, fontWeight: 600 }}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

import Link from 'next/link';
import React from 'react';

/**
 * Plain-text mention/hashtag renderer used outside the sanitized HTML path
 * (e.g. comment teasers, recent activity strips). For full post bodies the
 * sanitizer already turns @handle into anchors.
 *
 * Splits on @handle and #hashtag and emits Link components for each.
 */
const MENTION_OR_HASHTAG = /(?<![a-z0-9_])([@#][a-z0-9_]+)/gi;

export default function MentionRenderer({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(MENTION_OR_HASHTAG);
  return (
    <>
      {parts.map((part, idx) => {
        if (!part) return null;
        if (part.startsWith('@')) {
          const handle = part.slice(1).toLowerCase();
          if (handle.length < 3 || handle.length > 30) return part;
          return (
            <Link
              key={idx}
              href={`/community/members/${handle}`}
              data-mention
              style={{ color: '#7301FF', fontWeight: 600 }}
            >
              {part}
            </Link>
          );
        }
        if (part.startsWith('#')) {
          const tag = part.slice(1).toLowerCase();
          if (tag.length < 1 || tag.length > 32) return part;
          return (
            <Link
              key={idx}
              href={`/community/tag/${tag}`}
              data-hashtag
              style={{ color: '#A34BF5' }}
            >
              {part}
            </Link>
          );
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </>
  );
}

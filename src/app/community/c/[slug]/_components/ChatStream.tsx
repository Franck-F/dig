'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

export type ChatMessage = {
  id: string;
  body: string;
  publishedAt: string | null;
  attachmentUrls: string[];
  reactionCount: number;
  commentCount: number;
  author: {
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
};

type Props = {
  messages: ChatMessage[];
  /** Auto-refresh interval in ms. 0 disables polling. */
  pollMs?: number;
};

/**
 * Discord-like chat stream for a channel.
 *
 * Renders messages chronologically (oldest top → newest bottom). Each message
 * is a compact row: avatar | author + timestamp + body + reactions/comments
 * counts. Auto-scrolls to the latest message on first paint and after the
 * polling refresh.
 *
 * Polling: a setInterval calls `router.refresh()` every `pollMs` (default
 * 10s) so newly created posts surface without the user reloading. Pure
 * server-component refresh — no WebSocket infra.
 */
export default function ChatStream({ messages, pollMs = 10_000 }: Props) {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<string | null>(null);

  // Polling — refreshes the underlying RSC data so new posts come in.
  useEffect(() => {
    if (pollMs <= 0) return;
    const id = setInterval(() => {
      // Only refresh when the tab is visible — avoids spamming the DB
      // for inactive tabs.
      if (document.visibilityState === 'visible') router.refresh();
    }, pollMs);
    return () => clearInterval(id);
  }, [router, pollMs]);

  // Auto-scroll to bottom on initial mount AND when a new message arrives.
  useEffect(() => {
    const lastId = messages[messages.length - 1]?.id ?? null;
    const shouldScroll = lastId !== lastIdRef.current;
    lastIdRef.current = lastId;
    if (shouldScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: '#8b91ad',
          fontSize: 14,
        }}
      >
        Aucun message encore. Soyez le premier à écrire !
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '12px 4px 8px',
      }}
    >
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        // Group consecutive messages from the same author within 5 minutes —
        // hide avatar/author on the second+ message for a tighter look.
        const samePrev =
          !!prev &&
          prev.author.handle === m.author.handle &&
          m.publishedAt &&
          prev.publishedAt &&
          new Date(m.publishedAt).getTime() - new Date(prev.publishedAt).getTime() < 5 * 60 * 1000;

        return (
          <ChatMessageRow key={m.id} message={m} compact={!!samePrev} />
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

function ChatMessageRow({ message, compact }: { message: ChatMessage; compact: boolean }) {
  const authorName = message.author.displayName ?? `@${message.author.handle}`;
  const initials = authorName.slice(0, 2).toUpperCase();
  const ts = message.publishedAt ? new Date(message.publishedAt) : null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '6px 12px',
        borderRadius: 10,
        transition: 'background 0.2s',
        marginTop: compact ? 0 : 4,
      }}
      className="dz-chat-row"
    >
      <div style={{ width: 38, flexShrink: 0 }}>
        {!compact ? (
          message.author.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={message.author.avatarUrl}
              alt=""
              width={38}
              height={38}
              style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div
              aria-hidden
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {initials}
            </div>
          )
        ) : (
          <div
            style={{
              fontSize: 10,
              color: '#c4cad8',
              textAlign: 'right',
              paddingTop: 4,
              paddingRight: 4,
              fontVariantNumeric: 'tabular-nums',
            }}
            aria-hidden
          >
            {ts ? formatTimeOnly(ts) : ''}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {!compact && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <Link
              href={`/community/members/${message.author.handle}`}
              style={{ fontSize: 14, fontWeight: 700, color: '#1a1f3a', textDecoration: 'none' }}
            >
              {authorName}
            </Link>
            {ts && (
              <span style={{ fontSize: 11, color: '#8b91ad' }}>
                {formatRelative(ts)}
              </span>
            )}
          </div>
        )}
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: '#1a1f3a',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            marginTop: compact ? 0 : 2,
          }}
        >
          {message.body}
        </div>

        {message.attachmentUrls.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                message.attachmentUrls.length === 1
                  ? 'minmax(0, 1fr)'
                  : 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 6,
              marginTop: 6,
              maxWidth: 520,
            }}
          >
            {message.attachmentUrls.map((url, i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={i}
                src={url}
                alt=""
                style={{
                  width: '100%',
                  borderRadius: 12,
                  display: 'block',
                  border: '1px solid rgba(115,1,255,0.10)',
                }}
              />
            ))}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 14,
            marginTop: 6,
            fontSize: 12,
            color: '#8b91ad',
          }}
        >
          <Link
            href={`/community/posts/${message.id}`}
            style={{ color: '#8b91ad', textDecoration: 'none' }}
          >
            ♡ {message.reactionCount}
          </Link>
          <Link
            href={`/community/posts/${message.id}`}
            style={{ color: '#8b91ad', textDecoration: 'none' }}
          >
            💬 {message.commentCount}
          </Link>
        </div>
      </div>

      <style jsx>{`
        .dz-chat-row:hover {
          background: rgba(115, 1, 255, 0.04);
        }
      `}</style>
    </div>
  );
}

function formatTimeOnly(d: Date): string {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatRelative(d: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (seconds < 60) return "à l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

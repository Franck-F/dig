'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { sendMessage, markThreadRead } from '@/lib/actions/mentora/messages';

type Msg = {
  id: string;
  body: string;
  senderUserId: string;
  sentAt: string;
};

/**
 * Messages tab — minimal chat thread bound to a single mentorship.
 *
 * Loading strategy:
 *   - Initial fetch from `/api/mentora/messages?mentorshipId=…`. The route
 *     itself is owned by Agent 2B-2 (or Agent 2B-1's API surface). If absent
 *     the component degrades to an empty state.
 *   - Soft polling every 8s while the tab is mounted. We deliberately avoid
 *     WebSockets / Server-Sent Events for v1 — the spec sets no real-time
 *     requirement and polling is dramatically simpler to ship.
 *
 * Thread is read-only when the mentorship is TERMINATED. The `isLocked` prop
 * lets the parent decide which lock applies (TERMINATED only — COMPLETED keeps
 * messages writable so partners can do post-mortems).
 */
export default function MessagesTab({
  mentorshipId,
  myUserId,
  isLocked,
}: {
  mentorshipId: string;
  myUserId: string;
  isLocked: boolean;
}) {
  const t = useTranslations('mentora.mentorships.detail');
  const tMsg = useTranslations('mentora.messages');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Initial + polling fetch
  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch(
          `/api/mentora/messages?mentorshipId=${encodeURIComponent(mentorshipId)}`,
          { cache: 'no-store' },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { messages?: Msg[] };
        if (!cancelled && Array.isArray(data.messages)) setMessages(data.messages);
      } catch {
        // Silent — degrade to empty thread, action will still try to send.
      }
    }
    tick();
    const id = window.setInterval(tick, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [mentorshipId]);

  // Mark thread read on mount (best-effort).
  useEffect(() => {
    let active = true;
    markThreadRead({ mentorshipId }).catch(() => {
      // Action may not exist yet during integration — ignore.
    });
    return () => {
      active = false;
      void active;
    };
  }, [mentorshipId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function handleSend() {
    const body = draft.trim();
    if (!body || isLocked) return;
    setError(null);
    startTransition(async () => {
      try {
        await sendMessage({ mentorshipId, body });
        setDraft('');
        // Optimistic refresh — the next 8s poll will overwrite anyway.
        setMessages((prev) => [
          ...prev,
          {
            id: `tmp-${Date.now()}`,
            body,
            senderUserId: myUserId,
            sentAt: new Date().toISOString(),
          },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur d\'envoi');
      }
    });
  }

  return (
    <div className="dz-card" style={{ padding: 24 }}>
      <h2 className="dz-h2" style={{ fontSize: 18, marginBottom: 12 }}>{t('messagesTitle')}</h2>

      {isLocked && (
        <div
          style={{
            padding: 10,
            marginBottom: 12,
            background: 'rgba(36,50,95,0.06)',
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {t('messagesLocked')}
        </div>
      )}

      <div
        ref={scrollRef}
        style={{
          minHeight: 240,
          maxHeight: 480,
          overflowY: 'auto',
          padding: 12,
          background: 'rgba(115,1,255,0.04)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {messages.length === 0 ? (
          <p className="dz-small" style={{ textAlign: 'center', margin: 'auto' }}>
            {t('messagesEmpty')}
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderUserId === myUserId;
            return (
              <div
                key={m.id}
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '78%',
                  padding: '8px 12px',
                  borderRadius: 14,
                  background: mine ? '#7301FF' : 'white',
                  color: mine ? 'white' : 'inherit',
                  border: mine ? 'none' : '1px solid rgba(115,1,255,0.10)',
                  fontSize: 14,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {m.body}
              </div>
            );
          })
        )}
      </div>

      {!isLocked && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <textarea
            className="dz-input"
            rows={2}
            placeholder={t('messagesPlaceholder')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSend();
              }
            }}
            maxLength={4000}
            style={{ flex: 1, resize: 'vertical' }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={pending || draft.trim().length === 0}
            className="dz-btn dz-btn-primary dz-btn-sm"
            style={{ alignSelf: 'flex-end' }}
          >
            {pending ? tMsg('sending') : t('messagesSend')}
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 8,
            padding: '8px 12px',
            borderRadius: 8,
            background: 'rgba(217,78,146,0.10)',
            color: '#a8235e',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

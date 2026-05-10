'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { broadcastCommunityAnnouncement } from '@/lib/actions/rituals';

/**
 * "Annonce communauté" textarea + send button. Calls
 * `broadcastCommunityAnnouncement` which inserts an in-app
 * Notification row for every active community member.
 *
 * On success we surface the recipient count below the button so the
 * admin gets immediate feedback ("Envoyé à 1 248 membres"). Errors
 * are rendered inline with no full-page redirect.
 */
export default function BroadcastForm({
  title,
  body,
  placeholder,
  submitLabel,
}: {
  title: string;
  body: string;
  placeholder: string;
  submitLabel: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    | { kind: 'success'; count: number }
    | { kind: 'error'; message: string }
    | null
  >(null);

  const onSubmit = () => {
    const text = draft.trim();
    if (text.length < 2) return;
    startTransition(async () => {
      const res = await broadcastCommunityAnnouncement({ body: text });
      if (res.status === 'success') {
        setFeedback({ kind: 'success', count: res.recipientCount });
        setDraft('');
        router.refresh();
      } else {
        setFeedback({ kind: 'error', message: res.error });
      }
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 12, opacity: 0.9 }}>{body}</p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        maxLength={500}
        disabled={pending}
        style={{
          width: '100%',
          marginTop: 12,
          padding: 12,
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.30)',
          background: 'rgba(255,255,255,0.10)',
          color: 'white',
          fontSize: 13,
          minHeight: 96,
          outline: 'none',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={pending || draft.trim().length < 2}
        style={{
          marginTop: 10,
          padding: '10px 20px',
          borderRadius: 10,
          border: 'none',
          background: 'white',
          color: '#7301FF',
          fontSize: 13,
          fontWeight: 700,
          cursor: pending ? 'wait' : 'pointer',
          opacity: pending || draft.trim().length < 2 ? 0.6 : 1,
          fontFamily: 'inherit',
        }}
      >
        {pending ? '…' : submitLabel}
      </button>
      {feedback?.kind === 'success' && (
        <p
          role="status"
          style={{
            margin: '10px 0 0',
            fontSize: 12,
            color: 'rgba(255,255,255,0.95)',
            fontWeight: 600,
          }}
        >
          ✓ Envoyé à {feedback.count.toLocaleString('fr-FR')} membres.
        </p>
      )}
      {feedback?.kind === 'error' && (
        <p
          role="alert"
          style={{
            margin: '10px 0 0',
            fontSize: 12,
            color: '#ffe5f1',
            fontWeight: 600,
          }}
        >
          ✗ {feedback.message}
        </p>
      )}
    </div>
  );
}

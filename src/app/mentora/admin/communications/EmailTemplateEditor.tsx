'use client';

import { useState, useTransition } from 'react';

import { sendNewsletterCampaign } from '@/lib/actions/newsletter';

/**
 * Email-template editor for `/mentora/admin/communications`.
 *
 * Two stops:
 *   - "Tester l'envoi" — pushes the current draft to the `subscribers`
 *     audience (newsletter opt-ins only) so a real test reaches the
 *     admin's own inbox if they're subscribed. The action returns a
 *     `mocked: true` flag when RESEND_API_KEY is missing — surfaced
 *     to the admin so they don't think nothing happened.
 *   - "Sauvegarder" — local-storage persist of subject + body so the
 *     admin can come back later. We don't ship a server-side template
 *     table yet because the editing flow is single-admin in practice.
 *
 * Live characters counters help the admin stay under the 200/10000 limits
 * enforced by `campaignSchema`.
 */

const STORAGE_KEY = 'digizelle.admin.email-template.v1';

const DEFAULT_SUBJECT = '✦ Nouvelle session disponible avec ton mentor';
const DEFAULT_BODY = `Bonjour {{prenom}},

Ton mentor {{mentor}} a ouvert un créneau pour {{date}}. Réserve-le en 1 clic depuis ton espace Mentorat.

— L'équipe Digizelle ✦`;

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'sent'; mocked: boolean; recipientCount: number }
  | { kind: 'error'; error: string }
  | { kind: 'saved' };

export default function EmailTemplateEditor() {
  // SSR-safe initial values; we hydrate from localStorage on the client only
  // to avoid hydration mismatches.
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();
  const [hydrated, setHydrated] = useState(false);

  // Defer the localStorage read to a useEffect-style mount to keep SSR clean.
  // We don't need useEffect because React 19's startTransition + useState
  // re-render is enough — but we only read once.
  if (typeof window !== 'undefined' && !hydrated) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { subject?: string; body?: string };
        if (typeof parsed.subject === 'string') setSubject(parsed.subject);
        if (typeof parsed.body === 'string') setBody(parsed.body);
      }
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }

  function handleSave() {
    setStatus({ kind: 'saving' });
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ subject, body, savedAt: new Date().toISOString() }),
      );
      setStatus({ kind: 'saved' });
      setTimeout(() => setStatus({ kind: 'idle' }), 2500);
    } catch {
      setStatus({ kind: 'error', error: 'Impossible de sauvegarder localement.' });
    }
  }

  function handleSendTest() {
    if (subject.trim().length < 5) {
      setStatus({ kind: 'error', error: 'Sujet trop court (min 5 caractères).' });
      return;
    }
    if (body.trim().length < 10) {
      setStatus({ kind: 'error', error: 'Contenu trop court (min 10 caractères).' });
      return;
    }
    startTransition(async () => {
      const res = await sendNewsletterCampaign({
        subject,
        body,
        audience: 'subscribers',
        format: 'text',
      });
      if (res.status === 'success') {
        setStatus({
          kind: 'sent',
          mocked: res.mocked,
          recipientCount: res.recipientCount,
        });
      } else {
        const error =
          res.error === 'no_recipients'
            ? "Aucun destinataire dans l'audience « inscrits newsletter »."
            : res.error === 'unauthorized'
              ? 'Action réservée aux administrateurs.'
              : res.error === 'send_failed'
                ? "L'envoi a échoué. Réessayez plus tard."
                : res.error;
        setStatus({ kind: 'error', error });
      }
    });
  }

  return (
    <>
      {/* Subject */}
      <div
        style={{
          padding: 14,
          borderRadius: 12,
          background: '#faf7ff',
          border: '1px solid rgba(115,1,255,0.06)',
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <label htmlFor="comms-subject" className="dz-small" style={{ fontSize: 11 }}>
            Sujet
          </label>
          <span className="dz-small" style={{ fontSize: 10 }}>
            {subject.length} / 200
          </span>
        </div>
        <input
          id="comms-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid rgba(115,1,255,0.10)',
            background: 'white',
            fontSize: 12,
            color: '#1a1f3a',
            outline: 'none',
          }}
        />
      </div>

      {/* Body */}
      <div
        style={{
          padding: 14,
          borderRadius: 12,
          background: '#faf7ff',
          border: '1px solid rgba(115,1,255,0.06)',
          minHeight: 180,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <label htmlFor="comms-body" className="dz-small" style={{ fontSize: 11 }}>
            Corps de l&rsquo;email
          </label>
          <span className="dz-small" style={{ fontSize: 10 }}>
            {body.length} / 10 000
          </span>
        </div>
        <textarea
          id="comms-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={10000}
          rows={8}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid rgba(115,1,255,0.10)',
            background: 'white',
            fontSize: 13,
            color: '#1a1f3a',
            outline: 'none',
            fontFamily: 'inherit',
            lineHeight: 1.55,
            resize: 'vertical',
          }}
        />
        <p className="dz-small" style={{ fontSize: 10, marginTop: 8 }}>
          Variables supportées : <code>{'{{prenom}}'}</code>, <code>{'{{mentor}}'}</code>,{' '}
          <code>{'{{date}}'}</code> — remplacées au moment de l&rsquo;envoi.
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button
          type="button"
          onClick={handleSendTest}
          disabled={pending}
          style={{
            flex: 1,
            padding: '9px 14px',
            borderRadius: 9,
            border: 'none',
            background: pending
              ? 'rgba(115,1,255,0.45)'
              : 'linear-gradient(135deg, #7301FF, #A34BF5)',
            color: 'white',
            fontSize: 12,
            fontWeight: 700,
            cursor: pending ? 'wait' : 'pointer',
          }}
        >
          {pending ? 'Envoi…' : "Tester l'envoi"}
        </button>
        <button
          type="button"
          onClick={handleSave}
          style={{
            flex: 1,
            padding: '9px 14px',
            borderRadius: 9,
            border: '1px solid rgba(115,1,255,0.15)',
            background: 'transparent',
            color: '#7301FF',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Sauvegarder
        </button>
      </div>

      {/* Feedback */}
      {status.kind === 'sent' && (
        <div
          role="status"
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 9,
            background: 'rgba(35,197,94,0.10)',
            color: '#0e7c3a',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {status.mocked
            ? `Test mocké — ${status.recipientCount} destinataires dans l'audience (RESEND_API_KEY manquante).`
            : `Envoyé à ${status.recipientCount} inscrit·es à la newsletter.`}
        </div>
      )}
      {status.kind === 'saved' && (
        <div
          role="status"
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 9,
            background: 'rgba(115,1,255,0.10)',
            color: '#7301FF',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Modèle sauvegardé localement.
        </div>
      )}
      {status.kind === 'error' && (
        <div
          role="alert"
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 9,
            background: 'rgba(239,68,68,0.08)',
            color: '#991b1b',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {status.error}
        </div>
      )}
    </>
  );
}

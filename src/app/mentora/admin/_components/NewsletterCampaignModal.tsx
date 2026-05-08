'use client';

import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';

import {
  type Audience,
  countAudience,
  getNewsletterCampaignStatus,
  sendNewsletterCampaign,
  triggerNewsletterDrain,
} from '@/lib/actions/newsletter';
import { useFocusTrap } from '@/hooks/useFocusTrap';

type Props = {
  /** Total recipients pre-counted at render time (mentors + mentees). Used as
   *  a hint while the live audience count loads. */
  initialReachHint: number;
};

const AUDIENCES: Array<{ key: Audience; label: string; sub: string }> = [
  { key: 'all', label: 'Tous', sub: 'Mentors + mentoré·es + communauté + inscrits newsletter' },
  { key: 'subscribers', label: 'Inscrits newsletter', sub: 'Visiteurs ayant rempli le footer' },
  { key: 'mentors', label: 'Mentors', sub: 'Tous les comptes avec profil mentor' },
  { key: 'mentees', label: 'Mentoré·es', sub: 'Tous les comptes avec profil mentee' },
  { key: 'community', label: 'Communauté', sub: 'Membres actifs de l\'espace communauté' },
];

type View = 'compose' | 'confirm' | 'sending' | 'done' | 'error';

/**
 * Newsletter composer launched from the Mentora admin pilotage.
 *
 * Flow: compose (subject + audience + body) → confirm (shows live count) →
 * server action `sendNewsletterCampaign` → result screen with sent / failed
 * / mocked counters. Audience count is fetched live whenever the segment
 * changes, so the admin sees the real reach before sending.
 *
 * The send is stateless server-side (no campaign history table). If the
 * RESEND_API_KEY is missing the action returns `mocked: true` and the UI
 * surfaces a clear note so the admin knows nothing was actually sent.
 */
export default function NewsletterCampaignModal({ initialReachHint }: Props) {
  const [open, setOpen] = useState(false);
  // Focus trap on the campaign composer (WCAG 2.4.3).
  const dialogRef = useFocusTrap<HTMLDivElement>(open);
  const [view, setView] = useState<View>('compose');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [format, setFormat] = useState<'text' | 'html'>('text');
  const [audience, setAudience] = useState<Audience>('all');
  const [count, setCount] = useState<number>(initialReachHint);
  const [countLoading, setCountLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    campaignTag: string;
    recipientCount: number;
    mocked: boolean;
  } | null>(null);
  const [progress, setProgress] = useState<{
    pending: number;
    sending: number;
    sent: number;
    failed: number;
    total: number;
  } | null>(null);
  const [draining, setDraining] = useState(false);
  const [pending, startTransition] = useTransition();

  // Live audience count whenever the picker changes.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCountLoading(true);
    countAudience(audience).then((res) => {
      if (cancelled) return;
      if (res.status === 'success') setCount(res.count);
      setCountLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, audience]);

  // Esc to close + scroll lock.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
     
  }, [open]);

  const closeModal = () => {
    setOpen(false);
    // Reset on close so re-open starts clean — but only after the closing
    // animation completes-ish; immediate reset is fine since we conditionally
    // render the modal.
    setTimeout(() => {
      setView('compose');
      setError(null);
      setResult(null);
    }, 100);
  };

  const validateForCompose = (): string | null => {
    if (subject.trim().length < 5) return 'Le sujet doit faire au moins 5 caractères.';
    if (subject.trim().length > 200) return 'Le sujet est trop long (max 200).';
    if (body.trim().length < 10) return 'Le contenu doit faire au moins 10 caractères.';
    if (body.trim().length > 10000) return 'Le contenu est trop long (max 10 000).';
    if (count === 0) return 'Aucun destinataire pour ce segment.';
    return null;
  };

  const onPrimary = () => {
    if (view === 'compose') {
      const validation = validateForCompose();
      if (validation) {
        setError(validation);
        return;
      }
      setError(null);
      setView('confirm');
    } else if (view === 'confirm') {
      setError(null);
      setView('sending');
      startTransition(async () => {
        const res = await sendNewsletterCampaign({ subject, body, audience, format });
        if (res.status === 'success') {
          setResult({
            campaignTag: res.campaignTag,
            recipientCount: res.recipientCount,
            mocked: res.mocked,
          });
          // Pull the first status snapshot so the result screen has
          // numbers to display immediately (the in-request drain
          // already moved some items to SENT).
          const status = await getNewsletterCampaignStatus(res.campaignTag);
          if (status.status === 'success') {
            setProgress({
              pending: status.pending,
              sending: status.sending,
              sent: status.sent,
              failed: status.failed,
              total: status.total,
            });
          }
          setView('done');
        } else {
          setError(humanizeError(res.error));
          setView('error');
        }
      });
    } else if (view === 'done' || view === 'error') {
      closeModal();
    }
  };

  // Live progress polling — refreshes every 3s while the result panel is
  // visible AND there are still pending/sending items. Stops cleanly
  // when everything is settled or the user closes the modal.
  useEffect(() => {
    if (view !== 'done' || !result?.campaignTag) return;
    if (progress && progress.pending === 0 && progress.sending === 0) return;
    const id = setInterval(async () => {
      const s = await getNewsletterCampaignStatus(result.campaignTag);
      if (s.status === 'success') {
        setProgress({
          pending: s.pending,
          sending: s.sending,
          sent: s.sent,
          failed: s.failed,
          total: s.total,
        });
      }
    }, 3000);
    return () => clearInterval(id);
  }, [view, result?.campaignTag, progress]);

  const onAccelerateDrain = () => {
    if (draining || !result) return;
    setDraining(true);
    triggerNewsletterDrain()
      .then(async () => {
        const s = await getNewsletterCampaignStatus(result.campaignTag);
        if (s.status === 'success') {
          setProgress({
            pending: s.pending,
            sending: s.sending,
            sent: s.sent,
            failed: s.failed,
            total: s.total,
          });
        }
      })
      .finally(() => setDraining(false));
  };

  const primaryLabel =
    view === 'compose'
      ? 'Continuer →'
      : view === 'confirm'
        ? `Envoyer à ${count} destinataire${count > 1 ? 's' : ''}`
        : view === 'sending'
          ? 'Envoi en cours…'
          : 'Fermer';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          flex: 1,
          padding: '8px 12px',
          borderRadius: 9,
          border: 'none',
          background: '#ffffff',
          color: '#7301FF',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 6px 14px rgba(15,18,40,0.18)',
        }}
      >
        Composer →
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="newsletter-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeModal();
            }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,18,40,0.78)',
              backdropFilter: 'blur(10px) saturate(160%)',
              WebkitBackdropFilter: 'blur(10px) saturate(160%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: 16,
            }}
          >
            <div
              ref={dialogRef}
              style={{
                background: '#ffffff',
                color: '#1a1f3a',
                width: '100%',
                maxWidth: 640,
                borderRadius: 22,
                maxHeight: '92vh',
                overflowY: 'auto',
                border: '1px solid rgba(115,1,255,0.10)',
                boxShadow:
                  '0 30px 80px -20px rgba(15,18,40,0.45), 0 8px 24px -8px rgba(15,18,40,0.25)',
              }}
            >
              <div
                style={{
                  background: 'linear-gradient(135deg,#7301FF,#A34BF5)',
                  color: 'white',
                  padding: '22px 28px 18px',
                  position: 'relative',
                  borderTopLeftRadius: 22,
                  borderTopRightRadius: 22,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    opacity: 0.85,
                  }}
                >
                  Communication
                </div>
                <h2
                  id="newsletter-modal-title"
                  style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 800 }}
                >
                  Newsletter Digizelle
                </h2>
                <button
                  type="button"
                  onClick={closeModal}
                  aria-label="Fermer"
                  style={{
                    position: 'absolute',
                    top: 14,
                    right: 14,
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.22)',
                    border: 'none',
                    color: 'white',
                    fontSize: 18,
                    lineHeight: 1,
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ padding: '22px 28px 28px' }}>
                {view === 'compose' && (
                  <ComposeView
                    subject={subject}
                    setSubject={setSubject}
                    body={body}
                    setBody={setBody}
                    format={format}
                    setFormat={setFormat}
                    audience={audience}
                    setAudience={setAudience}
                    count={count}
                    countLoading={countLoading}
                  />
                )}
                {view === 'confirm' && (
                  <ConfirmView
                    subject={subject}
                    body={body}
                    format={format}
                    audienceLabel={
                      AUDIENCES.find((a) => a.key === audience)?.label ?? audience
                    }
                    count={count}
                  />
                )}
                {(view === 'sending' || view === 'done' || view === 'error') && (
                  <ResultView
                    view={view}
                    error={error}
                    result={result}
                    progress={progress}
                    draining={draining}
                    onAccelerateDrain={onAccelerateDrain}
                  />
                )}

                {error && view !== 'error' && (
                  <div
                    role="alert"
                    style={{
                      marginTop: 14,
                      padding: 12,
                      borderRadius: 10,
                      background: 'rgba(217,78,146,0.10)',
                      color: '#a8235e',
                      fontSize: 13,
                    }}
                  >
                    {error}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    marginTop: 24,
                    justifyContent: 'flex-end',
                  }}
                >
                  {view === 'compose' && (
                    <button
                      type="button"
                      onClick={closeModal}
                      className="dz-btn dz-btn-ghost"
                    >
                      Annuler
                    </button>
                  )}
                  {view === 'confirm' && (
                    <button
                      type="button"
                      onClick={() => setView('compose')}
                      className="dz-btn dz-btn-ghost"
                      disabled={pending}
                    >
                      ← Modifier
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onPrimary}
                    disabled={pending || view === 'sending'}
                    className="dz-btn dz-btn-primary"
                    style={{ opacity: pending || view === 'sending' ? 0.7 : 1 }}
                  >
                    {primaryLabel}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function ComposeView({
  subject,
  setSubject,
  body,
  setBody,
  format,
  setFormat,
  audience,
  setAudience,
  count,
  countLoading,
}: {
  subject: string;
  setSubject: (v: string) => void;
  body: string;
  setBody: (v: string) => void;
  format: 'text' | 'html';
  setFormat: (v: 'text' | 'html') => void;
  audience: Audience;
  setAudience: (v: Audience) => void;
  count: number;
  countLoading: boolean;
}) {
  return (
    <>
      <Label>Sujet</Label>
      <input
        type="text"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Ex. Digizelle Impact #1 — récap & photos"
        maxLength={200}
        style={inputStyle}
      />
      <div style={hintStyle}>{subject.trim().length} / 200</div>

      <Label style={{ marginTop: 18 }}>Audience</Label>
      <div style={{ display: 'grid', gap: 8 }}>
        {AUDIENCES.map((a) => {
          const on = audience === a.key;
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => setAudience(a.key)}
              aria-pressed={on}
              style={{
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 12,
                border: `1px solid ${on ? '#7301FF' : 'rgba(115,1,255,0.15)'}`,
                background: on ? 'rgba(115,1,255,0.06)' : '#ffffff',
                cursor: 'pointer',
                color: '#2c1c4f',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>{a.label}</div>
              <div style={{ fontSize: 12, color: '#7a6a9a', marginTop: 2 }}>
                {a.sub}
              </div>
            </button>
          );
        })}
      </div>
      <div style={hintStyle}>
        {countLoading
          ? 'Calcul du nombre de destinataires…'
          : `${count} destinataire${count > 1 ? 's' : ''} unique${count > 1 ? 's' : ''} après dédoublonnage`}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 6, gap: 12, flexWrap: 'wrap' }}>
        <Label style={{ marginTop: 0, marginBottom: 0 }}>Contenu</Label>
        {/* Format toggle: plain text (default, auto-linked) vs raw
            HTML/CSS (sanitised server-side via DOMPurify before send).
            HTML mode lets the admin paste a hand-crafted email
            template — useful for branded campaigns with images,
            tables and inline styles. */}
        <div
          role="group"
          aria-label="Format du contenu"
          style={{
            display: 'inline-flex',
            padding: 3,
            borderRadius: 999,
            background: 'rgba(115,1,255,0.06)',
            border: '1px solid rgba(115,1,255,0.18)',
          }}
        >
          {(['text', 'html'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              aria-pressed={format === f}
              style={{
                padding: '5px 12px',
                borderRadius: 999,
                border: 'none',
                cursor: format === f ? 'default' : 'pointer',
                background: format === f ? 'linear-gradient(135deg, #7301FF, #A34BF5)' : 'transparent',
                color: format === f ? '#fff' : '#7301FF',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontFamily: 'inherit',
              }}
            >
              {f === 'text' ? 'Texte' : 'HTML'}
            </button>
          ))}
        </div>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          format === 'html'
            ? '<table width="100%" cellpadding="0" cellspacing="0" style="font-family:Inter,Helvetica,sans-serif">\n  <tr><td>\n    <h1 style="color:#7301FF">Sujet de la newsletter</h1>\n    <p>Le contenu HTML sera nettoyé côté serveur (DOMPurify).</p>\n  </td></tr>\n</table>'
            : 'Bonjour à toutes et à tous,\n\nUn petit mot pour vous partager…\n\nÀ très vite,\nL\'équipe Digizelle'
        }
        rows={format === 'html' ? 14 : 10}
        maxLength={10000}
        spellCheck={format === 'text'}
        style={{
          ...inputStyle,
          fontFamily: format === 'html' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
          fontSize: format === 'html' ? 12.5 : 14,
          resize: 'vertical',
          lineHeight: 1.6,
        }}
      />
      <div style={hintStyle}>
        {body.trim().length} / 10 000 ·{' '}
        {format === 'html'
          ? 'Tags autorisés : a, p, h1-h6, ul/ol/li, table, img, span/div + inline styles. Scripts et iframes bloqués.'
          : 'Les liens https:// sont auto-cliquables.'}
      </div>
    </>
  );
}

function ConfirmView({
  subject,
  body,
  format,
  audienceLabel,
  count,
}: {
  subject: string;
  body: string;
  format: 'text' | 'html';
  audienceLabel: string;
  count: number;
}) {
  return (
    <>
      <div style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
        <Row label="Audience" value={`${audienceLabel} · ${count} destinataire${count > 1 ? 's' : ''}`} />
        <Row label="Sujet" value={subject} />
        <Row label="Format" value={format === 'html' ? 'HTML enrichi (sanitisé)' : 'Texte brut'} />
      </div>
      <Label>Aperçu du contenu</Label>
      {format === 'html' ? (
        // Render the HTML preview directly. Same DOMPurify-allow-list
        // sanitisation runs server-side before send — the preview is
        // an indicative render to catch obvious typos / broken tags.
        // Wrapped in an iframe to isolate styles from the modal.
        <iframe
          title="Aperçu HTML newsletter"
          srcDoc={`<!doctype html><html><body style="margin:0;padding:16px;background:#f7f4ff;color:#2c1c4f;font-family:Inter,Helvetica,sans-serif;font-size:14px;line-height:1.65">${body}</body></html>`}
          sandbox=""
          style={{
            width: '100%',
            height: 240,
            borderRadius: 12,
            border: '1px solid rgba(115,1,255,0.10)',
            background: '#f7f4ff',
          }}
        />
      ) : (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            background: '#f7f4ff',
            border: '1px solid rgba(115,1,255,0.10)',
            fontSize: 14,
            lineHeight: 1.65,
            color: '#2c1c4f',
            whiteSpace: 'pre-wrap',
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {body}
        </div>
      )}
      <div style={{ ...hintStyle, marginTop: 12 }}>
        L&apos;envoi est définitif. Vérifiez bien le contenu avant de confirmer.
      </div>
    </>
  );
}

type ProgressShape = {
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  total: number;
};

function ResultView({
  view,
  error,
  result,
  progress,
  draining,
  onAccelerateDrain,
}: {
  view: View;
  error: string | null;
  result: { campaignTag: string; recipientCount: number; mocked: boolean } | null;
  progress: ProgressShape | null;
  draining: boolean;
  onAccelerateDrain: () => void;
}) {
  if (view === 'sending') {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div
          style={{
            width: 36,
            height: 36,
            margin: '0 auto 14px',
            borderRadius: '50%',
            border: '3px solid rgba(115,1,255,0.20)',
            borderTopColor: '#7301FF',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p style={{ margin: 0, color: '#3a2960', fontWeight: 600 }}>
          Mise en file d&apos;attente…
        </p>
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }
  if (view === 'error') {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>×</div>
        <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>Envoi impossible</h3>
        <p style={{ margin: 0, color: '#a8235e', fontSize: 14 }}>{error ?? 'Une erreur est survenue.'}</p>
      </div>
    );
  }
  if (view === 'done' && result) {
    const total = progress?.total ?? result.recipientCount;
    const sent = progress?.sent ?? 0;
    const pending = (progress?.pending ?? 0) + (progress?.sending ?? 0);
    const failed = progress?.failed ?? 0;
    const pct = total === 0 ? 100 : Math.round((sent / total) * 100);
    const allDone = pending === 0;
    return (
      <div style={{ textAlign: 'center', padding: '4px 0 0' }}>
        <div style={{ fontSize: 36, marginBottom: 10, color: allDone ? '#23c55e' : '#7301FF' }}>
          {allDone ? '✓' : '⟳'}
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: 20 }}>
          {result.mocked
            ? 'Envoi simulé'
            : allDone
              ? 'Campagne terminée'
              : 'Envoi en cours…'}
        </h3>
        <p style={{ margin: 0, color: '#3a2960', fontSize: 14 }}>
          {sent} envoyé{sent > 1 ? 's' : ''}
          {failed > 0 ? ` · ${failed} échec${failed > 1 ? 's' : ''}` : ''}
          {' '}sur {total} destinataire{total > 1 ? 's' : ''}
          {!allDone && ` · ${pending} en attente`}.
        </p>

        {/* Progress bar — animates as the queue drains. */}
        <div
          style={{
            margin: '14px auto 0',
            width: '100%',
            maxWidth: 380,
            height: 8,
            background: 'rgba(115,1,255,0.10)',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #7301FF, #A34BF5)',
              transition: 'width 0.4s ease',
            }}
          />
        </div>

        {!allDone && !result.mocked && (
          <button
            type="button"
            onClick={onAccelerateDrain}
            disabled={draining}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              borderRadius: 10,
              border: '1px solid rgba(115,1,255,0.20)',
              background: 'white',
              color: '#7301FF',
              fontSize: 13,
              fontWeight: 600,
              cursor: draining ? 'wait' : 'pointer',
            }}
          >
            {draining ? 'Accélération…' : 'Accélérer l\'envoi'}
          </button>
        )}

        {result.mocked && (
          <p
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 10,
              background: 'rgba(244,196,48,0.12)',
              color: '#7a5a00',
              fontSize: 13,
            }}
          >
            <strong>RESEND_API_KEY</strong> manquante : les emails ont été simulés (logs serveur uniquement). Configurez la clé pour activer l&apos;envoi réel.
          </p>
        )}
      </div>
    );
  }
  return null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 14 }}>
      <span
        style={{
          minWidth: 90,
          color: '#7a6a9a',
          fontWeight: 600,
          textTransform: 'uppercase',
          fontSize: 11,
          letterSpacing: '0.08em',
          paddingTop: 2,
        }}
      >
        {label}
      </span>
      <span style={{ color: '#2c1c4f', fontWeight: 600, flex: 1 }}>{value}</span>
    </div>
  );
}

function Label({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: '#3a2960',
        marginBottom: 8,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid rgba(115,1,255,0.20)',
  background: '#ffffff',
  fontSize: 14,
  color: '#1a1f3a',
  outline: 'none',
};

const hintStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: '#7a6a9a',
};

function humanizeError(code: string): string {
  switch (code) {
    case 'unauthorized':
      return 'Vous n\'avez pas les droits pour envoyer une newsletter.';
    case 'no_recipients':
      return 'Aucun destinataire pour ce segment.';
    case 'send_failed':
      return 'L\'envoi a échoué. Réessayez ou vérifiez les logs serveur.';
    default:
      return code || 'Erreur inconnue.';
  }
}

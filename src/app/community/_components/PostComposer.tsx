'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { createPost, updatePost } from '@/lib/actions/community/posts';
import MentionAutocomplete from './MentionAutocomplete';
import {
  applyMarkdownAction,
  handleMarkdownKeyDown,
  type MarkdownAction,
} from './markdownShortcuts';

const MAX_ATTACHMENTS = 4;
const ATTACHMENT_MAX_WIDTH = 720;
const ATTACHMENT_QUALITY = 0.78;

export type PostComposerChannel = {
  slug: string;
  name: string;
  emoji: string | null;
};

/**
 * Authoring-helper kinds surfaced from the home-feed quick chips
 * (+ Photo / + Sondage / + Événement / + Ressource). Each one
 * pre-configures the composer differently:
 *  - photo    → opens the file picker on mount, no body template
 *  - poll     → pre-fills body with a poll skeleton; user tweaks
 *  - event    → pre-fills with date / location lines
 *  - resource → pre-fills with link + why-it-matters
 *
 * The data model is unchanged — these are plain Posts; the helpers
 * just save the user from typing the scaffolding from scratch.
 */
export type PostAttachKind = 'photo' | 'poll' | 'event' | 'resource';

type Props = {
  mode: 'create' | 'edit';
  channels: PostComposerChannel[];
  initial?: {
    id?: string;
    channelSlug: string;
    title: string;
    body: string;
  };
  requireEditReason?: boolean;
  attachKind?: PostAttachKind;
};

const MAX_BODY = 10_000;

/**
 * Modern post composer.
 *
 * Replaces the flat 1-column form with:
 *   • Channel chip strip — visual selector replacing the bland <select>.
 *   • Toolbar — Bold / Italic / Ordered list / Link / Image. Each button
 *     wraps the selected text or inserts a markdown placeholder. The image
 *     button asks for a URL and inserts `![](url)` so the post body itself
 *     references the image — no server-side change required (the post body
 *     is markdown-rendered downstream by `marked`).
 *   • Live preview pane on the right that shows the rendered post with
 *     images. Toggleable on mobile to keep the form full-width.
 *   • Character counter and tone-of-voice tips.
 *
 * Image upload (multipart) is intentionally NOT implemented — that requires
 * a storage backend. Inserting an image URL is the lightest path that ships
 * the feature today; once a CDN/upload pipeline lands, this same toolbar
 * button can swap to a file input.
 */
// Body / title scaffolding for each helper kind. Plain text — the user
// edits inside the composer like any other post. We don't lock these
// fields; if the user clears the template, we trust them.
const ATTACH_TEMPLATES: Record<
  Exclude<PostAttachKind, 'photo'>,
  { titlePrefix: string; body: string }
> = {
  poll: {
    titlePrefix: '[Sondage] ',
    body:
      'Question :\n\n' +
      'Options :\n' +
      '1. \n' +
      '2. \n' +
      '3. \n\n' +
      'Vote en commentaire avec le numéro de ton choix.',
  },
  event: {
    titlePrefix: '[Événement] ',
    body:
      'Quoi : \n' +
      'Quand : \n' +
      'Où : \n' +
      'Pour qui : \n' +
      "Lien d'inscription : ",
  },
  resource: {
    titlePrefix: '[Ressource] ',
    body:
      'Lien : \n' +
      "Pourquoi c'est utile : \n" +
      'Niveau / public visé : ',
  },
};

const ATTACH_LABELS: Record<PostAttachKind, { title: string; body: string }> = {
  photo: { title: 'Photo', body: 'On ouvre la sélection de fichiers — choisis une à 4 images.' },
  poll: { title: 'Sondage', body: 'Squelette de sondage pré-rempli — adapte la question et les options.' },
  event: { title: 'Événement', body: 'Annonce un événement avec date, lieu et lien d’inscription.' },
  resource: { title: 'Ressource', body: 'Partage un lien utile avec son contexte.' },
};

export default function PostComposer({ mode, channels, initial, requireEditReason, attachKind }: Props) {
  const t = useTranslations('community.post.composer');
  const router = useRouter();

  // For poll/event/resource, seed body+title from the template only
  // when the user opens a fresh composer (no prior content). Editing
  // an existing post never overwrites — we never destroy authored
  // content even if the URL has ?attach=…
  const seededInitial = useMemo(() => {
    if (mode !== 'create' || !attachKind || attachKind === 'photo') return initial;
    const tpl = ATTACH_TEMPLATES[attachKind];
    if (!tpl) return initial;
    return {
      channelSlug: initial?.channelSlug ?? '',
      title: (initial?.title ?? '') || tpl.titlePrefix,
      body: (initial?.body ?? '') || tpl.body,
    };
  }, [mode, attachKind, initial]);

  const [channelSlug, setChannelSlug] = useState(seededInitial?.channelSlug ?? channels[0]?.slug ?? '');
  const [title, setTitle] = useState(seededInitial?.title ?? '');
  const [body, setBody] = useState(seededInitial?.body ?? '');
  const [editReason, setEditReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [previewOpen, setPreviewOpen] = useState(true);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Photo helper: open the native file picker once on mount. Guarded
  // by a ref-flag so a re-render doesn't re-trigger the dialog (which
  // would interrupt the user mid-selection).
  const photoTriggered = useRef(false);
  useEffect(() => {
    if (
      mode === 'create' &&
      attachKind === 'photo' &&
      !photoTriggered.current &&
      fileInputRef.current
    ) {
      photoTriggered.current = true;
      // Defer one frame so the native picker doesn't fire before the
      // page has finished its initial paint (avoids the dialog
      // appearing on a half-rendered background on slower devices).
      const id = requestAnimationFrame(() => {
        fileInputRef.current?.click();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [mode, attachKind]);

  /* ----- Markdown helpers ------------------------------------------------ */

  // Toolbar action dispatcher — same engine that powers the keyboard
  // shortcuts. Centralising in `markdownShortcuts.ts` keeps both surfaces
  // in lockstep (a new action only needs to be added in one place).
  const md = (action: MarkdownAction) =>
    applyMarkdownAction({ action, textarea: textareaRef.current, value: body, setValue: setBody });

  const onImage = () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      setImageError(`Maximum ${MAX_ATTACHMENTS} images par post.`);
      return;
    }
    fileInputRef.current?.click();
  };

  const onFilesChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (e.target) e.target.value = '';
    if (files.length === 0) return;
    setImageError(null);
    setImageBusy(true);
    try {
      const slotsLeft = MAX_ATTACHMENTS - attachments.length;
      const slice = files.slice(0, slotsLeft);
      const dataUrls: string[] = [];
      for (const f of slice) {
        if (!f.type.startsWith('image/')) {
          setImageError("Seuls les fichiers image sont acceptés.");
          continue;
        }
        const url = await compressImage(f, ATTACHMENT_MAX_WIDTH, ATTACHMENT_QUALITY);
        dataUrls.push(url);
      }
      if (dataUrls.length) setAttachments((prev) => [...prev, ...dataUrls]);
      if (files.length > slotsLeft) {
        setImageError(`Seulement ${slotsLeft} image(s) ajoutée(s) — limite ${MAX_ATTACHMENTS}/post.`);
      }
    } catch {
      setImageError("Impossible de lire ce fichier. Essayez un autre format (PNG, JPG).");
    } finally {
      setImageBusy(false);
    }
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const onLink = () => {
    const url = window.prompt('URL du lien (https://…) :', 'https://');
    if (!url) return;
    // Link insertion is the one wrap that doesn't fit the simple
    // pre/post pair (the "after" side carries the URL), so we do it
    // inline rather than baking it into the shared dispatcher.
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = body.slice(start, end) || 'texte du lien';
    const next = body.slice(0, start) + '[' + selected + `](${url})` + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + 1, start + 1 + selected.length);
    });
  };

  // Keyboard interceptor — Ctrl/Cmd+B/I/`, Ctrl/Cmd+Shift+8/7/.
  // Forwarded to MentionAutocomplete via its `onKeyDown` prop. The
  // mention dropdown intercepts arrow keys / Enter / Escape itself
  // and only delegates to us when it's closed, so the two surfaces
  // never fight for the same key.
  const onTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    handleMarkdownKeyDown(e, {
      textarea: textareaRef.current,
      value: body,
      setValue: setBody,
    });
  };

  /* ----- Submit ---------------------------------------------------------- */

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    const trimmedBody = body.trim();
    if (trimmedBody.length === 0) {
      setError('community.errors.invalidInput');
      return;
    }
    if (mode === 'edit' && requireEditReason && editReason.trim().length === 0) {
      setError('community.errors.editReasonRequired');
      return;
    }

    startTransition(async () => {
      try {
        if (mode === 'create') {
          const fn = createPost as unknown as (input: {
            channelSlug: string;
            title?: string;
            body: string;
            status: 'DRAFT' | 'PUBLISHED';
            attachmentUrls?: string[];
          }) => Promise<{ status: 'success' | 'error'; data?: { id?: string }; error?: string }>;
          const res = await fn({
            channelSlug,
            title: title.trim() || undefined,
            body: trimmedBody,
            status: 'PUBLISHED',
            attachmentUrls: attachments.length > 0 ? attachments : undefined,
          });
          if (res.status === 'error') {
            setError(res.error ?? 'community.errors.unauthorized');
            return;
          }
          const newId = res.data?.id;
          if (newId) router.push(`/community/posts/${newId}`);
          else router.push('/community');
        } else {
          if (!initial?.id) {
            setError('community.errors.notFound');
            return;
          }
          const fn = updatePost as unknown as (input: {
            id: string;
            title?: string;
            body?: string;
            editReason?: string;
          }) => Promise<{ status: 'success' | 'error'; error?: string }>;
          const res = await fn({
            id: initial.id,
            title: title.trim() || undefined,
            body: trimmedBody,
            editReason: editReason.trim() || undefined,
          });
          if (res.status === 'error') {
            setError(res.error ?? 'community.errors.unauthorized');
            return;
          }
          router.push(`/community/posts/${initial.id}`);
        }
      } catch {
        setError('community.errors.unauthorized');
      }
    });
  }

  /* ----- Preview rendering ---------------------------------------------- */

  const previewHtml = useMemo(() => renderMarkdownLite(body), [body]);

  const charsLeft = MAX_BODY - body.length;
  const overLimit = charsLeft < 0;
  const activeChannel = channels.find((c) => c.slug === channelSlug);

  /* ----- Render ---------------------------------------------------------- */

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: 'grid',
        gap: 18,
        gridTemplateColumns: previewOpen ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)',
      }}
    >
      <div
        style={{
          background: '#fff',
          border: '1px solid rgba(115,1,255,0.10)',
          borderRadius: 22,
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          boxShadow: '0 14px 38px -22px rgba(36,18,80,0.18)',
        }}
      >
        {/* Authoring-helper banner — visible only when the user
            arrived from a quick-action chip on the home feed. Confirms
            the active mode + explains in one line what was pre-filled. */}
        {mode === 'create' && attachKind && (
          <div
            role="status"
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(115,1,255,0.06)',
              border: '1px solid rgba(115,1,255,0.18)',
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                marginTop: 2,
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#7301FF',
              }}
            />
            <div style={{ minWidth: 0 }}>
              <strong style={{ color: '#1a1f3a' }}>
                Mode {ATTACH_LABELS[attachKind].title}
              </strong>
              <span style={{ color: '#545b7a' }}>
                {' '}
                · {ATTACH_LABELS[attachKind].body}
              </span>
            </div>
          </div>
        )}

        {/* Channel chip strip */}
        {mode === 'create' && (
          <div>
            <Label>{t('channelLabel')}</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {channels.map((c) => {
                const active = c.slug === channelSlug;
                return (
                  <button
                    type="button"
                    key={c.slug}
                    onClick={() => setChannelSlug(c.slug)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: 700,
                      border: active ? '1px solid #7301FF' : '1px solid rgba(115,1,255,0.15)',
                      background: active ? 'linear-gradient(135deg, #7301FF, #A34BF5)' : '#fff',
                      color: active ? '#fff' : '#1a1f3a',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span aria-hidden>{c.emoji ?? '#'}</span>
                    {c.name}
                  </button>
                );
              })}
            </div>
            <Help>{t('channelHelp')}</Help>
          </div>
        )}

        {/* Title */}
        <div>
          <Label>{t('titleLabel')}</Label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('titlePlaceholder')}
            maxLength={140}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid rgba(115,1,255,0.20)',
              background: '#fff',
              fontSize: 17,
              fontWeight: 600,
              color: '#1a1f3a',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Toolbar */}
        <div>
          <Label>{t('bodyLabel')}</Label>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              padding: 8,
              borderRadius: '14px 14px 0 0',
              border: '1px solid rgba(115,1,255,0.20)',
              borderBottom: 'none',
              background: 'rgba(115,1,255,0.04)',
              alignItems: 'center',
            }}
          >
            <ToolbarButton title="Gras (Ctrl+B)" onClick={() => md('bold')}>
              <strong>B</strong>
            </ToolbarButton>
            <ToolbarButton title="Italique (Ctrl+I)" onClick={() => md('italic')}>
              <em>I</em>
            </ToolbarButton>
            <ToolbarButton title="Titre" onClick={() => md('heading')}>
              H
            </ToolbarButton>
            <ToolbarButton title="Liste (Ctrl+Shift+8)" onClick={() => md('list')}>
              ☰
            </ToolbarButton>
            <ToolbarButton title="Citation (Ctrl+Shift+.)" onClick={() => md('quote')}>
              “
            </ToolbarButton>
            <ToolbarButton title="Code (Ctrl+`)" onClick={() => md('code')}>
              {'<>'}
            </ToolbarButton>
            <Separator />
            <ToolbarButton title="Lien" onClick={onLink}>
              ↗
            </ToolbarButton>
            <ToolbarButton
              title="Téléverser une image depuis votre appareil"
              onClick={onImage}
              highlight
            >
              {imageBusy ? '⏳ …' : '🖼 Image'}
            </ToolbarButton>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              onChange={onFilesChosen}
              style={{ display: 'none' }}
            />
            <div style={{ flex: 1 }} />
            {/* Aperçu — bouton toggle bien visible (gradient violet quand actif). */}
            <button
              type="button"
              onClick={() => setPreviewOpen((v) => !v)}
              title={previewOpen ? 'Masquer la prévisualisation' : 'Afficher la prévisualisation'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 32,
                padding: '0 14px',
                borderRadius: 8,
                border: previewOpen ? '1px solid #7301FF' : '1px solid rgba(115,1,255,0.30)',
                background: previewOpen
                  ? 'linear-gradient(135deg, #7301FF, #A34BF5)'
                  : 'rgba(115,1,255,0.08)',
                color: previewOpen ? '#fff' : '#7301FF',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: previewOpen ? '0 4px 12px -4px rgba(115,1,255,0.45)' : 'none',
              }}
            >
              <span aria-hidden>{previewOpen ? '◉' : '◎'}</span>
              {previewOpen ? 'Aperçu actif' : 'Aperçu'}
            </button>
          </div>
          {/* Mention autocomplete wrapper — opens a floating list of
              matching @handles when the user types `@xxx`, arrow-keys
              and Enter to pick. The wrapper is just a forwarded
              <textarea> so all the existing styling, ref usage and
              toolbar interactions still work. */}
          <MentionAutocomplete
            ref={textareaRef}
            value={body}
            onChange={setBody}
            onKeyDown={onTextareaKeyDown}
            placeholder={t('bodyPlaceholder')}
            rows={12}
            required
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: '0 0 14px 14px',
              border: '1px solid rgba(115,1,255,0.20)',
              background: '#fff',
              color: '#1a1f3a',
              fontSize: 15,
              lineHeight: 1.6,
              resize: 'vertical',
              fontFamily: 'inherit',
              minHeight: 240,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#8b91ad' }}>
              {t('bodyHelp')} · {t('mentionsHelp')} · {t('hashtagsHelp')}
            </span>
            <span style={{ fontSize: 11, color: overLimit ? '#d94e92' : '#8b91ad', fontWeight: overLimit ? 700 : 500 }}>
              {body.length} / {MAX_BODY}
            </span>
          </div>

          {/* Image attachments — thumbnails + remove buttons. */}
          {attachments.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fill, minmax(140px, 1fr))`,
                gap: 10,
                marginTop: 12,
              }}
            >
              {attachments.map((url, i) => (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    aspectRatio: '4/3',
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: '1px solid rgba(115,1,255,0.20)',
                    background: `#fff url("${url}") center/cover no-repeat`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    aria-label="Retirer cette image"
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      border: 'none',
                      background: 'rgba(15,18,40,0.78)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 14,
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {imageError && (
            <div
              role="alert"
              style={{
                marginTop: 10,
                padding: '8px 12px',
                borderRadius: 10,
                background: 'rgba(244,111,177,0.10)',
                border: '1px solid rgba(244,111,177,0.30)',
                color: '#a8235e',
                fontSize: 12,
              }}
            >
              {imageError}
            </div>
          )}
        </div>

        {mode === 'edit' && (
          <div>
            <Label>{t('editReasonLabel')}</Label>
            <input
              type="text"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder={t('editReasonPlaceholder')}
              maxLength={200}
              required={requireEditReason}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 12,
                border: '1px solid rgba(115,1,255,0.20)',
                background: '#fff',
                color: '#1a1f3a',
                fontSize: 14,
                fontFamily: 'inherit',
              }}
            />
            {requireEditReason && <Help>{t('editWindowExpiredHint')}</Help>}
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(244,111,177,0.10)',
              border: '1px solid rgba(244,111,177,0.30)',
              color: '#a8235e',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#8b91ad', marginRight: 'auto' }}>
            Publication dans{' '}
            <strong style={{ color: '#7301FF' }}>
              {activeChannel?.emoji ? `${activeChannel.emoji} ` : '#'}
              {activeChannel?.name ?? '?'}
            </strong>
          </span>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={pending}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: '1px solid rgba(115,1,255,0.20)',
              background: 'transparent',
              color: '#7301FF',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={pending || body.trim().length === 0 || overLimit}
            style={{
              padding: '10px 22px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              opacity: pending || body.trim().length === 0 || overLimit ? 0.5 : 1,
              boxShadow: '0 8px 22px -10px rgba(115,1,255,0.55)',
            }}
          >
            {pending ? '…' : mode === 'edit' ? t('successUpdated') : t('publish')}
          </button>
        </div>
      </div>

      {previewOpen && (
        <div
          style={{
            background: '#fff',
            border: '1px solid rgba(115,1,255,0.10)',
            borderRadius: 22,
            padding: 22,
            position: 'sticky',
            top: 80,
            alignSelf: 'flex-start',
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: '#7301FF', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
            Aperçu
          </div>
          {title && (
            <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 700, color: '#1a1f3a', lineHeight: 1.2 }}>
              {title}
            </h2>
          )}
          <div
            className="dz-post-preview"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: previewHtml || '<p style="color:#8b91ad">Tape quelque chose pour voir l’aperçu…</p>' }}
            style={{ fontSize: 15, lineHeight: 1.65, color: '#1a1f3a' }}
          />
          {attachments.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: attachments.length > 1 ? '1fr 1fr' : '1fr',
                gap: 8,
                marginTop: 14,
              }}
            >
              {attachments.map((url, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={i}
                  src={url}
                  alt=""
                  style={{
                    width: '100%',
                    borderRadius: 12,
                    border: '1px solid rgba(115,1,255,0.10)',
                    display: 'block',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </form>
  );
}

/* ----- Sub-components ---------------------------------------------------- */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1f3a', marginBottom: 8 }}>
      {children}
    </div>
  );
}
function Help({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, color: '#8b91ad', marginTop: 6 }}>{children}</div>
  );
}
function Separator() {
  return (
    <div
      aria-hidden
      style={{ width: 1, height: 22, background: 'rgba(115,1,255,0.18)', margin: '0 4px' }}
    />
  );
}
function ToolbarButton({
  children,
  title,
  onClick,
  highlight,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 32,
        padding: '0 10px',
        borderRadius: 8,
        border: highlight ? '1px solid rgba(115,1,255,0.35)' : '1px solid transparent',
        background: highlight ? 'rgba(115,1,255,0.10)' : 'transparent',
        color: highlight ? '#7301FF' : '#545b7a',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

/* ----- Tiny markdown renderer for the preview --------------------------- */
/* Only handles a useful subset (bold, italic, headings, lists, code, link,
   image). Avoids pulling in a full markdown library client-side. The real
   post page renders via `marked` + DOMPurify on the server. */
function renderMarkdownLite(src: string): string {
  if (!src.trim()) return '';
  let s = escapeHtml(src);

  s = s.replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g,
    '<img src="$2" alt="$1" style="max-width:100%;border-radius:12px;margin:8px 0;" />');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener" style="color:#7301FF;text-decoration:underline;">$1</a>');
  s = s.replace(/`([^`\n]+)`/g,
    '<code style="background:rgba(115,1,255,0.08);padding:1px 6px;border-radius:5px;font-family:SF Mono,monospace;font-size:0.92em;">$1</code>');
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  s = s.replace(/^## (.+)$/gm, '<h3 style="font-size:18px;font-weight:700;margin:14px 0 6px">$1</h3>');
  s = s.replace(/^> (.+)$/gm,
    '<blockquote style="border-left:3px solid #7301FF;padding-left:12px;color:#545b7a;font-style:italic;margin:8px 0;">$1</blockquote>');
  s = s.replace(/^(?:- |\* )(.+)$/gm, '<li>$1</li>');
  s = s.replace(/(?:<li>.*?<\/li>\n?)+/g, (m) => `<ul style="padding-left:20px;margin:8px 0;">${m}</ul>`);

  // Mentions and hashtags — match the regexes used by the server-side
  // sanitizer (see src/lib/community/sanitizer.ts) so the preview shows
  // exactly how the post will render once published. Negative
  // lookbehind keeps `email@example.com` and `#xyz` inside identifiers
  // out of the picture.
  s = s.replace(
    /(^|[^a-zA-Z0-9_])@([a-z0-9_]{3,30})(?![a-z0-9_])/gi,
    '$1<a href="/community/members/$2" style="color:#7301FF;font-weight:600;text-decoration:none;">@$2</a>',
  );
  s = s.replace(
    /(^|[^a-zA-Z0-9_])#([a-z0-9_]{1,32})/gi,
    (_, lead, tag) => `${lead}<a href="/community/tag/${tag.toLowerCase()}" style="background:rgba(115,1,255,0.10);color:#7301FF;padding:1px 8px;border-radius:999px;font-size:0.85em;font-weight:600;text-decoration:none;">#${tag}</a>`,
  );

  s = s
    .split(/\n{2,}/)
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (/^<(h\d|ul|blockquote|img|pre)/.test(trimmed)) return trimmed;
      return `<p style="margin:0 0 10px">${trimmed.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');
  return s;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Read an image File and return a JPEG data URL whose width is at most
 * `maxWidth`. Aspect ratio preserved. Used by the post composer to embed
 * uploaded images directly without an external storage backend.
 */
function compressImage(file: File, maxWidth: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image load'));
      img.onload = () => {
        try {
          const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
          const w = Math.round(img.width * ratio);
          const h = Math.round(img.height * ratio);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('no canvas context'));
            return;
          }
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (e) {
          reject(e);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

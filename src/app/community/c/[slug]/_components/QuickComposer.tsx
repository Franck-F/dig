'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { createPost } from '@/lib/actions/community/posts';

const MAX = 4;

type Props = {
  channelSlug: string;
  channelName: string;
};

/**
 * Quick chat-style composer for a channel.
 *
 * Sticky at the bottom of the channel page when the viewer can write.
 * Single textarea + send button + image picker. Submits via the same
 * `createPost` server action used by the full editor — but with no title,
 * just body and attachments. Auto-grows the textarea up to a few lines.
 *
 * Image upload: same compress-on-canvas pipeline as the full PostComposer
 * — files are turned into JPEG data URLs (≤720px, q=0.78) and submitted in
 * `attachmentUrls`. Keep the experience consistent with the full editor.
 */
export default function QuickComposer({ channelSlug, channelName }: Props) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [imgBusy, setImgBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSubmit = body.trim().length > 0 && !pending;

  const onPickImage = () => {
    if (attachments.length >= MAX) {
      setError(`Max ${MAX} images.`);
      return;
    }
    fileRef.current?.click();
  };

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (e.target) e.target.value = '';
    if (files.length === 0) return;
    setError(null);
    setImgBusy(true);
    try {
      const slots = MAX - attachments.length;
      const slice = files.slice(0, slots);
      const urls: string[] = [];
      for (const f of slice) {
        if (!f.type.startsWith('image/')) continue;
        urls.push(await compressImage(f, 720, 0.78));
      }
      if (urls.length) setAttachments((a) => [...a, ...urls]);
    } catch {
      setError("Impossible de lire ce fichier.");
    } finally {
      setImgBusy(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const fn = createPost as unknown as (input: {
        channelSlug: string;
        body: string;
        status: 'PUBLISHED';
        attachmentUrls?: string[];
      }) => Promise<{ status: 'success' | 'error'; error?: string }>;
      const res = await fn({
        channelSlug,
        body: body.trim(),
        status: 'PUBLISHED',
        attachmentUrls: attachments.length > 0 ? attachments : undefined,
      });
      if (res.status === 'error') {
        setError(res.error ?? 'Envoi impossible.');
        return;
      }
      setBody('');
      setAttachments([]);
      router.refresh();
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter inserts a newline (Discord/Slack convention).
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) onSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{
        background: '#fff',
        border: '1px solid rgba(115,1,255,0.20)',
        borderRadius: 18,
        padding: 12,
        boxShadow: '0 14px 36px -22px rgba(36,18,80,0.20)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {attachments.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {attachments.map((url, i) => (
            <div
              key={i}
              style={{
                position: 'relative',
                width: 96,
                height: 72,
                borderRadius: 10,
                background: `#fff url("${url}") center/cover no-repeat`,
                border: '1px solid rgba(115,1,255,0.20)',
              }}
            >
              <button
                type="button"
                onClick={() => setAttachments((a) => a.filter((_, j) => j !== i))}
                aria-label="Retirer"
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'rgba(15,18,40,0.80)',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 12,
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

      {error && (
        <div
          role="alert"
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            background: 'rgba(244,111,177,0.10)',
            border: '1px solid rgba(244,111,177,0.30)',
            color: '#a8235e',
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          onChange={onFiles}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          onClick={onPickImage}
          disabled={imgBusy || pending}
          aria-label="Joindre une image"
          title="Joindre une image"
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: '1px solid rgba(115,1,255,0.20)',
            background: '#fff',
            color: '#7301FF',
            cursor: imgBusy ? 'wait' : 'pointer',
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {imgBusy ? '⏳' : '📎'}
        </button>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Écris dans #${channelName}…  (Entrée pour envoyer, Maj+Entrée pour une nouvelle ligne)`}
          maxLength={10_000}
          rows={1}
          style={{
            flex: 1,
            minHeight: 38,
            maxHeight: 200,
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid rgba(115,1,255,0.20)',
            background: '#fff',
            color: '#1a1f3a',
            fontSize: 14,
            fontFamily: 'inherit',
            resize: 'none',
            lineHeight: 1.45,
          }}
        />
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            padding: '0 18px',
            height: 38,
            borderRadius: 10,
            border: 'none',
            background: canSubmit
              ? 'linear-gradient(135deg, #7301FF, #A34BF5)'
              : 'rgba(115,1,255,0.30)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            boxShadow: canSubmit ? '0 6px 18px -8px rgba(115,1,255,0.55)' : 'none',
            flexShrink: 0,
          }}
        >
          {pending ? '…' : 'Envoyer'}
        </button>
      </div>
    </form>
  );
}

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

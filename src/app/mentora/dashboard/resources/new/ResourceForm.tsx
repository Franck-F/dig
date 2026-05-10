'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { createResource } from '@/lib/actions/resources';

const KINDS: Array<{ value: 'PDF' | 'REPLAY' | 'TEMPLATE' | 'ARTICLE' | 'TOOL' | 'NOTION'; label: string; hint: string }> = [
  { value: 'PDF', label: 'PDF', hint: 'Document à télécharger' },
  { value: 'REPLAY', label: 'Replay vidéo', hint: 'Live ou atelier' },
  { value: 'TEMPLATE', label: 'Template', hint: 'Figma, Notion…' },
  { value: 'ARTICLE', label: 'Article', hint: 'Lien vers un article' },
  { value: 'TOOL', label: 'Outil', hint: 'App ou service' },
  { value: 'NOTION', label: 'Notion', hint: 'Page Notion partagée' },
];

const CATEGORIES: Array<{ value: 'UX_UI' | 'CAREER' | 'CAREER_CHANGE' | 'TECH' | 'SOFT_SKILLS' | 'OTHER'; label: string }> = [
  { value: 'UX_UI', label: 'UX / UI' },
  { value: 'CAREER', label: 'Carrière' },
  { value: 'CAREER_CHANGE', label: 'Reconversion' },
  { value: 'TECH', label: 'Tech' },
  { value: 'SOFT_SKILLS', label: 'Soft skills' },
  { value: 'OTHER', label: 'Autre' },
];

const AUDIENCES: Array<{ value: 'MENTORA' | 'COMMUNITY' | 'BOTH'; label: string; hint: string }> = [
  { value: 'MENTORA', label: 'Mentora', hint: 'Visible des mentorées et mentors' },
  { value: 'COMMUNITY', label: 'Communauté', hint: 'Visible de l’espace communauté' },
  { value: 'BOTH', label: 'Les deux', hint: 'Réservé à l’admin' },
];

type FieldErrors = Partial<Record<'title' | 'url' | 'description' | 'coverImageUrl' | 'pillLabel', string>>;

/**
 * Resource creation form — backs `/mentora/dashboard/resources/new`.
 *
 * Live validation locally (URL format, max-length counters), final
 * validation in the server action via Zod. Admin-only fields
 * (`isFeatured`, `isPinned`) appear behind the `isAdmin` flag from
 * the parent. Submit redirects to the resources list with a `?created=`
 * flag the parent page can show as a toast (kept simple here — no
 * extra UI plumbing required, the success message is shown inline).
 */
export default function ResourceForm({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [kind, setKind] = useState<typeof KINDS[number]['value']>('ARTICLE');
  const [category, setCategory] = useState<typeof CATEGORIES[number]['value']>('CAREER');
  const [audience, setAudience] = useState<typeof AUDIENCES[number]['value']>('MENTORA');
  const [pillLabel, setPillLabel] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (title.trim().length < 2) e.title = 'Titre trop court (min 2 caractères).';
    if (title.length > 200) e.title = 'Titre trop long (max 200).';
    if (!url.trim()) {
      e.url = 'URL requise.';
    } else {
      try {
        const u = new URL(url);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          e.url = 'URL doit commencer par http:// ou https://';
        }
      } catch {
        e.url = 'URL invalide.';
      }
    }
    if (description.length > 2000) e.description = 'Description trop longue (max 2 000).';
    if (coverImageUrl && coverImageUrl.length > 0) {
      try {
        new URL(coverImageUrl);
      } catch {
        e.coverImageUrl = 'URL d’image invalide.';
      }
    }
    if (pillLabel.length > 40) e.pillLabel = 'Étiquette trop longue (max 40).';
    return e;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setGlobalError(null);
    setSuccess(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    startTransition(async () => {
      const res = await createResource({
        title: title.trim(),
        description: description.trim() || null,
        url: url.trim(),
        coverImageUrl: coverImageUrl.trim() || null,
        kind,
        category,
        audience,
        pillLabel: pillLabel.trim() || null,
        isFeatured: isAdmin ? isFeatured : false,
        isPinned: isAdmin ? isPinned : false,
      });
      if (res.status === 'success') {
        setSuccess('Ressource publiée. Redirection…');
        setTimeout(() => router.push('/mentora/dashboard/resources'), 700);
      } else {
        setGlobalError(humanError(res.error));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Title */}
      <Field label="Titre" hint={`${title.length} / 200`} error={errors.title}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Ex : « Replay live UX par Karim »"
          style={inputStyle}
          required
        />
      </Field>

      {/* URL */}
      <Field label="URL" hint="Lien externe vers la ressource" error={errors.url}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          style={inputStyle}
          required
        />
      </Field>

      {/* Kind + Category */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <Field label="Type" hint="Comment la ressource s’ouvrira">
          <div style={chipRowStyle}>
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                style={chipStyle(kind === k.value)}
                title={k.hint}
              >
                {k.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Catégorie" hint="Pour la recherche & le filtrage">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            style={inputStyle}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Audience */}
      <Field label="Audience" hint="Où la ressource sera visible">
        <div style={chipRowStyle}>
          {AUDIENCES.filter((a) => a.value !== 'BOTH' || isAdmin).map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => setAudience(a.value)}
              style={chipStyle(audience === a.value)}
              title={a.hint}
            >
              {a.label}
            </button>
          ))}
        </div>
      </Field>

      {/* Description */}
      <Field
        label="Description"
        hint={`${description.length} / 2 000 — optionnelle`}
        error={errors.description}
      >
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Décris brièvement la ressource (1-3 phrases)."
          style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
        />
      </Field>

      {/* Cover image + pill */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <Field label="Image de couverture" hint="URL d’image (optionnel)" error={errors.coverImageUrl}>
          <input
            type="url"
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="https://…/cover.jpg"
            style={inputStyle}
          />
        </Field>

        <Field label="Étiquette" hint="Ex : « Nouveau », « Lecture rapide »" error={errors.pillLabel}>
          <input
            type="text"
            value={pillLabel}
            onChange={(e) => setPillLabel(e.target.value)}
            maxLength={40}
            style={inputStyle}
          />
        </Field>
      </div>

      {/* Admin-only flags */}
      {isAdmin && (
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: 'rgba(115,1,255,0.04)',
            border: '1px solid rgba(115,1,255,0.10)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#7301FF', marginBottom: 8 }}>
            Options administrateur
          </div>
          <label style={checkboxLabel}>
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
            />
            <span>
              <strong>Mettre à la une</strong>
              <span className="dz-small" style={{ display: 'block', fontSize: 11 }}>
                Apparaît dans le bandeau « À LA UNE » de la bibliothèque.
              </span>
            </span>
          </label>
          <label style={{ ...checkboxLabel, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
            />
            <span>
              <strong>Épingler en tête de liste</strong>
              <span className="dz-small" style={{ display: 'block', fontSize: 11 }}>
                Reste en haut du tri chronologique.
              </span>
            </span>
          </label>
        </div>
      )}

      {/* Feedback */}
      {globalError && (
        <div role="alert" style={errorBoxStyle}>
          {globalError}
        </div>
      )}
      {success && (
        <div role="status" style={successBoxStyle}>
          {success}
        </div>
      )}

      {/* Submit */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => router.push('/mentora/dashboard/resources')}
          style={ghostBtn}
        >
          Annuler
        </button>
        <button type="submit" disabled={pending} style={primaryBtn(pending)}>
          {pending ? 'Publication…' : 'Publier la ressource'}
        </button>
      </div>
    </form>
  );
}

// ── UI primitives ─────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
        }}
      >
        <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1f3a' }}>{label}</label>
        {hint && (
          <span className="dz-small" style={{ fontSize: 10 }}>
            {hint}
          </span>
        )}
      </div>
      {children}
      {error && (
        <span role="alert" style={{ fontSize: 11, color: '#991b1b', fontWeight: 600 }}>
          {error}
        </span>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 9,
  border: '1px solid rgba(115,1,255,0.15)',
  background: 'white',
  fontSize: 13,
  color: '#1a1f3a',
  outline: 'none',
};

const chipRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
};

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    borderRadius: 999,
    border: active ? '1px solid #7301FF' : '1px solid rgba(115,1,255,0.15)',
    background: active ? 'rgba(115,1,255,0.10)' : 'white',
    color: active ? '#7301FF' : '#545b7a',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  };
}

const checkboxLabel: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  fontSize: 13,
  color: '#1a1f3a',
  cursor: 'pointer',
};

const errorBoxStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 9,
  background: 'rgba(239,68,68,0.08)',
  color: '#991b1b',
  fontSize: 12,
  fontWeight: 600,
};

const successBoxStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 9,
  background: 'rgba(35,197,94,0.10)',
  color: '#0e7c3a',
  fontSize: 12,
  fontWeight: 600,
};

const ghostBtn: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 10,
  border: '1px solid rgba(115,1,255,0.15)',
  background: 'transparent',
  color: '#545b7a',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

function primaryBtn(pending: boolean): React.CSSProperties {
  return {
    padding: '10px 22px',
    borderRadius: 10,
    border: 'none',
    background: pending ? 'rgba(115,1,255,0.45)' : 'linear-gradient(135deg, #7301FF, #A34BF5)',
    color: 'white',
    fontSize: 13,
    fontWeight: 700,
    cursor: pending ? 'wait' : 'pointer',
  };
}

function humanError(code: string): string {
  switch (code) {
    case 'unauthorized':
      return 'Connecte-toi pour publier une ressource.';
    case 'forbidden':
      return 'Réservé aux mentors et administrateurs.';
    case 'create_failed':
      return 'La publication a échoué. Réessaie dans un instant.';
    default:
      return code;
  }
}

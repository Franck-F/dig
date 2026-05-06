'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

import { createChallenge } from '@/lib/actions/community/admin/challenges';

/**
 * Opens a 4-step composer (slug + dates + content + cover) and calls the
 * existing `createChallenge` server action. The action already does all the
 * validation we care about (slug shape, date ordering, slug unicity); this
 * UI mirrors those checks client-side so the user gets instant feedback.
 *
 * On success the modal closes and `router.refresh()` re-runs the parent's
 * server query so the new DRAFT appears in the list.
 */
export default function ChallengeCreatorModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [prize, setPrize] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverUploading, setCoverUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [submissionOpensAt, setSubmissionOpensAt] = useState(defaultDate(0));
  const [submissionClosesAt, setSubmissionClosesAt] = useState(defaultDate(14));
  const [votingClosesAt, setVotingClosesAt] = useState(defaultDate(21));

  // Auto-slugify until the user manually edits the slug field.
  const autoSlug = useMemo(() => slugify(title), [title]);
  const effectiveSlug = slugTouched ? slug : autoSlug;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const closeModal = () => {
    setOpen(false);
    setTimeout(() => {
      setDone(false);
      setError(null);
    }, 100);
  };

  const reset = () => {
    setTitle('');
    setSlug('');
    setSlugTouched(false);
    setDescription('');
    setPrize('');
    setCoverImageUrl('');
    setSubmissionOpensAt(defaultDate(0));
    setSubmissionClosesAt(defaultDate(14));
    setVotingClosesAt(defaultDate(21));
  };

  const validate = (): string | null => {
    if (title.trim().length < 5) return 'Le titre doit faire au moins 5 caractères.';
    if (title.trim().length > 120) return 'Le titre est trop long (max 120).';
    if (!/^[a-z0-9-]{4,60}$/.test(effectiveSlug)) {
      return 'Le slug doit contenir 4 à 60 caractères : lettres minuscules, chiffres ou tirets.';
    }
    if (description.trim().length < 20) return 'La description doit faire au moins 20 caractères.';
    if (description.trim().length > 4000) return 'La description est trop longue (max 4 000).';
    if (prize.trim().length > 200) return 'Le prix est trop long (max 200).';
    if (coverImageUrl && !isValidCover(coverImageUrl)) {
      return "L'image de couverture est invalide.";
    }
    const o = new Date(submissionOpensAt);
    const c = new Date(submissionClosesAt);
    const v = new Date(votingClosesAt);
    if (Number.isNaN(o.getTime()) || Number.isNaN(c.getTime()) || Number.isNaN(v.getTime())) {
      return 'Les dates sont invalides.';
    }
    if (!(o < c && c < v)) {
      return 'Les dates doivent respecter l\'ordre : ouverture < clôture des soumissions < clôture du vote.';
    }
    return null;
  };

  const onPickCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      setError('Format non supporté. PNG, JPEG ou WebP uniquement.');
      e.target.value = '';
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Image trop lourde (max 8 Mo avant compression).');
      e.target.value = '';
      return;
    }
    setError(null);
    setCoverUploading(true);
    try {
      const dataUrl = await resizeCoverToDataUrl(file, 1280, 720);
      setCoverImageUrl(dataUrl);
    } catch {
      setError("Impossible de lire l'image.");
    } finally {
      setCoverUploading(false);
      e.target.value = '';
    }
  };

  const submit = () => {
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createChallenge({
        slug: effectiveSlug,
        title: title.trim(),
        description: description.trim(),
        prize: prize.trim() || undefined,
        coverImageUrl: coverImageUrl.trim() || undefined,
        submissionOpensAt: new Date(submissionOpensAt).toISOString(),
        submissionClosesAt: new Date(submissionClosesAt).toISOString(),
        votingClosesAt: new Date(votingClosesAt).toISOString(),
      });
      if (res.status === 'success') {
        setDone(true);
        reset();
        router.refresh();
      } else {
        setError(humanizeError(res.error));
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: '10px 18px',
          borderRadius: 10,
          border: 'none',
          background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
          color: 'white',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 8px 18px rgba(115,1,255,0.30)',
        }}
      >
        + Nouveau défi
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="challenge-creator-title"
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
              style={{
                background: '#ffffff',
                color: '#1a1f3a',
                width: '100%',
                maxWidth: 720,
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
                  padding: '22px 28px',
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
                  Communauté · Défis
                </div>
                <h2
                  id="challenge-creator-title"
                  style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 800 }}
                >
                  {done ? 'Défi créé' : 'Nouveau défi'}
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
                {done ? (
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: 36, color: '#23c55e', marginBottom: 12 }}>
                      ✓
                    </div>
                    <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>
                      Le défi est en brouillon.
                    </p>
                    <p
                      style={{ margin: 0, fontSize: 13, color: '#7a6a9a' }}
                    >
                      Publiez-le depuis la liste pour notifier la communauté et
                      ouvrir les soumissions.
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        gap: 10,
                        marginTop: 22,
                        justifyContent: 'center',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setDone(false);
                        }}
                        className="dz-btn dz-btn-ghost"
                      >
                        Créer un autre
                      </button>
                      <button
                        type="button"
                        onClick={closeModal}
                        className="dz-btn dz-btn-primary"
                      >
                        Voir la liste
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Section title="Identité">
                      <Field label="Titre" hint={`${title.trim().length} / 120`}>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Ex. Défi printemps : ton portfolio en 30 jours"
                          maxLength={120}
                          style={inputStyle}
                        />
                      </Field>
                      <Field
                        label="Slug (URL)"
                        hint="Lettres minuscules, chiffres et tirets uniquement (4-60 caractères)."
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            border: '1px solid rgba(115,1,255,0.20)',
                            borderRadius: 10,
                            background: '#ffffff',
                            paddingLeft: 12,
                            color: '#7a6a9a',
                            fontSize: 13,
                          }}
                        >
                          <span>/community/challenges/</span>
                          <input
                            type="text"
                            value={effectiveSlug}
                            onChange={(e) => {
                              setSlugTouched(true);
                              setSlug(slugify(e.target.value));
                            }}
                            placeholder="defi-portfolio-30j"
                            maxLength={60}
                            style={{
                              ...inputStyle,
                              border: 'none',
                              padding: '10px 12px 10px 0',
                              flex: 1,
                              background: 'transparent',
                              color: '#1a1f3a',
                            }}
                          />
                        </div>
                      </Field>
                    </Section>

                    <Section title="Contenu">
                      <Field
                        label="Description (markdown supporté)"
                        hint={`${description.trim().length} / 4000`}
                      >
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder={
                            'Présente le défi en quelques paragraphes : objectif, format des soumissions, critères de jugement, ressources utiles…'
                          }
                          rows={6}
                          maxLength={4000}
                          style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6 }}
                        />
                      </Field>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Field label="Prix (optionnel)" hint="Ex. 200€ Amazon · Visite Microsoft.">
                          <input
                            type="text"
                            value={prize}
                            onChange={(e) => setPrize(e.target.value)}
                            placeholder="3 prix à la clé…"
                            maxLength={200}
                            style={inputStyle}
                          />
                        </Field>
                        <Field label="Image de couverture (optionnel)">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={onPickCover}
                            style={{ display: 'none' }}
                          />
                          {coverImageUrl ? (
                            <div
                              style={{
                                position: 'relative',
                                borderRadius: 10,
                                overflow: 'hidden',
                                border: '1px solid rgba(115,1,255,0.20)',
                                background: '#f7f4ff',
                                aspectRatio: '16 / 9',
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={coverImageUrl}
                                alt="Aperçu"
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  display: 'block',
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => setCoverImageUrl('')}
                                aria-label="Retirer l'image"
                                style={{
                                  position: 'absolute',
                                  top: 6,
                                  right: 6,
                                  width: 26,
                                  height: 26,
                                  borderRadius: '50%',
                                  background: 'rgba(15,18,40,0.78)',
                                  color: 'white',
                                  border: 'none',
                                  fontSize: 14,
                                  lineHeight: 1,
                                  cursor: 'pointer',
                                }}
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={coverUploading}
                              style={{
                                ...inputStyle,
                                cursor: coverUploading ? 'wait' : 'pointer',
                                textAlign: 'left',
                                color: '#7301FF',
                                fontWeight: 700,
                                background:
                                  'repeating-linear-gradient(135deg, rgba(115,1,255,0.04) 0 8px, transparent 8px 16px)',
                                border: '1px dashed rgba(115,1,255,0.30)',
                              }}
                            >
                              {coverUploading
                                ? 'Compression…'
                                : '↑ Choisir une image (1280×720 max)'}
                            </button>
                          )}
                        </Field>
                      </div>
                    </Section>

                    <Section title="Calendrier">
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: 12,
                        }}
                      >
                        <Field label="Ouverture des soumissions">
                          <input
                            type="datetime-local"
                            value={submissionOpensAt}
                            onChange={(e) => setSubmissionOpensAt(e.target.value)}
                            style={inputStyle}
                          />
                        </Field>
                        <Field label="Clôture des soumissions">
                          <input
                            type="datetime-local"
                            value={submissionClosesAt}
                            onChange={(e) => setSubmissionClosesAt(e.target.value)}
                            style={inputStyle}
                          />
                        </Field>
                        <Field label="Clôture du vote">
                          <input
                            type="datetime-local"
                            value={votingClosesAt}
                            onChange={(e) => setVotingClosesAt(e.target.value)}
                            style={inputStyle}
                          />
                        </Field>
                      </div>
                      <p style={{ marginTop: 8, fontSize: 12, color: '#7a6a9a' }}>
                        Phases : Soumission → Vote → Résultats. La clôture du
                        vote déclenche le calcul automatique du podium.
                      </p>
                    </Section>

                    {error && (
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
                        marginTop: 22,
                        justifyContent: 'flex-end',
                      }}
                    >
                      <button
                        type="button"
                        onClick={closeModal}
                        className="dz-btn dz-btn-ghost"
                        disabled={pending}
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={submit}
                        disabled={pending}
                        className="dz-btn dz-btn-primary"
                        style={{ opacity: pending ? 0.7 : 1 }}
                      >
                        {pending ? 'Création…' : 'Créer le brouillon'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h3
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: '#7301FF',
          margin: '0 0 12px',
        }}
      >
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 700,
          color: '#3a2960',
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <div style={{ marginTop: 4, fontSize: 11, color: '#7a6a9a' }}>{hint}</div>
      )}
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

/**
 * Banner-aspect resize: cover-fits the source into `targetW × targetH`,
 * outputs a JPEG data URL at quality 0.82. Same pattern as the avatar
 * resizer in SettingsForm but with a 16:9 canvas.
 */
function resizeCoverToDataUrl(
  file: File,
  targetW: number,
  targetH: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image load'));
      img.onload = () => {
        try {
          // Don't upscale — bigger source images get downscaled to the
          // target box, smaller ones keep their native size centred on
          // a black canvas (avoids upscaling blur).
          const scale = Math.min(
            1,
            Math.max(targetW / img.width, targetH / img.height),
          );
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = Math.min(targetW, w);
          canvas.height = Math.min(targetH, h);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('no canvas context'));
            return;
          }
          // Cover fit (centred crop) when the source is larger than the
          // target box on both axes; letterbox otherwise.
          const scaleCover = Math.max(canvas.width / img.width, canvas.height / img.height);
          const cw = img.width * scaleCover;
          const ch = img.height * scaleCover;
          const dx = (canvas.width - cw) / 2;
          const dy = (canvas.height - ch) / 2;
          ctx.fillStyle = '#0f0820';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, dx, dy, cw, ch);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } catch (e) {
          reject(e);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function isValidCover(s: string): boolean {
  return (
    s.startsWith('https://') ||
    s.startsWith('http://') ||
    /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(s)
  );
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9-\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

/** Returns a YYYY-MM-DDTHH:mm string usable in <input type="datetime-local">. */
function defaultDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(18, 0, 0, 0);
  // strip timezone — the input expects local time without offset
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function humanizeError(code: string): string {
  switch (code) {
    case 'community.errors.invalidInput':
    case 'invalidInput':
      return 'Les données saisies sont invalides ou le slug est déjà pris.';
    case 'community.errors.unauthorized':
    case 'unauthorized':
    case 'community.errors.forbidden':
    case 'forbidden':
      return 'Vous n\'avez pas les droits pour créer un défi.';
    default:
      return code || 'Erreur inconnue.';
  }
}

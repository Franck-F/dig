'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { changeHandle, updateMemberProfile } from '@/lib/actions/community/member';

const PALETTE = ['#7301FF', '#A34BF5', '#F46FB1', '#3B7BFF', '#23c55e', '#FFB400', '#24325F', '#0F0820'];
const HANDLE_REGEX = /^[a-z0-9_]{3,30}$/;
const MAX_AVATAR_BYTES = 250 * 1024;
const AVATAR_TARGET_SIZE = 320;

type Props = {
  initial: {
    handle: string;
    displayName: string;
    bio: string;
    avatarUrl: string;
    bannerColor: string;
  };
};

/**
 * Settings form — 2-column layout.
 *
 *  • Left column: editable form, organized in tabs (Identité, Apparence, Bio).
 *  • Right column: sticky live preview of the public profile card —
 *    avatar, banner, displayed name, handle, bio. Updates as the user types.
 *
 * The preview is what the user will see at /community/members/{handle},
 * so they can fine-tune without going back and forth.
 */
export default function SettingsForm({ initial }: Props) {
  const router = useRouter();

  // Tabs
  type Tab = 'identity' | 'avatar' | 'bio';
  const [tab, setTab] = useState<Tab>('identity');

  // Profile section state
  const [pending, startTransition] = useTransition();
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [bannerColor, setBannerColor] = useState(initial.bannerColor);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Handle section state
  const [handle, setHandle] = useState(initial.handle);
  const [handlePending, startHandleTransition] = useTransition();
  const [handleError, setHandleError] = useState<string | null>(null);
  const [handleSuccess, setHandleSuccess] = useState(false);

  // Avatar upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);

  /* ----- Profile dirty? ------------------------------------------------- */
  const profileDirty =
    displayName !== initial.displayName ||
    bio !== initial.bio ||
    avatarUrl !== initial.avatarUrl ||
    bannerColor !== initial.bannerColor;

  /* ----- Avatar upload -------------------------------------------------- */
  const onPickFile = () => fileInputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploadError(null);
    if (!file.type.startsWith('image/')) {
      setAvatarUploadError("Le fichier doit être une image.");
      return;
    }
    setAvatarUploading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, AVATAR_TARGET_SIZE);
      const approxBytes = Math.floor(dataUrl.length * 0.75);
      if (approxBytes > MAX_AVATAR_BYTES) {
        setAvatarUploadError("Image trop lourde. Choisissez un fichier plus simple.");
        return;
      }
      setAvatarUrl(dataUrl);
    } catch {
      setAvatarUploadError("Impossible de lire ce fichier.");
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /* ----- Submits -------------------------------------------------------- */
  const onSubmitProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(false);
    startTransition(async () => {
      const res = await updateMemberProfile({
        displayName: displayName.trim() || undefined,
        bio: bio.trim() || undefined,
        avatarUrl: avatarUrl.trim() || null,
        bannerColor,
      });
      if (res.status === 'error') {
        setProfileError(res.error ?? 'Une erreur est survenue.');
        return;
      }
      setProfileSuccess(true);
      router.refresh();
    });
  };

  const onSubmitHandle = (e: React.FormEvent) => {
    e.preventDefault();
    setHandleError(null);
    setHandleSuccess(false);
    const next = handle.trim().toLowerCase();
    if (!HANDLE_REGEX.test(next)) {
      setHandleError('3 à 30 caractères, minuscules, chiffres et underscore.');
      return;
    }
    startHandleTransition(async () => {
      const res = await changeHandle({ newHandle: next });
      if (res.status === 'error') {
        const map: Record<string, string> = {
          handleTaken: 'Ce pseudo est déjà pris.',
          handleInvalid: 'Ce pseudo est réservé.',
          invalidInput: 'Format invalide.',
        };
        setHandleError(map[res.error] ?? res.error ?? 'Une erreur est survenue.');
        return;
      }
      setHandleSuccess(true);
      router.refresh();
    });
  };

  /* ----- Derived ------------------------------------------------------- */
  const initialsFallback = (displayName || handle || '?').slice(0, 2).toUpperCase();
  const previewName = displayName.trim() || `@${handle}`;
  const previewBio = bio.trim();

  /* ----- Render -------------------------------------------------------- */
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
        gap: 20,
      }}
      className="dz-settings-grid"
    >
      <style>{`
        @media (max-width: 960px) {
          .dz-settings-grid { grid-template-columns: 1fr !important; }
          .dz-settings-preview { position: static !important; }
        }
      `}</style>

      {/* LEFT — form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header card */}
        <div
          style={{
            background: 'linear-gradient(135deg, #7301FF 0%, #A34BF5 60%, #F46FB1 120%)',
            color: '#fff',
            borderRadius: 22,
            padding: 24,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              right: -40,
              top: -40,
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.20), transparent 60%)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div
              aria-hidden
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.30)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
              }}
            >
              ✎
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Modifier mon profil</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.9 }}>
                Pseudo, photo, bio, bannière. Aperçu en direct à droite.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          style={{
            display: 'flex',
            gap: 4,
            padding: 4,
            borderRadius: 14,
            background: '#fff',
            border: '1px solid rgba(115,1,255,0.10)',
            width: 'fit-content',
            maxWidth: '100%',
            flexWrap: 'wrap',
          }}
        >
          {(['identity', 'avatar', 'bio'] as const).map((k) => {
            const labels: Record<Tab, string> = {
              identity: 'Identité',
              avatar: 'Photo & bannière',
              bio: 'Bio',
            };
            const active = tab === k;
            return (
              <button
                key={k}
                type="button"
                role="tab"
                onClick={() => setTab(k)}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: active ? 'linear-gradient(135deg, #7301FF, #A34BF5)' : 'transparent',
                  color: active ? '#fff' : '#545b7a',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: active ? '0 6px 14px -6px rgba(115,1,255,0.45)' : 'none',
                }}
              >
                {labels[k]}
              </button>
            );
          })}
        </div>

        {/* Tab — Identity (handle + display name) */}
        {tab === 'identity' && (
          <Card>
            <div style={{ marginBottom: 16 }}>
              <SectionTitle>Pseudo public</SectionTitle>
              <SectionSub>
                Visible partout dans la communauté et dans l&apos;URL de ton profil.
              </SectionSub>
            </div>

            <form onSubmit={onSubmitHandle} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="@ pseudo">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    border: '1px solid rgba(115,1,255,0.20)',
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: '#fff',
                  }}
                >
                  <span
                    style={{
                      padding: '12px 14px',
                      background: 'rgba(115,1,255,0.06)',
                      color: '#7301FF',
                      fontWeight: 700,
                      fontSize: 14,
                      borderRight: '1px solid rgba(115,1,255,0.18)',
                    }}
                  >
                    @
                  </span>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) =>
                      setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30))
                    }
                    minLength={3}
                    maxLength={30}
                    required
                    style={{
                      flex: 1,
                      padding: '12px 14px',
                      border: 'none',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      color: '#1a1f3a',
                      background: 'transparent',
                      outline: 'none',
                    }}
                  />
                </div>
                <Help>
                  3 à 30 caractères, minuscules, chiffres, underscore. Réservés (admin, moderator…)
                  bloqués.
                </Help>
              </Field>

              {handleError && <Banner kind="error">{handleError}</Banner>}
              {handleSuccess && <Banner kind="success">✓ Pseudo mis à jour.</Banner>}

              <FormActions
                submitLabel="Changer mon pseudo"
                pending={handlePending}
                disabled={handlePending || handle === initial.handle}
              />
            </form>

            <Divider />

            <div style={{ marginBottom: 14 }}>
              <SectionTitle>Nom affiché</SectionTitle>
              <SectionSub>Le nom qui apparaît à côté de tes posts (différent du pseudo).</SectionSub>
            </div>

            <Field label="Nom affiché">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={60}
                placeholder="Le nom que voient les autres"
                style={fieldStyle()}
              />
              <Help>1 à 60 caractères. Vide = on utilise le nom de ton compte.</Help>
            </Field>
          </Card>
        )}

        {/* Tab — Avatar + banner */}
        {tab === 'avatar' && (
          <Card>
            <div style={{ marginBottom: 14 }}>
              <SectionTitle>Photo de profil</SectionTitle>
              <SectionSub>Téléverse une image, on la recadre en 320×320 et on la compresse.</SectionSub>
            </div>

            <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
              <div
                aria-hidden
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  background: avatarUrl
                    ? `#fff url("${avatarUrl}") center/cover no-repeat`
                    : `linear-gradient(135deg, ${bannerColor}, #A34BF5)`,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 32,
                  border: '4px solid #fff',
                  boxShadow: '0 10px 26px -10px rgba(36,18,80,0.32)',
                  flexShrink: 0,
                }}
              >
                {!avatarUrl && initialsFallback}
              </div>
              <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={onFileChange}
                  style={{ display: 'none' }}
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={onPickFile}
                    disabled={avatarUploading}
                    style={primaryBtn(avatarUploading)}
                  >
                    {avatarUploading ? 'Compression…' : '🖼 Choisir une image'}
                  </button>
                  {avatarUrl && (
                    <button type="button" onClick={() => setAvatarUrl('')} style={ghostBtn(false)}>
                      Retirer
                    </button>
                  )}
                </div>
                <details>
                  <summary style={{ fontSize: 12, color: '#7301FF', cursor: 'pointer', fontWeight: 600 }}>
                    Coller un lien d&apos;image (avancé)
                  </summary>
                  <input
                    type="url"
                    value={avatarUrl.startsWith('data:') ? '' : avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://…"
                    style={{ ...fieldStyle(), marginTop: 8 }}
                  />
                </details>
                {avatarUploadError && <Banner kind="error">{avatarUploadError}</Banner>}
              </div>
            </div>

            <Divider />

            <div style={{ marginBottom: 12 }}>
              <SectionTitle>Couleur de bannière</SectionTitle>
              <SectionSub>La grande bande colorée en haut de ton profil public.</SectionSub>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {PALETTE.map((c) => {
                const active = bannerColor.toLowerCase() === c.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setBannerColor(c)}
                    aria-label={`Choisir ${c}`}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: c,
                      border: active ? '3px solid #1a1f3a' : '1px solid rgba(115,1,255,0.20)',
                      cursor: 'pointer',
                      boxShadow: active ? '0 6px 14px rgba(0,0,0,0.20)' : 'none',
                      transition: 'transform 0.2s',
                      transform: active ? 'scale(1.1)' : 'scale(1)',
                    }}
                  />
                );
              })}
            </div>
          </Card>
        )}

        {/* Tab — Bio */}
        {tab === 'bio' && (
          <Card>
            <div style={{ marginBottom: 14 }}>
              <SectionTitle>Bio</SectionTitle>
              <SectionSub>
                Quelques lignes pour te présenter. Les @mentions et #hashtags sont reconnus.
              </SectionSub>
            </div>
            <Field label="Description">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={600}
                rows={6}
                placeholder="Quelques lignes pour te présenter…"
                style={{ ...fieldStyle(), resize: 'vertical' }}
              />
              <Help>
                {bio.length}/600 caractères.
              </Help>
            </Field>
          </Card>
        )}

        {/* Save bar — global, always visible when profile is dirty */}
        {(tab === 'avatar' || tab === 'bio' || profileDirty) && (
          <Card>
            <form onSubmit={onSubmitProfile} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {profileError && <Banner kind="error">{profileError}</Banner>}
              {profileSuccess && <Banner kind="success">✓ Profil enregistré.</Banner>}
              <FormActions
                submitLabel={profileDirty ? 'Enregistrer' : 'Tout est à jour ✓'}
                pending={pending}
                disabled={pending || !profileDirty}
              />
            </form>
          </Card>
        )}
      </div>

      {/* RIGHT — sticky live preview */}
      <aside
        className="dz-settings-preview"
        style={{
          position: 'sticky',
          top: 80,
          alignSelf: 'flex-start',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: '#7301FF',
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            paddingLeft: 4,
          }}
        >
          ✦ Aperçu de ton profil public
        </div>
        <div
          style={{
            background: '#fff',
            border: '1px solid rgba(115,1,255,0.10)',
            borderRadius: 22,
            overflow: 'hidden',
            boxShadow: '0 16px 38px -22px rgba(36,18,80,0.20)',
          }}
        >
          {/* Banner */}
          <div
            style={{
              height: 90,
              background: `linear-gradient(135deg, ${bannerColor}, ${bannerColor}AA)`,
            }}
          />
          {/* Avatar overlap */}
          <div style={{ padding: '0 20px 20px', position: 'relative' }}>
            <div
              style={{
                marginTop: -42,
                width: 84,
                height: 84,
                borderRadius: '50%',
                padding: 4,
                background: '#fff',
                boxShadow: '0 10px 24px -10px rgba(36,18,80,0.32)',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: avatarUrl
                    ? `#fff url("${avatarUrl}") center/cover no-repeat`
                    : `linear-gradient(135deg, ${bannerColor}, #A34BF5)`,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 26,
                }}
              >
                {!avatarUrl && initialsFallback}
              </div>
            </div>
            <h3 style={{ margin: '14px 0 4px', fontSize: 20, fontWeight: 800, color: '#1a1f3a' }}>
              {previewName}
            </h3>
            <div style={{ fontSize: 13, color: '#8b91ad' }}>@{handle}</div>
            {previewBio ? (
              <p style={{ margin: '14px 0 0', fontSize: 14, color: '#545b7a', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                {previewBio}
              </p>
            ) : (
              <p style={{ margin: '14px 0 0', fontSize: 13, color: '#c4cad8', fontStyle: 'italic' }}>
                Tu n&apos;as pas encore écrit de bio. Ajoutes-en une dans l&apos;onglet « Bio ».
              </p>
            )}
          </div>
          <div
            style={{
              borderTop: '1px solid rgba(115,1,255,0.08)',
              padding: '12px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12,
              color: '#8b91ad',
            }}
          >
            <span>0 post</span>
            <span>0 commentaire</span>
            <span>0 réaction</span>
          </div>
        </div>
        <p style={{ fontSize: 11, color: '#8b91ad', margin: '0 4px', lineHeight: 1.5 }}>
          C&apos;est l&apos;aperçu de ce que les autres membres voient à l&apos;adresse{' '}
          <code style={{ color: '#7301FF' }}>/community/members/{handle}</code>.
          Les compteurs réels apparaîtront sur le vrai profil.
        </p>
      </aside>
    </div>
  );
}

/* ============================================================
   Sub-components — small, reusable, scoped to this form.
   ============================================================ */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid rgba(115,1,255,0.10)',
        borderRadius: 22,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 14px 38px -24px rgba(36,18,80,0.16)',
      }}
    >
      {children}
    </div>
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1a1f3a' }}>{children}</h2>;
}
function SectionSub({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '4px 0 0', fontSize: 12, color: '#8b91ad' }}>{children}</p>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 700,
          color: '#1a1f3a',
          marginBottom: 6,
          letterSpacing: '0.02em',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
function Help({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: '#8b91ad', marginTop: 6, lineHeight: 1.5 }}>{children}</div>;
}
function Divider() {
  return (
    <div
      aria-hidden
      style={{
        height: 1,
        background: 'rgba(115,1,255,0.10)',
        margin: '20px 0',
      }}
    />
  );
}
function Banner({ kind, children }: { kind: 'error' | 'success'; children: React.ReactNode }) {
  const palette =
    kind === 'error'
      ? { bg: 'rgba(244,111,177,0.10)', border: 'rgba(244,111,177,0.30)', color: '#a8235e' }
      : { bg: 'rgba(35,197,94,0.10)', border: 'rgba(35,197,94,0.30)', color: '#1a8a52' };
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      style={{
        padding: '10px 14px',
        borderRadius: 10,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.color,
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}
function FormActions({
  submitLabel,
  pending,
  disabled,
}: {
  submitLabel: string;
  pending: boolean;
  disabled: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <button type="submit" disabled={disabled} style={primaryBtn(disabled)}>
        {pending ? 'Enregistrement…' : submitLabel}
      </button>
    </div>
  );
}

function fieldStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid rgba(115,1,255,0.20)',
    fontSize: 14,
    fontFamily: 'inherit',
    color: '#1a1f3a',
    background: '#fff',
  };
}
function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '10px 22px',
    borderRadius: 10,
    border: 'none',
    background: disabled ? 'rgba(115,1,255,0.30)' : 'linear-gradient(135deg, #7301FF, #A34BF5)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : '0 8px 22px -10px rgba(115,1,255,0.55)',
    fontFamily: 'inherit',
  };
}
function ghostBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '10px 18px',
    borderRadius: 10,
    border: '1px solid rgba(115,1,255,0.20)',
    background: 'transparent',
    color: '#7301FF',
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  };
}

/**
 * Read a file and return a JPEG data URL of `size × size`, cover-fit.
 */
function resizeImageToDataUrl(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image load'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('no canvas context'));
            return;
          }
          const ratio = Math.max(size / img.width, size / img.height);
          const w = img.width * ratio;
          const h = img.height * ratio;
          const dx = (size - w) / 2;
          const dy = (size - h) / 2;
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, dx, dy, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (e) {
          reject(e);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

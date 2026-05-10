'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

import { updateCommunitySettings } from '@/lib/actions/platform-settings';

type Props = {
  initial: string;
};

/**
 * Banned-words editor for `/community/admin/settings`.
 *
 * The list is stored as a single string on `CommunitySettings.bannedWords`
 * — newline OR comma separated. Splitting/matching happens at runtime in
 * `lib/community/moderation` when a post or comment is created. We keep
 * the storage format permissive (newlines, commas, comments preceded by
 * `#`) so admins can paste in lists from existing moderation tooling.
 *
 * Live counters: shows total tokens and a 200-char preview so the admin
 * can spot accidental whole-paragraphs being added (which would cause
 * over-blocking).
 */
export default function BannedWordsEditor({ initial }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const [body, setBody] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Esc + scroll lock.
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

  function closeModal() {
    setOpen(false);
    setError(null);
    setSuccess(null);
  }

  // Tokenisation preview — split on newline or comma, drop empty &
  // comment lines, lowercase for the dedup so "SPAM" / "spam" count as
  // one entry.
  const tokens = body
    .split(/[\n,]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !t.startsWith('#'));
  const unique = new Set(tokens.map((t) => t.toLowerCase()));
  const tokenCount = unique.size;

  function handleSave() {
    setError(null);
    setSuccess(null);
    if (body.length > 8000) {
      setError('Liste trop longue (max 8 000 caractères).');
      return;
    }
    startTransition(async () => {
      const res = await updateCommunitySettings({
        bannedWords: body.trim().length > 0 ? body : null,
      });
      if (res.status === 'success') {
        setSuccess(`Liste sauvegardée — ${tokenCount} mot${tokenCount > 1 ? 's' : ''}.`);
        setTimeout(() => {
          closeModal();
          router.refresh();
        }, 700);
      } else {
        setError(
          res.error === 'unauthorized' || res.error === 'forbidden'
            ? 'Action réservée aux modérateur·rice·s.'
            : 'La sauvegarde a échoué.',
        );
      }
    });
  }

  function handleClear() {
    if (!window.confirm('Vider la liste de mots interdits ? Le filtre sera désactivé.')) return;
    setBody('');
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={ghostBtn}>
        Configurer
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="banned-words-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeModal();
            }}
            style={overlayStyle}
          >
            <div ref={dialogRef} style={modalStyle}>
              <header
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 14,
                }}
              >
                <h2
                  id="banned-words-title"
                  style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1a1f3a' }}
                >
                  Mots interdits
                </h2>
                <button type="button" onClick={closeModal} aria-label="Fermer" style={closeBtn}>
                  ×
                </button>
              </header>

              <p
                style={{
                  margin: '0 0 14px',
                  fontSize: 13,
                  color: '#545b7a',
                  lineHeight: 1.55,
                }}
              >
                Un mot par ligne (ou séparés par une virgule). La détection
                est insensible à la casse. Préfixe une ligne par <code>#</code>{' '}
                pour la garder comme commentaire — elle sera ignorée par le
                filtre.
              </p>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 6,
                }}
              >
                <label
                  htmlFor="banned-words-textarea"
                  style={{ fontSize: 12, fontWeight: 700, color: '#1a1f3a' }}
                >
                  Liste de mots
                </label>
                <span className="dz-small" style={{ fontSize: 10 }}>
                  {tokenCount} mot{tokenCount > 1 ? 's' : ''} · {body.length} / 8 000 caractères
                </span>
              </div>
              <textarea
                id="banned-words-textarea"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={8000}
                rows={12}
                placeholder={'# Liste de mots filtrés\nspam\narnaque, scam, fraude\n# pseudonymes inacceptables\nadmin, modérateur'}
                style={{
                  ...inputStyle,
                  width: '100%',
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                  fontSize: 12,
                  resize: 'vertical',
                }}
              />

              {tokenCount > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: '#faf7ff',
                    border: '1px solid rgba(115,1,255,0.06)',
                    fontSize: 11,
                    color: '#1a1f3a',
                    maxHeight: 60,
                    overflowY: 'auto',
                  }}
                >
                  <strong style={{ color: '#7301FF', marginRight: 6 }}>
                    Aperçu :
                  </strong>
                  {[...unique].slice(0, 30).join(' · ')}
                  {unique.size > 30 && ` · …`}
                </div>
              )}

              {error && <div role="alert" style={errorBox}>{error}</div>}
              {success && <div role="status" style={successBox}>{success}</div>}

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  justifyContent: 'space-between',
                  marginTop: 20,
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  onClick={handleClear}
                  style={{ ...ghostBtn, color: '#d94e92', borderColor: 'rgba(244,111,177,0.30)' }}
                >
                  Vider la liste
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={closeModal} style={ghostBtn}>
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={pending}
                    style={primaryBtn(pending)}
                  >
                    {pending ? 'Sauvegarde…' : 'Sauvegarder'}
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

const overlayStyle: React.CSSProperties = {
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
};

const modalStyle: React.CSSProperties = {
  background: '#ffffff',
  color: '#1a1f3a',
  width: '100%',
  maxWidth: 600,
  borderRadius: 22,
  maxHeight: '92vh',
  overflowY: 'auto',
  border: '1px solid rgba(115,1,255,0.10)',
  padding: 26,
};

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 9,
  border: '1px solid rgba(115,1,255,0.15)',
  background: 'white',
  fontSize: 13,
  color: '#1a1f3a',
  outline: 'none',
};

const ghostBtn: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 9,
  border: '1px solid rgba(115,1,255,0.20)',
  background: 'transparent',
  color: '#7301FF',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const closeBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: 'none',
  background: 'rgba(115,1,255,0.08)',
  color: '#1a1f3a',
  fontSize: 22,
  fontWeight: 700,
  cursor: 'pointer',
  lineHeight: 1,
};

function primaryBtn(pending: boolean): React.CSSProperties {
  return {
    padding: '10px 20px',
    borderRadius: 10,
    border: 'none',
    background: pending ? 'rgba(115,1,255,0.45)' : 'linear-gradient(135deg, #7301FF, #A34BF5)',
    color: 'white',
    fontSize: 13,
    fontWeight: 700,
    cursor: pending ? 'wait' : 'pointer',
  };
}

const errorBox: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 9,
  background: 'rgba(239,68,68,0.08)',
  color: '#991b1b',
  fontSize: 12,
  fontWeight: 600,
  marginTop: 12,
};

const successBox: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 9,
  background: 'rgba(35,197,94,0.10)',
  color: '#0e7c3a',
  fontSize: 12,
  fontWeight: 600,
  marginTop: 12,
};

'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

import { updateCommunitySettings } from '@/lib/actions/platform-settings';

type Props = {
  initial: {
    version: string;
    publishedAt: Date | null;
  };
};

/**
 * Charter publish-state editor for `/community/admin/settings`.
 *
 * The actual charter content lives at `/community/charte` (static page)
 * — what's editable from the admin is the **version** + **publish
 * date**. Bumping the version with `requireCharterAccept = true` forces
 * existing members to re-accept the charter on their next visit (handled
 * by the gate in `community/onboarding`).
 *
 * "Aujourd'hui" CTA pre-fills the date picker with the current date so
 * publishing is one-click for the common case.
 */
export default function CharterEditor({ initial }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const [version, setVersion] = useState(initial.version);
  const [publishDate, setPublishDate] = useState(
    initial.publishedAt ? toIsoDate(initial.publishedAt) : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Esc to close + scroll lock while open.
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

  function handlePublish() {
    setError(null);
    setSuccess(null);
    if (!/^v?\d+(\.\d+)?(\.\d+)?$/i.test(version.trim())) {
      setError("Format de version invalide (ex : v3.2 ou 3.2.1).");
      return;
    }
    const date = publishDate ? new Date(publishDate) : new Date();
    if (Number.isNaN(date.getTime())) {
      setError('Date de publication invalide.');
      return;
    }
    startTransition(async () => {
      const res = await updateCommunitySettings({
        charterVersion: version.trim(),
        charterPublishedAt: date,
      });
      if (res.status === 'success') {
        setSuccess('Charte publiée.');
        setTimeout(() => {
          closeModal();
          router.refresh();
        }, 700);
      } else {
        setError(
          res.error === 'unauthorized' || res.error === 'forbidden'
            ? 'Action réservée aux modérateur·rice·s.'
            : 'La publication a échoué.',
        );
      }
    });
  }

  function bumpMinor() {
    const m = /^v?(\d+)\.(\d+)(\.\d+)?$/i.exec(version);
    if (!m) return;
    const major = m[1];
    const minor = String(Number(m[2]) + 1);
    setVersion(`v${major}.${minor}`);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={ghostBtn}>
        Éditer
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="charter-editor-title"
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
                  id="charter-editor-title"
                  style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1a1f3a' }}
                >
                  Charte communauté
                </h2>
                <button
                  type="button"
                  onClick={closeModal}
                  aria-label="Fermer"
                  style={closeBtn}
                >
                  ×
                </button>
              </header>

              <p
                style={{
                  margin: '0 0 18px',
                  fontSize: 13,
                  color: '#545b7a',
                  lineHeight: 1.55,
                }}
              >
                Le contenu de la charte est rédigé sur{' '}
                <a
                  href="/community/charte"
                  target="_blank"
                  rel="noopener"
                  style={{ color: '#7301FF', fontWeight: 600 }}
                >
                  /community/charte
                </a>
                . Depuis ce panneau, mets à jour la <strong>version</strong> et la{' '}
                <strong>date de publication</strong> — si « Acceptation à
                l’inscription » est active, les membres devront re-signer la
                nouvelle version à leur prochaine visite.
              </p>

              <Field label="Version" hint="Ex : v3.2 ou 3.2.1">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    maxLength={20}
                    style={{ ...inputStyle, flex: 1, minWidth: 160 }}
                  />
                  <button type="button" onClick={bumpMinor} style={ghostBtn}>
                    + 0.1
                  </button>
                </div>
              </Field>

              <Field label="Date de publication" hint="Stockée en UTC à la sauvegarde">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="date"
                    value={publishDate}
                    onChange={(e) => setPublishDate(e.target.value)}
                    style={{ ...inputStyle, flex: 1, minWidth: 160 }}
                  />
                  <button
                    type="button"
                    onClick={() => setPublishDate(toIsoDate(new Date()))}
                    style={ghostBtn}
                  >
                    Aujourd’hui
                  </button>
                </div>
              </Field>

              {error && <div role="alert" style={errorBox}>{error}</div>}
              {success && <div role="status" style={successBox}>{success}</div>}

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  justifyContent: 'flex-end',
                  marginTop: 20,
                  flexWrap: 'wrap',
                }}
              >
                <button type="button" onClick={closeModal} style={ghostBtn}>
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={pending}
                  style={primaryBtn(pending)}
                >
                  {pending ? 'Publication…' : 'Publier la version'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1f3a' }}>{label}</label>
        {hint && (
          <span className="dz-small" style={{ fontSize: 10 }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
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
  maxWidth: 520,
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
  marginBottom: 12,
};

const successBox: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 9,
  background: 'rgba(35,197,94,0.10)',
  color: '#0e7c3a',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 12,
};

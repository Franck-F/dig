'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { createCommunityEvent } from '@/lib/actions/events';

const KINDS: Array<{ value: 'LIVE' | 'WORKSHOP' | 'HACKATHON' | 'DEMO' | 'TALK' | 'MEETUP' | 'OTHER'; label: string }> = [
  { value: 'LIVE', label: 'Live' },
  { value: 'WORKSHOP', label: 'Atelier' },
  { value: 'TALK', label: 'Talk' },
  { value: 'DEMO', label: 'Démo' },
  { value: 'HACKATHON', label: 'Hackathon' },
  { value: 'MEETUP', label: 'Meetup' },
  { value: 'OTHER', label: 'Autre' },
];

const FORMATS: Array<{ value: 'REMOTE_VIDEO' | 'IN_PERSON' | 'HYBRID'; label: string; hint: string }> = [
  { value: 'REMOTE_VIDEO', label: 'En ligne', hint: 'Visio uniquement' },
  { value: 'IN_PERSON', label: 'Présentiel', hint: 'Lieu physique' },
  { value: 'HYBRID', label: 'Hybride', hint: 'Lieu + visio' },
];

type FieldErrors = Partial<
  Record<
    'title' | 'description' | 'startsAt' | 'durationMin' | 'location' | 'meetingUrl' | 'capacity',
    string
  >
>;

/**
 * Event creation form — backs `/community/events/new`.
 *
 * The format chips drive which physical/virtual fields are shown:
 *   - REMOTE_VIDEO → meetingUrl required, location optional
 *   - IN_PERSON   → location required, meetingUrl hidden
 *   - HYBRID      → both shown
 *
 * Date/time uses a single <input type="datetime-local"> bound to the
 * user's local timezone — the server action coerces via `z.coerce.date()`
 * which interprets it as UTC unless the browser sent the offset
 * (datetime-local doesn't, so the value is stored as the local wall
 * clock at the host's timezone — same behaviour as Google Calendar's
 * default input). Capacity defaults to 0 = unlimited.
 */
export default function EventForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<typeof KINDS[number]['value']>('LIVE');
  const [format, setFormat] = useState<typeof FORMATS[number]['value']>('REMOTE_VIDEO');
  const [startsAt, setStartsAt] = useState('');
  const [durationMin, setDurationMin] = useState(60);
  const [location, setLocation] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [capacityEnabled, setCapacityEnabled] = useState(false);
  const [capacity, setCapacity] = useState(40);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (title.trim().length < 2) e.title = 'Titre trop court (min 2 caractères).';
    if (title.length > 200) e.title = 'Titre trop long (max 200).';
    if (description.length > 4000) e.description = 'Description trop longue (max 4 000).';
    if (!startsAt) {
      e.startsAt = 'Date & heure requises.';
    } else {
      const d = new Date(startsAt);
      if (Number.isNaN(d.getTime())) e.startsAt = 'Date invalide.';
      else if (d.getTime() < Date.now() - 60 * 60 * 1000) {
        e.startsAt = 'L’événement doit être dans le futur (ou moins d’1h dans le passé).';
      }
    }
    if (durationMin < 15 || durationMin > 480) {
      e.durationMin = 'Durée entre 15 et 480 minutes.';
    }
    if ((format === 'IN_PERSON' || format === 'HYBRID') && !location.trim()) {
      e.location = 'Lieu requis pour un événement en présentiel.';
    }
    if (location.length > 500) e.location = 'Lieu trop long (max 500).';
    if (format === 'REMOTE_VIDEO' || format === 'HYBRID') {
      if (!meetingUrl.trim()) {
        e.meetingUrl = 'Lien de visio requis.';
      } else {
        try {
          const u = new URL(meetingUrl);
          if (u.protocol !== 'http:' && u.protocol !== 'https:') {
            e.meetingUrl = 'URL doit commencer par http:// ou https://';
          }
        } catch {
          e.meetingUrl = 'URL invalide.';
        }
      }
    }
    if (capacityEnabled && (capacity < 1 || capacity > 10000)) {
      e.capacity = 'Jauge entre 1 et 10 000.';
    }
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
      const res = await createCommunityEvent({
        title: title.trim(),
        description: description.trim() || null,
        kind,
        format,
        startsAt: new Date(startsAt),
        durationMin,
        location: location.trim() || null,
        meetingUrl: meetingUrl.trim() || null,
        capacity: capacityEnabled ? capacity : null,
      });
      if (res.status === 'success') {
        setSuccess('Événement créé. Redirection…');
        setTimeout(() => router.push('/community/events'), 700);
      } else {
        setGlobalError(humanError(res.error));
      }
    });
  }

  // Helpers — mirror the resource form styles to keep visual coherence
  // across creation surfaces.
  const showLocation = format === 'IN_PERSON' || format === 'HYBRID';
  const showMeeting = format === 'REMOTE_VIDEO' || format === 'HYBRID';

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Field label="Titre" hint={`${title.length} / 200`} error={errors.title}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Ex : « Live UX par Karim — atelier portfolio »"
          style={inputStyle}
          required
        />
      </Field>

      {/* Kind + Format */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        <Field label="Type d’événement" hint="Influence le tag affiché">
          <div style={chipRowStyle}>
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                style={chipStyle(kind === k.value)}
              >
                {k.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Format" hint="Détermine les champs lieu/visio">
          <div style={chipRowStyle}>
            {FORMATS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFormat(f.value)}
                style={chipStyle(format === f.value)}
                title={f.hint}
              >
                {f.label}
              </button>
            ))}
          </div>
        </Field>
      </div>

      {/* Date + Duration */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        <Field label="Date & heure de début" hint="Heure locale" error={errors.startsAt}>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            style={inputStyle}
            required
          />
        </Field>

        <Field label="Durée" hint={`${durationMin} min · entre 15 et 480`} error={errors.durationMin}>
          <input
            type="range"
            min={15}
            max={240}
            step={15}
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </Field>
      </div>

      {/* Location / meeting URL */}
      {showLocation && (
        <Field
          label="Lieu"
          hint={format === 'IN_PERSON' ? 'Adresse complète' : 'Adresse OU « visio uniquement »'}
          error={errors.location}
        >
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={500}
            placeholder="Ex : « EPITECH Le Kremlin-Bicêtre, salle B12 »"
            style={inputStyle}
            required={format === 'IN_PERSON'}
          />
        </Field>
      )}

      {showMeeting && (
        <Field label="Lien de visio" hint="Zoom, Meet, Whereby…" error={errors.meetingUrl}>
          <input
            type="url"
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            placeholder="https://…"
            style={inputStyle}
            required={format === 'REMOTE_VIDEO'}
          />
        </Field>
      )}

      {/* Description */}
      <Field
        label="Description"
        hint={`${description.length} / 4 000 — optionnelle`}
        error={errors.description}
      >
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={4000}
          rows={4}
          placeholder="Programme, intervenant·es, prérequis…"
          style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
        />
      </Field>

      {/* Capacity */}
      <div
        style={{
          padding: 14,
          borderRadius: 12,
          background: '#faf7ff',
          border: '1px solid rgba(115,1,255,0.06)',
        }}
      >
        <label style={checkboxLabel}>
          <input
            type="checkbox"
            checked={capacityEnabled}
            onChange={(e) => setCapacityEnabled(e.target.checked)}
          />
          <span>
            <strong>Limiter le nombre de places</strong>
            <span className="dz-small" style={{ display: 'block', fontSize: 11 }}>
              Désactive pour des inscriptions illimitées.
            </span>
          </span>
        </label>
        {capacityEnabled && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              min={1}
              max={10000}
              style={{ ...inputStyle, width: 120 }}
            />
            <span className="dz-small" style={{ fontSize: 12 }}>
              place{capacity > 1 ? 's' : ''} maximum
            </span>
          </div>
        )}
        {errors.capacity && (
          <span role="alert" style={{ fontSize: 11, color: '#991b1b', fontWeight: 600, marginTop: 6, display: 'block' }}>
            {errors.capacity}
          </span>
        )}
      </div>

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

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => router.push('/community/events')}
          style={ghostBtn}
        >
          Annuler
        </button>
        <button type="submit" disabled={pending} style={primaryBtn(pending)}>
          {pending ? 'Création…' : 'Créer l’événement'}
        </button>
      </div>
    </form>
  );
}

// ── Shared UI primitives ─────────────────────────────────────────────────

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

const chipRowStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6 };

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
      return 'Connecte-toi pour créer un événement.';
    case 'forbidden':
      return 'Réservé aux modérateur·rice·s et administrateur·rice·s.';
    case 'create_failed':
      return 'La création a échoué. Réessaie dans un instant.';
    default:
      return code;
  }
}

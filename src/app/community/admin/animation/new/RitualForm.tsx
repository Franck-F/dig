'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { createCommunityRitual } from '@/lib/actions/rituals';

const DAYS: Array<{ value: number; label: string; short: string }> = [
  { value: 1, label: 'Lundi', short: 'Lun' },
  { value: 2, label: 'Mardi', short: 'Mar' },
  { value: 3, label: 'Mercredi', short: 'Mer' },
  { value: 4, label: 'Jeudi', short: 'Jeu' },
  { value: 5, label: 'Vendredi', short: 'Ven' },
  { value: 6, label: 'Samedi', short: 'Sam' },
  { value: 0, label: 'Dimanche', short: 'Dim' },
];

const COLORS = ['#7301FF', '#A34BF5', '#F46FB1', '#3B7BFF', '#23c55e', '#FFB823'];

type FieldErrors = Partial<Record<'title' | 'description' | 'time', string>>;

/**
 * Ritual creation form — backs `/community/admin/animation/new`.
 *
 * Three small fields plus a colour picker. Time-of-day is a single
 * `<input type="time">`; we convert HH:MM → minutes-since-midnight on
 * submit. The day-of-week chip row mirrors the planner grid order so
 * the choice maps directly to the calendar slot.
 *
 * `isPublished` toggles whether the ritual appears in member-facing
 * surfaces immediately or stays in the draft column.
 */
export default function RitualForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [time, setTime] = useState('19:00');
  const [durationMin, setDurationMin] = useState(60);
  const [colorHex, setColorHex] = useState('#7301FF');
  const [isPublished, setIsPublished] = useState(true);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (title.trim().length < 2) e.title = 'Titre trop court (min 2 caractères).';
    if (title.length > 120) e.title = 'Titre trop long (max 120).';
    if (description.length > 2000) e.description = 'Description trop longue (max 2 000).';
    const m = /^(\d{1,2}):(\d{2})$/.exec(time);
    if (!m) {
      e.time = 'Heure invalide (HH:MM).';
    } else {
      const hh = Number(m[1]);
      const mm = Number(m[2]);
      if (hh < 0 || hh > 23 || mm < 0 || mm > 59) e.time = 'Heure hors plage.';
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

    const m = /^(\d{1,2}):(\d{2})$/.exec(time)!;
    const startMinute = Number(m[1]) * 60 + Number(m[2]);

    startTransition(async () => {
      const res = await createCommunityRitual({
        title: title.trim(),
        description: description.trim() || null,
        dayOfWeek,
        startMinute,
        durationMin,
        colorHex,
        isPublished,
      });
      if (res.status === 'success') {
        setSuccess('Rituel créé. Redirection…');
        setTimeout(() => router.push('/community/admin/animation'), 700);
      } else {
        setGlobalError(humanError(res.error));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Field label="Titre" hint={`${title.length} / 120`} error={errors.title}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Ex : « Live UX · Karim »"
          style={inputStyle}
          required
        />
      </Field>

      <Field label="Jour de la semaine" hint="Récurrence hebdomadaire">
        <div style={chipRowStyle}>
          {DAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => setDayOfWeek(d.value)}
              style={chipStyle(dayOfWeek === d.value)}
              aria-pressed={dayOfWeek === d.value}
            >
              {d.short}
            </button>
          ))}
        </div>
      </Field>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 14,
        }}
      >
        <Field label="Heure de début" hint="Heure locale" error={errors.time}>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={inputStyle}
            required
          />
        </Field>

        <Field label="Durée" hint={`${durationMin} min`}>
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

      <Field label="Couleur" hint="Identifie le rituel sur le planning">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColorHex(c)}
              aria-label={`Couleur ${c}`}
              aria-pressed={colorHex === c}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: colorHex === c ? '2px solid #1a1f3a' : '2px solid white',
                background: c,
                cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
              }}
            />
          ))}
        </div>
      </Field>

      <Field
        label="Description"
        hint={`${description.length} / 2 000 — optionnelle`}
        error={errors.description}
      >
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Sujet du rituel, intervenant, lien visio par défaut…"
          style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
        />
      </Field>

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
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
          />
          <span>
            <strong>Publier immédiatement</strong>
            <span className="dz-small" style={{ display: 'block', fontSize: 11 }}>
              Décoche pour garder le rituel en brouillon (visible des modérateur·rice·s uniquement).
            </span>
          </span>
        </label>
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
          onClick={() => router.push('/community/admin/animation')}
          style={ghostBtn}
        >
          Annuler
        </button>
        <button type="submit" disabled={pending} style={primaryBtn(pending)}>
          {pending ? 'Création…' : 'Créer le rituel'}
        </button>
      </div>
    </form>
  );
}

// ── Shared UI primitives (mirror the resource/event forms) ─────────────

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
    padding: '6px 14px',
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
      return 'Connecte-toi pour créer un rituel.';
    case 'forbidden':
      return 'Réservé aux modérateur·rice·s communauté et administrateur·rice·s.';
    case 'create_failed':
      return 'La création a échoué. Réessaie dans un instant.';
    case 'invalid_color':
      return 'Couleur invalide.';
    default:
      return code;
  }
}

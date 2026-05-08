'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CyclePhase, CycleStatus } from '@prisma/client';

import { createCycle } from '@/lib/actions/mentora/cycles';

/**
 * Inline form to create a new cycle. Defaults: today → +6 months,
 * phase ONBOARDING, status DRAFT (admin promotes to ACTIVE separately).
 * Collapsed by default to reduce visual noise — opens on click.
 */
export default function CycleCreateForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const endDefault = new Date(today.getTime() + 1000 * 60 * 60 * 24 * 30 * 6);

  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState(today.toISOString().slice(0, 10));
  const [endsAt, setEndsAt] = useState(endDefault.toISOString().slice(0, 10));
  const [description, setDescription] = useState('');

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="dz-btn dz-btn-primary"
        style={{ alignSelf: 'flex-start' }}
      >
        + Nouveau cycle
      </button>
    );
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createCycle({
        name: name.trim(),
        startsAt,
        endsAt,
        description: description.trim() || undefined,
        phase: CyclePhase.ONBOARDING,
        status: CycleStatus.DRAFT,
      });
      if (res.status === 'success') {
        setName('');
        setDescription('');
        setOpen(false);
        router.refresh();
      } else {
        setError(translateError(res.error));
      }
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="dz-card"
      style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>
          Nouveau cycle
        </h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="dz-btn dz-btn-ghost dz-btn-sm"
          style={{ fontSize: 12 }}
        >
          Annuler
        </button>
      </div>

      <label className="dz-small" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        Nom
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={3}
          maxLength={80}
          placeholder="Printemps 2026"
          className="dz-input"
        />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label className="dz-small" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          Début
          <input
            type="date"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
            className="dz-input"
          />
        </label>
        <label className="dz-small" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          Fin
          <input
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            required
            className="dz-input"
          />
        </label>
      </div>

      <label className="dz-small" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        Description (optionnel)
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Cohorte axée IA & accessibilité, partenariat EY × Microsoft."
          className="dz-input"
          style={{ fontFamily: 'inherit', resize: 'vertical' }}
        />
      </label>

      {error && (
        <div
          role="alert"
          style={{
            padding: 10,
            borderRadius: 10,
            background: 'rgba(217,78,146,0.08)',
            color: '#a8235e',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="submit" disabled={pending} className="dz-btn dz-btn-primary">
          {pending ? 'Création…' : 'Créer le cycle'}
        </button>
      </div>
    </form>
  );
}

function translateError(code: string): string {
  switch (code) {
    case 'forbidden':
      return 'Action réservée aux administrateurs.';
    case 'endsBeforeStart':
      return 'La date de fin doit être postérieure à la date de début.';
    case 'slug_collision':
      return 'Un cycle avec un nom similaire existe déjà — change le nom.';
    case 'invalid_input':
      return 'Données invalides — vérifie les champs requis.';
    default:
      return 'Une erreur est survenue. Réessaie.';
  }
}

'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';

import { updateCommunitySettings } from '@/lib/actions/platform-settings';

type Initial = {
  requireCharterAccept: boolean;
  quarantineDays: number;
  hasBannedWords: boolean;
  autoSanctionThreshold: number;
};

type FilterKey = 'charter' | 'quarantine' | 'bannedWords' | 'autoSanctions';

type FilterRow = {
  key: FilterKey;
  label: string;
  hint: string;
  on: boolean;
  /** Some toggles map to numeric thresholds; clicking flips between the
   *  default "on" value and 0. */
  asNumber?: { onValue: number; offValue: number };
  /** When `manageHref` is set, we render a small "Configurer →" link
   *  instead of (or alongside) the toggle — used for banned-words which
   *  is a free-text editor on a dedicated page. */
  manageHref?: string;
};

/**
 * Right-pane "Filtres automatiques" toggles for `/community/admin/content`.
 *
 * Each row maps to a `CommunitySettings` field:
 *   - charter      → requireCharterAccept (bool)
 *   - quarantine   → quarantineDays > 0 (default-on value: 3 days)
 *   - bannedWords  → hasBannedWords; the toggle just disables enforcement
 *                    by clearing the field. The actual list lives at
 *                    /community/admin/settings (charter editor section).
 *   - autoSanctions → autoSanctionThreshold > 0 (default-on value: 3)
 *
 * Each toggle fires `updateCommunitySettings` server-side and uses
 * optimistic UI: we flip the local state first, then roll back if the
 * action returns an error.
 */
export default function AutoFiltersPanel({ initial }: { initial: Initial }) {
  const [state, setState] = useState<Record<FilterKey, boolean>>({
    charter: initial.requireCharterAccept,
    quarantine: initial.quarantineDays > 0,
    bannedWords: initial.hasBannedWords,
    autoSanctions: initial.autoSanctionThreshold > 0,
  });
  const [pendingKey, setPendingKey] = useState<FilterKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const rows: FilterRow[] = [
    {
      key: 'charter',
      label: 'Acceptation de la charte requise',
      hint: 'Bloque le post tant que la charte n’est pas signée.',
      on: state.charter,
    },
    {
      key: 'quarantine',
      label: 'Quarantaine nouveaux membres',
      hint: 'Lecture seule pendant 3 jours après l’inscription.',
      on: state.quarantine,
    },
    {
      key: 'bannedWords',
      label: 'Mots interdits',
      hint: 'Active la liste de mots filtrés.',
      on: state.bannedWords,
      manageHref: '/community/admin/settings#banned-words',
    },
    {
      key: 'autoSanctions',
      label: 'Sanctions automatiques',
      hint: 'Suspension automatique après 3 avertissements.',
      on: state.autoSanctions,
    },
  ];

  function payloadFor(key: FilterKey, next: boolean): Record<string, unknown> {
    switch (key) {
      case 'charter':
        return { requireCharterAccept: next };
      case 'quarantine':
        return { quarantineDays: next ? 3 : 0 };
      case 'bannedWords':
        // Toggling "off" clears the list (intentional — admin can't enforce
        // a list and disable enforcement at the same time). Toggling "on"
        // when the list is empty inserts a stub so the field is non-empty
        // until the admin edits it on the settings page.
        return { bannedWords: next ? (initial.hasBannedWords ? undefined : '# liste à compléter') : null };
      case 'autoSanctions':
        return { autoSanctionThreshold: next ? 3 : 0 };
    }
  }

  const handleToggle = (key: FilterKey) => {
    if (pendingKey) return;
    const next = !state[key];
    setError(null);
    setState((prev) => ({ ...prev, [key]: next }));
    setPendingKey(key);
    startTransition(async () => {
      const payload = payloadFor(key, next);
      // `undefined` values mean "leave as-is" — drop them before send so
      // Zod's `.optional()` doesn't choke.
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(payload)) {
        if (v !== undefined) cleaned[k] = v;
      }
      const res = await updateCommunitySettings(cleaned as Parameters<typeof updateCommunitySettings>[0]);
      if (res.status !== 'success') {
        // Roll back optimistic flip
        setState((prev) => ({ ...prev, [key]: !next }));
        setError(
          res.error === 'unauthorized' || res.error === 'forbidden'
            ? 'Action réservée aux modérateurs.'
            : 'Échec de la sauvegarde. Réessayez.',
        );
      }
      setPendingKey(null);
    });
  };

  return (
    <>
      {rows.map((row, i) => (
        <div
          key={row.key}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 0',
            borderTop: i > 0 ? '1px solid rgba(115,1,255,0.06)' : 'none',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1f3a' }}>{row.label}</div>
            <div className="dz-small" style={{ fontSize: 10, marginTop: 2 }}>
              {row.hint}
            </div>
            {row.manageHref && (
              <Link
                href={row.manageHref}
                style={{
                  display: 'inline-block',
                  marginTop: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#7301FF',
                  textDecoration: 'none',
                }}
              >
                Configurer la liste →
              </Link>
            )}
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={row.on}
            aria-label={row.label}
            onClick={() => handleToggle(row.key)}
            disabled={pendingKey !== null}
            style={{
              width: 36,
              height: 20,
              padding: 0,
              borderRadius: 10,
              border: 'none',
              background: row.on ? '#23c55e' : 'rgba(115,1,255,0.15)',
              position: 'relative',
              cursor: pendingKey ? 'wait' : 'pointer',
              flexShrink: 0,
              transition: 'background 160ms',
            }}
          >
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: 2,
                left: row.on ? 18 : 2,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: 'white',
                transition: 'left 160ms',
                boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
              }}
            />
          </button>
        </div>
      ))}

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 12,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(239,68,68,0.08)',
            color: '#991b1b',
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}
    </>
  );
}

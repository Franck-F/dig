'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  addAvailabilityRule,
  updateAvailabilityRule,
  deleteAvailabilityRule,
} from '@/lib/actions/mentora/availability';

type SavedRule = {
  // `id` present and non-empty when persisted; null/empty for in-memory drafts.
  id: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

type DraftRule = SavedRule & { dirty: boolean };

type Props = {
  initialRules: SavedRule[];
  mentorTimezone: string;
};

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** Convert "HH:MM" → minute count (0..1440). Returns null if invalid. */
function parseTime(value: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) return null;
  const total = hours * 60 + minutes;
  if (total > 1440) return null;
  return total;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

let tmpIdCounter = 0;
function newTmpId() {
  tmpIdCounter += 1;
  return `tmp-${Date.now()}-${tmpIdCounter}`;
}

export default function AvailabilityEditor({ initialRules, mentorTimezone }: Props) {
  const t = useTranslations('mentora.availability');
  const tShared = useTranslations('mentora.dashboard.shared');
  const [rules, setRules] = useState<DraftRule[]>(
    initialRules.map((r) => ({ ...r, dirty: false })),
  );
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  // Group rules by dayOfWeek for rendering.
  const rulesByDay = useMemo(() => {
    const grouped: Record<number, DraftRule[]> = {};
    for (let d = 0; d < 7; d += 1) grouped[d] = [];
    for (const r of rules) grouped[r.dayOfWeek].push(r);
    for (const d of Object.keys(grouped)) {
      grouped[Number(d)].sort((a, b) => a.startMinute - b.startMinute);
    }
    return grouped;
  }, [rules]);

  function handleAddRule(dayOfWeek: number) {
    setRules((prev) => [
      ...prev,
      {
        id: newTmpId(),
        dayOfWeek,
        startMinute: 9 * 60,
        endMinute: 12 * 60,
        dirty: true,
      },
    ]);
    setFeedback(null);
  }

  function handleRemoveRule(rule: DraftRule) {
    if (rule.id.startsWith('tmp-')) {
      // Local-only draft, just drop.
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      setFeedback(null);
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await deleteAvailabilityRule({ id: rule.id });
        if (result.status === 'success') {
          setRules((prev) => prev.filter((r) => r.id !== rule.id));
          setFeedback({ kind: 'success', message: t('removeRuleSuccess') });
        } else {
          setFeedback({ kind: 'error', message: result.error });
        }
      } catch {
        setFeedback({ kind: 'error', message: t('errors.unexpected') });
      }
    });
  }

  function handleUpdateLocal(id: string, patch: Partial<Pick<DraftRule, 'startMinute' | 'endMinute'>>) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch, dirty: true } : r)));
    setFeedback(null);
  }

  function handleSave() {
    // Validation
    for (const r of rules) {
      if (r.startMinute >= r.endMinute) {
        setFeedback({ kind: 'error', message: t('errors.invalidRange') });
        return;
      }
      if (r.startMinute < 0 || r.endMinute > 1440) {
        setFeedback({ kind: 'error', message: t('errors.outOfBounds') });
        return;
      }
    }

    setFeedback(null);
    startTransition(async () => {
      try {
        // Persist each dirty rule. New (tmp-*) rules → addAvailabilityRule;
        // existing dirty rules → updateAvailabilityRule.
        const next: DraftRule[] = [];
        for (const r of rules) {
          if (!r.dirty) {
            next.push(r);
            continue;
          }
          if (r.id.startsWith('tmp-')) {
            const result = await addAvailabilityRule({
              dayOfWeek: r.dayOfWeek,
              startMinute: r.startMinute,
              endMinute: r.endMinute,
            });
            if (result.status !== 'success') {
              setFeedback({ kind: 'error', message: result.error });
              return;
            }
            const created = result.data;
            next.push({
              ...r,
              id: created?.id ?? r.id,
              dirty: false,
            });
          } else {
            const result = await updateAvailabilityRule({
              id: r.id,
              dayOfWeek: r.dayOfWeek,
              startMinute: r.startMinute,
              endMinute: r.endMinute,
            });
            if (result.status !== 'success') {
              setFeedback({ kind: 'error', message: result.error });
              return;
            }
            next.push({ ...r, dirty: false });
          }
        }
        setRules(next);
        setFeedback({ kind: 'success', message: t('saveSuccess') });
      } catch {
        setFeedback({ kind: 'error', message: t('errors.unexpected') });
      }
    });
  }

  return (
    <div className="dz-card" style={{ padding: 24 }}>
      <p className="dz-small" style={{ marginBottom: 18 }}>
        {t('helpText', { tz: mentorTimezone })}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 7 }).map((_, dayOfWeek) => {
          const dayKey = DAY_KEYS[dayOfWeek];
          const dayRules = rulesByDay[dayOfWeek];
          return (
            <div
              key={dayOfWeek}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr auto',
                gap: 12,
                alignItems: 'flex-start',
                padding: '14px 0',
                borderBottom: '1px solid rgba(115,1,255,0.08)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, paddingTop: 8 }}>
                {t(`weekdays.${dayKey}`)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dayRules.length === 0 ? (
                  <span className="dz-small" style={{ paddingTop: 8 }}>{t('dayEmpty')}</span>
                ) : (
                  dayRules.map((rule) => (
                    <div
                      key={rule.id}
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <input
                        type="time"
                        className="dz-input"
                        value={minutesToTime(rule.startMinute)}
                        onChange={(e) => {
                          const m = parseTime(e.target.value);
                          if (m != null) handleUpdateLocal(rule.id, { startMinute: m });
                        }}
                        style={{ width: 120 }}
                        aria-label={t('startTimeAria', { day: t(`weekdays.${dayKey}`) })}
                      />
                      <span className="dz-small">{t('rangeSeparator')}</span>
                      <input
                        type="time"
                        className="dz-input"
                        value={minutesToTime(rule.endMinute)}
                        onChange={(e) => {
                          const m = parseTime(e.target.value);
                          if (m != null) handleUpdateLocal(rule.id, { endMinute: m });
                        }}
                        style={{ width: 120 }}
                        aria-label={t('endTimeAria', { day: t(`weekdays.${dayKey}`) })}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveRule(rule)}
                        disabled={pending}
                        className="dz-btn dz-btn-ghost dz-btn-sm"
                        aria-label={t('removeRange')}
                      >
                        {t('removeRange')}
                      </button>
                    </div>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={() => handleAddRule(dayOfWeek)}
                className="dz-btn dz-btn-ghost dz-btn-sm"
                style={{ marginTop: 4 }}
              >
                {t('addRange')}
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="dz-btn dz-btn-primary"
          style={{ opacity: pending ? 0.7 : 1 }}
        >
          {pending ? tShared('loading') : t('saveCta')}
        </button>
        {feedback?.kind === 'success' && (
          <div
            role="status"
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(35,197,94,0.10)',
              color: '#108a48',
              fontSize: 14,
            }}
          >
            {feedback.message}
          </div>
        )}
        {feedback?.kind === 'error' && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(217,78,146,0.10)',
              color: '#a8235e',
              fontSize: 14,
            }}
          >
            {feedback.message}
          </div>
        )}
      </div>
    </div>
  );
}

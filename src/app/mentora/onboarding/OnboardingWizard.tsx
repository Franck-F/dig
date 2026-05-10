'use client';

import { useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { upsertMenteeProfile } from '@/lib/actions/mentora/mentee-profile';
import { addMenteeGoalSkill } from '@/lib/actions/mentora/mentee-profile';
import { getSkillIdsBySlugs } from '@/lib/mentora/skills';

import OnboardingShell from '@/components/app-shell/OnboardingShell';
import { useTheme } from '@/components/ThemeProvider';

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
const FORMATS = ['REMOTE', 'IN_PERSON', 'HYBRID'] as const;
const DISCOVERED_VIA = ['SEARCH', 'SOCIAL', 'FRIEND', 'EVENT', 'PARTNER', 'OTHER'] as const;
const GOAL_KEYS = [
  'first-job',
  'career-change',
  'side-project',
  'level-up',
  'other',
] as const;

/** Brand-aligned accent per goal — drives both the icon-box tint and
 *  the active-card border. Picked from the 5-color palette so cards
 *  read as "different but family". */
const GOAL_COLOR: Record<(typeof GOAL_KEYS)[number], string> = {
  'first-job': '#7301FF',
  'career-change': '#A34BF5',
  'side-project': '#F46FB1',
  'level-up': '#3B7BFF',
  other: '#23c55e',
};
const FREQUENCY_KEYS = ['weekly', 'biweekly', 'monthly', 'ondemand'] as const;
const SLOT_ROWS = [
  { key: 'morning', label: '9 h–12 h' },
  { key: 'noon', label: '12 h–14 h' },
  { key: 'afternoon', label: '14 h–18 h' },
  { key: 'evening', label: '18 h–22 h' },
] as const;

type Level = (typeof LEVELS)[number];
type Format = (typeof FORMATS)[number];
type DiscoveredVia = (typeof DISCOVERED_VIA)[number];
type GoalKey = (typeof GOAL_KEYS)[number];
type FrequencyKey = (typeof FREQUENCY_KEYS)[number];
type SlotRowKey = (typeof SLOT_ROWS)[number]['key'];

export type OnboardingPrefill = {
  goals: string;
  level: Level;
  preferredFormat: Format;
  languages: string[];
  timezone: string;
  location: string | null;
  currentChallenges: string | null;
  discoveredVia: DiscoveredVia;
  goalSkillSlugs: string[];
} | null;

type WizardSkill = { slug: string; name: string };

type Props = {
  prefill: OnboardingPrefill;
  /** When set, redirect target after success (preserves `?next=` from query). */
  redirectAfter: string;
  /** Pre-fetched curated skill list (server component fetches via
   *  `listPopularSkillsForWizard`). */
  skills: WizardSkill[];
};

/**
 * Brand-aligned goal icons. Replaces the previous emoji-soup with
 * line-stroke SVGs that match the platform's design language (see the
 * geometric glyph set used in the manifesto / newsletter rubriques —
 * same minimal aesthetic, but recognisable as objects so the user can
 * scan the cards without reading every label).
 *
 * Sized at 22 px to fit the existing card padding and tinted with
 * `currentColor` so the parent's accent flows through.
 */
function GoalIcon({ kind, size = 22 }: { kind: (typeof GOAL_KEYS)[number]; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (kind) {
    case 'first-job':
      // Briefcase
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="13" rx="2.5" />
          <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
          <path d="M3 13h18" />
        </svg>
      );
    case 'career-change':
      // Two-arrow refresh loop
      return (
        <svg {...common}>
          <path d="M4 9a8 8 0 0 1 13.5-3.5L20 8" />
          <path d="M20 3v5h-5" />
          <path d="M20 15a8 8 0 0 1-13.5 3.5L4 16" />
          <path d="M4 21v-5h5" />
        </svg>
      );
    case 'side-project':
      // Rocket
      return (
        <svg {...common}>
          <path d="M14 4s4-1 6 1 1 6 1 6c-3 6-8 9-13 10l-3-3c1-5 4-10 10-13z" />
          <circle cx="15" cy="9" r="1.6" />
          <path d="M8 16l-2 4 4-2" />
        </svg>
      );
    case 'level-up':
      // Ascending bars
      return (
        <svg {...common}>
          <path d="M3 21h18" />
          <rect x="5" y="14" width="3" height="7" rx="0.5" />
          <rect x="10.5" y="9" width="3" height="12" rx="0.5" />
          <rect x="16" y="4" width="3" height="17" rx="0.5" />
        </svg>
      );
    case 'other':
      // Sparkle — same 4-point star the platform uses as a brand glyph.
      return (
        <svg {...common}>
          <path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3z" />
        </svg>
      );
  }
}

/**
 * Three-step mentee onboarding wizard, redesigned to match the Claude
 * Design handoff:
 *
 *   1. Objectifs — main goal cards (4 picks) + domain chip selector +
 *                  one-sentence goal description
 *   2. Parcours — current level + format preference + challenges textarea
 *   3. Disponibilités — frequency cards + slot grid (4 ranges × 7 days,
 *                        purely informational on the mentee side, used
 *                        as a matching hint) + languages + timezone +
 *                        AI compatibility banner
 *
 * Persistence:
 *   - upsertMenteeProfile (goals, level, format, languages, timezone, …)
 *   - addMenteeGoalSkill for each picked chip (best-effort)
 *
 * The slot grid is a UX preference (not a structured availability rule —
 * mentees don't have an availability table). We append a compact
 * representation to `currentChallenges` when ticked, so admin and the
 * matching algorithm can read it without a schema migration.
 */
export default function OnboardingWizard({ prefill, redirectAfter, skills }: Props) {
  const t = useTranslations('mentora.onboarding');
  const tStep1 = useTranslations('mentora.onboarding.step1');
  const tStep2 = useTranslations('mentora.onboarding.step2');
  const tStep3 = useTranslations('mentora.onboarding.step3');
  const tSlots = useTranslations('mentora.onboarding.slots');
  const tBanner = useTranslations('mentora.onboarding.matchBanner');
  const tActions = useTranslations('mentora.onboarding.actions');
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  // ──── Step 1 ────────────────────────────────────────────────────────
  const [primaryGoal, setPrimaryGoal] = useState<GoalKey>('first-job');
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(
    new Set(prefill?.goalSkillSlugs ?? []),
  );
  /** Free-text domains the user typed in — these don't map to existing
   *  Skill rows in the DB, so we track them separately and surface them
   *  in the goals string at submit time so the mentor sees them. */
  const [customSkills, setCustomSkills] = useState<string[]>([]);
  const [customSkillDraft, setCustomSkillDraft] = useState('');
  const [goals, setGoals] = useState(prefill?.goals ?? '');

  const toggleSkill = (slug: string) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const addCustomSkill = () => {
    const v = customSkillDraft.trim();
    if (!v) return;
    // Cap individual entries at 60 chars and dedup case-insensitively
    // against both the curated chip list and other custom entries.
    const trimmed = v.slice(0, 60);
    const lower = trimmed.toLowerCase();
    const inCurated = skills.some((s) => s.name.toLowerCase() === lower);
    const inCustom = customSkills.some((c) => c.toLowerCase() === lower);
    if (inCurated || inCustom) {
      setCustomSkillDraft('');
      return;
    }
    setCustomSkills((prev) => [...prev, trimmed]);
    setCustomSkillDraft('');
  };

  const removeCustomSkill = (idx: number) => {
    setCustomSkills((prev) => prev.filter((_, i) => i !== idx));
  };

  // ──── Step 2 ────────────────────────────────────────────────────────
  const [level, setLevel] = useState<Level>(prefill?.level ?? 'BEGINNER');
  const [preferredFormat, setPreferredFormat] = useState<Format>(
    prefill?.preferredFormat ?? 'REMOTE',
  );
  const [challenges, setChallenges] = useState(prefill?.currentChallenges ?? '');
  const [discoveredVia, setDiscoveredVia] = useState<DiscoveredVia>(
    prefill?.discoveredVia ?? 'SEARCH',
  );

  // ──── Step 3 ────────────────────────────────────────────────────────
  const [frequency, setFrequency] = useState<FrequencyKey>('weekly');
  const [slots, setSlots] = useState<Set<string>>(new Set());
  const [languagesRaw, setLanguagesRaw] = useState(
    (prefill?.languages ?? ['fr']).join(', '),
  );
  const [timezone, setTimezone] = useState(
    prefill?.timezone ??
      (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Europe/Paris'),
  );
  const [location, setLocation] = useState(prefill?.location ?? '');

  const toggleSlot = (rowKey: SlotRowKey, day: number) => {
    const k = `${rowKey}:${day}`;
    setSlots((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  // ──── Submit ────────────────────────────────────────────────────────
  const submit = () => {
    setError(null);

    const languages = languagesRaw
      .split(',')
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean);
    if (languages.length === 0) {
      setError(t('errors.languagesRequired'));
      setStep(2);
      return;
    }
    if (goals.trim().length < 1) {
      setError(t('errors.goalsRequired'));
      setStep(0);
      return;
    }

    startTransition(async () => {
      try {
        // Build a compact preferences blob — primary goal + frequency +
        // slot grid + custom domains — appended to `currentChallenges`.
        // Lets admin and the matching algorithm read user preferences
        // without a schema migration. Format is a small JSON snippet at
        // the end of the text, separated by a fenced marker so it can
        // be stripped on display.
        const prefsBlob = JSON.stringify({
          v: 1,
          primaryGoal,
          frequency,
          slots: [...slots],
          customSkills,
        });
        const challengesWithPrefs = challenges.trim()
          ? `${challenges.trim()}\n\n<!--mentora-prefs:${prefsBlob}-->`
          : `<!--mentora-prefs:${prefsBlob}-->`;

        // Tag the goals string with the primary goal label for quick scan,
        // and surface custom-typed domains right after the user's text so
        // they show up plainly in the mentor's first impression — no
        // hidden behaviour. Curated chip skills land on dedicated
        // MenteeGoalSkill rows (see `addMenteeGoalSkill` below) so
        // we don't duplicate them here.
        const goalLabel = tStep1(`goalCards.${primaryGoal}.title`);
        const customSuffix = customSkills.length > 0
          ? `\n\nDomaines complémentaires : ${customSkills.join(', ')}`
          : '';
        const userGoals = goals.trim();
        const baseGoals = userGoals.startsWith(`[${goalLabel}]`)
          ? userGoals
          : `[${goalLabel}] ${userGoals}`;
        const taggedGoals = `${baseGoals}${customSuffix}`;

        const profileRes = await upsertMenteeProfile({
          goals: taggedGoals,
          level,
          languages,
          timezone,
          location: location.trim() || undefined,
          currentChallenges: challengesWithPrefs,
          preferredFormat,
          discoveredVia,
        });
        if (profileRes.status === 'error') {
          setError(profileRes.error ?? t('errors.generic'));
          return;
        }

        if (selectedSkills.size > 0) {
          try {
            const skillIds = await getSkillIdsBySlugs([...selectedSkills]);
            for (const skillId of skillIds) {
              try {
                await addMenteeGoalSkill({ skillId });
              } catch {
                /* partial success acceptable */
              }
            }
          } catch {
            /* slug resolution best-effort */
          }
        }

        router.push(redirectAfter);
        router.refresh();
      } catch {
        setError(t('errors.generic'));
      }
    });
  };

  const totalSteps = 3;
  const nextStep = () => setStep((s) => Math.min(totalSteps - 1, s + 1));
  const backStep = () => setStep((s) => Math.max(0, s - 1));

  const isUpdate = prefill !== null;
  const isFinal = step === totalSteps - 1;

  // ──── Tokens ────────────────────────────────────────────────────────
  const ink = isDark ? 'white' : '#1a1f3a';
  const sub = isDark ? 'rgba(255,255,255,0.65)' : '#545b7a';
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : '#faf7ff';
  const cardBd = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(115,1,255,0.10)';
  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 11,
    border: cardBd,
    background: isDark ? 'rgba(255,255,255,0.04)' : 'white',
    fontSize: 13,
    color: ink,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };
  const fieldGap: CSSProperties = { display: 'grid', gap: 16 };

  const Title = ({ kicker, h1, sub: s }: { kicker: string; h1: string; sub?: string }) => (
    <div style={{ marginBottom: 24 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: '#7301FF',
        }}
      >
        {kicker}
      </span>
      <h2
        style={{
          margin: '6px 0 8px',
          fontSize: 26,
          fontWeight: 800,
          color: ink,
          letterSpacing: '-0.02em',
        }}
      >
        {h1}
      </h2>
      {s && <p style={{ margin: 0, fontSize: 14, color: sub, lineHeight: 1.6, maxWidth: 540 }}>{s}</p>}
    </div>
  );

  const FieldLabel = ({
    children,
    hint,
    htmlFor,
  }: {
    children: ReactNode;
    hint?: string;
    htmlFor?: string;
  }) => (
    <div style={{ marginBottom: 6 }}>
      <label
        htmlFor={htmlFor}
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 700,
          color: ink,
          letterSpacing: '0.02em',
        }}
      >
        {children}
      </label>
      {hint && <div style={{ fontSize: 11, color: sub, marginTop: 4 }}>{hint}</div>}
    </div>
  );

  const Chip = ({
    label,
    active,
    onClick,
    title,
  }: {
    label: string;
    active: boolean;
    onClick: () => void;
    title?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        padding: '8px 14px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        border: active ? '1px solid #7301FF' : cardBd,
        background: active ? 'rgba(115,1,255,0.10)' : 'transparent',
        color: active ? '#7301FF' : sub,
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );

  const stepLabels = [
    { t: tStep1('title'), s: tStep1('subtitle') },
    { t: tStep2('title'), s: tStep2('subtitle') },
    { t: tStep3('title'), s: tStep3('subtitle') },
  ];

  // ──── Step 1 — Objectifs ───────────────────────────────────────────
  const renderStep1 = () => (
    <>
      <Title
        kicker={t('stepIndicator', { current: 1, total: totalSteps })}
        h1={tStep1('title')}
        sub={tStep1('subtitle')}
      />
      <div style={fieldGap}>
        {/* Goal cards (radio-like selection) */}
        <div>
          <FieldLabel>{tStep1('goalCardsLabel')}</FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {GOAL_KEYS.map((k) => {
              const active = primaryGoal === k;
              const accent = GOAL_COLOR[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPrimaryGoal(k)}
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    border: active ? `2px solid ${accent}` : cardBd,
                    background: active
                      ? `linear-gradient(135deg, ${accent}10, ${accent}06)`
                      : cardBg,
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: ink,
                    position: 'relative',
                    fontFamily: 'inherit',
                  }}
                >
                  {active && (
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: accent,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      ✓
                    </span>
                  )}
                  {/* Brand-aligned icon box — tinted background +
                      accent-stroked SVG. Replaces the previous emoji. */}
                  <div
                    aria-hidden
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 11,
                      background: `${accent}18`,
                      color: accent,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <GoalIcon kind={k} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                    {tStep1(`goalCards.${k}.title`)}
                  </div>
                  <div style={{ fontSize: 12, color: sub, marginTop: 4 }}>
                    {tStep1(`goalCards.${k}.desc`)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Domain chips (skills) */}
        <div>
          <FieldLabel hint={tStep1('skillsHint')}>{tStep1('skillsLabel')}</FieldLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {skills.map((s) => (
              <Chip
                key={s.slug}
                label={s.name}
                active={selectedSkills.has(s.slug)}
                onClick={() => toggleSkill(s.slug)}
                title={s.slug}
              />
            ))}
            {/* User-added domains — rendered as removable chips so they
                visually live alongside the curated ones. */}
            {customSkills.map((c, i) => (
              <button
                key={`custom-${c}-${i}`}
                type="button"
                onClick={() => removeCustomSkill(i)}
                title={tStep1('customSkillRemove')}
                style={{
                  padding: '8px 14px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px dashed #7301FF',
                  background: 'rgba(115,1,255,0.10)',
                  color: '#7301FF',
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>{c}</span>
                <span aria-hidden style={{ opacity: 0.7, fontSize: 14, lineHeight: 1 }}>
                  ×
                </span>
              </button>
            ))}
          </div>
          {/* Custom domain input — type + Enter (or click Ajouter) to
              push a new chip into the list above. */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              type="text"
              value={customSkillDraft}
              onChange={(e) => setCustomSkillDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomSkill();
                }
              }}
              placeholder={tStep1('customSkillPlaceholder')}
              aria-label={tStep1('customSkillLabel')}
              maxLength={60}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="button"
              onClick={addCustomSkill}
              disabled={customSkillDraft.trim().length === 0}
              style={{
                padding: '12px 18px',
                borderRadius: 11,
                border: 'none',
                background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
                color: 'white',
                fontSize: 12,
                fontWeight: 700,
                cursor: customSkillDraft.trim().length === 0 ? 'not-allowed' : 'pointer',
                opacity: customSkillDraft.trim().length === 0 ? 0.45 : 1,
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              + {tStep1('customSkillAdd')}
            </button>
          </div>
        </div>

        {/* Goal description */}
        <div>
          <FieldLabel htmlFor="goals" hint={tStep1('goalsHint')}>
            {tStep1('goalsLabel')}
          </FieldLabel>
          <textarea
            id="goals"
            rows={3}
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder={tStep1('goalsPlaceholder')}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>
      </div>
    </>
  );

  // ──── Step 2 — Parcours ────────────────────────────────────────────
  const renderStep2 = () => (
    <>
      <Title
        kicker={t('stepIndicator', { current: 2, total: totalSteps })}
        h1={tStep2('title')}
        sub={tStep2('subtitle')}
      />
      <div style={fieldGap}>
        <div>
          <FieldLabel>{tStep1('levelLabel')}</FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {LEVELS.map((l) => {
              const active = level === l;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLevel(l)}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    border: active ? '2px solid #7301FF' : cardBd,
                    background: active ? 'rgba(115,1,255,0.05)' : cardBg,
                    cursor: 'pointer',
                    textAlign: 'center',
                    color: ink,
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{tStep1(`level.${l}`)}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <FieldLabel>{tStep1('formatLabel')}</FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {FORMATS.map((f) => {
              const active = preferredFormat === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setPreferredFormat(f)}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    border: active ? '2px solid #7301FF' : cardBd,
                    background: active ? 'rgba(115,1,255,0.05)' : cardBg,
                    cursor: 'pointer',
                    textAlign: 'center',
                    color: ink,
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{tStep1(`format.${f}`)}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="challenges">{tStep2('challengesLabel')}</FieldLabel>
          <textarea
            id="challenges"
            rows={4}
            value={challenges}
            onChange={(e) => setChallenges(e.target.value)}
            placeholder={tStep2('challengesPlaceholder')}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div>
          <FieldLabel>{tStep3('discoveredViaLabel')}</FieldLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {DISCOVERED_VIA.map((d) => (
              <Chip
                key={d}
                label={tStep3(`discoveredVia.${d}`)}
                active={discoveredVia === d}
                onClick={() => setDiscoveredVia(d)}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );

  // ──── Step 3 — Disponibilités ──────────────────────────────────────
  const renderStep3 = () => (
    <>
      <Title
        kicker={t('stepIndicator', { current: 3, total: totalSteps })}
        h1={tStep3('title')}
        sub={tStep3('subtitle')}
      />
      <div style={fieldGap}>
        {/* Frequency */}
        <div>
          <FieldLabel>{tStep3('frequencyLabel')}</FieldLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FREQUENCY_KEYS.map((f) => (
              <Chip
                key={f}
                label={tStep3(`frequency.${f}`)}
                active={frequency === f}
                onClick={() => setFrequency(f)}
              />
            ))}
          </div>
        </div>

        {/* Slot grid */}
        <div>
          <FieldLabel hint={tSlots('hint')}>{tSlots('header')}</FieldLabel>
          <SlotGrid
            slots={slots}
            onToggle={toggleSlot}
            cardBg={cardBg}
            cardBd={cardBd}
            ink={ink}
            sub={sub}
            isDark={isDark}
            tSlots={tSlots}
          />
        </div>

        {/* Languages + timezone + city */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <FieldLabel htmlFor="languages" hint={tStep3('languagesHint')}>
              {tStep3('languagesLabel')}
            </FieldLabel>
            <input
              id="languages"
              type="text"
              value={languagesRaw}
              onChange={(e) => setLanguagesRaw(e.target.value)}
              placeholder={tStep3('languagesPlaceholder')}
              maxLength={64}
              style={inputStyle}
            />
          </div>
          <div>
            <FieldLabel htmlFor="timezone" hint={tStep3('timezoneAutodetect')}>
              {tStep3('timezoneLabel')}
            </FieldLabel>
            <input
              id="timezone"
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              maxLength={64}
              aria-label={tStep3('timezoneLabel')}
              placeholder="Europe/Paris"
              style={inputStyle}
            />
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="location">{tStep3('locationLabel')}</FieldLabel>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={120}
            aria-label={tStep3('locationLabel')}
            placeholder="Paris, Lyon, Dakar…"
            style={inputStyle}
          />
        </div>

        {/* AI compatibility banner */}
        <div
          style={{
            marginTop: 8,
            padding: 18,
            borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(115,1,255,0.08), rgba(244,111,177,0.06))',
            border: '1px solid rgba(115,1,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            aria-hidden
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #7301FF, #F46FB1)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            ✦
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: ink }}>{tBanner('title')}</div>
            <div style={{ fontSize: 12, color: sub }}>{tBanner('body')}</div>
          </div>
        </div>
      </div>
    </>
  );

  const stepRenderers = [renderStep1, renderStep2, renderStep3];
  const renderCurrent = stepRenderers[step] ?? renderStep1;

  const submitLabel = isUpdate ? t('actions.update') : tActions('finish');
  const ctaLabel = pending ? tActions('submitting') : isFinal ? submitLabel : tActions('next');

  return (
    <OnboardingShell
      role="mentee"
      step={step + 1}
      totalSteps={totalSteps}
      stepLabels={stepLabels}
      eyebrow="✦ Rejoindre Mentora"
      heading={`${t('title')} ${t('titleHighlight')}`}
      intro={t('subtitle')}
      illustration={step >= 2 ? '/images/robot-mascotte-2.png' : '/images/robot-mascotte-1.png'}
      exitHref="/app"
      exitLabel="Reprendre plus tard"
    >
      {isUpdate && (
        <div
          role="status"
          style={{
            marginBottom: 18,
            padding: 12,
            borderRadius: 12,
            background: isDark ? 'rgba(115,1,255,0.18)' : 'rgba(115,1,255,0.08)',
            color: isDark ? '#d7b8ff' : '#7301FF',
            fontSize: 13,
            border: cardBd,
          }}
        >
          {t('prefillNotice')}
        </div>
      )}

      {renderCurrent()}

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 20,
            padding: 12,
            borderRadius: 12,
            background: 'rgba(217,78,146,0.10)',
            color: '#a8235e',
            fontSize: 14,
            border: '1px solid rgba(217,78,146,0.20)',
          }}
        >
          {error}
        </div>
      )}

      {/* Footer actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 36,
          paddingTop: 24,
          borderTop: cardBd,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={backStep}
          disabled={step === 0 || pending}
          style={{
            padding: '12px 22px',
            borderRadius: 11,
            border: cardBd,
            background: 'transparent',
            color: ink,
            fontSize: 13,
            fontWeight: 600,
            cursor: step === 0 ? 'not-allowed' : 'pointer',
            opacity: step === 0 ? 0.4 : 1,
            fontFamily: 'inherit',
          }}
        >
          ← {tActions('back')}
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={isFinal ? submit : nextStep}
            disabled={pending}
            style={{
              padding: '12px 28px',
              borderRadius: 11,
              border: 'none',
              background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
              color: 'white',
              fontSize: 13,
              fontWeight: 700,
              cursor: pending ? 'wait' : 'pointer',
              opacity: pending ? 0.7 : 1,
              boxShadow: '0 10px 24px rgba(115,1,255,0.30)',
              fontFamily: 'inherit',
              minWidth: 200,
            }}
          >
            {ctaLabel} {!pending && '→'}
          </button>
        </div>
      </div>
    </OnboardingShell>
  );
}

// ──── SlotGrid (mentee variant — 4 ranges × 7 days) ──────────────────
function SlotGrid({
  slots,
  onToggle,
  cardBg,
  cardBd,
  ink,
  sub,
  isDark,
  tSlots,
}: {
  slots: Set<string>;
  onToggle: (rowKey: SlotRowKey, day: number) => void;
  cardBg: string;
  cardBd: string;
  ink: string;
  sub: string;
  isDark: boolean;
  tSlots: (key: string) => string;
}) {
  const days = (() => {
    try {
      const raw = (tSlots as unknown as { raw: (k: string) => string[] }).raw('days');
      if (Array.isArray(raw) && raw.length === 7) return raw;
    } catch {
      /* fall through */
    }
    return ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  })();

  return (
    <div
      style={{
        borderRadius: 14,
        border: cardBd,
        overflow: 'hidden',
        background: isDark ? 'rgba(255,255,255,0.03)' : 'white',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          borderBottom: cardBd,
        }}
      >
        {['', ...days].map((d, i) => (
          <div
            key={i}
            style={{
              padding: '10px 0',
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: i === 0 ? sub : ink,
              borderRight: i < 7 ? cardBd : 'none',
            }}
          >
            {d}
          </div>
        ))}
      </div>
      {SLOT_ROWS.map((row, rowIdx) => (
        <div
          key={row.key}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            borderBottom: rowIdx < SLOT_ROWS.length - 1 ? cardBd : 'none',
          }}
        >
          <div
            style={{
              padding: '10px 8px',
              borderRight: cardBd,
              fontSize: 11,
              fontWeight: 700,
              color: ink,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {tSlots(`rows.${row.key}`)}
          </div>
          {[0, 1, 2, 3, 4, 5, 6].map((day) => {
            const k = `${row.key}:${day}`;
            const on = slots.has(k);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(row.key, day)}
                style={{
                  padding: 6,
                  borderRight: day < 6 ? cardBd : 'none',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: 32,
                    borderRadius: 8,
                    background: on
                      ? 'linear-gradient(135deg, #7301FF, #A34BF5)'
                      : isDark
                        ? 'rgba(255,255,255,0.04)'
                        : cardBg,
                    border: on
                      ? 'none'
                      : isDark
                        ? '1px dashed rgba(255,255,255,0.10)'
                        : '1px dashed rgba(115,1,255,0.15)',
                    color: on ? 'white' : sub,
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {on ? '✓' : ''}
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

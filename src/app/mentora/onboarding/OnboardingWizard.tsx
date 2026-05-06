'use client';

import { useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

// Provided by Agent 2B-2.
import { upsertMenteeProfile } from '@/lib/actions/mentora/mentee-profile';
import { addMenteeGoalSkill } from '@/lib/actions/mentora/mentee-profile';
import { getSkillIdsBySlugs } from '@/lib/mentora/skills';

import OnboardingShell from '@/components/app-shell/OnboardingShell';
import { useTheme } from '@/components/ThemeProvider';

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
const FORMATS = ['REMOTE', 'IN_PERSON', 'HYBRID'] as const;
const DISCOVERED_VIA = ['SEARCH', 'SOCIAL', 'FRIEND', 'EVENT', 'PARTNER', 'OTHER'] as const;

type Level = (typeof LEVELS)[number];
type Format = (typeof FORMATS)[number];
type DiscoveredVia = (typeof DISCOVERED_VIA)[number];

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

type Props = {
  prefill: OnboardingPrefill;
  /** When set, redirect target after success (preserves `?next=` from query). */
  redirectAfter: string;
};

/**
 * Three-step mentee onboarding wizard. Persists on the final step:
 *   1. upsertMenteeProfile (goals, level, format, languages, timezone, …)
 *   2. addMenteeGoalSkill for each picked skill (best-effort)
 * Then redirects the viewer to /mentora/discover (or to ?next=… if set).
 */
export default function OnboardingWizard({ prefill, redirectAfter }: Props) {
  const t = useTranslations('mentora.onboarding');
  const tStep1 = useTranslations('mentora.onboarding.step1');
  const tStep2 = useTranslations('mentora.onboarding.step2');
  const tStep3 = useTranslations('mentora.onboarding.step3');
  const tActions = useTranslations('mentora.onboarding.actions');
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const [goals, setGoals] = useState(prefill?.goals ?? '');
  const [level, setLevel] = useState<Level>(prefill?.level ?? 'BEGINNER');
  const [preferredFormat, setPreferredFormat] = useState<Format>(
    prefill?.preferredFormat ?? 'REMOTE',
  );
  const [skillsRaw, setSkillsRaw] = useState((prefill?.goalSkillSlugs ?? []).join(', '));
  const [challenges, setChallenges] = useState(prefill?.currentChallenges ?? '');
  const [languagesRaw, setLanguagesRaw] = useState(
    (prefill?.languages ?? ['fr']).join(', '),
  );
  const [timezone, setTimezone] = useState(
    prefill?.timezone ??
      (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Europe/Paris'),
  );
  const [location, setLocation] = useState(prefill?.location ?? '');
  const [discoveredVia, setDiscoveredVia] = useState<DiscoveredVia>(
    prefill?.discoveredVia ?? 'SEARCH',
  );

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

    const skillSlugs = skillsRaw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    startTransition(async () => {
      try {
        // 1. Upsert profile.
        const profileRes = await upsertMenteeProfile({
          goals: goals.trim(),
          level,
          languages,
          timezone,
          location: location.trim() || undefined,
          currentChallenges: challenges.trim() || undefined,
          preferredFormat,
          discoveredVia,
        });
        if (profileRes.status === 'error') {
          setError(profileRes.error ?? t('errors.generic'));
          return;
        }

        // 2. Resolve goal-skill slugs to ids and persist (best-effort).
        if (skillSlugs.length > 0) {
          try {
            const skillIds = await getSkillIdsBySlugs(skillSlugs);
            for (const skillId of skillIds) {
              try {
                await addMenteeGoalSkill({ skillId });
              } catch {
                // Ignore individual skill errors — partial success acceptable.
              }
            }
          } catch {
            // Slug resolution is best-effort.
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

  // Visual tokens — light/dark aware.
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

  const renderChip = (
    label: string,
    active: boolean,
    onClick: () => void,
    key?: string | number,
  ) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
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

  // Step labels for the shell sidebar.
  const stepLabels = [
    { t: tStep1('title'), s: tStep1('subtitle') },
    { t: tStep2('title'), s: tStep2('subtitle') },
    { t: tStep3('title'), s: tStep3('subtitle') },
  ];

  const renderStep1 = () => (
    <>
      <Title
        kicker={t('stepIndicator', { current: 1, total: totalSteps })}
        h1={tStep1('title')}
        sub={tStep1('subtitle')}
      />
      <div style={fieldGap}>
        <div>
          <FieldLabel htmlFor="goals" hint={tStep1('goalsHint')}>{tStep1('goalsLabel')}</FieldLabel>
          <textarea
            id="goals"
            rows={5}
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder={tStep1('goalsPlaceholder')}
            maxLength={2000}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>
        <div>
          <FieldLabel>{tStep1('levelLabel')}</FieldLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {LEVELS.map((l) =>
              renderChip(tStep1(`level.${l}`), level === l, () => setLevel(l), l),
            )}
          </div>
        </div>
        <div>
          <FieldLabel>{tStep1('formatLabel')}</FieldLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FORMATS.map((f) =>
              renderChip(
                tStep1(`format.${f}`),
                preferredFormat === f,
                () => setPreferredFormat(f),
                f,
              ),
            )}
          </div>
        </div>
      </div>
    </>
  );

  const renderStep2 = () => (
    <>
      <Title
        kicker={t('stepIndicator', { current: 2, total: totalSteps })}
        h1={tStep2('title')}
        sub={tStep2('subtitle')}
      />
      <div style={fieldGap}>
        <div>
          <FieldLabel htmlFor="goalSkills" hint={tStep2('skillsHint')}>{tStep2('skillsLabel')}</FieldLabel>
          <input
            id="goalSkills"
            type="text"
            value={skillsRaw}
            onChange={(e) => setSkillsRaw(e.target.value)}
            placeholder={tStep2('skillsPlaceholder')}
            style={inputStyle}
          />
        </div>
        <div>
          <FieldLabel htmlFor="challenges">{tStep2('challengesLabel')}</FieldLabel>
          <textarea
            id="challenges"
            rows={4}
            value={challenges}
            onChange={(e) => setChallenges(e.target.value)}
            placeholder={tStep2('challengesPlaceholder')}
            maxLength={2000}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>
      </div>
    </>
  );

  const renderStep3 = () => (
    <>
      <Title
        kicker={t('stepIndicator', { current: 3, total: totalSteps })}
        h1={tStep3('title')}
        sub={tStep3('subtitle')}
      />
      <div style={fieldGap}>
        <div>
          <FieldLabel htmlFor="languages" hint={tStep3('languagesHint')}>{tStep3('languagesLabel')}</FieldLabel>
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
          <FieldLabel htmlFor="timezone" hint={tStep3('timezoneAutodetect')}>{tStep3('timezoneLabel')}</FieldLabel>
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
        <div>
          <FieldLabel>{tStep3('discoveredViaLabel')}</FieldLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {DISCOVERED_VIA.map((d) =>
              renderChip(
                tStep3(`discoveredVia.${d}`),
                discoveredVia === d,
                () => setDiscoveredVia(d),
                d,
              ),
            )}
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
              minWidth: 160,
            }}
          >
            {ctaLabel} {!pending && '→'}
          </button>
        </div>
      </div>
    </OnboardingShell>
  );
}

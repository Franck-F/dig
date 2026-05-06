'use client';

import { useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

// Provided by Agent 2B-2.
import { createMentorProfile, addMentorSkill } from '@/lib/actions/mentora/mentor-profile';
import { getSkillIdsBySlugs } from '@/lib/mentora/skills';

import OnboardingShell from '@/components/app-shell/OnboardingShell';
import { useTheme } from '@/components/ThemeProvider';

const FORMATS = ['REMOTE', 'IN_PERSON', 'HYBRID'] as const;
const RESPONSE_TIMES = ['WITHIN_HOUR', 'WITHIN_DAY', 'WITHIN_WEEK', 'WITHIN_MONTH'] as const;
const SKILL_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const;

type Format = (typeof FORMATS)[number];
type ResponseTimeT = (typeof RESPONSE_TIMES)[number];
type SkillLevelT = (typeof SKILL_LEVELS)[number];

/**
 * Four-step mentor application wizard. Submits to `createMentorProfile`
 * which creates a row with status=DRAFT (advanced to PENDING_REVIEW by the
 * server action when validation passes). On success we redirect to the
 * dashboard with a `pending=1` flag so the dashboard shows the waiting state.
 */
export default function MentorApplicationWizard() {
  const t = useTranslations('mentora.becomeAMentor');
  const tStep1 = useTranslations('mentora.becomeAMentor.step1');
  const tStep2 = useTranslations('mentora.becomeAMentor.step2');
  const tStep3 = useTranslations('mentora.becomeAMentor.step3');
  const tStep4 = useTranslations('mentora.becomeAMentor.step4');
  const tActions = useTranslations('mentora.becomeAMentor.actions');
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [years, setYears] = useState(3);
  const [photoUrl, setPhotoUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');

  const [skillsRaw, setSkillsRaw] = useState('');
  const [skillLevel, setSkillLevel] = useState<SkillLevelT>('INTERMEDIATE');

  const [languagesRaw, setLanguagesRaw] = useState('fr');
  const [timezone, setTimezone] = useState(
    typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Europe/Paris',
  );
  const [format, setFormat] = useState<Format>('REMOTE');
  const [maxMentees, setMaxMentees] = useState(5);
  const [responseTime, setResponseTime] = useState<ResponseTimeT>('WITHIN_WEEK');

  const [consent, setConsent] = useState(false);

  const submit = () => {
    setError(null);
    if (headline.trim().length === 0) {
      setError(t('errors.headlineRequired'));
      setStep(0);
      return;
    }
    if (bio.trim().length < 120) {
      setError(t('errors.bioTooShort'));
      setStep(0);
      return;
    }
    const languages = languagesRaw
      .split(',')
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean);
    if (languages.length === 0) {
      setError(t('errors.languagesRequired'));
      setStep(2);
      return;
    }
    const skillSlugs = skillsRaw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (skillSlugs.length === 0) {
      setError(t('errors.skillsRequired'));
      setStep(1);
      return;
    }
    if (!consent) {
      setError(t('errors.consentRequired'));
      setStep(3);
      return;
    }

    startTransition(async () => {
      try {
        const res = await createMentorProfile({
          headline: headline.trim(),
          bio: bio.trim(),
          yearsExperience: years,
          timezone,
          languages,
          maxConcurrentMentees: maxMentees,
          responseTime,
          photoUrl: photoUrl.trim() || undefined,
          linkedinUrl: linkedinUrl.trim() || undefined,
        });
        if (res.status === 'error') {
          setError(res.error ?? t('errors.generic'));
          return;
        }

        // Resolve skill slugs to ids and attach to the freshly-created profile
        // (best-effort — partial success is acceptable, the user can edit after).
        try {
          const skillIds = await getSkillIdsBySlugs(skillSlugs);
          for (const skillId of skillIds) {
            try {
              await addMentorSkill({ skillId, level: skillLevel });
            } catch {
              // Ignore individual skill errors.
            }
          }
        } catch {
          // Slug resolution is best-effort.
        }

        router.push('/mentora/dashboard?tab=profile&pending=1');
        router.refresh();
      } catch {
        setError(t('errors.generic'));
      }
    });
  };

  const totalSteps = 4;
  const nextStep = () => setStep((s) => Math.min(totalSteps - 1, s + 1));
  const backStep = () => setStep((s) => Math.max(0, s - 1));
  const isFinal = step === totalSteps - 1;

  // Mentor accent palette: #A34BF5 → #24325F.
  const ink = isDark ? 'white' : '#1a1f3a';
  const sub = isDark ? 'rgba(255,255,255,0.65)' : '#545b7a';
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : '#faf7ff';
  const cardBd = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(163,75,245,0.12)';
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

  const Title = ({ kicker, h1, sub: s }: { kicker: string; h1: string; sub?: string }) => (
    <div style={{ marginBottom: 24 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: '#A34BF5',
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
      {s && <p style={{ margin: 0, fontSize: 14, color: sub, lineHeight: 1.6, maxWidth: 580 }}>{s}</p>}
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
        style={{ display: 'block', fontSize: 12, fontWeight: 700, color: ink }}
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
        border: active ? '1px solid #A34BF5' : cardBd,
        background: active ? 'rgba(163,75,245,0.10)' : 'transparent',
        color: active ? '#A34BF5' : sub,
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );

  // Step labels (4 steps in this wizard — keep existing count).
  const stepLabels = [
    { t: tStep1('title'), s: tStep1('subtitle') },
    { t: tStep2('title'), s: tStep2('subtitle') },
    { t: tStep3('title'), s: tStep3('subtitle') },
    { t: tStep4('title'), s: tStep4('subtitle') },
  ];

  const renderStep1 = () => (
    <>
      <Title
        kicker={t('stepIndicator', { current: 1, total: totalSteps })}
        h1={tStep1('title')}
        sub={tStep1('subtitle')}
      />
      <div style={{ display: 'grid', gap: 16 }}>
        <div>
          <FieldLabel htmlFor="headline" hint={tStep1('headlineHint')}>
            {tStep1('headlineLabel')}
          </FieldLabel>
          <input
            id="headline"
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder={tStep1('headlinePlaceholder')}
            maxLength={120}
            style={inputStyle}
          />
        </div>
        <div>
          <FieldLabel htmlFor="bio" hint={tStep1('bioHint')}>
            {tStep1('bioLabel')}
          </FieldLabel>
          <textarea
            id="bio"
            rows={6}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={tStep1('bioPlaceholder')}
            maxLength={4000}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <FieldLabel htmlFor="years">{tStep1('yearsLabel')}</FieldLabel>
            <input
              id="years"
              type="number"
              min={0}
              max={60}
              value={years}
              onChange={(e) => setYears(Math.max(0, Math.min(60, Number(e.target.value) || 0)))}
              aria-label={tStep1('yearsLabel')}
              style={inputStyle}
            />
          </div>
          <div>
            <FieldLabel htmlFor="linkedin">{tStep1('linkedinLabel')}</FieldLabel>
            <input
              id="linkedin"
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/…"
              style={inputStyle}
            />
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="photo" hint={t('photoComingSoon')}>
            {tStep1('photoLabel')}
          </FieldLabel>
          <input
            id="photo"
            type="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder={tStep1('photoPlaceholder')}
            style={inputStyle}
          />
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
      <div style={{ display: 'grid', gap: 16 }}>
        <div>
          <FieldLabel htmlFor="skills" hint={tStep2('skillsHint')}>
            {tStep2('skillsLabel')}
          </FieldLabel>
          <input
            id="skills"
            type="text"
            value={skillsRaw}
            onChange={(e) => setSkillsRaw(e.target.value)}
            placeholder={tStep2('skillsPlaceholder')}
            style={inputStyle}
          />
        </div>
        <div>
          <FieldLabel>{tStep2('levelLabel')}</FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {SKILL_LEVELS.map((l) => {
              const active = skillLevel === l;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => setSkillLevel(l)}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    border: active ? '2px solid #A34BF5' : cardBd,
                    background: active ? 'rgba(163,75,245,0.05)' : cardBg,
                    cursor: 'pointer',
                    textAlign: 'center',
                    color: ink,
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{tStep2(`level.${l}`)}</div>
                </button>
              );
            })}
          </div>
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
      <div style={{ display: 'grid', gap: 16 }}>
        <div>
          <FieldLabel htmlFor="languages">{tStep3('languagesLabel')}</FieldLabel>
          <input
            id="languages"
            type="text"
            value={languagesRaw}
            onChange={(e) => setLanguagesRaw(e.target.value)}
            placeholder={tStep3('languagesPlaceholder')}
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
            aria-label={tStep3('timezoneLabel')}
            placeholder="Europe/Paris"
            style={inputStyle}
          />
        </div>
        <div>
          <FieldLabel>{tStep3('formatLabel')}</FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {FORMATS.map((f) => {
              const active = format === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    border: active ? '2px solid #A34BF5' : cardBd,
                    background: active ? 'rgba(163,75,245,0.05)' : cardBg,
                    cursor: 'pointer',
                    textAlign: 'center',
                    color: ink,
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{tStep3(`format.${f}`)}</div>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <FieldLabel htmlFor="maxMentees">{tStep3('maxMenteesLabel')}</FieldLabel>
            <input
              id="maxMentees"
              type="number"
              min={1}
              max={20}
              value={maxMentees}
              onChange={(e) =>
                setMaxMentees(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
              }
              aria-label={tStep3('maxMenteesLabel')}
              style={inputStyle}
            />
          </div>
          <div>
            <FieldLabel htmlFor="responseTime">{tStep3('responseTimeLabel')}</FieldLabel>
            <select
              id="responseTime"
              value={responseTime}
              onChange={(e) => setResponseTime(e.target.value as ResponseTimeT)}
              aria-label={tStep3('responseTimeLabel')}
              style={inputStyle}
            >
              {RESPONSE_TIMES.map((r) => (
                <option key={r} value={r}>
                  {tStep3(`responseTime.${r}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </>
  );

  const renderStep4 = () => (
    <>
      <Title
        kicker={t('stepIndicator', { current: 4, total: totalSteps })}
        h1={tStep4('title')}
        sub={tStep4('subtitle')}
      />
      <div style={{ display: 'grid', gap: 12 }}>
        <ReviewRow
          label={tStep4('reviewHeadline')}
          value={headline}
          isDark={isDark}
          ink={ink}
          sub={sub}
        />
        <ReviewRow
          label={tStep4('reviewBio')}
          value={bio.length > 200 ? `${bio.slice(0, 200)}…` : bio}
          isDark={isDark}
          ink={ink}
          sub={sub}
        />
        <ReviewRow
          label={tStep4('reviewYears')}
          value={String(years)}
          isDark={isDark}
          ink={ink}
          sub={sub}
        />
        <ReviewRow
          label={tStep4('reviewSkills')}
          value={skillsRaw || '—'}
          isDark={isDark}
          ink={ink}
          sub={sub}
        />
        <ReviewRow
          label={tStep4('reviewLanguages')}
          value={languagesRaw}
          isDark={isDark}
          ink={ink}
          sub={sub}
        />
        <ReviewRow
          label={tStep4('reviewFormat')}
          value={format}
          isDark={isDark}
          ink={ink}
          sub={sub}
        />
        <ReviewRow
          label={tStep4('reviewResponseTime')}
          value={responseTime}
          isDark={isDark}
          ink={ink}
          sub={sub}
        />
        <ReviewRow
          label={tStep4('reviewMaxMentees')}
          value={String(maxMentees)}
          isDark={isDark}
          ink={ink}
          sub={sub}
        />

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: 18,
            borderRadius: 14,
            border: consent ? '2px solid #A34BF5' : cardBd,
            background: consent
              ? 'linear-gradient(135deg, rgba(163,75,245,0.08), rgba(36,50,95,0.05))'
              : cardBg,
            marginTop: 12,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            style={{ marginTop: 3, accentColor: '#A34BF5' }}
          />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: ink }}>{tStep4('consent')}</div>
            <div style={{ fontSize: 12, color: sub, marginTop: 4 }}>{tStep4('submitNotice')}</div>
          </div>
        </label>
      </div>
    </>
  );

  const stepRenderers = [renderStep1, renderStep2, renderStep3, renderStep4];
  const renderCurrent = stepRenderers[step] ?? renderStep1;

  const ctaLabel = pending
    ? tActions('submitting')
    : isFinal
      ? tActions('submit')
      : tActions('next');

  return (
    <OnboardingShell
      role="mentor"
      step={step + 1}
      totalSteps={totalSteps}
      stepLabels={stepLabels}
      eyebrow="✦ Devenir mentor"
      heading={`${t('title')} ${t('titleHighlight')}`}
      intro={t('subtitle')}
      illustration={step >= 2 ? '/images/robot-mascotte-2.png' : '/images/robot-mascotte-1.png'}
      exitHref="/app"
      exitLabel="Reprendre plus tard"
    >
      <div
        style={{
          marginBottom: 18,
          padding: 12,
          borderRadius: 12,
          background: isDark ? 'rgba(163,75,245,0.18)' : 'rgba(163,75,245,0.08)',
          color: isDark ? '#d7b8ff' : '#A34BF5',
          fontSize: 13,
          border: cardBd,
        }}
      >
        {t('eligibilityNotice')}
      </div>

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
              background: 'linear-gradient(135deg, #A34BF5, #24325F)',
              color: 'white',
              fontSize: 13,
              fontWeight: 700,
              cursor: pending ? 'wait' : 'pointer',
              opacity: pending ? 0.7 : 1,
              boxShadow: '0 10px 24px rgba(163,75,245,0.30)',
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

function ReviewRow({
  label,
  value,
  isDark,
  ink,
  sub,
}: {
  label: string;
  value: string;
  isDark: boolean;
  ink: string;
  sub: string;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px 1fr',
        gap: 12,
        padding: '10px 0',
        borderBottom: isDark
          ? '1px solid rgba(255,255,255,0.06)'
          : '1px solid rgba(163,75,245,0.10)',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 12, color: sub }}>{label}</div>
      <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', color: ink }}>{value || '—'}</div>
    </div>
  );
}

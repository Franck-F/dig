'use client';

import { useRef, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { createMentorProfile, addMentorSkill } from '@/lib/actions/mentora/mentor-profile';
import { addAvailabilityRule } from '@/lib/actions/mentora/availability';
import { getSkillIdsBySlugs } from '@/lib/mentora/skills';

import OnboardingShell from '@/components/app-shell/OnboardingShell';
import { useTheme } from '@/components/ThemeProvider';

const FORMATS = ['REMOTE', 'IN_PERSON', 'HYBRID'] as const;
const RESPONSE_TIMES = ['WITHIN_HOUR', 'WITHIN_DAY', 'WITHIN_WEEK', 'WITHIN_MONTH'] as const;
const SKILL_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const;
const SENIORITY_KEYS = ['junior', 'confirmed', 'senior', 'expert'] as const;
const MENTEE_TYPE_KEYS = [
  'career-change',
  'fresh-grad',
  'first-job',
  'founder',
  'career-up',
  'all',
] as const;
const SLOT_ROWS = [
  { key: 'noon', startMinute: 12 * 60, endMinute: 14 * 60 },
  { key: 'afternoon', startMinute: 14 * 60, endMinute: 18 * 60 },
  { key: 'evening', startMinute: 18 * 60, endMinute: 22 * 60 },
] as const;

type Format = (typeof FORMATS)[number];
type ResponseTimeT = (typeof RESPONSE_TIMES)[number];
type SkillLevelT = (typeof SKILL_LEVELS)[number];
type SeniorityKey = (typeof SENIORITY_KEYS)[number];
type MenteeTypeKey = (typeof MENTEE_TYPE_KEYS)[number];
type SlotRowKey = (typeof SLOT_ROWS)[number]['key'];

/** Mapping from seniority key → years of experience floor. Stored on the
 *  mentor profile so admin filters and the public profile both have a
 *  numeric value to work with. */
const SENIORITY_TO_YEARS: Record<SeniorityKey, number> = {
  junior: 2,
  confirmed: 4,
  senior: 8,
  expert: 12,
};

type WizardSkill = { slug: string; name: string };
type Props = {
  /** Pre-fetched curated skill list (server component fetches via
   *  `listPopularSkillsForWizard`). */
  skills: WizardSkill[];
};

/**
 * Four-step mentor application wizard, redesigned to match the Claude
 * Design handoff:
 *
 *   1. Profil — headline, bio, photo, LinkedIn, years experience
 *   2. Expertises — skill chips (curated list), seniority cards,
 *                   mentee types, languages
 *   3. Engagement — capacity, response time, format, recurring slot grid
 *                   (3 ranges × 7 days)
 *   4. Charte — 5 commitment cards + e-signature checkbox
 *
 * On submit we (a) create the mentor profile in DRAFT, (b) attach skills
 * via `addMentorSkill`, (c) create one `AvailabilityRule` per ticked slot
 * cell, then redirect to /mentora/dashboard?pending=1. Step 5 of the
 * design (admin-side validation visio) is post-submit and lives in the
 * admin panel.
 */
export default function MentorApplicationWizard({ skills }: Props) {
  const t = useTranslations('mentora.becomeAMentor');
  const tStep1 = useTranslations('mentora.becomeAMentor.step1');
  const tStep2 = useTranslations('mentora.becomeAMentor.step2');
  const tStep3 = useTranslations('mentora.becomeAMentor.step3');
  const tStep4 = useTranslations('mentora.becomeAMentor.step4');
  const tSlots = useTranslations('mentora.becomeAMentor.slots');
  const tMenteeTypes = useTranslations('mentora.becomeAMentor.menteeTypes');
  const tSeniority = useTranslations('mentora.becomeAMentor.seniority');
  const tActions = useTranslations('mentora.becomeAMentor.actions');
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  // ──── Step 1 ────────────────────────────────────────────────────────
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [years, setYears] = useState(3);
  const [photoUrl, setPhotoUrl] = useState('');
  const photoFileRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const [linkedinUrl, setLinkedinUrl] = useState('');

  const onPhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    setPhotoErr(null);
    if (!file.type.startsWith('image/')) {
      setPhotoErr(t('errors.imageInvalidType'));
      return;
    }
    setPhotoBusy(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 320);
      const approxBytes = Math.floor(dataUrl.length * 0.75);
      if (approxBytes > 250 * 1024) {
        setPhotoErr(t('errors.imageTooLarge'));
        return;
      }
      setPhotoUrl(dataUrl);
    } catch {
      setPhotoErr(t('errors.imageReadFailed'));
    } finally {
      setPhotoBusy(false);
    }
  };

  // ──── Step 2 ────────────────────────────────────────────────────────
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [skillLevel, setSkillLevel] = useState<SkillLevelT>('INTERMEDIATE');
  const [seniority, setSeniority] = useState<SeniorityKey>('senior');
  const [selectedMenteeTypes, setSelectedMenteeTypes] = useState<Set<MenteeTypeKey>>(new Set());
  const [languagesRaw, setLanguagesRaw] = useState('fr');

  const toggleSkill = (slug: string) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const toggleMenteeType = (key: MenteeTypeKey) => {
    setSelectedMenteeTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ──── Step 3 ────────────────────────────────────────────────────────
  const [timezone, setTimezone] = useState(
    typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Europe/Paris',
  );
  const [format, setFormat] = useState<Format>('REMOTE');
  const [maxMentees, setMaxMentees] = useState(5);
  const [responseTime, setResponseTime] = useState<ResponseTimeT>('WITHIN_WEEK');
  // Time-slot grid: 3 ranges × 7 days = 21 boolean cells. Stored as a
  // Set of `${rowKey}:${dayIndex}` strings (compact, easy to toggle).
  const [slots, setSlots] = useState<Set<string>>(new Set());

  const toggleSlot = (rowKey: SlotRowKey, day: number) => {
    const k = `${rowKey}:${day}`;
    setSlots((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  // ──── Step 4 ────────────────────────────────────────────────────────
  const [consent, setConsent] = useState(false);

  // ──── Submit ────────────────────────────────────────────────────────
  const submit = () => {
    setError(null);
    if (headline.trim().length === 0) {
      setError(t('errors.headlineRequired'));
      setStep(0);
      return;
    }
    if (bio.trim().length < 1) {
      setError(t('errors.bioRequired'));
      setStep(0);
      return;
    }
    const languages = languagesRaw
      .split(',')
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean);
    if (languages.length === 0) {
      setError(t('errors.languagesRequired'));
      setStep(1);
      return;
    }
    if (selectedSkills.size === 0) {
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
        // Combine the explicit `years` field with the seniority floor
        // so the persisted value is at least consistent with the
        // selected seniority bucket.
        const yearsExperience = Math.max(years, SENIORITY_TO_YEARS[seniority]);

        // Merge mentee-type tags into the bio so they're surfaced on
        // the mentor profile without a schema migration. Keeps the
        // signal in one searchable text field for now; if/when admin
        // wants a structured filter, we'll promote it to its own column.
        const menteeTypeTags =
          selectedMenteeTypes.size > 0
            ? `\n\nProfils accompagnés : ${[...selectedMenteeTypes]
                .map((k) => tMenteeTypes(`items.${k}.title`))
                .join(', ')}`
            : '';

        const res = await createMentorProfile({
          headline: headline.trim(),
          bio: `${bio.trim()}${menteeTypeTags}`,
          yearsExperience,
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

        // Attach skills (best-effort, partial success is fine).
        try {
          const skillIds = await getSkillIdsBySlugs([...selectedSkills]);
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

        // Persist the time-slot grid as availability rules — one rule
        // per ticked cell. The action validates start < end and ties
        // each rule to the new mentor profile via `requireMentorOwner`.
        try {
          for (const slotKey of slots) {
            const [rowKey, dayStr] = slotKey.split(':') as [SlotRowKey, string];
            const row = SLOT_ROWS.find((r) => r.key === rowKey);
            if (!row) continue;
            const dayOfWeek = Number(dayStr);
            if (Number.isNaN(dayOfWeek)) continue;
            try {
              await addAvailabilityRule({
                dayOfWeek,
                startMinute: row.startMinute,
                endMinute: row.endMinute,
              });
            } catch {
              // Best-effort — the user can edit availability from the dashboard.
            }
          }
        } catch {
          // Same.
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

  // ──── Tokens ────────────────────────────────────────────────────────
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
        border: active ? '1px solid #A34BF5' : cardBd,
        background: active ? 'rgba(163,75,245,0.10)' : 'transparent',
        color: active ? '#A34BF5' : sub,
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
    { t: tStep4('title'), s: tStep4('subtitle') },
  ];

  // ──── Step 1 — Profil ──────────────────────────────────────────────
  const renderStep1 = () => (
    <>
      <Title
        kicker={t('stepIndicator', { current: 1, total: totalSteps })}
        h1={tStep1('title')}
        sub={tStep1('subtitle')}
      />
      {/* Photo card — flush to top so the mentor sees the visual identity
          they're building from the very first step. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          padding: 20,
          borderRadius: 16,
          background: cardBg,
          border: cardBd,
          marginBottom: 22,
        }}
      >
        <div
          aria-hidden
          style={{
            width: 84,
            height: 84,
            borderRadius: '50%',
            flexShrink: 0,
            position: 'relative',
            background: photoUrl
              ? `${isDark ? '#1c123c' : '#fff'} url("${photoUrl}") center/cover no-repeat`
              : 'linear-gradient(135deg, #A34BF5, #24325F)',
            color: photoUrl ? 'transparent' : 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 26,
            boxShadow: photoUrl ? '0 8px 18px rgba(36,18,80,0.18)' : 'none',
            border: cardBd,
          }}
        >
          {!photoUrl && '✦'}
          <button
            type="button"
            onClick={() => photoFileRef.current?.click()}
            disabled={photoBusy}
            aria-label={tStep1('photoUploadCta')}
            style={{
              position: 'absolute',
              bottom: -4,
              right: -4,
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: '2px solid white',
              background: '#A34BF5',
              color: 'white',
              fontSize: 12,
              cursor: photoBusy ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✎
          </button>
        </div>
        <input
          ref={photoFileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={onPhotoFile}
          style={{ display: 'none' }}
          aria-hidden
          tabIndex={-1}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: ink }}>
            {tStep1('photoLabel')}
          </div>
          <div style={{ fontSize: 12, color: sub, marginTop: 2 }}>
            {tStep1('photoHint')}
          </div>
          {photoUrl && (
            <button
              type="button"
              onClick={() => {
                setPhotoUrl('');
                setPhotoErr(null);
              }}
              style={{
                marginTop: 8,
                padding: '6px 12px',
                borderRadius: 10,
                border: cardBd,
                background: 'transparent',
                color: sub,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {tStep1('photoRemove')}
            </button>
          )}
          {photoErr && (
            <p
              role="alert"
              style={{
                margin: '8px 0 0',
                padding: '6px 10px',
                borderRadius: 8,
                background: 'rgba(217,78,146,0.10)',
                border: '1px solid rgba(217,78,146,0.20)',
                color: '#a8235e',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {photoErr}
            </p>
          )}
        </div>
      </div>

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
            rows={5}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={tStep1('bioPlaceholder')}
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
      </div>
    </>
  );

  // ──── Step 2 — Expertises ──────────────────────────────────────────
  const renderStep2 = () => (
    <>
      <Title
        kicker={t('stepIndicator', { current: 2, total: totalSteps })}
        h1={tStep2('title')}
        sub={tStep2('subtitle')}
      />
      <div style={{ display: 'grid', gap: 22 }}>
        {/* Skill chips */}
        <div>
          <FieldLabel hint={tStep2('skillsHint')}>{tStep2('skillsLabel')}</FieldLabel>
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
          </div>
        </div>

        {/* Seniority cards */}
        <div>
          <FieldLabel>{tSeniority('label')}</FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {SENIORITY_KEYS.map((k) => {
              const active = seniority === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSeniority(k)}
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
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{tSeniority(`items.${k}.title`)}</div>
                  <div style={{ fontSize: 11, color: sub, marginTop: 2 }}>
                    {tSeniority(`items.${k}.sub`)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Skill level (per-skill default) */}
        <div>
          <FieldLabel hint={tStep2('skillsHint')}>{tStep2('levelLabel')}</FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {SKILL_LEVELS.map((l) => {
              const active = skillLevel === l;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => setSkillLevel(l)}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: active ? '2px solid #A34BF5' : cardBd,
                    background: active ? 'rgba(163,75,245,0.05)' : cardBg,
                    cursor: 'pointer',
                    textAlign: 'center',
                    color: ink,
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{tStep2(`level.${l}`)}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mentee type checkboxes */}
        <div>
          <FieldLabel hint={tMenteeTypes('hint')}>{tMenteeTypes('label')}</FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {MENTEE_TYPE_KEYS.map((k) => {
              const active = selectedMenteeTypes.has(k);
              return (
                <label
                  key={k}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: 12,
                    borderRadius: 12,
                    border: active ? '2px solid #A34BF5' : cardBd,
                    background: active ? 'rgba(163,75,245,0.05)' : cardBg,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleMenteeType(k)}
                    style={{ accentColor: '#A34BF5' }}
                  />
                  <span aria-hidden style={{ fontSize: 18 }}>
                    {tMenteeTypes(`items.${k}.emoji`)}
                  </span>
                  <span style={{ fontSize: 13, color: ink, fontWeight: 600 }}>
                    {tMenteeTypes(`items.${k}.title`)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Languages */}
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
      </div>
    </>
  );

  // ──── Step 3 — Engagement ──────────────────────────────────────────
  const renderStep3 = () => (
    <>
      <Title
        kicker={t('stepIndicator', { current: 3, total: totalSteps })}
        h1={tStep3('title')}
        sub={tStep3('subtitle')}
      />
      <div style={{ display: 'grid', gap: 22 }}>
        {/* Format */}
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

        {/* Capacity & response time */}
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

        {/* Timezone */}
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
      </div>
    </>
  );

  // ──── Step 4 — Charte ──────────────────────────────────────────────
  const charteIndices = [0, 1, 2, 3, 4] as const;
  const renderStep4 = () => (
    <>
      <Title
        kicker={t('stepIndicator', { current: 4, total: totalSteps })}
        h1={tStep4('title')}
        sub={tStep4('subtitle')}
      />
      <div style={{ display: 'grid', gap: 12 }}>
        {charteIndices.map((i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 14,
              padding: 18,
              borderRadius: 14,
              background: cardBg,
              border: cardBd,
            }}
          >
            <div aria-hidden style={{ fontSize: 24 }}>
              {tStep4(`charteCards.${i}.emoji`)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: ink }}>
                {tStep4(`charteCards.${i}.title`)}
              </div>
              <div style={{ fontSize: 13, color: sub, marginTop: 4, lineHeight: 1.55 }}>
                {tStep4(`charteCards.${i}.desc`)}
              </div>
            </div>
            <div
              aria-hidden
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: '#A34BF5',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              ✓
            </div>
          </div>
        ))}

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
            marginTop: 8,
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
            <div style={{ fontSize: 14, fontWeight: 700, color: ink }}>{tStep4('consent')}</div>
            <div style={{ fontSize: 12, color: sub, marginTop: 4 }}>{tStep4('consentSub')}</div>
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

// ──── SlotGrid — Lun..Dim × Midi/Après-midi/Soir ─────────────────────
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
                      ? 'linear-gradient(135deg, #A34BF5, #24325F)'
                      : isDark
                        ? 'rgba(255,255,255,0.04)'
                        : cardBg,
                    border: on
                      ? 'none'
                      : isDark
                        ? '1px dashed rgba(255,255,255,0.10)'
                        : '1px dashed rgba(163,75,245,0.20)',
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

/**
 * Read an image File and return a `size × size` JPEG data URL, cover-fit.
 * Mirrors the helper in `MentorProfileForm.tsx` so the upload UX is
 * identical between the application wizard and the profile editor.
 */
function resizeImageToDataUrl(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image load'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('no canvas context'));
            return;
          }
          const ratio = Math.max(size / img.width, size / img.height);
          const w = img.width * ratio;
          const h = img.height * ratio;
          const dx = (size - w) / 2;
          const dy = (size - h) / 2;
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, dx, dy, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (e) {
          reject(e);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

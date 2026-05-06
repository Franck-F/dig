'use client';

import { useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  updateMentorProfile,
  submitMentorForReview,
} from '@/lib/actions/mentora/mentor-profile';
import {
  addMentorSkill,
  removeMentorSkill,
} from '@/lib/actions/mentora/profile';

type MentorStatus = 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'PAUSED' | 'SUSPENDED';
type ResponseTime = 'WITHIN_HOUR' | 'WITHIN_DAY' | 'WITHIN_WEEK' | 'WITHIN_MONTH';
type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
type SkillCategory = 'TECHNICAL' | 'SOFT' | 'CAREER' | 'BUSINESS' | 'CREATIVE';

type InitialProfile = {
  headline: string;
  bio: string;
  yearsExperience: number;
  hourlyRate: number | null;
  timezone: string;
  location: string | null;
  photoUrl: string | null;
  linkedinUrl: string | null;
  languages: string[];
  isAcceptingMentees: boolean;
  maxConcurrentMentees: number;
  responseTime: ResponseTime;
  status: MentorStatus;
};

type SkillRow = {
  skillId: string;
  name: string;
  category: SkillCategory;
  level: SkillLevel;
  yearsOfPractice: number;
  isFeatured: boolean;
};

type SkillCatalogEntry = { id: string; name: string; category: SkillCategory };

type Props = {
  initial: InitialProfile;
  skills: SkillRow[];
  skillCatalog: SkillCatalogEntry[];
  preview: ReactNode;
};

const RESPONSE_TIMES: ResponseTime[] = ['WITHIN_HOUR', 'WITHIN_DAY', 'WITHIN_WEEK', 'WITHIN_MONTH'];
const SKILL_LEVELS: SkillLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];

/** Convert HourlyRate cents → display euros string. */
function centsToEuros(cents: number | null): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(0);
}

/** Convert display euros string → cents (or null when empty). */
function eurosToCents(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export default function MentorProfileForm({ initial, skills: initialSkills, skillCatalog, preview }: Props) {
  const t = useTranslations('mentora.profileEdit');
  const tShared = useTranslations('mentora.dashboard.shared');

  const [headline, setHeadline] = useState(initial.headline);
  const [bio, setBio] = useState(initial.bio);
  const [yearsExperience, setYearsExperience] = useState(initial.yearsExperience);
  const [hourlyRateEuros, setHourlyRateEuros] = useState(centsToEuros(initial.hourlyRate));
  const [timezone, setTimezone] = useState(initial.timezone);
  const [location, setLocation] = useState(initial.location ?? '');
  const [photoUrl, setPhotoUrl] = useState(initial.photoUrl ?? '');
  const photoFileRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  const onPhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    setPhotoErr(null);
    if (!file.type.startsWith('image/')) {
      setPhotoErr("Le fichier doit être une image.");
      return;
    }
    setPhotoBusy(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 320);
      const approxBytes = Math.floor(dataUrl.length * 0.75);
      if (approxBytes > 250 * 1024) {
        setPhotoErr("Image trop lourde après compression. Choisissez un fichier plus simple.");
        return;
      }
      setPhotoUrl(dataUrl);
    } catch {
      setPhotoErr("Impossible de lire ce fichier.");
    } finally {
      setPhotoBusy(false);
    }
  };
  const [linkedinUrl, setLinkedinUrl] = useState(initial.linkedinUrl ?? '');
  const [languagesCsv, setLanguagesCsv] = useState(initial.languages.join(', '));
  const [isAcceptingMentees, setIsAcceptingMentees] = useState(initial.isAcceptingMentees);
  const [maxConcurrentMentees, setMaxConcurrentMentees] = useState(initial.maxConcurrentMentees);
  const [responseTime, setResponseTime] = useState<ResponseTime>(initial.responseTime);
  const [status, setStatus] = useState<MentorStatus>(initial.status);

  const [skills, setSkills] = useState<SkillRow[]>(initialSkills);
  const [skillSearch, setSkillSearch] = useState('');

  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  // Skills not already attached, filtered by search.
  const skillSearchResults = useMemo(() => {
    const owned = new Set(skills.map((s) => s.skillId));
    const q = skillSearch.trim().toLowerCase();
    return skillCatalog
      .filter((s) => !owned.has(s.id) && (q === '' || s.name.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [skills, skillCatalog, skillSearch]);

  function handleSave() {
    setFeedback(null);
    const languages = languagesCsv
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    startTransition(async () => {
      try {
        const result = await updateMentorProfile({
          headline: headline.trim(),
          bio: bio.trim(),
          yearsExperience,
          hourlyRate: eurosToCents(hourlyRateEuros),
          timezone: timezone.trim(),
          location: location.trim() || undefined,
          photoUrl: photoUrl.trim() || undefined,
          linkedinUrl: linkedinUrl.trim() || undefined,
          languages,
          isAcceptingMentees,
          maxConcurrentMentees,
          responseTime,
        });
        if (result.status === 'success') {
          setFeedback({ kind: 'success', message: t('saveSuccess') });
        } else {
          setFeedback({ kind: 'error', message: result.error });
        }
      } catch {
        setFeedback({ kind: 'error', message: t('errors.unexpected') });
      }
    });
  }

  function handleSubmitForReview() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await submitMentorForReview();
        if (result.status === 'success') {
          setStatus('PENDING_REVIEW');
          setFeedback({ kind: 'success', message: t('submitForReviewSuccess') });
        } else {
          setFeedback({ kind: 'error', message: result.error });
        }
      } catch {
        setFeedback({ kind: 'error', message: t('errors.unexpected') });
      }
    });
  }

  function handleAddSkill(catalog: SkillCatalogEntry) {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await addMentorSkill({
          skillId: catalog.id,
          level: 'INTERMEDIATE',
          yearsOfPractice: 1,
          isFeatured: false,
        });
        if (result.status === 'success') {
          setSkills((prev) => [
            ...prev,
            {
              skillId: catalog.id,
              name: catalog.name,
              category: catalog.category,
              level: 'INTERMEDIATE',
              yearsOfPractice: 1,
              isFeatured: false,
            },
          ]);
          setSkillSearch('');
        } else {
          setFeedback({ kind: 'error', message: result.error });
        }
      } catch {
        setFeedback({ kind: 'error', message: t('errors.unexpected') });
      }
    });
  }

  function handleRemoveSkill(skillId: string) {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await removeMentorSkill({ skillId });
        if (result.status === 'success') {
          setSkills((prev) => prev.filter((s) => s.skillId !== skillId));
        } else {
          setFeedback({ kind: 'error', message: result.error });
        }
      } catch {
        setFeedback({ kind: 'error', message: t('errors.unexpected') });
      }
    });
  }

  function handleUpdateSkill(skillId: string, patch: Partial<Pick<SkillRow, 'level' | 'yearsOfPractice' | 'isFeatured'>>) {
    setFeedback(null);
    setSkills((prev) => prev.map((s) => (s.skillId === skillId ? { ...s, ...patch } : s)));
    startTransition(async () => {
      const target = skills.find((s) => s.skillId === skillId);
      if (!target) return;
      try {
        // addMentorSkill is upsert (per spec) — re-call with updated fields.
        const result = await addMentorSkill({
          skillId,
          level: patch.level ?? target.level,
          yearsOfPractice: patch.yearsOfPractice ?? target.yearsOfPractice,
          isFeatured: patch.isFeatured ?? target.isFeatured,
        });
        if (result.status === 'error') {
          setFeedback({ kind: 'error', message: result.error });
        }
      } catch {
        setFeedback({ kind: 'error', message: t('errors.unexpected') });
      }
    });
  }

  // Status banner styling
  const statusStyles: Record<MentorStatus, { bg: string; color: string; label: string }> = {
    DRAFT: {
      bg: 'rgba(115,1,255,0.10)',
      color: '#7301FF',
      label: t('statusBanner.draft'),
    },
    PENDING_REVIEW: {
      bg: 'rgba(244,158,11,0.10)',
      color: '#a86b00',
      label: t('statusBanner.pendingReview'),
    },
    ACTIVE: {
      bg: 'rgba(35,197,94,0.10)',
      color: '#108a48',
      label: t('statusBanner.active'),
    },
    PAUSED: {
      bg: 'rgba(217,78,146,0.10)',
      color: '#a8235e',
      label: t('statusBanner.paused'),
    },
    SUSPENDED: {
      bg: 'rgba(220,38,38,0.10)',
      color: '#b91c1c',
      label: t('statusBanner.suspended'),
    },
  };
  const statusStyle = statusStyles[status];

  return (
    <>
      <h1 className="dz-h2" style={{ fontSize: 36 }}>{t('mentorTitle')}</h1>
      <p className="dz-small" style={{ marginTop: -8 }}>{t('mentorSubtitle')}</p>

      {/* Status banner */}
      <div
        role="status"
        style={{
          padding: '14px 18px',
          borderRadius: 14,
          background: statusStyle.bg,
          color: statusStyle.color,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {t('statusBanner.label')}
          </span>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{statusStyle.label}</span>
        </div>
        {status === 'DRAFT' && (
          <button
            type="button"
            onClick={handleSubmitForReview}
            disabled={pending}
            className="dz-btn dz-btn-primary dz-btn-sm"
          >
            {t('submitForReview')}
          </button>
        )}
      </div>

      {/* Two-column layout: form + live preview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
          gap: 24,
          alignItems: 'flex-start',
        }}
      >
        <div className="dz-card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h2 className="dz-h3" style={{ fontSize: 22 }}>{t('basicsSectionTitle')}</h2>

          <div>
            <label htmlFor="prof-headline" className="dz-label">{t('fields.headline')}</label>
            <input
              id="prof-headline"
              className="dz-input"
              value={headline}
              maxLength={120}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder={t('fields.headlinePlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="prof-bio" className="dz-label">{t('fields.bio')}</label>
            <textarea
              id="prof-bio"
              className="dz-input"
              value={bio}
              minLength={120}
              maxLength={4000}
              rows={6}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t('fields.bioPlaceholder')}
            />
            <div className="dz-small" style={{ marginTop: 4 }}>
              {t('fields.bioHint', { count: bio.length })}
            </div>
          </div>

          <div>
            <label htmlFor="prof-years" className="dz-label">{t('fields.yearsExperience')}</label>
            <input
              id="prof-years"
              type="number"
              className="dz-input"
              min={0}
              max={60}
              value={yearsExperience}
              onChange={(e) => setYearsExperience(Math.max(0, Math.min(60, Number(e.target.value))))}
              style={{ maxWidth: 200 }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label htmlFor="prof-timezone" className="dz-label">{t('fields.timezone')}</label>
              <input
                id="prof-timezone"
                className="dz-input"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Europe/Paris"
              />
            </div>
            <div>
              <label htmlFor="prof-location" className="dz-label">{t('fields.location')}</label>
              <input
                id="prof-location"
                className="dz-input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t('fields.locationPlaceholder')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="prof-languages" className="dz-label">{t('fields.languages')}</label>
            <input
              id="prof-languages"
              className="dz-input"
              value={languagesCsv}
              onChange={(e) => setLanguagesCsv(e.target.value)}
              placeholder="fr, en"
            />
            <div className="dz-small" style={{ marginTop: 4 }}>{t('fields.languagesHint')}</div>
          </div>

          <div>
            <label className="dz-label">Photo de profil</label>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <div
                aria-hidden
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: '50%',
                  background: photoUrl
                    ? `#fff url("${photoUrl}") center/cover no-repeat`
                    : 'linear-gradient(135deg, #7301FF, #A34BF5)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 26,
                  border: '3px solid #fff',
                  boxShadow: '0 8px 22px -10px rgba(36,18,80,0.32)',
                  flexShrink: 0,
                }}
              >
                {!photoUrl && '✦'}
              </div>
              <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  ref={photoFileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={onPhotoFile}
                  style={{ display: 'none' }}
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => photoFileRef.current?.click()}
                    disabled={photoBusy}
                    className="dz-btn dz-btn-primary dz-btn-sm"
                  >
                    {photoBusy ? 'Compression…' : '🖼 Téléverser une photo'}
                  </button>
                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="dz-btn dz-btn-ghost dz-btn-sm"
                    >
                      Retirer
                    </button>
                  )}
                </div>
                <div className="dz-small" style={{ fontSize: 11 }}>
                  PNG, JPG, WebP ou GIF. L&apos;image est recadrée et compressée en 320×320.
                </div>
                {photoErr && (
                  <div
                    role="alert"
                    style={{
                      fontSize: 12,
                      color: '#a8235e',
                      background: 'rgba(244,111,177,0.10)',
                      border: '1px solid rgba(244,111,177,0.30)',
                      padding: '6px 10px',
                      borderRadius: 8,
                    }}
                  >
                    {photoErr}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="prof-linkedin" className="dz-label">{t('fields.linkedinUrl')}</label>
            <input
              id="prof-linkedin"
              className="dz-input"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/…"
            />
          </div>

          <h2 className="dz-h3" style={{ fontSize: 22, marginTop: 8 }}>{t('preferencesSectionTitle')}</h2>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--ink-soft)' }}>
            <input
              type="checkbox"
              checked={isAcceptingMentees}
              onChange={(e) => setIsAcceptingMentees(e.target.checked)}
            />
            {t('fields.isAcceptingMentees')}
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label htmlFor="prof-maxmentees" className="dz-label">{t('fields.maxConcurrentMentees')}</label>
              <input
                id="prof-maxmentees"
                type="number"
                className="dz-input"
                min={1}
                max={20}
                value={maxConcurrentMentees}
                onChange={(e) => setMaxConcurrentMentees(Math.max(1, Math.min(20, Number(e.target.value))))}
              />
            </div>
            <div>
              <label htmlFor="prof-response" className="dz-label">{t('fields.responseTime')}</label>
              <select
                id="prof-response"
                className="dz-input"
                value={responseTime}
                onChange={(e) => setResponseTime(e.target.value as ResponseTime)}
              >
                {RESPONSE_TIMES.map((rt) => (
                  <option key={rt} value={rt}>
                    {t(`responseTimes.${rt}` as
                      | 'responseTimes.WITHIN_HOUR'
                      | 'responseTimes.WITHIN_DAY'
                      | 'responseTimes.WITHIN_WEEK'
                      | 'responseTimes.WITHIN_MONTH')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="dz-btn dz-btn-primary"
              style={{ opacity: pending ? 0.7 : 1 }}
            >
              {pending ? tShared('loading') : t('saveCta')}
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              disabled={pending}
              className="dz-btn dz-btn-ghost"
            >
              {t('cancelCta')}
            </button>
          </div>
        </div>

        {/* Right column: live preview */}
        <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span className="dz-label">{t('previewLabel')}</span>
          {preview}
        </div>
      </div>

      {/* Skills section (full width) */}
      <div className="dz-card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 className="dz-h3" style={{ fontSize: 22 }}>{t('skillsSectionTitle')}</h2>
        <p className="dz-small">{t('skillsHelp')}</p>

        {/* Existing skills */}
        {skills.length === 0 ? (
          <p className="dz-small">{t('skillsEmpty')}</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {skills.map((s) => (
              <li
                key={s.skillId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(160px, 1.4fr) repeat(3, minmax(120px, 1fr)) auto',
                  gap: 10,
                  alignItems: 'center',
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'rgba(115,1,255,0.04)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</span>
                  <span className="dz-small">{s.category}</span>
                </div>
                <select
                  className="dz-input"
                  value={s.level}
                  onChange={(e) => handleUpdateSkill(s.skillId, { level: e.target.value as SkillLevel })}
                  aria-label={t('fields.skillLevel')}
                >
                  {SKILL_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {t(`skillLevels.${lvl}` as
                        | 'skillLevels.BEGINNER'
                        | 'skillLevels.INTERMEDIATE'
                        | 'skillLevels.ADVANCED'
                        | 'skillLevels.EXPERT')}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  max={60}
                  className="dz-input"
                  value={s.yearsOfPractice}
                  onChange={(e) =>
                    handleUpdateSkill(s.skillId, {
                      yearsOfPractice: Math.max(0, Math.min(60, Number(e.target.value))),
                    })
                  }
                  aria-label={t('fields.yearsOfPractice')}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-soft)' }}>
                  <input
                    type="checkbox"
                    checked={s.isFeatured}
                    onChange={(e) => handleUpdateSkill(s.skillId, { isFeatured: e.target.checked })}
                  />
                  {t('fields.featured')}
                </label>
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(s.skillId)}
                  disabled={pending}
                  className="dz-btn dz-btn-ghost dz-btn-sm"
                >
                  {t('removeSkill')}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add skill */}
        <div style={{ marginTop: 8 }}>
          <label htmlFor="skill-search" className="dz-label">{t('addSkill')}</label>
          <input
            id="skill-search"
            className="dz-input"
            value={skillSearch}
            onChange={(e) => setSkillSearch(e.target.value)}
            placeholder={t('skillSearchPlaceholder')}
          />
          {skillSearch.trim() !== '' && skillSearchResults.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 8, margin: '8px 0 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {skillSearchResults.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => handleAddSkill(s)}
                    disabled={pending}
                    className="dz-btn dz-btn-ghost dz-btn-sm"
                  >
                    + {s.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {skillSearch.trim() !== '' && skillSearchResults.length === 0 && (
            <p className="dz-small" style={{ marginTop: 6 }}>{t('skillSearchEmpty')}</p>
          )}
        </div>
      </div>

      {/* Feedback banners */}
      {feedback?.kind === 'success' && (
        <div
          role="status"
          style={{
            padding: 14,
            borderRadius: 12,
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
            padding: 14,
            borderRadius: 12,
            background: 'rgba(217,78,146,0.10)',
            color: '#a8235e',
            fontSize: 14,
          }}
        >
          {feedback.message}
        </div>
      )}
    </>
  );
}

/**
 * Read a file and return a JPEG data URL of `size × size`, cover-fit.
 * Same pipeline as community avatar / member settings — keeps the upload
 * UX consistent across the platform.
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

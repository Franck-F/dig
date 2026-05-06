'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { claimHandle, updateMemberProfile } from '@/lib/actions/community/member';

export type DefaultChannel = {
  slug: string;
  name: string;
  emoji: string | null;
};

type Props = {
  channels: DefaultChannel[];
  suggestedHandle: string;
  defaultDisplayName: string;
};

const HANDLE_REGEX = /^[a-z0-9_]{3,30}$/;

// Keep in sync with the server-side reserved list. Strict subset — server
// has the final say. Case-insensitive.
const RESERVED_WORDS = new Set([
  'admin',
  'moderator',
  'digizelle',
  'system',
  'root',
  'owner',
  'staff',
]);

const DEFAULT_TICKED = new Set(['annonces', 'general']);

/**
 * Three-step community onboarding wizard.
 *
 *  Step 1 — handle: format check + reserved-word reject inline. Uniqueness is
 *           enforced server-side (no live availability call to keep the wizard
 *           thin).
 *  Step 2 — bio (textarea, ≤ 500) + avatarUrl (text input; upload deferred).
 *  Step 3 — pre-ticked default channels; user may untick.
 *
 *  Final submit pipes everything through `claimHandle({ handle, bio,
 *  defaultChannelSlugs })` (avatarUrl gets persisted via a follow-up
 *  `updateMemberProfile` since `claimHandle` doesn't accept it).
 *  On success, router.push('/community').
 */
export default function OnboardingWizard({ channels, suggestedHandle, defaultDisplayName }: Props) {
  const t = useTranslations('community.onboarding');
  const tActions = useTranslations('community.onboarding.actions');
  const tStep1 = useTranslations('community.onboarding.handle');
  const tStep2 = useTranslations('community.onboarding.profile');
  const tStep3 = useTranslations('community.onboarding.channels');
  const tSummary = useTranslations('community.onboarding.summary');
  const tErrors = useTranslations('community.onboarding.errors');

  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [handle, setHandle] = useState(suggestedHandle);
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [displayName, setDisplayName] = useState(defaultDisplayName);

  const initialChannels = useMemo(() => {
    const out = new Set<string>();
    for (const c of channels) {
      out.add(c.slug);
    }
    // Always ensure annonces + general are pre-ticked when present.
    for (const slug of DEFAULT_TICKED) {
      if (channels.some((c) => c.slug === slug)) out.add(slug);
    }
    return out;
  }, [channels]);
  const [pickedChannels, setPickedChannels] = useState<Set<string>>(initialChannels);

  const handleNormalized = handle.trim().toLowerCase();
  const handleFormatError = handleNormalized.length > 0 && !HANDLE_REGEX.test(handleNormalized);
  const handleReservedError = RESERVED_WORDS.has(handleNormalized);
  const handleEmpty = handleNormalized.length === 0;

  const totalSteps = 3;

  const goNext = () => {
    setError(null);
    if (step === 0) {
      if (handleEmpty) {
        setError(tErrors('handleRequired'));
        return;
      }
      if (handleFormatError) {
        setError(tStep1('invalidError'));
        return;
      }
      if (handleReservedError) {
        setError(tStep1('reservedError'));
        return;
      }
    }
    setStep((s) => Math.min(totalSteps - 1, s + 1));
  };
  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const toggleChannel = (slug: string) => {
    setPickedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const submit = () => {
    setError(null);
    if (!HANDLE_REGEX.test(handleNormalized)) {
      setStep(0);
      setError(tStep1('invalidError'));
      return;
    }
    if (handleReservedError) {
      setStep(0);
      setError(tStep1('reservedError'));
      return;
    }

    const payload = {
      handle: handleNormalized,
      displayName: displayName.trim() || undefined,
      bio: bio.trim() || undefined,
      defaultChannelSlugs: Array.from(pickedChannels),
    };

    startTransition(async () => {
      try {
        const res = await claimHandle(payload);
        if (res.status === 'error') {
          if (res.error === 'community.errors.handleTaken') {
            setStep(0);
            setError(tStep1('takenError'));
          } else if (res.error === 'community.errors.handleInvalid') {
            setStep(0);
            setError(tStep1('invalidError'));
          } else if (res.error === 'community.errors.alreadyOnboarded') {
            // Already a member — just redirect.
            router.push('/community');
            router.refresh();
          } else {
            setError(tErrors('generic'));
          }
          return;
        }
        // Best-effort avatar persistence — non-fatal.
        const avatarTrim = avatarUrl.trim();
        if (avatarTrim.length > 0) {
          try {
            await updateMemberProfile({ avatarUrl: avatarTrim });
          } catch {
            // ignore — user can set it later from /community/settings
          }
        }
        router.push('/community');
        router.refresh();
      } catch {
        setError(tErrors('submissionFailed'));
      }
    });
  };

  const stepLabels = [
    { id: 'handle', title: tStep1('stepTitle'), subtitle: tStep1('stepSubtitle') },
    { id: 'profile', title: tStep2('stepTitle'), subtitle: tStep2('stepSubtitle') },
    { id: 'channels', title: tStep3('stepTitle'), subtitle: tStep3('stepSubtitle') },
  ];
  const cur = stepLabels[step];

  return (
    <div className="dz-glass-strong" style={{ padding: 32, borderRadius: 24 }}>
      <div className="dz-small" style={{ marginBottom: 8, color: '#7301FF', fontWeight: 600 }}>
        {t('stepCounter', { current: step + 1, total: totalSteps })}
      </div>
      <div aria-hidden style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {stepLabels.map((s, i) => (
          <div
            key={s.id}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 99,
              background: i <= step
                ? 'linear-gradient(90deg,#7301FF,#A34BF5)'
                : 'rgba(115,1,255,0.12)',
            }}
          />
        ))}
      </div>

      <h2 className="dz-h2" style={{ fontSize: 28 }}>{cur.title}</h2>
      <p className="dz-small" style={{ marginTop: 8, fontSize: 14 }}>{cur.subtitle}</p>

      <div style={{ marginTop: 24 }}>
        {step === 0 && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label htmlFor="handle" className="dz-label">{tStep1('label')}</label>
              <input
                id="handle"
                type="text"
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="dz-input"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                placeholder={tStep1('placeholder')}
                maxLength={30}
                aria-invalid={handleFormatError || handleReservedError}
              />
              <div className="dz-small" style={{ marginTop: 4, fontSize: 12 }}>
                {tStep1('help', { handle: handleNormalized || 'tonhandle' })}
              </div>
              {handleFormatError && (
                <div className="dz-small" style={{ marginTop: 4, color: '#a8235e', fontSize: 12 }}>
                  {tStep1('invalidError')}
                </div>
              )}
              {!handleFormatError && handleReservedError && (
                <div className="dz-small" style={{ marginTop: 4, color: '#a8235e', fontSize: 12 }}>
                  {tStep1('reservedError')}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label htmlFor="displayName" className="dz-label">{tStep2('displayNameLabel')}</label>
              <input
                id="displayName"
                type="text"
                className="dz-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={tStep2('displayNamePlaceholder')}
                maxLength={60}
              />
              <div className="dz-small" style={{ marginTop: 4, fontSize: 12 }}>
                {tStep2('displayNameHelp')}
              </div>
            </div>
            <div>
              <label htmlFor="bio" className="dz-label">{tStep2('bioLabel')}</label>
              <textarea
                id="bio"
                rows={4}
                className="dz-input"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={tStep2('bioPlaceholder')}
                maxLength={500}
              />
              <div className="dz-small" style={{ marginTop: 4, fontSize: 12 }}>
                {tStep2('bioHelp')}
              </div>
            </div>
            <div>
              <label htmlFor="avatarUrl" className="dz-label">{tStep2('avatarUrlLabel')}</label>
              <input
                id="avatarUrl"
                type="url"
                className="dz-input"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder={tStep2('avatarUrlPlaceholder')}
                maxLength={2000}
              />
              <div className="dz-small" style={{ marginTop: 4, fontSize: 12 }}>
                {tStep2('avatarUrlHelp')}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="dz-small" style={{ fontSize: 13 }}>
              {tStep3('defaultsLabel')}
            </div>
            {channels.length === 0 ? (
              <div className="dz-small" style={{ fontSize: 13, color: 'rgba(0,0,0,0.6)' }}>
                {tStep3('noneSelected')}
              </div>
            ) : (
              <ul style={{ display: 'grid', gap: 8, listStyle: 'none', padding: 0, margin: 0 }}>
                {channels.map((c) => {
                  const checked = pickedChannels.has(c.slug);
                  return (
                    <li key={c.slug}>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 14px',
                          borderRadius: 12,
                          border: '1px solid rgba(115,1,255,0.18)',
                          background: checked ? 'rgba(115,1,255,0.06)' : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleChannel(c.slug)}
                          style={{ accentColor: '#7301FF', width: 18, height: 18 }}
                        />
                        <span style={{ fontSize: 14, fontWeight: 600 }}>
                          {c.emoji ? `${c.emoji} ` : ''}#{c.slug}
                        </span>
                        <span className="dz-small" style={{ fontSize: 12 }}>{c.name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            {pickedChannels.size === 0 && (
              <div className="dz-small" style={{ fontSize: 12 }}>
                {tStep3('noneSelected')}
              </div>
            )}

            <div
              className="dz-glass"
              style={{ padding: 14, marginTop: 12, borderRadius: 12 }}
            >
              <div className="dz-small" style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                {tSummary('stepTitle')}
              </div>
              <ul className="dz-small" style={{ fontSize: 13, listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
                <li>
                  <strong>{tSummary('handleLabel')} :</strong> @{handleNormalized || '—'}
                </li>
                <li>
                  <strong>{tSummary('displayNameLabel')} :</strong> {displayName.trim() || tSummary('noDisplayName')}
                </li>
                <li>
                  <strong>{tSummary('bioLabel')} :</strong>{' '}
                  {bio.trim().length > 0 ? `${bio.trim().slice(0, 80)}${bio.trim().length > 80 ? '…' : ''}` : tSummary('noBio')}
                </li>
                <li>
                  <strong>{tSummary('channelsLabel')} :</strong> {Array.from(pickedChannels).map((s) => `#${s}`).join(', ') || '—'}
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

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
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          marginTop: 28,
        }}
      >
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0 || pending}
          className="dz-btn dz-btn-ghost"
          style={{ visibility: step === 0 ? 'hidden' : 'visible' }}
        >
          {tActions('back')}
        </button>
        {step < totalSteps - 1 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={pending}
            className="dz-btn dz-btn-primary"
          >
            {tActions('next')}
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="dz-btn dz-btn-primary"
            style={{ minWidth: 200, opacity: pending ? 0.7 : 1 }}
          >
            {tActions('finish')}
          </button>
        )}
      </div>

      <div style={{ marginTop: 20, fontSize: 12 }} className="dz-small">
        <Link href="/community">{t('alreadyMember')} {t('goToFeed')}</Link>
      </div>
    </div>
  );
}

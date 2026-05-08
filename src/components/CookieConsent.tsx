'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCookieConsent } from './CookieConsentProvider';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';

/* ------------------------------------------------------------------
   Inline switch — violet brand, accessible, no extra css file
   ------------------------------------------------------------------ */
function ConsentSwitch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange?: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      style={{
        position: 'relative',
        width: 46,
        height: 26,
        borderRadius: 999,
        border: '1px solid rgba(115,1,255,0.20)',
        background: checked
          ? 'linear-gradient(135deg, #7301FF 0%, #A34BF5 100%)'
          : 'rgba(115,1,255,0.10)',
        boxShadow: checked
          ? '0 6px 18px rgba(115,1,255,0.35), 0 1px 0 rgba(255,255,255,0.45) inset'
          : 'inset 0 1px 2px rgba(0,0,0,0.04)',
        transition: 'background .25s, box-shadow .25s, opacity .2s',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        padding: 0,
        flex: '0 0 auto',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 22 : 2,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 2px 6px rgba(36,50,95,0.25)',
          transition: 'left .25s cubic-bezier(.2,.9,.3,1.2)',
        }}
      />
    </button>
  );
}

/* ------------------------------------------------------------------
   Cookie icon for the floating button
   ------------------------------------------------------------------ */
function CookieIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21.6 12.3A9 9 0 1 1 11.7 2.4a4 4 0 0 0 4.3 5.6 4 4 0 0 0 5.6 4.3Z" />
      <path d="M9 11.5h.01M13 16.5h.01M16.5 12h.01M8 7.5h.01" />
    </svg>
  );
}

export default function CookieConsent() {
  const t = useTranslations('cookies');
  const {
    hasDecided,
    isHydrated,
    acceptAll,
    rejectAll,
    setPartial,
    openPreferences,
    closePreferences,
    isPreferencesOpen,
    consent,
  } = useCookieConsent();

  // Local form state for the modal toggles
  const [prefPref, setPrefPref] = useState<boolean>(true);
  const [prefAnalytics, setPrefAnalytics] = useState<boolean>(false);

  // Sync modal toggles with current consent each time it opens
  useEffect(() => {
    if (isPreferencesOpen) {
      setPrefPref(consent?.preferences ?? true);
      setPrefAnalytics(consent?.analytics ?? false);
    }
  }, [isPreferencesOpen, consent]);

  // Lock body scroll when modal is open (shared, ref-counted)
  useScrollLock(isPreferencesOpen);

  // Trap focus inside the preferences dialog while open (WCAG 2.4.3).
  const dialogRef = useFocusTrap<HTMLDivElement>(isPreferencesOpen);

  // Close on Escape
  useEffect(() => {
    if (!isPreferencesOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePreferences();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPreferencesOpen, closePreferences]);

  // SSR-safe: render nothing until hydrated
  if (!isHydrated) return null;

  const showBanner = !hasDecided && !isPreferencesOpen;

  return (
    <>
      {/* ------------------------------------------------------------------
          Banner
          ------------------------------------------------------------------ */}
      {showBanner && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label={t('banner.title')}
          className="dz-glass-strong"
          style={{
            position: 'fixed',
            left: 16,
            right: 16,
            bottom: 16,
            zIndex: 1000,
            padding: 22,
            maxWidth: 1080,
            margin: '0 auto',
            borderRadius: 24,
            display: 'flex',
            gap: 20,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 320px', minWidth: 260 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--brand-violet)',
                marginBottom: 8,
              }}
            >
              <CookieIcon size={14} />
              {t('banner.title')}
            </div>
            <p className="dz-body" style={{ fontSize: 15, marginBottom: 8 }}>
              {t('banner.body')}
            </p>
            <Link
              href="/cookies"
              style={{
                color: 'var(--brand-violet)',
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              {t('banner.learnMore')}
            </Link>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
              flex: '0 1 auto',
            }}
          >
            <button
              type="button"
              className="dz-btn dz-btn-ghost"
              onClick={rejectAll}
            >
              {t('banner.rejectAll')}
            </button>
            <button
              type="button"
              className="dz-btn dz-btn-ghost"
              onClick={openPreferences}
            >
              {t('banner.customize')}
            </button>
            <button
              type="button"
              className="dz-btn dz-btn-primary"
              onClick={acceptAll}
            >
              {t('banner.acceptAll')}
            </button>
          </div>
        </div>
      )}

      {/* The floating "Manage cookies" pill used to live here pinned
          bottom-left, but it overlapped the community sidebar user
          card and felt visually cluttered. Cookie preferences remain
          fully reachable from the /cookies page via
          <ManagePreferencesButton /> in the footer-linked policy
          page — which is the canonical CNIL-compliant access point. */}

      {/* ------------------------------------------------------------------
          Preferences modal
          ------------------------------------------------------------------ */}
      {isPreferencesOpen && (
        <div
          role="presentation"
          onClick={closePreferences}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(15, 10, 46, 0.45)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dz-cookie-pref-title"
            onClick={(e) => e.stopPropagation()}
            className="dz-glass-strong"
            style={{
              width: '100%',
              maxWidth: 520,
              padding: 28,
              borderRadius: 24,
              maxHeight: 'calc(100vh - 32px)',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
              <div>
                <h2
                  id="dz-cookie-pref-title"
                  className="dz-h3"
                  style={{ fontSize: 24, marginBottom: 4 }}
                >
                  {t('preferences.title')}
                </h2>
                <p className="dz-small" style={{ color: 'var(--ink-muted)' }}>
                  {t('preferences.subtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={closePreferences}
                aria-label={t('preferences.close')}
                style={{
                  background: 'rgba(115,1,255,0.08)',
                  border: '1px solid rgba(115,1,255,0.16)',
                  borderRadius: 999,
                  width: 32,
                  height: 32,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--brand-violet)',
                  cursor: 'pointer',
                  flex: '0 0 auto',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
              {/* Essential — always on, disabled */}
              <article
                style={{
                  display: 'flex',
                  gap: 16,
                  alignItems: 'center',
                  padding: 16,
                  borderRadius: 18,
                  background: 'rgba(115,1,255,0.05)',
                  border: '1px solid rgba(115,1,255,0.12)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                    {t('preferences.essentialTitle')}
                  </h3>
                  <p className="dz-small" style={{ fontSize: 13, color: 'var(--ink-muted)', margin: 0 }}>
                    {t('preferences.essentialDesc')}
                  </p>
                </div>
                <ConsentSwitch
                  checked
                  disabled
                  label={t('preferences.essentialTitle')}
                />
              </article>

              {/* Preferences */}
              <article
                style={{
                  display: 'flex',
                  gap: 16,
                  alignItems: 'center',
                  padding: 16,
                  borderRadius: 18,
                  background: 'rgba(255,255,255,0.45)',
                  border: '1px solid rgba(115,1,255,0.10)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                    {t('preferences.preferencesTitle')}
                  </h3>
                  <p className="dz-small" style={{ fontSize: 13, color: 'var(--ink-muted)', margin: 0 }}>
                    {t('preferences.preferencesDesc')}
                  </p>
                </div>
                <ConsentSwitch
                  checked={prefPref}
                  onChange={setPrefPref}
                  label={t('preferences.preferencesTitle')}
                />
              </article>

              {/* Analytics */}
              <article
                style={{
                  display: 'flex',
                  gap: 16,
                  alignItems: 'center',
                  padding: 16,
                  borderRadius: 18,
                  background: 'rgba(255,255,255,0.45)',
                  border: '1px solid rgba(115,1,255,0.10)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                    {t('preferences.analyticsTitle')}
                  </h3>
                  <p className="dz-small" style={{ fontSize: 13, color: 'var(--ink-muted)', margin: 0 }}>
                    {t('preferences.analyticsDesc')}
                  </p>
                </div>
                <ConsentSwitch
                  checked={prefAnalytics}
                  onChange={setPrefAnalytics}
                  label={t('preferences.analyticsTitle')}
                />
              </article>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
                marginTop: 22,
              }}
            >
              <button
                type="button"
                className="dz-btn dz-btn-ghost"
                onClick={rejectAll}
              >
                {t('banner.rejectAll')}
              </button>
              <button
                type="button"
                className="dz-btn dz-btn-primary"
                onClick={() => setPartial({ preferences: prefPref, analytics: prefAnalytics })}
              >
                {t('preferences.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

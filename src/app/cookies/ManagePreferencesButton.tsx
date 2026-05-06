'use client';

import { useTranslations } from 'next-intl';
import { useCookieConsent } from '@/components/CookieConsentProvider';

export default function ManagePreferencesButton() {
  const t = useTranslations('cookies');
  const { openPreferences } = useCookieConsent();

  return (
    <button
      type="button"
      className="dz-btn dz-btn-primary"
      onClick={openPreferences}
      style={{ marginTop: 14 }}
    >
      {t('preferences.reopen')}
    </button>
  );
}

'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { subscribeNewsletter, type NewsletterState } from '@/lib/actions/newsletter';

const initialState: NewsletterState = { status: 'idle' };

/**
 * Inscription form for the dedicated /newsletter page. Mirrors the
 * Pixel Mensuel mockup: prénom + email on one row, profile chips on
 * the next, full-width primary CTA. Wires to the existing
 * `subscribeNewsletter` server action — `source` is set to
 * `newsletter-page` so admin can trace acquisition funnels.
 *
 * The selected profile chip is purely cosmetic at the moment (the
 * server action doesn't persist it yet); we still send it via a
 * hidden input so the persisted source string carries the segment,
 * which lets analytics queries split signups by audience without
 * a schema change.
 */
export default function NewsletterPageForm() {
  const t = useTranslations('newsletterPage.form');
  const profiles = (t.raw('profiles') as string[]) ?? [];
  const [profileIdx, setProfileIdx] = useState(0);
  const [state, formAction, pending] = useActionState(subscribeNewsletter, initialState);

  // Build the source string so the server stores e.g. "newsletter-page:Étudiant·e".
  const source = `newsletter-page${profiles[profileIdx] ? `:${profiles[profileIdx]}` : ''}`;

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column' }}>
      <input type="hidden" name="source" value={source} />

      <div className="dz-newsletter-form-row" style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <label htmlFor="newsletter-firstname" className="dz-sr-only">
          {t('firstNameLabel')}
        </label>
        <input
          id="newsletter-firstname"
          className="dz-input"
          name="firstName"
          placeholder={t('firstNamePlaceholder')}
          maxLength={80}
          autoComplete="given-name"
          disabled={pending}
          style={{ flex: 1 }}
        />
        <label htmlFor="newsletter-email" className="dz-sr-only">
          {t('emailLabel')}
        </label>
        <input
          id="newsletter-email"
          className="dz-input"
          name="email"
          placeholder={t('emailPlaceholder')}
          type="email"
          required
          maxLength={200}
          autoComplete="email"
          disabled={pending}
          style={{ flex: 2 }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 12, marginRight: 4, fontWeight: 600 }}>
          {t('profilePrefix')}
        </span>
        {profiles.map((p, i) => (
          <button
            key={p}
            type="button"
            onClick={() => setProfileIdx(i)}
            className={`dz-btn dz-btn-sm ${i === profileIdx ? 'dz-btn-primary' : 'dz-btn-ghost'}`}
            aria-pressed={i === profileIdx}
            disabled={pending}
          >
            {p}
          </button>
        ))}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="dz-btn dz-btn-primary dz-btn-lg"
        style={{ width: '100%', opacity: pending ? 0.7 : 1 }}
      >
        {pending ? t('submitting') : t('submit')}
      </button>

      {state.status === 'success' && (
        <div role="status" style={{ fontSize: 13, color: '#108a48', marginTop: 12, textAlign: 'center' }}>
          {t('success')}
        </div>
      )}
      {state.status === 'error' && (
        <div role="alert" style={{ fontSize: 13, color: '#a8235e', marginTop: 12, textAlign: 'center' }}>
          {state.error || t('errorGeneric')}
        </div>
      )}
    </form>
  );
}

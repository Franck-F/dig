'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { subscribeNewsletter, type NewsletterState } from '@/lib/actions/newsletter';

const initialState: NewsletterState = { status: 'idle' };

export default function NewsletterInline() {
  const t = useTranslations('blog.newsletter');
  const [state, formAction, pending] = useActionState(subscribeNewsletter, initialState);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 480, margin: '0 auto' }}>
      <input type="hidden" name="source" value="blog" />
      <label htmlFor="newsletter-email" className="dz-sr-only">
        {t('label')}
      </label>
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          id="newsletter-email"
          className="dz-input"
          name="email"
          placeholder={t('placeholder')}
          type="email"
          required
          maxLength={200}
          autoComplete="email"
          disabled={pending}
        />
        <button type="submit" disabled={pending} className="dz-btn dz-btn-primary" style={{ opacity: pending ? 0.7 : 1 }}>
          {pending ? t('submitting') : t('submit')}
        </button>
      </div>
      {state.status === 'success' && (
        <div role="status" style={{ fontSize: 13, color: '#108a48' }}>{t('success')}</div>
      )}
      {state.status === 'error' && (
        <div role="alert" style={{ fontSize: 13, color: '#a8235e' }}>{t('error', { error: state.error })}</div>
      )}
    </form>
  );
}

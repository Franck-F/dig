'use client';

import { useActionState, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { submitContact, type ContactState } from '@/lib/actions/contact';

// Each tuple: [translation key for label, ContactSubject enum value sent to server]
const SUBJECTS = [
  ['join', 'ADHERER'],
  ['partnership', 'PARTENARIAT'],
  ['mentor', 'MENTOR'],
  ['press', 'PRESSE'],
  ['other', 'AUTRE'],
] as const;
type SubjectKey = (typeof SUBJECTS)[number][1];

// Translation key → enum value, used to honour `?subject=...` URL param
// (e.g. /contact?subject=event maps to AUTRE since the Prisma enum has no
// dedicated "event" variant yet).
const SUBJECT_FROM_PARAM: Record<string, SubjectKey> = {
  join: 'ADHERER',
  partnership: 'PARTENARIAT',
  mentor: 'MENTOR',
  press: 'PRESSE',
  other: 'AUTRE',
  event: 'AUTRE',
};

const initialState: ContactState = { status: 'idle' };

export default function ContactForm() {
  const t = useTranslations('contact.form');
  const searchParams = useSearchParams();
  const [subject, setSubject] = useState<SubjectKey>('ADHERER');
  const [state, formAction, pending] = useActionState(submitContact, initialState);

  // Pre-fill subject and message body from URL params (e.g. when arriving
  // from /events).
  const eventKey = searchParams.get('event') ?? '';
  const subjectParam = searchParams.get('subject') ?? '';
  const prefillMessage =
    subjectParam === 'event' && eventKey
      ? `Je souhaite m'inscrire à l'événement « ${eventKey} ».`
      : '';

  useEffect(() => {
    const mapped = SUBJECT_FROM_PARAM[subjectParam];
    if (mapped) setSubject(mapped);
  }, [subjectParam]);

  return (
    <form action={formAction} className="dz-glass-strong" style={{ padding: 40, borderRadius: 28 }}>
      <h2 className="dz-h3">{t('title')}</h2>
      <p className="dz-small" style={{ marginTop: 6 }}>
        {t('subtitle')}
      </p>

      <div style={{ marginTop: 24, display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label htmlFor="contact-firstname" className="dz-label">{t('firstName')}</label>
            <input id="contact-firstname" name="firstName" className="dz-input" placeholder={t('firstNamePlaceholder')} required maxLength={80} />
          </div>
          <div>
            <label htmlFor="contact-lastname" className="dz-label">{t('lastName')}</label>
            <input id="contact-lastname" name="lastName" className="dz-input" placeholder={t('lastNamePlaceholder')} required maxLength={80} />
          </div>
        </div>
        <div>
          <label htmlFor="contact-email" className="dz-label">{t('email')}</label>
          <input id="contact-email" name="email" type="email" className="dz-input" placeholder={t('emailPlaceholder')} required maxLength={200} />
        </div>
        <div>
          <span className="dz-label">{t('subject')}</span>
          <input type="hidden" name="subject" value={subject} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SUBJECTS.map(([labelKey, value]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSubject(value)}
                className={`dz-btn dz-btn-sm ${value === subject ? 'dz-btn-primary' : 'dz-btn-ghost'}`}
              >
                {t(`subjects.${labelKey}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="contact-message" className="dz-label">{t('message')}</label>
          <textarea
            id="contact-message"
            name="message"
            className="dz-input"
            rows={5}
            placeholder={t('messagePlaceholder')}
            required
            minLength={10}
            maxLength={4000}
            defaultValue={prefillMessage}
            key={prefillMessage}
          />
        </div>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: '#545b7a' }}>
          <input type="checkbox" name="consent" required style={{ marginTop: 3 }} />
          {t('consent')}
        </label>
        <button type="submit" disabled={pending} className="dz-btn dz-btn-primary dz-btn-lg" style={{ width: '100%', opacity: pending ? 0.7 : 1 }}>
          {pending ? t('submitting') : t('submit')}
        </button>

        {state.status === 'success' && (
          <div role="status" style={{ padding: 14, borderRadius: 12, background: 'rgba(35,197,94,0.10)', color: '#108a48', fontSize: 14 }}>
            {t('success')}
          </div>
        )}
        {state.status === 'error' && (
          <div role="alert" style={{ padding: 14, borderRadius: 12, background: 'rgba(217,78,146,0.10)', color: '#a8235e', fontSize: 14 }}>
            {t('error', { error: state.error ?? '' })}
          </div>
        )}
      </div>
    </form>
  );
}

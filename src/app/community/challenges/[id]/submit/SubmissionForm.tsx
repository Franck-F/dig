'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { submitChallenge } from '@/lib/actions/community/challenges';

type Props = {
  challengeId: string;
  backHref: string;
};

/**
 * Client island for the challenge submission form. Calls the
 * `submitChallenge` server action and bounces back to the challenge detail
 * page on success.
 */
export default function SubmissionForm({ challengeId, backHref }: Props) {
  const t = useTranslations('community.challenges.submit');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [projectUrl, setProjectUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (title.trim().length === 0 || body.trim().length === 0) {
      setError('Titre et description requis.');
      return;
    }
    startTransition(async () => {
      try {
        const res = await submitChallenge({
          challengeId,
          title: title.trim(),
          body: body.trim(),
          projectUrl: projectUrl.trim() || undefined,
        });
        if (res.status === 'error') {
          if (res.error === 'community.errors.duplicateSubmission') {
            setError(t('alreadySubmitted'));
          } else if (res.error === 'community.errors.challengeClosed') {
            setError(t('challengeNotOpen'));
          } else {
            setError(res.error);
          }
          return;
        }
        router.push(backHref);
        router.refresh();
      } catch {
        setError(t('challengeNotOpen'));
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="dz-glass-strong" style={{ padding: 28, borderRadius: 24, display: 'grid', gap: 16 }}>
      <div>
        <label htmlFor="title" className="dz-label">{t('titleLabel')}</label>
        <input
          id="title"
          type="text"
          className="dz-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('titlePlaceholder')}
          maxLength={120}
          required
        />
      </div>
      <div>
        <label htmlFor="body" className="dz-label">{t('bodyLabel')}</label>
        <textarea
          id="body"
          rows={10}
          className="dz-input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('bodyPlaceholder')}
          maxLength={6000}
          required
        />
        <div className="dz-small" style={{ marginTop: 4, fontSize: 12 }}>
          {t('bodyHelp')}
        </div>
      </div>
      <div>
        <label htmlFor="projectUrl" className="dz-label">{t('projectUrlLabel')}</label>
        <input
          id="projectUrl"
          type="url"
          className="dz-input"
          value={projectUrl}
          onChange={(e) => setProjectUrl(e.target.value)}
          placeholder={t('projectUrlPlaceholder')}
          maxLength={2000}
        />
        <div className="dz-small" style={{ marginTop: 4, fontSize: 12 }}>
          {t('projectUrlHelp')}
        </div>
      </div>

      <div className="dz-glass" style={{ padding: 14, borderRadius: 12 }}>
        <div className="dz-small" style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
          {t('guidanceTitle')}
        </div>
        <ul className="dz-small" style={{ margin: 0, paddingLeft: 16, fontSize: 12, display: 'grid', gap: 4 }}>
          <li>{t('guidanceBullets.0')}</li>
          <li>{t('guidanceBullets.1')}</li>
          <li>{t('guidanceBullets.2')}</li>
        </ul>
      </div>

      {error && (
        <div role="alert" style={{ padding: 12, borderRadius: 12, background: 'rgba(217,78,146,0.10)', color: '#a8235e', fontSize: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
        <Link href={backHref} className="dz-btn dz-btn-ghost">
          {t('cancel')}
        </Link>
        <button type="submit" className="dz-btn dz-btn-primary" disabled={pending} style={{ minWidth: 200, opacity: pending ? 0.7 : 1 }}>
          {pending ? '...' : t('submit')}
        </button>
      </div>
    </form>
  );
}

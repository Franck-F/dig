import Link from 'next/link';
import type { MentorStatus } from '@prisma/client';
import { getTranslations } from 'next-intl/server';
import { mentorApplicationState } from '@/lib/mentora/mentor-application';

/**
 * Status card for a mentor candidate (B6): in review, sent back with the
 * admin's note, or still a draft. Renders nothing once the profile is
 * approved.
 */
export default async function MentorApplicationStatus({
  status,
  reviewNote,
}: {
  status: MentorStatus;
  reviewNote: string | null;
}) {
  const state = mentorApplicationState({ status, reviewNote });
  if (!state) return null;
  const t = await getTranslations('mentora.dashboard.application');

  return (
    <section className="dz-card" style={{ padding: 28 }}>
      <h1 className="dz-h2" style={{ fontSize: 22 }}>{t(`${state}.title`)}</h1>
      <p className="dz-body" style={{ marginTop: 8 }}>{t(`${state}.body`)}</p>
      {state === 'rejected' && reviewNote && (
        <div className="dz-body" style={{ marginTop: 16 }}>
          <strong>{t('reviewNoteLabel')}</strong>
          <p style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{reviewNote}</p>
        </div>
      )}
      <Link
        href="/mentora/dashboard/profile/edit"
        className="dz-btn dz-btn-primary dz-btn-sm"
        style={{ marginTop: 16, display: 'inline-flex' }}
      >
        {t(state === 'inReview' ? 'viewCta' : 'editCta')}
      </Link>
    </section>
  );
}

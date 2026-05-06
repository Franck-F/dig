import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import NotesClient from './NotesClient';

/**
 * Notes tab — Mentorship-level shared + private notes.
 *
 * v1 stores notes on the most-recent Session; future revisions can promote a
 * dedicated `MentorshipNotes` row. We surface the latest session's notes by
 * default and keep both the shared field (visible to mentor + mentee) and the
 * private mentor-only field. If no session exists yet we explain it inline.
 */
export default async function NotesTab({
  mentorshipId,
  iAmMentor,
  isLocked,
}: {
  mentorshipId: string;
  iAmMentor: boolean;
  isLocked: boolean;
}) {
  const t = await getTranslations('mentora.mentorships.detail');

  const latestSession = await prisma.session.findFirst({
    where: { mentorshipId },
    orderBy: { scheduledAt: 'desc' },
    select: { id: true, sharedNotes: true, mentorNotesPrivate: true },
  });

  return (
    <div className="dz-card" style={{ padding: 24 }}>
      {!latestSession ? (
        <>
          <h2 className="dz-h2" style={{ fontSize: 18, marginBottom: 8 }}>{t('notesTitle')}</h2>
          <p className="dz-body">
            {/* Notes attach to a session — encourage scheduling one first. */}
            {t('sessionsEmpty')}
          </p>
        </>
      ) : (
        <NotesClient
          sessionId={latestSession.id}
          shared={latestSession.sharedNotes ?? ''}
          privateMentor={latestSession.mentorNotesPrivate ?? ''}
          iAmMentor={iAmMentor}
          isLocked={isLocked}
        />
      )}
    </div>
  );
}

import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { fmtDate } from '../../../_components/format';
import GoalsClient from './GoalsClient';

/**
 * Goals tab — server-renders the list, client island handles add + toggle.
 *
 * MentorshipGoal is a simple list of free-form descriptions, optionally tied
 * to a Skill. v1 keeps it minimal: add-text-only and a "mark achieved" toggle.
 */
export default async function GoalsTab({
  mentorshipId,
  isLocked,
}: {
  mentorshipId: string;
  isLocked: boolean;
}) {
  const t = await getTranslations('mentora.mentorships.detail');

  const goals = await prisma.mentorshipGoal.findMany({
    where: { mentorshipId },
    include: { skill: true },
    orderBy: [{ isAchieved: 'asc' }, { createdAt: 'asc' }],
  });

  const goalsForClient = goals.map((g) => ({
    id: g.id,
    description: g.description,
    isAchieved: g.isAchieved,
    achievedAt: g.achievedAt ? fmtDate(g.achievedAt) : null,
    skillName: g.skill?.name ?? null,
  }));

  return (
    <div className="dz-card" style={{ padding: 24 }}>
      <h2 className="dz-h2" style={{ fontSize: 18, marginBottom: 12 }}>{t('goalsTitle')}</h2>
      <GoalsClient mentorshipId={mentorshipId} goals={goalsForClient} isLocked={isLocked} />
    </div>
  );
}

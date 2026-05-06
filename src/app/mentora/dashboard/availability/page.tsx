import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentRoleProfile } from '@/lib/mentora/getCurrentRoleProfile';
import AvailabilityEditor from './AvailabilityEditor';
import ExceptionsList from './ExceptionsList';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('mentora.availability');
  return { title: t('metaTitle') };
}

export default async function AvailabilityPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect('/login?next=/mentora/dashboard/availability');

  const role = await getCurrentRoleProfile(userId);
  if (role.kind !== 'mentor') {
    redirect('/mentora/become-a-mentor');
  }

  const t = await getTranslations('mentora.availability');
  const mentorProfileId = role.mentorProfile.id;

  // Fetch rules + exceptions; exceptions sorted by upcoming dates first.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [rules, exceptions] = await Promise.all([
    prisma.availabilityRule.findMany({
      where: { mentorProfileId },
      orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
    }),
    prisma.availabilityException.findMany({
      where: { mentorProfileId, date: { gte: today } },
      orderBy: { date: 'asc' },
    }),
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <header>
        <h1 className="dz-h2" style={{ fontSize: 36 }}>{t('title')}</h1>
        <p className="dz-small" style={{ marginTop: 8, maxWidth: 720 }}>{t('subtitle')}</p>
        <p className="dz-small" style={{ marginTop: 4 }}>
          {t('timezoneLabel', { tz: role.mentorProfile.timezone })}
        </p>
      </header>

      <section>
        <h2 className="dz-h3" style={{ fontSize: 22, marginBottom: 12 }}>{t('weeklyTitle')}</h2>
        <AvailabilityEditor
          initialRules={rules.map((r) => ({
            id: r.id,
            dayOfWeek: r.dayOfWeek,
            startMinute: r.startMinute,
            endMinute: r.endMinute,
          }))}
          mentorTimezone={role.mentorProfile.timezone}
        />
      </section>

      <section>
        <h2 className="dz-h3" style={{ fontSize: 22, marginBottom: 12 }}>{t('exceptionsTitle')}</h2>
        <ExceptionsList
          initialExceptions={exceptions.map((e) => ({
            id: e.id,
            date: e.date.toISOString().slice(0, 10),
            startMinute: e.startMinute,
            endMinute: e.endMinute,
            kind: e.kind,
            note: e.note,
          }))}
        />
      </section>
    </div>
  );
}

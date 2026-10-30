import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentRoleProfile } from '@/lib/mentora/getCurrentRoleProfile';
import MentorProfileForm from './MentorProfileForm';
import MentorProfilePreview from './MentorProfilePreview';
import AvailabilityEditor from './AvailabilityEditor';
import ExceptionsList from './ExceptionsList';
import ScrollToHashSection from './ScrollToHashSection';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('mentora.profileEdit');
  return { title: t('mentorTitle') };
}

/**
 * `/mentora/dashboard/profile/edit` — unified profile editor entry point.
 *
 * Previously this page was mentor-only and redirected every other role back to
 * the dashboard, which created a loop when the sidebar profile card linked
 * here for mentees. Now it dispatches per role:
 *
 *   - Mentor with profile  → render the mentor form (full-blown editor with
 *                            preview, skills, photo, languages, availability).
 *   - Mentee with profile  → forward to the onboarding wizard reopened with
 *                            ?edit=1 so the same form she filled at signup is
 *                            reused for editing. No duplicate UI to maintain.
 *   - No profile yet       → push to the relevant onboarding entry point.
 */
export default async function ProfileEditPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect('/login?next=/mentora/dashboard/profile/edit');

  const role = await getCurrentRoleProfile(userId);

  if (role.kind === 'mentee') {
    redirect('/mentora/onboarding?edit=1');
  }

  if (role.kind !== 'mentor') {
    // No role profile yet — onboarding entry point.
    redirect('/mentora/onboarding');
  }

  // Upcoming exceptions only — past blackout days are noise in settings.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Re-fetch profile with skill names + reviews aggregate for preview, plus
  // the availability rules/exceptions (the standalone availability page was
  // folded into this settings page).
  const [profile, allSkills, ratingAgg, rules, exceptions, tAvail] = await Promise.all([
    prisma.mentorProfile.findUnique({
      where: { id: role.mentorProfile.id },
      include: {
        skills: { include: { skill: true } },
      },
    }),
    prisma.skill.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
    prisma.review.aggregate({
      where: { mentorship: { mentorProfileId: role.mentorProfile.id }, isPublic: true },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.availabilityRule.findMany({
      where: { mentorProfileId: role.mentorProfile.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
    }),
    prisma.availabilityException.findMany({
      where: { mentorProfileId: role.mentorProfile.id, date: { gte: today } },
      orderBy: { date: 'asc' },
    }),
    getTranslations('mentora.availability'),
  ]);

  if (!profile) redirect('/mentora/become-a-mentor');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <MentorProfileForm
        initial={{
          headline: profile.headline,
          bio: profile.bio,
          yearsExperience: profile.yearsExperience,
          hourlyRate: profile.hourlyRate,
          timezone: profile.timezone,
          location: profile.location,
          photoUrl: profile.photoUrl,
          linkedinUrl: profile.linkedinUrl,
          languages: profile.languages,
          isAcceptingMentees: profile.isAcceptingMentees,
          maxConcurrentMentees: profile.maxConcurrentMentees,
          responseTime: profile.responseTime,
          status: profile.status,
        }}
        skills={profile.skills.map((s) => ({
          skillId: s.skillId,
          name: s.skill.name,
          category: s.skill.category,
          level: s.level,
          yearsOfPractice: s.yearsOfPractice,
          isFeatured: s.isFeatured,
        }))}
        skillCatalog={allSkills.map((s) => ({ id: s.id, name: s.name, category: s.category }))}
        preview={
          <MentorProfilePreview
            headline={profile.headline}
            bio={profile.bio}
            yearsExperience={profile.yearsExperience}
            hourlyRate={profile.hourlyRate}
            timezone={profile.timezone}
            location={profile.location}
            photoUrl={profile.photoUrl}
            linkedinUrl={profile.linkedinUrl}
            languages={profile.languages}
            featuredSkills={profile.skills.filter((s) => s.isFeatured).map((s) => s.skill.name)}
            avgRating={ratingAgg._avg.rating}
            reviewCount={ratingAgg._count._all}
          />
        }
      />

      <section
        id="disponibilites"
        className="dz-card"
        style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, scrollMarginTop: 96 }}
      >
        <ScrollToHashSection id="disponibilites" />
        <header>
          <h2 className="dz-h3" style={{ fontSize: 24 }}>{tAvail('title')}</h2>
          <p className="dz-small" style={{ marginTop: 6, maxWidth: 720 }}>{tAvail('subtitle')}</p>
          <p className="dz-small" style={{ marginTop: 4 }}>
            {tAvail('timezoneLabel', { tz: profile.timezone })}
          </p>
        </header>
        <div>
          <h3 className="dz-h3" style={{ fontSize: 18, marginBottom: 12 }}>{tAvail('weeklyTitle')}</h3>
          <AvailabilityEditor
            initialRules={rules.map((r) => ({
              id: r.id,
              dayOfWeek: r.dayOfWeek,
              startMinute: r.startMinute,
              endMinute: r.endMinute,
            }))}
            mentorTimezone={profile.timezone}
          />
        </div>
        <div>
          <h3 className="dz-h3" style={{ fontSize: 18, marginBottom: 12 }}>{tAvail('exceptionsTitle')}</h3>
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
        </div>
      </section>
    </div>
  );
}

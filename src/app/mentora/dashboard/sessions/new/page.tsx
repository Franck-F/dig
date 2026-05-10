import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getAvailableSlots } from '@/lib/mentora/scheduling';
import SlotPicker from './SlotPicker';

/**
 * "Schedule a session" page.
 *
 * Two-pane layout:
 *  Left  — list of the user's ACTIVE mentorships, click to select.
 *  Right — slot picker for the chosen mentorship (server-rendered list of
 *           availability windows over the next 14 days).
 *
 * Selection is propagated via the `mentorshipId` query string. Default
 * duration is 45 min (matches Prisma `Session.durationMinutes` default).
 */
export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ mentorshipId?: string; duration?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/mentora/dashboard/sessions/new');

  const t = await getTranslations('mentora.sessions.new');

  const sp = await searchParams;
  const userId = session.user.id;
  const durationMinutes = clampDuration(parseInt(sp.duration ?? '45', 10) || 45);

  // Single round-trip: pull active mentorships AND the viewer's role
  // profiles so the empty-state copy can speak to "no active mentees"
  // (mentor) vs "no mentor yet" (mentee). Without this we'd default to
  // a generic "rien à afficher" which the user flagged as confusing.
  const [mentorships, viewer] = await Promise.all([
    prisma.mentorship.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { mentorProfile: { userId } },
          { menteeProfile: { userId } },
        ],
      },
      include: {
        mentorProfile: { include: { user: true } },
        menteeProfile: { include: { user: true } },
      },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        mentorProfile: { select: { id: true } },
        menteeProfile: { select: { id: true } },
      },
    }),
  ]);

  const viewerIsMentor = Boolean(viewer?.mentorProfile);

  const selectedId = sp.mentorshipId ?? mentorships[0]?.id ?? null;
  const selected = mentorships.find((m) => m.id === selectedId) ?? null;
  const iAmMentor = selected ? selected.mentorProfile.userId === userId : false;

  // Fetch slots best-effort. If `getAvailableSlots` is not yet exported by the
  // lib (Agent 2B-2), or its arg shape drifts during integration, degrade to
  // an empty list — the SlotPicker shows an empty state in that case.
  let slots: { startsAt: string; endsAt: string }[] = [];
  if (selected) {
    try {
      // Cast through `unknown` so we don't depend on the exact argument
      // contract while the upstream lib stabilizes.
      const callable = getAvailableSlots as unknown as (
        args: { mentorProfileId: string; durationMinutes: number; horizonDays: number },
      ) => Promise<unknown>;
      const raw = await callable({
        mentorProfileId: selected.mentorProfileId,
        durationMinutes,
        horizonDays: 14,
      });
      const list = (raw as unknown) as { startsAt: Date | string; endsAt: Date | string }[];
      if (Array.isArray(list)) {
        slots = list.map((s) => ({
          startsAt: typeof s.startsAt === 'string' ? s.startsAt : s.startsAt.toISOString(),
          endsAt: typeof s.endsAt === 'string' ? s.endsAt : s.endsAt.toISOString(),
        }));
      }
    } catch {
      slots = [];
    }
  }

  // ── Zero-mentorship empty state ──────────────────────────────────────
  // Replaces the previous two-pane "Rien à afficher" + "Sélectionnez un
  // mentorat" split (which said different things about the same situation
  // and didn't suggest a next step). One focused message, role-adapted,
  // with a CTA to the page that unblocks the user.
  if (mentorships.length === 0) {
    const headline = viewerIsMentor
      ? t('noMentorshipsMentor')
      : t('noMentorshipsMentee');
    const sub = viewerIsMentor
      ? t('noMentorshipsMentorSub')
      : t('noMentorshipsMenteeSub');
    const ctaHref = viewerIsMentor
      ? '/mentora/dashboard/requests'
      : '/mentora/discover';
    const ctaLabel = viewerIsMentor
      ? t('noMentorshipsMentorCta')
      : t('noMentorshipsMenteeCta');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="dz-card" style={{ padding: 24 }}>
          <h1 className="dz-h2" style={{ fontSize: 24 }}>
            {t('title')}
          </h1>
          <p className="dz-body" style={{ marginTop: 6 }}>
            {t('subtitle')}
          </p>
        </div>
        <div
          className="dz-card"
          style={{
            padding: '48px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 14,
          }}
        >
          <div
            aria-hidden
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(115,1,255,0.10), rgba(244,111,177,0.10))',
              border: '1px solid rgba(115,1,255,0.10)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              color: '#7301FF',
            }}
          >
            ✦
          </div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a1f3a' }}>
            {headline}
          </h2>
          <p
            className="dz-small"
            style={{ margin: 0, fontSize: 13, maxWidth: 420, lineHeight: 1.55 }}
          >
            {sub}
          </p>
          <Link
            href={ctaHref}
            style={{
              marginTop: 6,
              padding: '10px 18px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
              color: 'white',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 8px 18px rgba(115,1,255,0.25)',
            }}
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="dz-card" style={{ padding: 24 }}>
        <h1 className="dz-h2" style={{ fontSize: 24 }}>{t('title')}</h1>
        <p className="dz-body" style={{ marginTop: 6 }}>{t('subtitle')}</p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 280px) minmax(0, 1fr)',
          gap: 16,
        }}
      >
        {/* Mentorship picker */}
        <aside className="dz-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <strong style={{ fontSize: 13 }}>{t('mentorshipLabel')}</strong>
          {mentorships.map((m) => {
            const iAmMentor = m.mentorProfile.userId === userId;
            const otherUser = iAmMentor ? m.menteeProfile.user : m.mentorProfile.user;
            const otherName =
              otherUser.name ??
              ([otherUser.firstName, otherUser.lastName].filter(Boolean).join(' ').trim() ||
                otherUser.email);
            const active = selectedId === m.id;
            return (
              <Link
                key={m.id}
                href={`/mentora/dashboard/sessions/new?mentorshipId=${m.id}&duration=${durationMinutes}`}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: active ? 'rgba(115,1,255,0.10)' : 'transparent',
                  color: active ? '#7301FF' : 'inherit',
                  fontWeight: active ? 700 : 500,
                  textDecoration: 'none',
                  fontSize: 14,
                }}
              >
                {otherName}
              </Link>
            );
          })}
        </aside>

        {/* Slots */}
        <section className="dz-card" style={{ padding: 24 }}>
          {!selected ? (
            <p className="dz-body" style={{ margin: 0 }}>
              {t('mentorshipMissing')}
            </p>
          ) : (
            <SlotPicker
              mentorshipId={selected.id}
              durationMinutes={durationMinutes}
              slots={slots}
              iAmMentor={iAmMentor}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function clampDuration(d: number) {
  if (![30, 45, 60, 90].includes(d)) return 45;
  return d;
}

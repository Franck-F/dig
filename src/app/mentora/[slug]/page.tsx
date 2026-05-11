import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  breadcrumbJsonLd,
  jsonLdScriptProps,
  personJsonLd,
} from '@/lib/seo/jsonld';

// Provided by Agent 2B-2.
import { getMentorBySlug } from '@/lib/actions/mentora/discovery';

import RequestMentorshipModal from '../_components/RequestMentorshipModal';

export const dynamic = 'force-dynamic';

type Params = { slug: string };

function fullName(user: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
}): string {
  return (
    user.name ??
    [user.firstName, user.lastName].filter(Boolean).join(' ') ??
    'Mentor'
  );
}

/**
 * Per-mentor public profile. The `slug` is the mentor's `userId` cuid in v1
 * (spec defers human-readable slugs). Next.js prioritises explicit sibling
 * segments (`/mentora/discover`, `/mentora/onboarding`,
 * `/mentora/become-a-mentor`, `/mentora/dashboard`) over `[slug]`, so they
 * resolve correctly alongside this dynamic route.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const t = await getTranslations('mentora.profile');
  const { slug } = await params;
  let title = t('metaTitleSuffix');
  let description = t('metaDescriptionFallback');
  try {
    const mentor = await getMentorBySlug(slug);
    if (mentor) {
      const name = fullName(mentor.user);
      title = `${name} — ${t('metaTitleSuffix')}`;
      description = mentor.headline;
    }
  } catch {
    // Ignore — fall back.
  }
  return { title, description };
}

export default async function MentorProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const t = await getTranslations('mentora.profile');
  const { slug } = await params;

  // Mentor profiles are SaaS data — anon visitors get bounced to login with a
  // `next` deep-link so they land back on the profile after authenticating.
  const sessionGuard = await auth();
  if (!sessionGuard?.user?.id) {
    redirect(`/login?next=/mentora/${encodeURIComponent(slug)}`);
  }

  const mentor = await getMentorBySlug(slug);
  if (!mentor || mentor.status !== 'ACTIVE') notFound();

  // Compute average rating + recent reviews from DB.
  const mentorshipIds = await prisma.mentorship.findMany({
    where: { mentorProfileId: mentor.id },
    select: { id: true },
  });
  const mIds = mentorshipIds.map((m) => m.id);
  const reviews =
    mIds.length === 0
      ? []
      : await prisma.review.findMany({
          where: { mentorshipId: { in: mIds }, isPublic: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            author: { select: { name: true, firstName: true, lastName: true } },
          },
        });
  const avgAgg =
    mIds.length === 0
      ? null
      : await prisma.review.aggregate({
          where: { mentorshipId: { in: mIds }, isPublic: true },
          _avg: { rating: true },
          _count: { _all: true },
        });
  const averageRating = avgAgg?._avg.rating ?? null;
  const reviewCount = avgAgg?._count._all ?? 0;

  const session = await auth();
  const viewerId = (session?.user as { id?: string } | undefined)?.id;
  const isViewerThisMentor = viewerId === mentor.userId;
  const isAuthenticated = Boolean(viewerId);

  // Determine whether viewer has a mentee profile (so the modal opens directly
  // instead of routing to onboarding).
  let hasMenteeProfile = false;
  if (viewerId && !isViewerThisMentor) {
    const mp = await prisma.menteeProfile.findUnique({
      where: { userId: viewerId },
      select: { id: true },
    });
    hasMenteeProfile = Boolean(mp);
  }

  const displayName = fullName(mentor.user);
  const tCard = await getTranslations('mentora.discover.card');
  const responseLabel = tCard(`responseTime.${mentor.responseTime}`);

  return (
    <>
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: 'Mentorat', url: '/mentora' },
            { name: 'Trouver un mentor', url: '/mentora/discover' },
            { name: displayName, url: `/mentora/${mentor.userId}` },
          ]),
        )}
      />
      <script
        {...jsonLdScriptProps(
          personJsonLd({
            name: displayName,
            jobTitle: mentor.headline,
            description: mentor.bio.slice(0, 500),
            image: mentor.photoUrl ?? undefined,
            url: `/mentora/${mentor.userId}`,
            sameAs: mentor.linkedinUrl ? [mentor.linkedinUrl] : undefined,
          }),
        )}
      />

      <section className="dz-section" style={{ paddingTop: 32 }}>
        <Link href="/mentora/discover" className="dz-small" style={{ color: '#7301FF' }}>
          {t('back')}
        </Link>

        <div
          className="dz-glass-strong"
          style={{
            marginTop: 18,
            padding: 36,
            borderRadius: 28,
            display: 'grid',
            gridTemplateColumns: '120px 1fr auto',
            gap: 24,
            alignItems: 'center',
          }}
        >
          {mentor.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mentor.photoUrl}
              alt=""
              width={120}
              height={120}
              style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              aria-hidden
              style={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                background: 'linear-gradient(135deg,#7301FF,#A34BF5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 700,
                fontSize: 38,
              }}
            >
              {displayName
                .split(/\s+/)
                .map((p) => p[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="dz-h2" style={{ margin: 0, fontSize: 32 }}>{displayName}</h1>
            <p className="dz-body" style={{ marginTop: 8, fontSize: 16 }}>{mentor.headline}</p>
            <div
              className="dz-small"
              style={{
                marginTop: 12,
                display: 'flex',
                gap: 16,
                flexWrap: 'wrap',
                color: '#545b7a',
              }}
            >
              <span>{t('header.yearsLabel', { years: mentor.yearsExperience })}</span>
              <span>
                {reviewCount === 0
                  ? t('sections.reviewsEmpty')
                  : `${t('header.ratingLabel', {
                      rating: (averageRating ?? 0).toFixed(1),
                    })} · ${t('header.ratingCount', { count: reviewCount })}`}
              </span>
              <span>{t('header.responseLabel', { time: responseLabel })}</span>
              <span>
                {t('header.languagesLabel')}: {mentor.languages.join(', ').toUpperCase()}
              </span>
              <span>
                {t('header.timezoneLabel')}: {mentor.timezone}
              </span>
              {mentor.location && (
                <span>
                  {t('header.locationLabel')}: {mentor.location}
                </span>
              )}
              <span>
                {t('header.rateLabel')}:{' '}
                {mentor.hourlyRate
                  ? t('header.rateValue', { amount: (mentor.hourlyRate / 100).toFixed(0) })
                  : t('header.rateFree')}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}>
            {isViewerThisMentor ? (
              <Link
                href="/mentora/dashboard/profile/edit"
                className="dz-btn dz-btn-primary dz-btn-lg"
              >
                {t('ctaEditProfile')}
              </Link>
            ) : mentor.isAcceptingMentees ? (
              <RequestMentorshipModal
                mentorProfileId={mentor.id}
                mentorUserId={mentor.userId}
                mentorDisplayName={displayName}
                topicOptions={mentor.skills.map((s) => ({ id: s.skill.id, name: s.skill.name }))}
                isAuthenticated={isAuthenticated}
                hasMenteeProfile={hasMenteeProfile}
              />
            ) : (
              <button
                type="button"
                disabled
                aria-disabled="true"
                title={t('ctaRequestDisabled')}
                className="dz-btn dz-btn-ghost dz-btn-lg"
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              >
                {t('ctaRequestDisabled')}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="dz-section" style={{ paddingTop: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
            gap: 24,
            alignItems: 'flex-start',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="dz-card" style={{ padding: 28 }}>
              <h2 className="dz-h3">{t('sections.about')}</h2>
              <p
                className="dz-body"
                style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}
              >
                {mentor.bio}
              </p>
            </div>

            <div className="dz-card" style={{ padding: 28 }}>
              <h2 className="dz-h3">{t('sections.expertise')}</h2>
              {mentor.skills.length === 0 ? (
                <p className="dz-body" style={{ marginTop: 12 }}>{t('sections.expertiseEmpty')}</p>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  {mentor.skills.map((s) => (
                    <span
                      key={s.id}
                      className={`dz-chip ${s.isFeatured ? '' : '--navy'}`}
                      style={s.isFeatured
                        ? { background: 'linear-gradient(135deg,#7301FF,#A34BF5)', color: 'white' }
                        : undefined}
                    >
                      {s.skill.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="dz-card" style={{ padding: 28 }}>
              <h2 className="dz-h3">{t('sections.reviews')}</h2>
              {reviews.length === 0 ? (
                <p className="dz-body" style={{ marginTop: 12 }}>{t('sections.reviewsEmpty')}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 14 }}>
                  {reviews.map((r) => {
                    const author = fullName(r.author);
                    return (
                      <div
                        key={r.id}
                        style={{
                          borderTop: '1px solid rgba(115,1,255,0.10)',
                          paddingTop: 14,
                        }}
                      >
                        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                          <span style={{ fontWeight: 700 }}>{'★'.repeat(r.rating)}</span>
                          <span className="dz-small">{author}</span>
                        </div>
                        {r.comment && (
                          <p className="dz-body" style={{ marginTop: 6 }}>{r.comment}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <aside className="dz-glass" style={{ padding: 24, borderRadius: 20 }}>
            <h2 className="dz-h3" style={{ fontSize: 18 }}>{t('sections.availability')}</h2>
            <p className="dz-small" style={{ marginTop: 8 }}>{t('sections.availabilityHint')}</p>
            {!mentor.isAcceptingMentees && (
              <div
                role="status"
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 10,
                  background: 'rgba(217,78,146,0.08)',
                  color: '#a8235e',
                  fontSize: 13,
                }}
              >
                {t('notAcceptingNotice')}
              </div>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}

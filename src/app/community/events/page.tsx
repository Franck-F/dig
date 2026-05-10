import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { auth } from '@/auth';
import {
  getCurrentLiveEvent,
  getMyEventRegistrations,
  listUpcomingCommunityEvents,
} from '@/lib/actions/events';
import RegisterButton from './RegisterButton';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
  LIVE: 'Live',
  WORKSHOP: 'Atelier',
  HACKATHON: 'Hackathon',
  DEMO: 'Demo',
  TALK: 'Talk',
  MEETUP: 'Meetup',
  OTHER: 'Autre',
};

const KIND_COLOR: Record<string, string> = {
  LIVE: '#F46FB1',
  WORKSHOP: '#7301FF',
  HACKATHON: '#A34BF5',
  DEMO: '#3B7BFF',
  TALK: '#23c55e',
  MEETUP: '#FFB823',
  OTHER: '#7301FF',
};

const FORMAT_LABEL: Record<string, string> = {
  REMOTE_VIDEO: 'Visio',
  IN_PERSON: 'Présentiel',
  HYBRID: 'Hybride',
};

const MONTH_ABBR_FR = ['JANV', 'FÉV', 'MARS', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEPT', 'OCT', 'NOV', 'DÉC'];

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Community events listing — backed by `CommunityEvent` and
 * `CommunityEventRegistration`.
 *
 * Layout matches the handoff:
 *   - Left card: filter chips (visual stubs) + upcoming list with day
 *     pill, title, kind chip, LIVE badge if applicable, host meta,
 *     and a register/cancel CTA wired to `toggleEventRegistration`.
 *   - Right rail: gradient pink→violet "● LIVE MAINTENANT" banner
 *     populated from `getCurrentLiveEvent`, "Mes inscriptions" panel
 *     listing the viewer's upcoming registrations, "Tu organises ?"
 *     card linking to /community/events/new (route to wire later).
 */
export default async function CommunityEventsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/community/events');
  const userId = session.user.id;

  const t = await getTranslations('community.communityEventsPage');

  const [events, liveEvent, myRegs] = await Promise.all([
    listUpcomingCommunityEvents({ limit: 20 }),
    getCurrentLiveEvent(),
    getMyEventRegistrations(userId),
  ]);

  const myRegEventIds = new Set(myRegs.map((r) => r.event.id));

  return (
    <section className="dz-section" style={{ paddingTop: 32, paddingBottom: 64 }}>
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              color: '#7301FF',
            }}
          >
            {t('kicker')}
          </span>
          <h1 className="dz-h2" style={{ fontSize: 26, margin: '6px 0 0' }}>
            {t('title')}
          </h1>
        </div>

        <div
          className="dz-events-grid"
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18 }}
        >
          {/* LEFT — upcoming list */}
          <div
            className="dz-card"
            style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                {t('upcomingTitle')}
              </h2>
            </div>

            {events.length === 0 ? (
              <p className="dz-body" style={{ margin: 0 }}>
                Aucun événement prévu dans les 90 prochains jours.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {events.map((ev) => {
                  const accent = KIND_COLOR[ev.kind] ?? '#7301FF';
                  const day = String(ev.startsAt.getDate()).padStart(2, '0');
                  const month = MONTH_ABBR_FR[ev.startsAt.getMonth()] ?? '';
                  const hostUser = ev.host;
                  const hostName =
                    hostUser.name ??
                    ([hostUser.firstName, hostUser.lastName]
                      .filter(Boolean)
                      .join(' ')
                      .trim() ||
                      hostUser.email);
                  const hostMeta = `${hostName} · ${fmtTime(ev.startsAt)} · ${
                    FORMAT_LABEL[ev.format] ?? ev.format
                  }${ev.durationMin ? ` · ${ev.durationMin} min` : ''}`;
                  const isMine = myRegEventIds.has(ev.id);

                  return (
                    <div
                      key={ev.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: 14,
                        borderRadius: 14,
                        background: '#faf7ff',
                        border: '1px solid rgba(115,1,255,0.06)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div
                        aria-hidden
                        style={{
                          width: 56,
                          textAlign: 'center',
                          padding: '8px 0',
                          borderRadius: 10,
                          background: `${accent}15`,
                          color: accent,
                          flexShrink: 0,
                        }}
                      >
                        <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>
                          {day}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            marginTop: 2,
                          }}
                        >
                          {month}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            flexWrap: 'wrap',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: '#1a1f3a',
                            }}
                          >
                            {ev.title}
                          </span>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 999,
                              background: `${accent}18`,
                              color: accent,
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          >
                            {KIND_LABEL[ev.kind] ?? ev.kind}
                          </span>
                          {ev.isLive && (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 999,
                                background: '#F46FB1',
                                color: 'white',
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            >
                              ● LIVE
                            </span>
                          )}
                        </div>
                        <div className="dz-small" style={{ fontSize: 11, marginTop: 4 }}>
                          {hostMeta}
                        </div>
                      </div>
                      <RegisterButton
                        eventId={ev.id}
                        registered={isMine}
                        registeredLabel={t('registeredCta')}
                        registerLabel={t('registerCta')}
                        accent={accent}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT — live + my registrations + organizer */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {liveEvent && liveEvent.meetingUrl && (
              <div
                style={{
                  background:
                    'linear-gradient(160deg, #F46FB1 0%, #A34BF5 60%, #7301FF 110%)',
                  borderRadius: 18,
                  padding: 22,
                  color: 'white',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 12px 32px rgba(115,1,255,0.28)',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: -30,
                    right: -30,
                    width: 160,
                    height: 160,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.20)',
                    filter: 'blur(30px)',
                    pointerEvents: 'none',
                  }}
                />
                <span
                  style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.22)',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.10em',
                  }}
                >
                  {t('live.tag')}
                </span>
                <h3 style={{ margin: '12px 0 6px', fontSize: 18, fontWeight: 700 }}>
                  {liveEvent.title}
                </h3>
                <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
                  {liveEvent._count.registrations} inscrit·e·s · avec{' '}
                  {liveEvent.host.firstName ?? liveEvent.host.name ?? 'un mentor'}
                </p>
                <a
                  href={liveEvent.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    marginTop: 14,
                    display: 'block',
                    textAlign: 'center',
                    padding: 11,
                    borderRadius: 11,
                    background: 'white',
                    color: '#7301FF',
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    textDecoration: 'none',
                  }}
                >
                  {t('live.cta')}
                </a>
              </div>
            )}

            <div className="dz-card" style={{ padding: 18 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700 }}>
                {t('myRegistrations')}
              </h3>
              {myRegs.length === 0 ? (
                <p
                  className="dz-small"
                  style={{ fontSize: 12, margin: 0, color: '#8b91ad' }}
                >
                  Aucune inscription pour le moment.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {myRegs.slice(0, 5).map((r) => (
                    <div
                      key={r.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: KIND_COLOR[r.event.kind] ?? '#7301FF',
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#1a1f3a',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {r.event.title}
                        </div>
                        <div className="dz-small" style={{ fontSize: 11 }}>
                          {String(r.event.startsAt.getDate()).padStart(2, '0')}{' '}
                          {MONTH_ABBR_FR[r.event.startsAt.getMonth()]} ·{' '}
                          {fmtTime(r.event.startsAt)}
                        </div>
                      </div>
                      <span aria-hidden style={{ color: '#8b91ad' }}>
                        ›
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="dz-card" style={{ padding: 18, textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1f3a' }}>
                {t('organizer')}
              </div>
              <div
                className="dz-small"
                style={{ fontSize: 11, marginTop: 6, marginBottom: 12 }}
              >
                {t('organizerBody')}
              </div>
              <Link
                href="/community/events/new"
                style={{
                  display: 'inline-block',
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(115,1,255,0.20)',
                  background: 'transparent',
                  color: '#7301FF',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textDecoration: 'none',
                  textAlign: 'center',
                }}
              >
                {t('organizerCta')}
              </Link>
            </div>
          </aside>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .dz-events-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </section>
  );
}

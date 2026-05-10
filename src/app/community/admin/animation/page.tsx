import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getCommunityViewer } from '../../_components/viewer';
import { listRitualsByDayOfWeek } from '@/lib/actions/rituals';
import BroadcastForm from './BroadcastForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('community.admin.animationPage');
  return { title: t('metaTitle') };
}

const DAY_LABELS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'] as const;

function fmtTime(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

/**
 * Community animation planner — now backed by `CommunityRitual` rows.
 *
 * The week grid groups rituals by `dayOfWeek` (Mon..Sun) and renders
 * each one as a coloured block under the day header. Empty days
 * keep the soft "—" placeholder. The ISO week number is computed
 * from the current date so the title stays accurate.
 *
 * The "+ Ajouter un rituel" CTA links to /community/admin/animation/new
 * (form route reserved for the next pass — the create action is wired
 * server-side via `createCommunityRitual`).
 *
 * The broadcast announcement card uses the BroadcastForm client island,
 * which calls `broadcastCommunityAnnouncement` and reports the
 * recipient count back to the admin.
 */
export default async function CommunityAnimationPage() {
  const viewer = await getCommunityViewer();
  if (viewer.kind !== 'member' || !viewer.isModerator) redirect('/community');

  const t = await getTranslations('community.admin.animationPage');
  const tBroadcast = await getTranslations('community.admin.animationPage.broadcast');

  // ISO week number — same algo as the previous static page.
  const now = new Date();
  const tmp = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(
    ((tmp.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000) + 1) / 7,
  );

  // Pull every ritual; bucket into a 7-cell array indexed by dayOfWeek.
  const rituals = await listRitualsByDayOfWeek();
  const ritualsByDay: Array<typeof rituals> = [[], [], [], [], [], [], []];
  for (const r of rituals) {
    if (r.dayOfWeek >= 0 && r.dayOfWeek <= 6) {
      ritualsByDay[r.dayOfWeek]!.push(r);
    }
  }
  // Compute the day-of-month numbers for the current week (Mon-anchored)
  // so the header reads "LUN 06 / MAR 07 / …" out of the box.
  const monday = (() => {
    const d = new Date(now);
    const jsDow = d.getDay();
    const monIdx = (jsDow + 6) % 7;
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - monIdx);
    return d;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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

      <div className="dz-card" style={{ padding: 22 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
            {t('weekTitle', { week: weekNumber })}
          </h2>
          <a
            href="/community/admin/animation/new"
            style={{
              padding: '9px 16px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
              color: 'white',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textDecoration: 'none',
            }}
          >
            {t('addRitualCta')}
          </a>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 10,
          }}
        >
          {DAY_LABELS.map((label, i) => {
            const dayDate = new Date(monday);
            dayDate.setDate(dayDate.getDate() + i);
            const dayNumStr = String(dayDate.getDate()).padStart(2, '0');
            const dayRituals = ritualsByDay[i] ?? [];

            return (
              <div
                key={i}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: '#faf7ff',
                  border: '1px solid rgba(115,1,255,0.06)',
                  minHeight: 110,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      color: '#8b91ad',
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: '#1a1f3a',
                    }}
                  >
                    {dayNumStr}
                  </span>
                </div>
                {dayRituals.length === 0 ? (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: '#8b91ad',
                      textAlign: 'center',
                      opacity: 0.5,
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    —
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      flex: 1,
                    }}
                  >
                    {dayRituals.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          padding: 8,
                          borderRadius: 8,
                          background: `${r.colorHex}15`,
                          borderLeft: `3px solid ${r.colorHex}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            color: '#1a1f3a',
                            fontWeight: 700,
                            lineHeight: 1.3,
                          }}
                        >
                          {r.title}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: r.colorHex,
                            fontWeight: 700,
                            marginTop: 2,
                          }}
                        >
                          {fmtTime(r.startMinute)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Broadcast announcement — wired client island */}
      <div
        style={{
          background: 'linear-gradient(160deg, #7301FF 0%, #F46FB1 110%)',
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
            top: -40,
            right: -40,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.18)',
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }}
        />
        <BroadcastForm
          title={tBroadcast('title')}
          body={tBroadcast('body')}
          placeholder={tBroadcast('placeholder')}
          submitLabel={tBroadcast('submit')}
        />
      </div>
    </div>
  );
}

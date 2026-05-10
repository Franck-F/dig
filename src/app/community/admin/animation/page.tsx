import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getCommunityViewer } from '../../_components/viewer';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('community.admin.animationPage');
  return { title: t('metaTitle') };
}

type DayBlock = {
  label: string;
  num: string;
  title: string;
  time: string;
  color: string;
};

/**
 * Community animation planner — designed against
 * `community-admin-tabs.jsx#Animation`.
 *
 *   - Week planner (Mon..Sun) with one ritual block per day. Each
 *     block is a coloured card with a title and time. Empty days
 *     show a soft "—" placeholder so the grid stays even.
 *   - Broadcast announcement card (gradient violet→pink) with a
 *     textarea + send button — the underlying notification fan-out
 *     is wired in a follow-up; for now the form is a visual stub.
 *
 * Static i18n content powers the demo data; switching to real
 * scheduling state is a future migration (no Ritual model yet).
 */
export default async function CommunityAnimationPage() {
  // Defense-in-depth: layout already gates moderators + 2FA, but we
  // assert again so direct nav is safe.
  const viewer = await getCommunityViewer();
  if (viewer.kind !== 'member' || !viewer.isModerator) redirect('/community');

  const t = await getTranslations('community.admin.animationPage');
  const days = (t as unknown as { raw: (k: string) => DayBlock[] }).raw('days');

  // Compute current ISO week so the title isn't a permanent "sem. 19".
  const now = new Date();
  const tmp = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(
    ((tmp.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000) + 1) / 7,
  );

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

      {/* Weekly planner */}
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
          <button
            type="button"
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
            }}
          >
            {t('addRitualCta')}
          </button>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 10,
          }}
        >
          {days.map((d, i) => (
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
                  {d.label}
                </span>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: '#1a1f3a',
                  }}
                >
                  {d.num}
                </span>
              </div>
              {d.title === '—' ? (
                <div
                  style={{
                    marginTop: 10,
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
                    marginTop: 10,
                    padding: 8,
                    borderRadius: 8,
                    background: `${d.color}15`,
                    borderLeft: `3px solid ${d.color}`,
                    flex: 1,
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
                    {d.title}
                  </div>
                  {d.time && (
                    <div
                      style={{
                        fontSize: 10,
                        color: d.color,
                        fontWeight: 700,
                        marginTop: 2,
                      }}
                    >
                      {d.time}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Broadcast announcement */}
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
        <div style={{ position: 'relative' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>
            {t('broadcast.title')}
          </h3>
          <p style={{ margin: 0, fontSize: 12, opacity: 0.9 }}>{t('broadcast.body')}</p>
          <textarea
            placeholder={t('broadcast.placeholder')}
            style={{
              width: '100%',
              marginTop: 12,
              padding: 12,
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.30)',
              background: 'rgba(255,255,255,0.10)',
              color: 'white',
              fontSize: 13,
              minHeight: 96,
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="button"
            style={{
              marginTop: 10,
              padding: '10px 20px',
              borderRadius: 10,
              border: 'none',
              background: 'white',
              color: '#7301FF',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t('broadcast.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}

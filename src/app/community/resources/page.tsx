import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

const CATEGORIES = [
  { key: 'templates', accent: '#7301FF' },
  { key: 'videos', accent: '#F46FB1' },
  { key: 'articles', accent: '#A34BF5' },
  { key: 'tools', accent: '#3B7BFF' },
] as const;

const ITEM_INDICES = ['0', '1', '2', '3', '4', '5'] as const;

const ICON_BY_KEY: Record<string, string> = {
  templates: '◇',
  videos: '▷',
  articles: '☷',
  tools: '◧',
};

/**
 * Community resources library — designed against
 * `community-tabs.jsx#Resources`.
 *
 *   - 4 category cards (Templates / Vidéos / Articles / Outils) with
 *     coloured icon + count.
 *   - Library list below: each row is an icon box + title + author meta
 *     + tag chip + a download/open button on the right.
 *
 * Static i18n-driven content for now — there's no Resource table yet
 * and the goal is design parity with the handoff. When we add a real
 * model the structure stays identical: just swap the static raw map
 * for a Prisma findMany.
 */
export default async function CommunityResourcesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/community/resources');

  const t = await getTranslations('community.communityResourcesPage');

  return (
    <section className="dz-section" style={{ paddingTop: 32, paddingBottom: 64 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
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

        {/* Category cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 14,
          }}
        >
          {CATEGORIES.map((c) => (
            <div key={c.key} className="dz-card" style={{ padding: 18 }}>
              <div
                aria-hidden
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  background: `linear-gradient(135deg, ${c.accent}, ${c.accent}cc)`,
                  color: 'white',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  marginBottom: 12,
                }}
              >
                {ICON_BY_KEY[c.key]}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1f3a' }}>
                {t(`categories.${c.key}.label`)}
              </div>
              <div className="dz-small" style={{ fontSize: 11, marginTop: 2 }}>
                {t(`categories.${c.key}.count`)}
              </div>
            </div>
          ))}
        </div>

        {/* Library list */}
        <div className="dz-card" style={{ padding: 22 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
              {t('libraryTitle')}
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
              {t('shareCta')}
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: 10,
            }}
          >
            {ITEM_INDICES.map((i) => {
              const iconKey = t(`items.${i}.icon`);
              const accent = CATEGORIES.find((c) => c.key === iconKey)?.accent ?? '#7301FF';
              return (
                <div
                  key={i}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    background: '#faf7ff',
                    border: '1px solid rgba(115,1,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: `${accent}18`,
                      color: accent,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {ICON_BY_KEY[iconKey] ?? '◇'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1f3a' }}>
                      {t(`items.${i}.title`)}
                    </div>
                    <div className="dz-small" style={{ fontSize: 11, marginTop: 2 }}>
                      {t(`items.${i}.meta`)} · #{t(`items.${i}.tag`)}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Télécharger"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      border: 'none',
                      background: 'rgba(115,1,255,0.10)',
                      color: '#7301FF',
                      fontSize: 16,
                      cursor: 'pointer',
                      flexShrink: 0,
                      fontFamily: 'inherit',
                    }}
                  >
                    ↓
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ResourceCategory } from '@prisma/client';

import { auth } from '@/auth';
import { listResourcesForAudience } from '@/lib/actions/resources';
import { fmtDate } from '@/app/mentora/dashboard/_components/format';

export const dynamic = 'force-dynamic';

const CATEGORIES = [
  { key: 'templates', accent: '#7301FF' },
  { key: 'videos', accent: '#F46FB1' },
  { key: 'articles', accent: '#A34BF5' },
  { key: 'tools', accent: '#3B7BFF' },
] as const;

const ICON_BY_KEY: Record<string, string> = {
  templates: '◇',
  videos: '▷',
  articles: '☷',
  tools: '◧',
};

/** Maps a Resource.kind to one of the 4 category cards' icon. */
const KIND_TO_CATEGORY_KEY: Record<string, string> = {
  TEMPLATE: 'templates',
  NOTION: 'templates',
  REPLAY: 'videos',
  ARTICLE: 'articles',
  PDF: 'articles',
  TOOL: 'tools',
};

const KIND_LABEL: Record<string, string> = {
  PDF: 'PDF',
  REPLAY: 'Replay',
  TEMPLATE: 'Template',
  ARTICLE: 'Article',
  TOOL: 'Outil',
  NOTION: 'Notion',
};

/**
 * Community resources library — now backed by the `Resource` table.
 *
 * Authoring lands via the `createResource` server action (mentor +
 * admin). Mentees read; the page decorates each row with the category
 * icon + accent + author byline.
 *
 * Empty state surfaces when no rows match — no static fallback, so
 * admins know they need to publish content. Counts on the 4 category
 * cards reflect the live audience-filtered totals.
 */
export default async function CommunityResourcesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/community/resources');

  const t = await getTranslations('community.communityResourcesPage');
  const items = await listResourcesForAudience('COMMUNITY', { limit: 60 });

  // Live category counts — single pass over the rows we already fetched.
  const categoryCounts: Record<string, number> = {
    templates: 0,
    videos: 0,
    articles: 0,
    tools: 0,
  };
  for (const r of items) {
    const ck = KIND_TO_CATEGORY_KEY[r.kind] ?? 'articles';
    categoryCounts[ck] = (categoryCounts[ck] ?? 0) + 1;
  }

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

        {/* Category cards with live counts */}
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
                {(categoryCounts[c.key] ?? 0).toLocaleString('fr-FR')}{' '}
                {t(`categories.${c.key}.count`)
                  .replace(/^\d[\d ,]*\s*/, '')
                  .replace('resources', 'ressources')}
              </div>
            </div>
          ))}
        </div>

        {/* Library list — empty state vs DB rows */}
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

          {items.length === 0 ? (
            <p className="dz-body" style={{ margin: 0 }}>
              La bibliothèque est encore vide. Publie une première ressource pour démarrer.
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: 10,
              }}
            >
              {items.map((r) => {
                const categoryKey = KIND_TO_CATEGORY_KEY[r.kind] ?? 'articles';
                const accent =
                  CATEGORIES.find((c) => c.key === categoryKey)?.accent ?? '#7301FF';
                const author =
                  r.author.name ??
                  ([r.author.firstName, r.author.lastName]
                    .filter(Boolean)
                    .join(' ')
                    .trim() ||
                    r.author.email);
                return (
                  <div
                    key={r.id}
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
                      {ICON_BY_KEY[categoryKey] ?? '◇'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#1a1f3a',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.title}
                      </div>
                      <div className="dz-small" style={{ fontSize: 11, marginTop: 2 }}>
                        par {author} ·{' '}
                        {r.downloadCount.toLocaleString('fr-FR')} téléchargements · #
                        {KIND_LABEL[r.kind] ?? r.kind} ·{' '}
                        {fmtDate(r.createdAt)}
                      </div>
                    </div>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Ouvrir ${r.title}`}
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
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none',
                      }}
                    >
                      ↓
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// `ResourceCategory` is referenced from server filter helpers later;
// keep the import alive even if unused in this file directly.
void ResourceCategory;

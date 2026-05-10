import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ResourceCategory } from '@prisma/client';

import { auth } from '@/auth';
import { getCurrentRoleProfile } from '@/lib/mentora/current-profile';
import {
  getFeaturedResource,
  listResourcesForAudience,
} from '@/lib/actions/resources';
import { fmtDate } from '../_components/format';

export const dynamic = 'force-dynamic';

const FILTER_KEYS = ['ux-ui', 'career', 'career-change', 'tech', 'soft-skills'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
type FilterValue = 'all' | FilterKey;

const FILTER_TO_DB: Record<FilterKey, ResourceCategory> = {
  'ux-ui': ResourceCategory.UX_UI,
  career: ResourceCategory.CAREER,
  'career-change': ResourceCategory.CAREER_CHANGE,
  tech: ResourceCategory.TECH,
  'soft-skills': ResourceCategory.SOFT_SKILLS,
};

const DB_TO_FILTER: Partial<Record<ResourceCategory, FilterKey>> = {
  [ResourceCategory.UX_UI]: 'ux-ui',
  [ResourceCategory.CAREER]: 'career',
  [ResourceCategory.CAREER_CHANGE]: 'career-change',
  [ResourceCategory.TECH]: 'tech',
  [ResourceCategory.SOFT_SKILLS]: 'soft-skills',
};

const KIND_COLOR: Record<string, string> = {
  PDF: '#F46FB1',
  REPLAY: '#7301FF',
  TEMPLATE: '#A34BF5',
  ARTICLE: '#3B7BFF',
  TOOL: '#23c55e',
  NOTION: '#23c55e',
};

const KIND_LABEL: Record<string, string> = {
  PDF: 'PDF',
  REPLAY: 'Replay',
  TEMPLATE: 'Template',
  ARTICLE: 'Article',
  TOOL: 'Outil',
  NOTION: 'Notion',
};

function isFilterKey(value: string | undefined): value is FilterKey {
  return (
    typeof value === 'string' &&
    (FILTER_KEYS as readonly string[]).includes(value)
  );
}

/**
 * Mentora resources library — backed by the `Resource` table.
 *
 * Two role-driven variants on the same route:
 *   - Mentee: filter chips + featured banner + grid of curated cards
 *     (read-only). Empty state invites them to wait for new content.
 *   - Mentor: header + "+ Nouveau document" CTA → /mentora/dashboard/resources/new
 *     + grid of the resources THEY authored, with edit/share affordances.
 *
 * Authoring flows live in dedicated routes (linked but not implemented
 * inline here to keep the page lean).
 */
export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/mentora/dashboard/resources');

  const t = await getTranslations('mentora.dashboard.resourcesPage');
  const sp = await searchParams;
  const filter: FilterValue = isFilterKey(sp.filter) ? sp.filter : 'all';

  const profile = await getCurrentRoleProfile(session.user.id);
  const isMentor = profile.kind === 'mentor';

  if (isMentor) {
    return <MentorView t={t} authorId={session.user.id} />;
  }

  return <MenteeView t={t} filter={filter} />;
}

// ───────────── Mentee variant ─────────────────────────────────────────

async function MenteeView({
  t,
  filter,
}: {
  t: Awaited<ReturnType<typeof getTranslations<'mentora.dashboard.resourcesPage'>>>;
  filter: FilterValue;
}) {
  const items = await listResourcesForAudience('MENTORA', {
    category: filter === 'all' ? undefined : FILTER_TO_DB[filter],
    limit: 60,
  });
  const featured = filter === 'all' ? await getFeaturedResource('MENTORA') : null;

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
          {t('menteeTitle')}
        </h1>
        <p className="dz-body" style={{ marginTop: 6 }}>
          {t('menteeSubtitle')}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <FilterChip
          href="/mentora/dashboard/resources"
          active={filter === 'all'}
          label={t('filterAll')}
        />
        {FILTER_KEYS.map((k) => (
          <FilterChip
            key={k}
            href={`/mentora/dashboard/resources?filter=${k}`}
            active={filter === k}
            label={t(`filters.${k}`)}
          />
        ))}
      </div>

      {featured && (
        <div
          style={{
            background:
              'linear-gradient(135deg, #F46FB1 0%, #A34BF5 60%, #7301FF 110%)',
            borderRadius: 18,
            padding: '24px 28px',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            flexWrap: 'wrap',
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
              width: 180,
              height: 180,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.18)',
              filter: 'blur(40px)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.20)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.10em',
              }}
            >
              ✦ {t('featured.tag')}
            </span>
            <h2 style={{ margin: '10px 0 4px', fontSize: 22, fontWeight: 700 }}>
              {featured.title}
            </h2>
            {featured.description && (
              <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>
                {featured.description}
              </p>
            )}
          </div>
          <a
            href={featured.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '11px 20px',
              borderRadius: 11,
              border: 'none',
              background: 'white',
              color: '#7301FF',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
              fontFamily: 'inherit',
              position: 'relative',
              textDecoration: 'none',
            }}
          >
            {t('featured.cta')}
          </a>
        </div>
      )}

      {items.length === 0 ? (
        <div className="dz-card" style={{ padding: 24 }}>
          <p className="dz-body" style={{ margin: 0 }}>
            Aucune ressource pour le moment dans cette catégorie. Reviens bientôt.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {items.map((r) => {
            const accent = KIND_COLOR[r.kind] ?? '#7301FF';
            const author =
              r.author.name ??
              ([r.author.firstName, r.author.lastName]
                .filter(Boolean)
                .join(' ')
                .trim() ||
                r.author.email);
            // "NEW" pill for resources created in the last 14 days.
            const isNew =
              Date.now() - r.createdAt.getTime() < 14 * 24 * 60 * 60 * 1000;
            const filterKey = DB_TO_FILTER[r.category];
            const categoryLabel =
              filterKey ? t(`filters.${filterKey}`) : 'Divers';

            return (
              <article
                key={r.id}
                className="dz-card"
                style={{
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  gap: 10,
                }}
              >
                {isNew && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 14,
                      right: 14,
                      padding: '3px 8px',
                      borderRadius: 999,
                      background: 'linear-gradient(135deg, #F46FB1, #A34BF5)',
                      color: 'white',
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                    }}
                  >
                    {t('newPill')}
                  </span>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: 999,
                      background: `${accent}18`,
                      color: accent,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {KIND_LABEL[r.kind] ?? r.kind}
                  </span>
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: 999,
                      background: 'rgba(115,1,255,0.06)',
                      color: '#7301FF',
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {categoryLabel}
                  </span>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: '#1a1f3a',
                      lineHeight: 1.3,
                      minHeight: 40,
                    }}
                  >
                    {r.title}
                  </div>
                  <div
                    className="dz-small"
                    style={{ fontSize: 12, marginTop: 6 }}
                  >
                    {t('byAuthor', { author })} · {fmtDate(r.createdAt)}
                  </div>
                </div>
                <div style={{ flex: 1 }} />
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    width: '100%',
                    padding: '11px 16px',
                    borderRadius: 11,
                    border: 'none',
                    background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
                    color: 'white',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'center',
                    textDecoration: 'none',
                  }}
                >
                  {t('openCta')}
                </a>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ───────────── Mentor variant ─────────────────────────────────────────

async function MentorView({
  t,
  authorId,
}: {
  t: Awaited<ReturnType<typeof getTranslations<'mentora.dashboard.resourcesPage'>>>;
  authorId: string;
}) {
  // Mentors see ONLY the resources they authored.
  const items = await listResourcesForAudience('MENTORA', { limit: 60 }).then(
    (rows) => rows.filter((r) => r.authorId === authorId),
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
          BIBLIOTHÈQUE MENTOR
        </span>
        <h1 className="dz-h2" style={{ fontSize: 26, margin: '6px 0 0' }}>
          {t('mentorTitle')}
        </h1>
        <p className="dz-body" style={{ marginTop: 6 }}>
          {t('mentorSubtitle')}
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
          {t('mentorTitle')}
        </h2>
        <Link
          href="/mentora/dashboard/resources/new"
          style={{
            padding: '10px 18px',
            borderRadius: 11,
            background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
            color: 'white',
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
            boxShadow: '0 8px 18px rgba(115,1,255,0.30)',
          }}
        >
          {t('newResourceCta')}
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="dz-card" style={{ padding: 24 }}>
          <p className="dz-body" style={{ margin: 0 }}>
            {t('mentorEmpty')}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          {items.map((r) => {
            const accent = KIND_COLOR[r.kind] ?? '#7301FF';
            return (
              <article key={r.id} className="dz-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div
                    aria-hidden
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 12,
                      background: `${accent}18`,
                      color: accent,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {KIND_LABEL[r.kind] ?? r.kind}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: '#1a1f3a',
                        lineHeight: 1.3,
                      }}
                    >
                      {r.title}
                    </div>
                    <div className="dz-small" style={{ fontSize: 12, marginTop: 4 }}>
                      Créé le {fmtDate(r.createdAt)} ·{' '}
                      {r.downloadCount.toLocaleString('fr-FR')} ouvertures
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <Link
                    href={`/mentora/dashboard/resources/${r.id}/edit`}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: 'none',
                      background: 'rgba(115,1,255,0.10)',
                      color: '#7301FF',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'center',
                      textDecoration: 'none',
                    }}
                  >
                    {t('editCta')}
                  </Link>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1px solid rgba(115,1,255,0.20)',
                      background: 'transparent',
                      color: '#7301FF',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'center',
                      textDecoration: 'none',
                    }}
                  >
                    {t('shareCta')}
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ───────────── Helpers ─────────────────────────────────────────────────

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      style={{
        padding: '8px 16px',
        borderRadius: 999,
        background: active ? 'linear-gradient(135deg, #7301FF, #A34BF5)' : 'transparent',
        border: active ? 'none' : '1px solid rgba(115,1,255,0.20)',
        color: active ? 'white' : '#7301FF',
        fontSize: 12,
        fontWeight: 700,
        textDecoration: 'none',
      }}
    >
      {label}
    </Link>
  );
}

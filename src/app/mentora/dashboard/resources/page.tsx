import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { auth } from '@/auth';
import { getCurrentRoleProfile } from '@/lib/mentora/current-profile';

export const dynamic = 'force-dynamic';

const FILTER_KEYS = ['ux-ui', 'career', 'career-change', 'tech', 'soft-skills'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
type FilterValue = 'all' | FilterKey;

const KIND_COLOR: Record<string, string> = {
  PDF: '#F46FB1',
  Replay: '#7301FF',
  Template: '#A34BF5',
  Article: '#3B7BFF',
  Notion: '#23c55e',
};

const MENTEE_INDICES = ['0', '1', '2', '3', '4', '5'] as const;
const MENTOR_INDICES = ['0', '1', '2', '3'] as const;
/** Indices that should display the "NEW" pill — kept in code rather
 *  than i18n so the editorial team only edits prose, never visual flags. */
const MENTEE_NEW_INDICES = new Set<string>(['0', '3']);

function isFilterKey(value: string | undefined): value is FilterKey {
  return (
    typeof value === 'string' &&
    (FILTER_KEYS as readonly string[]).includes(value)
  );
}

/**
 * Resources library — designed against `mentora-mentee-tabs.jsx#Resources`
 * and `mentora-mentor-tabs.jsx#Resources`.
 *
 * Two role-driven variants on the same route:
 *   - Mentee: filter chips → "À LA UNE" gradient banner → grid of curated
 *     resource cards (PDF / Replay / Template / Article kind badges +
 *     category badge + NEW pill + author + meta + "Ouvrir" CTA).
 *   - Mentor: header card with "+ Nouveau document" CTA → grid of the
 *     resources the mentor shares with their mentees, each with
 *     "Modifier" / "Partager" actions.
 *
 * Static content for now — the platform doesn't yet have a Resource
 * table. All copy lives in i18n so the page is bilingual and easy to
 * curate without a code change.
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
    return <MentorView t={t} />;
  }

  return <MenteeView t={t} filter={filter} />;
}

// ───────────── Mentee variant ─────────────────────────────────────────

function MenteeView({
  t,
  filter,
}: {
  t: Awaited<ReturnType<typeof getTranslations<'mentora.dashboard.resourcesPage'>>>;
  filter: FilterValue;
}) {
  const allItems = MENTEE_INDICES.map((i) => ({
    idx: i,
    kind: t(`menteeItems.${i}.kind`),
    category: t(`menteeItems.${i}.category`),
    title: t(`menteeItems.${i}.title`),
    author: t(`menteeItems.${i}.author`),
    meta: t(`menteeItems.${i}.meta`),
    isNew: MENTEE_NEW_INDICES.has(i),
  }));

  const filteredItems =
    filter === 'all' ? allItems : allItems.filter((it) => it.category === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
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

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <FilterChip href="/mentora/dashboard/resources" active={filter === 'all'} label={t('filterAll')} />
        {FILTER_KEYS.map((k) => (
          <FilterChip
            key={k}
            href={`/mentora/dashboard/resources?filter=${k}`}
            active={filter === k}
            label={t(`filters.${k}`)}
          />
        ))}
      </div>

      {/* Featured banner — only on the All view so it doesn't overshadow
          the filtered list. */}
      {filter === 'all' && (
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
              {t('featured.title')}
            </h2>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>{t('featured.body')}</p>
          </div>
          <button
            type="button"
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
            }}
          >
            {t('featured.cta')}
          </button>
        </div>
      )}

      {/* Resource grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {filteredItems.map((it) => {
          const accent = KIND_COLOR[it.kind] ?? '#7301FF';
          return (
            <article
              key={it.idx}
              className="dz-card"
              style={{
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                gap: 10,
              }}
            >
              {it.isNew && (
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
                  {t(`kindLabels.${it.kind}`) ?? it.kind}
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
                  {isFilterKey(it.category) ? t(`filters.${it.category}`) : it.category}
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
                  {it.title}
                </div>
                <div className="dz-small" style={{ fontSize: 12, marginTop: 6 }}>
                  {t('byAuthor', { author: it.author })} · {it.meta}
                </div>
              </div>
              <div style={{ flex: 1 }} />
              <button
                type="button"
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
                }}
              >
                {t('openCta')}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

// ───────────── Mentor variant ─────────────────────────────────────────

function MentorView({
  t,
}: {
  t: Awaited<ReturnType<typeof getTranslations<'mentora.dashboard.resourcesPage'>>>;
}) {
  const items = MENTOR_INDICES.map((i) => ({
    idx: i,
    kind: t(`mentorItems.${i}.kind`),
    title: t(`mentorItems.${i}.title`),
    meta: t(`mentorItems.${i}.meta`),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
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

      {/* Section title + new-doc CTA */}
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
          href="/mentora/dashboard/resources"
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
          {items.map((it) => {
            const accent = KIND_COLOR[it.kind] ?? '#7301FF';
            return (
              <article
                key={it.idx}
                className="dz-card"
                style={{ padding: 20 }}
              >
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
                    {it.kind}
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
                      {it.title}
                    </div>
                    <div className="dz-small" style={{ fontSize: 12, marginTop: 4 }}>
                      {it.meta}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button
                    type="button"
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
                    }}
                  >
                    {t('editCta')}
                  </button>
                  <button
                    type="button"
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
                    }}
                  >
                    {t('shareCta')}
                  </button>
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

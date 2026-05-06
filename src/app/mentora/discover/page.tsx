import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PreferredFormat } from '@prisma/client';
import { auth } from '@/auth';
import {
  breadcrumbJsonLd,
  jsonLdScriptProps,
} from '@/lib/seo/jsonld';

// Provided by Agent 2B-2.
import { discoverMentors } from '@/lib/actions/mentora/discovery';

import MentorCard, { type MentorCardData } from '../_components/MentorCard';
import DiscoverFilters from './DiscoverFilters';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('mentora.discover');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

const PAGE_SIZE = 12;

type SearchParams = {
  q?: string;
  skills?: string;
  language?: string;
  format?: string;
  minRating?: string;
  page?: string;
};

function parseFormat(value: string | undefined): PreferredFormat | undefined {
  if (!value) return undefined;
  if ((Object.values(PreferredFormat) as string[]).includes(value)) {
    return value as PreferredFormat;
  }
  return undefined;
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/mentora/discover');

  const t = await getTranslations('mentora.discover');
  const sp = await searchParams;

  const q = sp.q?.trim().slice(0, 200) || undefined;
  const skillSlugs =
    sp.skills?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  const languages = sp.language?.trim() ? [sp.language.trim()] : undefined;
  const format = parseFormat(sp.format);
  const minRating = sp.minRating ? Math.round(Number(sp.minRating)) : undefined;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  let mentors: MentorCardData[] = [];
  let totalCount = 0;
  try {
    const result = await discoverMentors({
      q,
      skillSlugs: skillSlugs.length > 0 ? skillSlugs : undefined,
      languages,
      format,
      minRating,
      page,
      pageSize: PAGE_SIZE,
    });
    if (result.status === 'success' && result.data) {
      mentors = result.data.items as unknown as MentorCardData[];
      totalCount = result.data.total;
    }
  } catch {
    mentors = [];
    totalCount = 0;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Build pagination link helpers, preserving filter params.
  const buildPageHref = (p: number) => {
    const next = new URLSearchParams();
    if (sp.q) next.set('q', sp.q);
    if (sp.skills) next.set('skills', sp.skills);
    if (sp.language) next.set('language', sp.language);
    if (sp.format) next.set('format', sp.format);
    if (sp.minRating) next.set('minRating', sp.minRating);
    next.set('page', String(p));
    return `/mentora/discover?${next.toString()}`;
  };

  return (
    <>
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: 'Mentora', url: '/mentora' },
            { name: t('breadcrumb'), url: '/mentora/discover' },
          ]),
        )}
      />

      {/* Full-width container — bypasses `.dz-section`'s 1440px max so the
          discover catalog uses the entire AppShell main column. Compact
          horizontal header strip + 2-col layout (filters / grid). */}
      <div style={{ padding: '20px 28px 40px', maxWidth: '100%' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 22,
          }}
        >
          <div style={{ flex: 1, minWidth: 240 }}>
            <span
              style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: 999,
                background: 'rgba(115,1,255,0.08)',
                color: '#7301FF',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              ✦ Catalogue mentors
            </span>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#1a1f3a', lineHeight: 1.15 }}>
              {t('title')} <span className="dz-grad-text">{t('titleHighlight')}</span>
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: '#545b7a', maxWidth: 640 }}>
              {t('subtitle')}
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              borderRadius: 999,
              background: '#fff',
              border: '1px solid rgba(115,1,255,0.15)',
              fontSize: 13,
              color: '#1a1f3a',
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            <span aria-hidden style={{ color: '#7301FF' }}>◉</span>
            {t('resultsCount', { count: totalCount })}
          </div>
        </header>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 260px) minmax(0, 1fr)',
            gap: 24,
            alignItems: 'flex-start',
          }}
          className="dz-discover-grid"
        >
          <div style={{ position: 'sticky', top: 80, alignSelf: 'flex-start' }}>
            <DiscoverFilters />
          </div>

          <div style={{ minWidth: 0 }}>
            {mentors.length === 0 ? (
              <div
                style={{
                  background: '#fff',
                  border: '1px solid rgba(115,1,255,0.10)',
                  borderRadius: 22,
                  padding: 48,
                  textAlign: 'center',
                  boxShadow: '0 14px 38px -24px rgba(36,18,80,0.16)',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, rgba(115,1,255,0.12), rgba(244,111,177,0.08))',
                    color: '#7301FF',
                    fontSize: 28,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  ✦
                </div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a1f3a' }}>
                  {t('empty.title')}
                </h2>
                <p style={{ margin: '8px auto 0', maxWidth: 520, fontSize: 14, color: '#545b7a' }}>
                  {t('empty.body')}
                </p>
                <Link
                  href="/mentora/discover"
                  style={{
                    display: 'inline-block',
                    marginTop: 18,
                    padding: '10px 22px',
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: 'none',
                    boxShadow: '0 8px 22px -10px rgba(115,1,255,0.55)',
                  }}
                >
                  {t('empty.reset')}
                </Link>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: 16,
                  }}
                >
                  {mentors.map((m) => (
                    <MentorCard key={m.userId} mentor={m} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: 12,
                      marginTop: 32,
                    }}
                  >
                    {page > 1 ? (
                      <Link href={buildPageHref(page - 1)} className="dz-btn dz-btn-ghost dz-btn-sm">
                        ← {t('pagination.prev')}
                      </Link>
                    ) : (
                      <span className="dz-btn dz-btn-ghost dz-btn-sm" aria-disabled style={{ opacity: 0.4 }}>
                        ← {t('pagination.prev')}
                      </span>
                    )}
                    <span className="dz-small">
                      {t('pagination.page', { page, total: totalPages })}
                    </span>
                    {page < totalPages ? (
                      <Link href={buildPageHref(page + 1)} className="dz-btn dz-btn-ghost dz-btn-sm">
                        {t('pagination.next')} →
                      </Link>
                    ) : (
                      <span className="dz-btn dz-btn-ghost dz-btn-sm" aria-disabled style={{ opacity: 0.4 }}>
                        {t('pagination.next')} →
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <style>{`
          @media (max-width: 860px) {
            .dz-discover-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </>
  );
}

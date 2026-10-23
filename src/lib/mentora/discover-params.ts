/**
 * URL search params ⇄ directory filters for `/mentora/discover`.
 *
 * Garbage in (unknown sort, bad page, out-of-range rating…) degrades to
 * defaults instead of failing the zod schema in `discoverMentors`, which
 * would otherwise blank the whole list. Pure, relative imports only.
 */

export type DiscoverSort = 'relevance' | 'recent';
type Format = 'REMOTE' | 'IN_PERSON' | 'HYBRID';
type Category = 'TECHNICAL' | 'SOFT' | 'CAREER' | 'BUSINESS' | 'CREATIVE';

export type ParsedDiscoverParams = {
  q?: string;
  skillSlugs?: string[];
  languages?: string[];
  format?: Format;
  minRating?: number;
  category?: Category;
  reactiveOnly: boolean;
  sort: DiscoverSort;
  page: number;
};

const FORMATS: readonly Format[] = ['REMOTE', 'IN_PERSON', 'HYBRID'];
const CATEGORIES: readonly Category[] = ['TECHNICAL', 'SOFT', 'CAREER', 'BUSINESS', 'CREATIVE'];
const Q_MAX = 200;

function oneOf<T extends string>(list: readonly T[], value: string | undefined): T | undefined {
  return list.find((v) => v === value);
}

export function parseDiscoverParams(sp: Record<string, string | undefined>): ParsedDiscoverParams {
  const out: ParsedDiscoverParams = {
    reactiveOnly: sp.reactive === '1',
    sort: sp.sort === 'recent' ? 'recent' : 'relevance',
    page: 1,
  };

  const q = sp.q?.trim().slice(0, Q_MAX);
  if (q) out.q = q;

  const skillSlugs = sp.skills?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  if (skillSlugs.length > 0) out.skillSlugs = skillSlugs;

  const language = sp.language?.trim();
  if (language) out.languages = [language];

  const format = oneOf(FORMATS, sp.format);
  if (format) out.format = format;

  const category = oneOf(CATEGORIES, sp.category);
  if (category) out.category = category;

  const rating = Math.round(Number(sp.minRating));
  if (Number.isFinite(rating) && rating >= 1 && rating <= 5) out.minRating = rating;

  const page = Math.trunc(Number(sp.page));
  if (Number.isFinite(page) && page >= 1) out.page = page;

  return out;
}

/** Serialises filters back to a URL, omitting defaults so links stay short. */
export function buildDiscoverHref(
  p: ParsedDiscoverParams,
  overrides: Partial<ParsedDiscoverParams> = {},
): string {
  const v = { ...p, ...overrides };
  const next = new URLSearchParams();
  if (v.q) next.set('q', v.q);
  if (v.skillSlugs?.length) next.set('skills', v.skillSlugs.join(','));
  if (v.languages?.[0]) next.set('language', v.languages[0]);
  if (v.format) next.set('format', v.format);
  if (v.minRating) next.set('minRating', String(v.minRating));
  if (v.category) next.set('category', v.category);
  if (v.reactiveOnly) next.set('reactive', '1');
  if (v.sort !== 'relevance') next.set('sort', v.sort);
  if (v.page > 1) next.set('page', String(v.page));
  const qs = next.toString();
  return qs ? `/mentora/discover?${qs}` : '/mentora/discover';
}

import 'server-only';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

import type { BrandLogo } from '@/components/ui/brand-scoller';

/**
 * Auto-discovery of partner logos from `/public/images/partners/`.
 *
 * The legacy approach hard-coded an enum of slugs in `app/page.tsx` and
 * required a code edit + redeploy every time a new partner joined. With
 * this helper, dropping `<slug>.svg|.png|.webp|.jpg` into the partners
 * folder is enough — the file is picked up at the next render.
 *
 * Per-slug overrides (display height, font weight…) live in
 * `PARTNER_OVERRIDES` below. Unknown slugs fall back to neutral defaults
 * — same look, just no special-casing — which is fine because the typo
 * fallback only kicks in if the image fails to load anyway.
 *
 * Slug rules:
 *  - Filename without extension is the slug.
 *  - Slug must be lowercase / kebab-case (Linux/Vercel are case-sensitive).
 *  - The display name is humanised from the slug unless an override
 *    provides one (`hec-paris` → `HEC Paris`, `becomtech` → `BECOMTECH`).
 *
 * The function is `async` because filesystem access is async, and runs
 * server-side only (`server-only` import). Cached per-request by Next's
 * built-in fetch/`unstable_cache` if the consumer wraps it.
 */

const PARTNERS_DIR = path.join(process.cwd(), 'public', 'images', 'partners');
const ALLOWED_EXTS = new Set(['.svg', '.png', '.webp', '.jpg', '.jpeg']);

/**
 * Per-slug overrides. Add an entry only when the auto-derived defaults
 * don't look right. The `name` field is the visible label used by the
 * typography fallback when the image fails — pick what the brand
 * actually calls itself in marketing material.
 */
const PARTNER_OVERRIDES: Record<
  string,
  {
    name?: string;
    heightPx?: number;
    weight?: number;
    italic?: boolean;
    letterSpacing?: string;
    fontFamily?: string;
    maxWidthPx?: number;
  }
> = {
  microsoft: { name: 'Microsoft', heightPx: 30, weight: 600, letterSpacing: '-0.01em' },
  ey: { name: 'EY', heightPx: 44, weight: 900, letterSpacing: '0.16em' },
  allianz: { name: 'Allianz Technology', heightPx: 28, weight: 800, letterSpacing: '-0.01em' },
  aws: { name: 'AWS', heightPx: 36, weight: 800, letterSpacing: '-0.04em' },
  epitech: { name: 'Epitech', heightPx: 30, weight: 900, letterSpacing: '0.04em' },
  hec: { name: 'HEC Paris', heightPx: 38, weight: 700, fontFamily: 'Georgia, serif', italic: true, letterSpacing: '0.02em' },
  stationf: { name: 'Station F', heightPx: 28, weight: 800, letterSpacing: '-0.03em' },
  becomtech: { name: 'BECOMTECH', heightPx: 32, weight: 700, italic: true, letterSpacing: '-0.01em' },
};

/** Default visual — used when no override exists for a slug. */
const DEFAULT_OVERRIDE = {
  heightPx: 32,
  weight: 700,
  letterSpacing: '0' as const,
};

/**
 * Humanise a slug into a display name when no override is provided.
 *  `hec-paris` → `HEC Paris` (segments capitalised, ALL-CAPS preserved)
 *  `digital-act` → `Digital Act`
 */
function humanise(slug: string): string {
  return slug
    .split('-')
    .map((seg) => {
      if (seg.length === 0) return seg;
      // Heuristic: 2-3 char segments stay uppercase (EY, AWS, RSE).
      if (seg.length <= 3) return seg.toUpperCase();
      return seg.charAt(0).toUpperCase() + seg.slice(1);
    })
    .join(' ');
}

/**
 * Read the partners directory and return a stable list of `BrandLogo`s
 * suitable for `<BrandScroller logos={…} />`. Sorted alphabetically by
 * slug so the order is deterministic across renders (avoids visual
 * thrashing from undefined directory iteration order).
 *
 * Errors (missing dir, permission) are swallowed and return an empty
 * array — the marquee is decorative, not load-bearing.
 */
export async function getPartnerLogos(): Promise<BrandLogo[]> {
  let entries: string[] = [];
  try {
    entries = await readdir(PARTNERS_DIR);
  } catch {
    return [];
  }

  // Group by slug so we don't ship the same partner twice when both a
  // .svg and .png exist (SVG wins — it's vectorial).
  const bySlug = new Map<string, { ext: string; file: string }>();
  for (const file of entries) {
    const ext = path.extname(file).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) continue;
    const slug = path.basename(file, ext).toLowerCase();
    const existing = bySlug.get(slug);
    if (!existing) {
      bySlug.set(slug, { ext, file });
      continue;
    }
    // Prefer SVG > WebP > PNG > JPG (best compression / scalability).
    const score = (e: string) =>
      e === '.svg' ? 4 : e === '.webp' ? 3 : e === '.png' ? 2 : 1;
    if (score(ext) > score(existing.ext)) {
      bySlug.set(slug, { ext, file });
    }
  }

  const slugs = [...bySlug.keys()].sort();

  return slugs.map((slug) => {
    const { file } = bySlug.get(slug)!;
    const override = PARTNER_OVERRIDES[slug] ?? {};
    return {
      name: override.name ?? humanise(slug),
      alt: override.name ?? humanise(slug),
      src: `/images/partners/${file}`,
      heightPx: override.heightPx ?? DEFAULT_OVERRIDE.heightPx,
      weight: override.weight ?? DEFAULT_OVERRIDE.weight,
      italic: override.italic,
      letterSpacing: override.letterSpacing ?? DEFAULT_OVERRIDE.letterSpacing,
      fontFamily: override.fontFamily,
      maxWidthPx: override.maxWidthPx,
    };
  });
}

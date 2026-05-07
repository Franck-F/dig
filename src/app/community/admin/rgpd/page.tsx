import fs from 'node:fs/promises';
import path from 'node:path';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { marked } from 'marked';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Registre RGPD · Communauté' };

type Frontmatter = Record<string, string>;
type Search = { tab?: string };

const TABS = [
  { key: 'traitements', file: 'registre-traitements.md', label: 'Traitements' },
  { key: 'violations', file: 'registre-violations.md', label: 'Violations' },
  { key: 'aipd-mentora', file: 'aipd-mentora.md', label: 'AIPD Mentora' },
  { key: 'aipd-community', file: 'aipd-community.md', label: 'AIPD Community' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function parseFrontmatter(raw: string): { meta: Frontmatter; body: string } {
  if (!raw.startsWith('---\n')) return { meta: {}, body: raw };
  const end = raw.indexOf('\n---\n', 4);
  if (end === -1) return { meta: {}, body: raw };
  const headerBlock = raw.slice(4, end);
  const body = raw.slice(end + 5);
  const meta: Frontmatter = {};
  for (const line of headerBlock.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) meta[key] = value;
  }
  return { meta, body };
}

/**
 * Renders the RGPD docs (registre des traitements, registre des
 * violations, AIPDs) from `docs/rgpd/*.md`. ADMIN-only. Tabs query
 * string ?tab= switches between documents — bundled with the deploy
 * via outputFileTracingIncludes in next.config.ts.
 */
export default async function RgpdPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/community/admin/rgpd');

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (me?.role !== 'ADMIN') redirect('/community');

  const sp = await searchParams;
  const requestedKey = (sp.tab ?? 'traitements') as TabKey;
  const tab = TABS.find((t) => t.key === requestedKey) ?? TABS[0];

  const filePath = path.join(process.cwd(), 'docs', 'rgpd', tab.file);
  let raw: string | null = null;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    raw = null;
  }

  const parsed = raw ? parseFrontmatter(raw) : null;
  marked.setOptions({ gfm: true, breaks: false });
  const html = parsed ? await marked.parse(parsed.body) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(115,1,255,0.08), rgba(244,111,177,0.08))',
          border: '1px solid rgba(115,1,255,0.15)',
          borderRadius: 22,
          padding: 22,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: '#7301FF',
            marginBottom: 6,
          }}
        >
          Communauté · Conformité
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1a1f3a' }}>
          {parsed?.meta.titre ?? 'Registre RGPD'}
        </h1>
        {parsed && (
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#545b7a' }}>
            Version {parsed.meta.version ?? '—'} · dernière révision{' '}
            {parsed.meta.derniere_mise_a_jour ?? '—'}
          </p>
        )}
      </div>

      <nav
        aria-label="Sections RGPD"
        style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          padding: 6,
          background: 'rgba(115,1,255,0.04)',
          border: '1px solid rgba(115,1,255,0.10)',
          borderRadius: 12,
        }}
      >
        {TABS.map((t) => {
          const active = t.key === tab.key;
          return (
            <Link
              key={t.key}
              href={`/community/admin/rgpd?tab=${t.key}`}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                background: active ? 'white' : 'transparent',
                color: active ? '#7301FF' : '#545b7a',
                textDecoration: 'none',
                boxShadow: active ? '0 2px 6px rgba(115,1,255,0.10)' : 'none',
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {html ? (
        <article
          className="rgpd-registry"
          style={{
            background: 'white',
            border: '1px solid rgba(115,1,255,0.10)',
            borderRadius: 14,
            padding: '32px 36px',
            color: '#1a1f3a',
            fontSize: 14,
            lineHeight: 1.65,
          }}
          // The HTML comes from `marked.parse()` over a markdown file
          // we ship inside the deploy bundle (`docs/rgpd/*.md`). Source
          // is fully controlled by the team, audience is ADMIN-only,
          // and marked has its options pinned (gfm:true, breaks:false)
          // — no user-supplied input enters this string.
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            color: '#8b91ad',
            background: 'white',
            border: '1px solid rgba(115,1,255,0.10)',
            borderRadius: 14,
            fontSize: 14,
          }}
        >
          Le document <code>docs/rgpd/{tab.file}</code> n&apos;existe pas encore. Crée-le dans
          le dépôt pour qu&apos;il s&apos;affiche ici.
        </div>
      )}

      <style>{`
        .rgpd-registry h1 { font-size: 22px; margin: 0 0 16px; }
        .rgpd-registry h2 { font-size: 18px; margin: 28px 0 12px; color: #1a1f3a; border-bottom: 1px solid rgba(115,1,255,0.10); padding-bottom: 6px; }
        .rgpd-registry h3 { font-size: 15px; margin: 22px 0 10px; color: #7301FF; }
        .rgpd-registry h4 { font-size: 14px; margin: 16px 0 8px; color: #1a1f3a; }
        .rgpd-registry table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
        .rgpd-registry th, .rgpd-registry td { padding: 8px 12px; text-align: left; border: 1px solid rgba(115,1,255,0.10); vertical-align: top; }
        .rgpd-registry th { background: rgba(115,1,255,0.04); font-weight: 700; }
        .rgpd-registry blockquote { margin: 12px 0; padding: 10px 14px; border-left: 3px solid #7301FF; background: rgba(115,1,255,0.04); border-radius: 0 8px 8px 0; color: #545b7a; }
        .rgpd-registry code { background: rgba(115,1,255,0.06); padding: 1px 6px; border-radius: 4px; font-size: 12px; color: #7301FF; }
        .rgpd-registry pre { background: rgba(115,1,255,0.04); padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 12px; }
        .rgpd-registry pre code { background: transparent; padding: 0; }
        .rgpd-registry hr { border: 0; border-top: 1px solid rgba(115,1,255,0.10); margin: 28px 0; }
        .rgpd-registry ul, .rgpd-registry ol { padding-left: 22px; }
        .rgpd-registry li { margin: 4px 0; }
        .rgpd-registry a { color: #7301FF; text-decoration: underline; }
      `}</style>
    </div>
  );
}

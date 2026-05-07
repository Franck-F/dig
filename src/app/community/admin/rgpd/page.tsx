import fs from 'node:fs/promises';
import path from 'node:path';

import { redirect } from 'next/navigation';
import { marked } from 'marked';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Registre RGPD · Communauté' };

type Frontmatter = Record<string, string>;

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
 * Renders the RGPD treatment registry from the source markdown at
 * docs/rgpd/registre-traitements.md. ADMIN-only.
 */
export default async function RgpdPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/community/admin/rgpd');

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (me?.role !== 'ADMIN') redirect('/community');

  const filePath = path.join(process.cwd(), 'docs', 'rgpd', 'registre-traitements.md');
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#8b91ad' }}>
        Le registre n&apos;a pas été trouvé sur le serveur ({filePath}). Vérifie qu&apos;il est bien
        inclus dans le déploiement.
      </div>
    );
  }

  const { meta, body } = parseFrontmatter(raw);
  marked.setOptions({ gfm: true, breaks: false });
  const html = await marked.parse(body);

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
          {meta.titre ?? 'Registre RGPD'}
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#545b7a' }}>
          Version {meta.version ?? '—'} · dernière révision {meta.derniere_mise_a_jour ?? '—'} ·
          prochaine revue {meta.prochaine_revue ?? '—'}
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#7301FF' }}>
          DPO : <a href={`mailto:${meta.contact_dpo}`} style={{ color: '#7301FF' }}>{meta.contact_dpo ?? '—'}</a>
        </p>
      </div>

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
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <style>{`
        .rgpd-registry h1 { font-size: 22px; margin: 0 0 16px; }
        .rgpd-registry h2 { font-size: 18px; margin: 28px 0 12px; color: #1a1f3a; border-bottom: 1px solid rgba(115,1,255,0.10); padding-bottom: 6px; }
        .rgpd-registry h3 { font-size: 15px; margin: 22px 0 10px; color: #7301FF; }
        .rgpd-registry table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
        .rgpd-registry th, .rgpd-registry td { padding: 8px 12px; text-align: left; border: 1px solid rgba(115,1,255,0.10); vertical-align: top; }
        .rgpd-registry th { background: rgba(115,1,255,0.04); font-weight: 700; }
        .rgpd-registry blockquote { margin: 12px 0; padding: 10px 14px; border-left: 3px solid #7301FF; background: rgba(115,1,255,0.04); border-radius: 0 8px 8px 0; color: #545b7a; }
        .rgpd-registry code { background: rgba(115,1,255,0.06); padding: 1px 6px; border-radius: 4px; font-size: 12px; color: #7301FF; }
        .rgpd-registry hr { border: 0; border-top: 1px solid rgba(115,1,255,0.10); margin: 28px 0; }
        .rgpd-registry ul, .rgpd-registry ol { padding-left: 22px; }
        .rgpd-registry li { margin: 4px 0; }
        .rgpd-registry a { color: #7301FF; text-decoration: underline; }
      `}</style>
    </div>
  );
}

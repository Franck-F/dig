import type { Metadata } from 'next';
import Link from 'next/link';

import { searchPosts } from '@/lib/community/search';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Recherche · Communauté Digizelle',
};

type Search = { q?: string };

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function highlight(text: string, query: string): string {
  // Cheap server-side highlight — no HTML escaping needed because the
  // surrounding component renders this as plain text via `{...}` (no
  // dangerouslySetInnerHTML). We just trim long bodies around the
  // first match so the snippet feels relevant.
  const tokens = query
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) return text.slice(0, 240);

  const lower = text.toLowerCase();
  let firstHit = -1;
  for (const t of tokens) {
    const idx = lower.indexOf(t.toLowerCase());
    if (idx >= 0 && (firstHit === -1 || idx < firstHit)) firstHit = idx;
  }
  if (firstHit === -1) return text.slice(0, 240);
  const start = Math.max(0, firstHit - 60);
  const end = Math.min(text.length, firstHit + 240);
  const prefix = start > 0 ? '… ' : '';
  const suffix = end < text.length ? ' …' : '';
  return prefix + text.slice(start, end) + suffix;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const hits = q.length >= 2 ? await searchPosts(q, { limit: 30 }) : [];

  return (
    <section className="dz-section" style={{ paddingTop: 32, paddingBottom: 80 }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <Link
          href="/community"
          style={{ fontSize: 13, color: '#7301FF', fontWeight: 600, textDecoration: 'none' }}
        >
          ← Communauté
        </Link>

        <h1 style={{ margin: '14px 0 4px', fontSize: 28, fontWeight: 800, color: '#1a1f3a' }}>
          Recherche
        </h1>
        <p style={{ margin: '0 0 18px', fontSize: 14, color: '#545b7a' }}>
          Cherche dans les posts publiés de la communauté Digizelle.
        </p>

        <form
          action="/community/search"
          method="get"
          style={{
            display: 'flex',
            gap: 8,
            padding: 6,
            borderRadius: 14,
            background: 'white',
            border: '1px solid rgba(115,1,255,0.20)',
          }}
        >
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Mot-clé ou phrase…"
            autoFocus
            minLength={2}
            maxLength={200}
            style={{
              flex: 1,
              border: 'none',
              padding: '10px 12px',
              fontSize: 15,
              outline: 'none',
              fontFamily: 'inherit',
              background: 'transparent',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
              color: 'white',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Chercher
          </button>
        </form>

        {q.length === 0 ? null : q.length < 2 ? (
          <p style={{ marginTop: 24, fontSize: 14, color: '#8b91ad' }}>
            Saisis au moins 2 caractères.
          </p>
        ) : hits.length === 0 ? (
          <p style={{ marginTop: 24, fontSize: 14, color: '#8b91ad' }}>
            Aucun post ne correspond à <strong>{q}</strong>.
          </p>
        ) : (
          <div style={{ marginTop: 24 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#7301FF',
                marginBottom: 12,
              }}
            >
              {hits.length} résultat{hits.length > 1 ? 's' : ''} pour &laquo; {q} &raquo;
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
              {hits.map((hit) => (
                <li
                  key={hit.id}
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    background: 'white',
                    border: '1px solid rgba(115,1,255,0.10)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      fontSize: 12,
                      color: '#8b91ad',
                      marginBottom: 6,
                    }}
                  >
                    <Link href={`/community/c/${hit.channelSlug}`} style={{ color: '#7301FF', fontWeight: 700, textDecoration: 'none' }}>
                      #{hit.channelSlug}
                    </Link>
                    <span aria-hidden>·</span>
                    <Link href={`/community/members/${hit.authorHandle}`} style={{ color: '#545b7a', textDecoration: 'none' }}>
                      @{hit.authorHandle}
                    </Link>
                    {hit.publishedAt && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{dateFmt.format(hit.publishedAt)}</span>
                      </>
                    )}
                  </div>
                  <Link
                    href={`/community/posts/${hit.id}`}
                    style={{
                      display: 'block',
                      fontSize: 16,
                      fontWeight: 800,
                      color: '#1a1f3a',
                      textDecoration: 'none',
                      marginBottom: 4,
                    }}
                  >
                    {hit.title ?? 'Post sans titre'}
                  </Link>
                  <p style={{ margin: 0, fontSize: 13, color: '#3a2960', lineHeight: 1.6 }}>
                    {highlight(hit.body, q)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

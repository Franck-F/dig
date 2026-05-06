import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import Frame from '@/components/Frame';
import {
  articleJsonLd,
  breadcrumbJsonLd,
  jsonLdScriptProps,
} from '@/lib/seo/jsonld';

const POST_INDICES = ['0', '1', '2', '3', '4', '5'] as const;
type PostIdx = (typeof POST_INDICES)[number];

type Params = { slug: string };

/**
 * Resolve the post index from its slug. Returns null if the slug doesn't
 * match any known post — caller should 404.
 */
async function findIndex(slug: string): Promise<PostIdx | null> {
  const t = await getTranslations('blog');
  for (const i of POST_INDICES) {
    if (t(`posts.${i}.slug`) === slug) return i;
  }
  return null;
}

export async function generateStaticParams(): Promise<Params[]> {
  const t = await getTranslations('blog');
  return POST_INDICES.map((i) => ({ slug: t(`posts.${i}.slug`) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const i = await findIndex(slug);
  if (!i) return { title: 'Article introuvable' };
  const t = await getTranslations('blog');
  return {
    title: t(`posts.${i}.title`),
    description: t(`posts.${i}.excerpt`),
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const i = await findIndex(slug);
  if (!i) notFound();

  const t = await getTranslations('blog');
  const tCommon = await getTranslations('common');

  const title = t(`posts.${i}.title`);
  const author = t(`posts.${i}.author`);
  const date = t(`posts.${i}.date`);
  const iso = t(`posts.${i}.iso`);
  const category = t(`posts.${i}.category`);
  const body = t(`posts.${i}.body`);
  const excerpt = t(`posts.${i}.excerpt`);

  return (
    <Frame active="blog">
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: t('metaTitle'), url: '/blog' },
            { name: title, url: `/blog/${slug}` },
          ]),
        )}
      />
      <script
        {...jsonLdScriptProps(
          articleJsonLd({
            url: `/blog/${slug}`,
            headline: title,
            description: excerpt,
            datePublished: iso,
            authorName: author,
            category,
          }),
        )}
      />

      <article className="dz-section" style={{ paddingTop: 40, maxWidth: 820, margin: '0 auto' }}>
        <Link href="/blog" className="dz-small" style={{ color: '#7301FF', fontWeight: 600 }}>
          ← {tCommon('discover')}
        </Link>
        <span className="dz-chip --pink" style={{ marginLeft: 12 }}>{category}</span>
        <h1 className="dz-h1" style={{ marginTop: 18, fontSize: 48 }}>{title}</h1>
        <p className="dz-body" style={{ fontSize: 18, marginTop: 18 }}>{excerpt}</p>
        <div className="dz-small" style={{ marginTop: 14 }}>
          {author} · {date}
        </div>
        <div
          className="dz-body"
          style={{ marginTop: 28, fontSize: 17, lineHeight: 1.7, whiteSpace: 'pre-line' }}
        >
          {body}
        </div>
        <div style={{ marginTop: 40 }}>
          <Link href="/blog" className="dz-btn dz-btn-ghost">← Retour au blog</Link>
        </div>
      </article>
    </Frame>
  );
}

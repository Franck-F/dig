import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import Frame from '@/components/Frame';
import Mascot3D from '@/components/Mascot3D';
import {
  articleJsonLd,
  breadcrumbJsonLd,
  collectionPageJsonLd,
  itemListJsonLd,
  jsonLdScriptProps,
} from '@/lib/seo/jsonld';

import BlogList from './BlogList';
import NewsletterInline from './NewsletterInline';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('blog');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

const POSTS = ['0', '1', '2', '3', '4', '5'] as const;

export default async function BlogPage() {
  const t = await getTranslations('blog');

  // BlogPosting JSON-LD for the featured + each post (uses the iso/slug
  // keys added to messages/fr.json).
  const featuredArticleLd = articleJsonLd({
    url: `/blog/${t('featured.slug')}`,
    headline: t('featured.title'),
    description: t('featured.body'),
    datePublished: t('featured.iso'),
    authorName: t('featured.author'),
    category: t('featured.category'),
  });
  const postArticleLd = POSTS.map((i) =>
    articleJsonLd({
      url: `/blog/${t(`posts.${i}.slug`)}`,
      headline: t(`posts.${i}.title`),
      datePublished: t(`posts.${i}.iso`),
      authorName: t(`posts.${i}.author`),
      category: t(`posts.${i}.category`),
    }),
  );

  return (
    <Frame active="blog">
      {/* JSON-LD: CollectionPage + Breadcrumb + ItemList + Article entries. */}
      <script
        {...jsonLdScriptProps(
          collectionPageJsonLd({
            url: '/blog',
            name: t('metaTitle'),
            description: t('metaDescription'),
          }),
        )}
      />
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: t('metaTitle'), url: '/blog' },
          ]),
        )}
      />
      <script {...jsonLdScriptProps(featuredArticleLd)} />
      {postArticleLd.map((ld, i) => (
        <script key={`post-${i}`} {...jsonLdScriptProps(ld)} />
      ))}
      <script
        {...jsonLdScriptProps(
          itemListJsonLd({
            name: 'Articles Digizelle',
            url: '/blog',
            items: [
              { name: t('featured.title'), url: `/blog/${t('featured.slug')}` },
              ...POSTS.map((i) => ({
                name: t(`posts.${i}.title`),
                url: `/blog/${t(`posts.${i}.slug`)}`,
              })),
            ],
          }),
        )}
      />

      <section className="dz-section" style={{ paddingTop: 40 }}>
        <div className="dz-eyebrow"><span className="dot"></span>{t('eyebrow')}</div>
        <h1 className="dz-h1" style={{ marginTop: 18 }}>
          {t('title')} <span className="dz-grad-text">{t('titleHighlight')}</span>
        </h1>
        {/* Search + filter + grid live in a client island so the page can
            stay server-rendered for the hero and JSON-LD. */}
        <BlogList />
      </section>

      <section className="dz-section" style={{ paddingTop: 0 }}>
        <div className="dz-card" style={{ padding: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 360 }}>
          <div style={{ background: 'linear-gradient(135deg, #7301FF, #A34BF5 60%, #F46FB1)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mascot3D src="/images/robot-mascotte-1.png" width={260} intensity={12} />
          </div>
          <div style={{ padding: 48, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span className="dz-chip --pink">{t('featured.label', { category: t('featured.category') })}</span>
            <h2 className="dz-h2" style={{ marginTop: 14 }}>{t('featured.title')}</h2>
            <p className="dz-body" style={{ marginTop: 14, fontSize: 16 }}>{t('featured.body')}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 24 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#7301FF,#A34BF5)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>PM</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{t('featured.author')}</div>
                <div className="dz-small">{t('featured.date')}</div>
              </div>
              <Link
                href={`/blog/${t('featured.slug')}`}
                className="dz-btn dz-btn-primary"
                style={{ marginLeft: 'auto' }}
              >
                {t('featured.readMore')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section id="newsletter" className="dz-section" style={{ scrollMarginTop: 96 }}>
        <div className="dz-glass-strong" style={{ padding: 48, borderRadius: 32, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(60% 100% at 50% 0%, rgba(163,75,245,0.25), transparent 70%)' }} />
          <div style={{ position: 'relative' }}>
            <h2 className="dz-h2">{t('newsletter.title')} <span className="dz-grad-text">{t('newsletter.titleHighlight')}</span></h2>
            <p className="dz-body" style={{ marginTop: 12, fontSize: 17, maxWidth: 520, margin: '12px auto 24px' }}>{t('newsletter.intro')}</p>
            <NewsletterInline />
          </div>
        </div>
      </section>
    </Frame>
  );
}

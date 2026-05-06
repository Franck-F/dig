import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import Frame from '@/components/Frame';
import Mascot3D from '@/components/Mascot3D';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('notFound');
  return {
    title: t('metaTitle'),
  };
}

export default async function NotFound() {
  const t = await getTranslations('notFound');
  const tCommon = await getTranslations('common');

  return (
    <Frame active="notfound">
      <section className="dz-section" style={{ paddingTop: 40, paddingBottom: 40, minHeight: 720, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center', maxWidth: 1100 }}>
          <div>
            <div className="dz-eyebrow"><span className="dot"></span>{t('eyebrow')}</div>
            <h1 className="dz-h1" style={{ marginTop: 18, fontSize: 84 }}>
              <span className="dz-grad-text">{t('title')}</span><br />{t('titleSuffix')}
            </h1>
            <p className="dz-body" style={{ fontSize: 18, marginTop: 22, maxWidth: 420 }}>
              {t('body')}
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
              <Link href="/" className="dz-btn dz-btn-primary dz-btn-lg">{t('home')}</Link>
              <Link href="/contact" className="dz-btn dz-btn-ghost dz-btn-lg">{t('report')}</Link>
            </div>
            <div style={{ display: 'flex', gap: 18, marginTop: 36, flexWrap: 'wrap' }}>
              <Link href="/programs" style={{ color: '#7301FF', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>{t('shortcuts.programs')}</Link>
              <Link href="/mentora" style={{ color: '#7301FF', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>{t('shortcuts.mentora')}</Link>
              <Link href="/events" style={{ color: '#7301FF', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>{t('shortcuts.events')}</Link>
              <Link href="/blog" style={{ color: '#7301FF', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>{t('shortcuts.blog')}</Link>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
            <Mascot3D src="/images/robot.png" alt={tCommon('mascotAlt')} width={420} intensity={22} />
          </div>
        </div>
      </section>
    </Frame>
  );
}

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Frame from '@/components/Frame';
import LoginCharacters from '@/components/LoginCharacters';
import { oauthEnabled } from '@/auth';
import LoginForm from './LoginForm';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('login');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function LoginPage() {
  const t = await getTranslations('login');

  return (
    <Frame active="login">
      {/* Visually hidden h1 for accessibility — there was no top-level
          heading for the route until now. */}
      <h1 className="dz-sr-only">{t('title')}</h1>
      <section className="dz-section dz-login-section">
        <div className="dz-login-grid">
          <div
            className="dz-card dz-login-side"
            style={{
              padding: 0,
              overflow: 'hidden',
              position: 'relative',
              background: 'linear-gradient(160deg, #7301FF 0%, #A34BF5 50%, #F46FB1 100%)',
              color: 'white',
            }}
          >
            <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(60% 60% at 20% 20%, rgba(255,255,255,0.30), transparent 70%)' }} />
            <div aria-hidden className="dz-login-grid-overlay" />
            <div style={{ position: 'relative', padding: 48, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 620 }}>
              <div>
                <span className="dz-chip --white">{t('side.chip')}</span>
                <h2 className="dz-h2" style={{ color: 'white', marginTop: 14 }}>
                  {t('side.titleLine1')}
                  <br />
                  {t('side.titleLine2')}
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.85)', marginTop: 14, fontSize: 16, maxWidth: 380 }}>
                  {t('side.body')}
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', flex: 1, minHeight: 320 }}>
                <LoginCharacters />
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'rgba(255,255,255,0.85)', flexWrap: 'wrap' }}>
                <div>● {t('side.secure')}</div>
                <div>● {t('side.rgpd')}</div>
                <div>● {t('side.noSpam')}</div>
              </div>
            </div>
          </div>

          <LoginForm oauthEnabled={oauthEnabled} />
        </div>
      </section>
    </Frame>
  );
}

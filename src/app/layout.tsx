import type { Metadata, Viewport } from 'next';
import { Signika } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { ThemeProvider } from '@/components/ThemeProvider';
import { CookieConsentProvider } from '@/components/CookieConsentProvider';
import CookieConsent from '@/components/CookieConsent';
import ScrollRevealAuto from '@/components/ScrollRevealAuto';
import WebVitalsReporter from '@/components/WebVitalsReporter';
import {
  SessionContextProvider,
  type SessionInfo,
} from '@/components/SessionContextProvider';
import { prisma } from '@/lib/prisma';
import {
  jsonLdScriptProps,
  organizationJsonLd,
  websiteJsonLd,
} from '@/lib/seo/jsonld';
import './globals.css';

const signika = Signika({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-signika',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('home');
  return {
    metadataBase: new URL('https://digizelle.fr'),
    title: {
      default: `Digizelle — ${t('metaTitle')}`,
      template: '%s · Digizelle',
    },
    description: t('metaDescription'),
    keywords: ['Digizelle', 'association', 'digital', 'inclusion', 'numérique', 'mentorat', 'Mentorat', 'jeunes', 'tech', 'Paris'],
    authors: [{ name: 'Digizelle', url: 'https://digizelle.fr' }],
    creator: 'Digizelle',
    publisher: 'Digizelle',
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      locale: 'fr_FR',
      url: 'https://digizelle.fr',
      siteName: 'Digizelle',
      title: `Digizelle — ${t('metaTitle')}`,
      description: t('metaDescription'),
      images: [{ url: '/images/logo.png', width: 1200, height: 630, alt: 'Digizelle' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Digizelle — ${t('metaTitle')}`,
      description: t('metaDescription'),
      images: ['/images/logo.png'],
    },
    robots: { index: true, follow: true },
    icons: { icon: '/favicon.ico' },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0a2e' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const session = await auth();
  const userId = session?.user?.id ?? null;

  let sessionInfo: SessionInfo = {
    isAuthenticated: false,
    name: null,
    initial: null,
    role: null,
    hasMentorProfile: false,
    hasMenteeProfile: false,
  };

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        name: true,
        email: true,
        role: true,
        mentorProfile: { select: { id: true } },
        menteeProfile: { select: { id: true } },
      },
    });
    if (user) {
      const display =
        user.firstName ?? user.name?.split(' ')[0] ?? user.email?.split('@')[0] ?? 'Membre';
      const initial = (() => {
        const base = (user.firstName ?? user.name ?? user.email ?? 'M').trim();
        const parts = base.split(/\s+/).slice(0, 2);
        return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || base[0]?.toUpperCase() || 'M';
      })();
      sessionInfo = {
        isAuthenticated: true,
        name: display,
        initial,
        role: user.role,
        hasMentorProfile: Boolean(user.mentorProfile),
        hasMenteeProfile: Boolean(user.menteeProfile),
      };
    }
  }

  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={signika.variable}
      suppressHydrationWarning
    >
      <head>
        {/* Site-wide JSON-LD: Organization + WebSite (rendered server-side
            so AI crawlers and search bots see it without executing JS). */}
        <script {...jsonLdScriptProps(organizationJsonLd())} />
        <script {...jsonLdScriptProps(websiteJsonLd())} />
      </head>
      <body className={`${signika.className} antialiased`} suppressHydrationWarning>
        {/* Pre-hydration theme: avoid FOUC for users who previously opted
            into the preferences cookie category. We only consult
            localStorage if the consent record (digizelle-cookie-consent)
            indicates `preferences === true`. Otherwise we leave the body
            class untouched so React renders the default light theme.
            Placed at the start of <body> so document.body is defined. */}
        <script
          // Inline boot script — needs to run before React paints to
          // avoid a flash-of-light-theme. Source is a hard-coded string
          // we control, no user input.
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var c=localStorage.getItem('digizelle-cookie-consent');if(!c)return;var p=JSON.parse(c);if(!p||p.preferences!==true)return;var t=localStorage.getItem('digizelle-theme');if(t==='dark')document.body.classList.add('dz-theme-dark');}catch(e){}})();`,
          }}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SessionContextProvider value={sessionInfo}>
            <CookieConsentProvider>
              <ThemeProvider>{children}</ThemeProvider>
              <CookieConsent />
              <ScrollRevealAuto />
              <WebVitalsReporter />
            </CookieConsentProvider>
          </SessionContextProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

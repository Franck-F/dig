/**
 * JSON-LD structured data helpers for Digizelle.
 *
 * Each helper returns a plain object that can be stringified and injected
 * into a `<script type="application/ld+json">` tag at server-render time.
 *
 * Per Google's December 2025 JS SEO guidance, structured data should be
 * present in the initial server-rendered HTML — these helpers are designed
 * to be called from React Server Components.
 */

export const SITE_URL = 'https://digizelle.fr';
export const SITE_NAME = 'Digizelle';
export const SITE_LOGO = `${SITE_URL}/images/logo.png`;
export const FOUNDING_DATE = '2023';
export const FOUNDER_NAME = 'Priscillia Meza Samira';
export const CONTACT_EMAIL = 'contact@digizelle.fr';

// Social profiles (placeholders — kept here so future updates only touch one
// file). They are valid URLs so search engines won't reject the schema.
export const SAME_AS = [
  'https://www.linkedin.com/company/digizelle',
  'https://www.instagram.com/digizelle',
  'https://twitter.com/digizelle',
  'https://www.facebook.com/digizelle',
];

type Crumb = { name: string; url: string };

type JsonLd = Record<string, unknown>;

/**
 * Helper to render a `<script type="application/ld+json">` payload.
 * Use as: `<script {...jsonLdScriptProps(data)} />`
 */
export function jsonLdScriptProps(data: JsonLd | JsonLd[]) {
  return {
    type: 'application/ld+json',
    dangerouslySetInnerHTML: { __html: JSON.stringify(data) },
  } as const;
}

function abs(path: string): string {
  if (!path) return SITE_URL;
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Organization schema — Digizelle as an NGO (loi 1901 association).
 * Use on the home page or root layout (site-wide).
 */
export function organizationJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'NGO',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    legalName: 'Digizelle',
    alternateName: 'Association Digizelle',
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: SITE_LOGO,
      width: 512,
      height: 512,
    },
    image: SITE_LOGO,
    description:
      "Digizelle est une association française loi 1901 fondée en 2023, dédiée à l'inclusion et à l'épanouissement des jeunes dans le numérique. Basée à Paris.",
    foundingDate: FOUNDING_DATE,
    founder: {
      '@type': 'Person',
      name: FOUNDER_NAME,
      jobTitle: 'Co-fondatrice & CEO',
    },
    knowsAbout: [
      'Inclusion numérique',
      'Mentorat',
      'Formation tech',
      'Diversité dans la tech',
      'Éducation digitale',
    ],
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Paris',
      addressRegion: 'Île-de-France',
      addressCountry: 'FR',
    },
    areaServed: {
      '@type': 'Country',
      name: 'France',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      email: CONTACT_EMAIL,
      contactType: 'customer support',
      areaServed: 'FR',
      availableLanguage: ['French', 'English'],
    },
    sameAs: SAME_AS,
  };
}

/**
 * WebSite schema with sitelinks search box.
 * Use on the root layout (site-wide).
 */
export function websiteJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    inLanguage: 'fr-FR',
    description:
      "Association loi 1901 d'inclusion digitale fondée en 2023 à Paris.",
    publisher: { '@id': `${SITE_URL}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/blog?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * BreadcrumbList — pass an ordered list of crumbs starting from home.
 */
export function breadcrumbJsonLd(crumbs: Crumb[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: abs(c.url),
    })),
  };
}

/**
 * FAQPage schema — pass an array of {q, a} objects.
 */
export function faqPageJsonLd(items: Array<{ q: string; a: string }>): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: it.a,
      },
    })),
  };
}

/**
 * AboutPage schema — for the /about route.
 */
export function aboutPageJsonLd(args: {
  url: string;
  name: string;
  description: string;
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${abs(args.url)}#about`,
    url: abs(args.url),
    name: args.name,
    description: args.description,
    inLanguage: 'fr-FR',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: { '@id': `${SITE_URL}/#organization` },
    mainEntity: { '@id': `${SITE_URL}/#organization` },
  };
}

/**
 * ContactPage schema — for the /contact route.
 */
export function contactPageJsonLd(args: { url: string; name: string }): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    '@id': `${abs(args.url)}#contact`,
    url: abs(args.url),
    name: args.name,
    inLanguage: 'fr-FR',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: { '@id': `${SITE_URL}/#organization` },
  };
}

/**
 * Service schema — used to describe Digizelle programs (Atelier, Masterclass,
 * Hackathon, Mentorat) for the /programs and /mentora pages.
 */
export function serviceJsonLd(args: {
  name: string;
  description: string;
  url: string;
  serviceType?: string;
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: args.name,
    description: args.description,
    url: abs(args.url),
    serviceType: args.serviceType ?? 'Educational program',
    provider: { '@id': `${SITE_URL}/#organization` },
    areaServed: {
      '@type': 'Country',
      name: 'France',
    },
    audience: {
      '@type': 'PeopleAudience',
      audienceType: 'Jeunes intéressés par le numérique',
    },
  };
}

/**
 * Event schema — for an upcoming event listing.
 *
 * `startDate` MUST be ISO 8601 (YYYY-MM-DD or full datetime).
 */
export function eventJsonLd(args: {
  name: string;
  startDate: string;
  endDate?: string;
  locationName: string;
  locationCity?: string;
  description?: string;
  url?: string;
  image?: string;
  status?: 'EventScheduled' | 'EventCancelled' | 'EventPostponed' | 'EventRescheduled' | 'EventMovedOnline';
  attendanceMode?: 'OfflineEventAttendanceMode' | 'OnlineEventAttendanceMode' | 'MixedEventAttendanceMode';
}): JsonLd {
  const isOnline = args.attendanceMode === 'OnlineEventAttendanceMode';
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: args.name,
    startDate: args.startDate,
    ...(args.endDate ? { endDate: args.endDate } : {}),
    eventStatus: `https://schema.org/${args.status ?? 'EventScheduled'}`,
    eventAttendanceMode: `https://schema.org/${args.attendanceMode ?? 'OfflineEventAttendanceMode'}`,
    location: isOnline
      ? {
          '@type': 'VirtualLocation',
          url: args.url ? abs(args.url) : SITE_URL,
        }
      : {
          '@type': 'Place',
          name: args.locationName,
          address: {
            '@type': 'PostalAddress',
            addressLocality: args.locationCity ?? 'Paris',
            addressCountry: 'FR',
          },
        },
    description: args.description,
    image: args.image ? abs(args.image) : abs('/images/logo.png'),
    url: args.url ? abs(args.url) : `${SITE_URL}/events`,
    organizer: { '@id': `${SITE_URL}/#organization` },
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      url: args.url ? abs(args.url) : `${SITE_URL}/events`,
      price: '0',
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      validFrom: '2023-01-01',
    },
  };
}

/**
 * Article / BlogPosting schema for blog posts.
 */
export function articleJsonLd(args: {
  url: string;
  headline: string;
  description?: string;
  datePublished: string;
  dateModified?: string;
  authorName: string;
  image?: string;
  category?: string;
  wordCount?: number;
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${abs(args.url)}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': abs(args.url) },
    headline: args.headline,
    description: args.description,
    datePublished: args.datePublished,
    dateModified: args.dateModified ?? args.datePublished,
    author: {
      '@type': 'Person',
      name: args.authorName,
    },
    image: args.image ? abs(args.image) : abs('/images/logo.png'),
    publisher: { '@id': `${SITE_URL}/#organization` },
    inLanguage: 'fr-FR',
    articleSection: args.category,
    ...(args.wordCount ? { wordCount: args.wordCount } : {}),
  };
}

/**
 * Person schema — for team members / authors.
 */
export function personJsonLd(args: {
  name: string;
  jobTitle?: string;
  description?: string;
  image?: string;
  url?: string;
  sameAs?: string[];
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: args.name,
    jobTitle: args.jobTitle,
    description: args.description,
    image: args.image ? abs(args.image) : undefined,
    url: args.url ? abs(args.url) : undefined,
    worksFor: { '@id': `${SITE_URL}/#organization` },
    sameAs: args.sameAs,
  };
}

/**
 * ItemList wrapper — useful for lists of events, projects, blog posts.
 */
export function itemListJsonLd(args: {
  name: string;
  url: string;
  items: Array<{ name: string; url?: string }>;
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: args.name,
    url: abs(args.url),
    numberOfItems: args.items.length,
    itemListElement: args.items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      ...(item.url ? { url: abs(item.url) } : {}),
    })),
  };
}

/**
 * CollectionPage schema — for index pages like /blog, /events, /projects.
 */
export function collectionPageJsonLd(args: {
  url: string;
  name: string;
  description?: string;
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${abs(args.url)}#collection`,
    url: abs(args.url),
    name: args.name,
    description: args.description,
    inLanguage: 'fr-FR',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: { '@id': `${SITE_URL}/#organization` },
  };
}

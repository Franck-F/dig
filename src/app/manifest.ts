import type { MetadataRoute } from 'next';

/**
 * Web App Manifest for Digizelle.
 *
 * Served at /manifest.webmanifest by Next.js 16.
 * Brand color: violet #7301FF.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Digizelle',
    short_name: 'Digizelle',
    description:
      'Digizelle — association pour l’inclusion numérique des jeunes : mentorat Mentora, programmes tech et événements.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'fr',
    dir: 'ltr',
    background_color: '#0f0a2e',
    theme_color: '#7301FF',
    categories: ['education', 'social', 'nonprofit'],
    // Icon set: only square PWA-grade assets. The previous entry pointed
    // at /images/logo.png which is a 181×51 horizontal banner — Chrome
    // logs `Resource size is not correct - typo in the Manifest?` because
    // `sizes: 'any'` was incompatible with that aspect ratio. Until we
    // ship proper square 192×192 / 512×512 icons (TODO: generate via the
    // brand kit), we keep just the favicon — installability degrades to
    // the browser default but the console stops complaining.
    icons: [
      {
        src: '/favicon.ico',
        sizes: '48x48',
        type: 'image/x-icon',
      },
    ],
  };
}

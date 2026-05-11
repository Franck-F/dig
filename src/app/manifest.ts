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
      'Digizelle — association pour l’inclusion numérique des jeunes : mentorat Mentorat, programmes tech et événements.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'fr',
    dir: 'ltr',
    background_color: '#0f0a2e',
    theme_color: '#7301FF',
    categories: ['education', 'social', 'nonprofit'],
    // Square PWA-grade icons generated from the brand mascot
    // (1563×1563 source → resized via sharp at build prep time;
    // see commit notes). `purpose: 'any'` covers desktop / tab,
    // `purpose: 'maskable'` covers Android adaptive icons (the
    // maskable variant has ~15% safe-zone padding so the OS can
    // crop circles, squircles, etc. without clipping the mascot).
    icons: [
      { src: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

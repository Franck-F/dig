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
    icons: [
      {
        src: '/images/logo.png',
        sizes: 'any',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/favicon.ico',
        sizes: '48x48',
        type: 'image/x-icon',
      },
    ],
  };
}

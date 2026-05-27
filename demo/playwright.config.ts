import { defineConfig } from '@playwright/test';

/**
 * Config Playwright pour l'enregistrement des vidéos tutoriels d'onboarding.
 *
 * Lancer depuis la racine du dépôt :
 *   npx playwright test --config demo/playwright.config.ts
 *
 * Les vidéos finales sont écrites dans  demo/recordings/  :
 *   • mentee-onboarding.webm
 *   • mentor-onboarding.webm
 *
 * `slowMo` ralentit chaque action pour que la vidéo reste lisible ; les
 * scripts ajoutent en plus des pauses explicites entre les étapes.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  // Réinitialise les comptes de démo avant chaque session d'enregistrement
  // → les deux wizards repartent toujours d'un formulaire vide.
  globalSetup: './global-setup.ts',
  // Copie les vidéos vers des noms propres une fois le run terminé.
  globalTeardown: './global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Un walkthrough complet (connexion + wizard) tourne en ~1,5 à 2,5 min.
  timeout: 200_000,
  // Plafond dur du run entier — évite qu'un blocage ne tourne indéfiniment.
  globalTimeout: 900_000,
  reporter: [['list']],
  // Artefacts bruts de Playwright (la vidéo « propre » est copiée par
  // chaque test dans demo/recordings/<nom>.webm).
  outputDir: './recordings/raw',
  use: {
    baseURL: 'https://dig-black.vercel.app',
    browserName: 'chromium',
    headless: true,
    // Format mobile vertical 9:16. Playwright enregistre la vidéo à la
    // taille du VIEWPORT (un `video.size` plus grand laisserait du gris).
    // Viewport 720×1280 : < 900px → layout mobile de l'app, ratio 9:16
    // exact. deviceScaleFactor 2 → rendu supersamplé, texte net. La
    // composition hyperframes affiche ensuite ce flux dans un mockup
    // téléphone sur un canevas 1080×1920.
    viewport: { width: 720, height: 1280 },
    deviceScaleFactor: 2,
    video: { mode: 'on', size: { width: 720, height: 1280 } },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    // Ralentit chaque interaction → walkthrough lisible à l'écran.
    launchOptions: { slowMo: 450 },
  },
});

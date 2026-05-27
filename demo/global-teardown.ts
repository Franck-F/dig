import { copyFileSync, existsSync } from 'node:fs';

/**
 * Copie les vidéos enregistrées (rangées par Playwright dans des
 * sous-dossiers de `recordings/raw/`) vers des noms propres et stables.
 *
 * Ce nettoyage est fait en `globalTeardown` plutôt qu'en `afterEach` :
 * une copie de fichier ne peut pas se figer, contrairement à
 * `page.video().saveAs()` appelé pendant le teardown du test.
 */
const VIDEOS: Array<[src: string, dest: string]> = [
  [
    'demo/recordings/raw/mentee-onboarding-mentee-onboarding/video.webm',
    'demo/recordings/mentee-onboarding.webm',
  ],
  [
    'demo/recordings/raw/mentor-onboarding-mentor-onboarding/video.webm',
    'demo/recordings/mentor-onboarding.webm',
  ],
];

export default function globalTeardown(): void {
  for (const [src, dest] of VIDEOS) {
    if (existsSync(src)) {
      copyFileSync(src, dest);
      console.log(`  ✓ vidéo → ${dest}`);
    }
  }
}

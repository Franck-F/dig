import { test } from '@playwright/test';
import { beat, type, login } from './_helpers';

/**
 * TUTORIEL VIDÉO — Onboarding MENTORÉ
 * Parcours : connexion → wizard 3 étapes → tableau de bord.
 * Vidéo finale : demo/recordings/mentee-onboarding.webm
 *
 * Compte requis (seed) : demo-mentee@digizelle.test
 *   npx tsx prisma/seed-demo-accounts.ts
 */

const EMAIL = 'lea.moreau@gmail.com';
const PASSWORD = 'DemoMentee2026!';

test('mentee-onboarding', async ({ page }) => {
  test.setTimeout(200_000);

  // ─── 1. Connexion ──────────────────────────────────────────────
  await login(page, EMAIL, PASSWORD, '/mentora/onboarding');

  // ─── 2. Étape 1 — Objectifs ────────────────────────────────────
  const step1 = page.getByRole('heading', { name: /objectifs sur Mentorat/i });
  await step1.waitFor({ timeout: 30_000 });
  await step1.scrollIntoViewIfNeeded();
  await beat(page, 2600);

  // Objectif principal
  await page.getByRole('button', { name: /Décrocher mon premier job/i }).click();
  await beat(page);

  // Domaine personnalisé (les puces ci-dessus sont aussi cliquables)
  await type(
    page,
    'input[aria-label="Ajouter un domaine personnalisé"]',
    'Développement front-end',
  );
  await beat(page, 500);
  await page.getByRole('button', { name: /Ajouter/i }).click();
  await beat(page);

  // Description de l'objectif — lue par le mentor avant la 1re session
  await type(
    page,
    '#goals',
    "Decrocher mon premier poste de developpeuse front-end junior d'ici la fin de l'ete.",
  );
  await beat(page, 1800);
  await page.getByRole('button', { name: /Suivant/i }).click();

  // ─── 3. Étape 2 — Parcours ─────────────────────────────────────
  const step2 = page.getByRole('heading', { name: /parcours actuel/i });
  await step2.waitFor();
  await step2.scrollIntoViewIfNeeded();
  await beat(page, 1900);

  await page.getByRole('button', { name: 'Intermédiaire', exact: true }).click();
  await beat(page);
  await page.getByRole('button', { name: 'À distance', exact: true }).click();
  await beat(page);
  await type(
    page,
    '#challenges',
    "Je termine ma formation : besoin d'aide pour structurer mon portfolio et preparer les entretiens techniques.",
  );
  await beat(page, 1400);
  await page.getByRole('button', { name: /Réseaux sociaux/i }).click();
  await beat(page, 1300);
  await page.getByRole('button', { name: /Suivant/i }).click();

  // ─── 4. Étape 3 — Disponibilités ───────────────────────────────
  const step3 = page.getByRole('heading', { name: /Quand es-tu disponible/i });
  await step3.waitFor();
  await step3.scrollIntoViewIfNeeded();
  await beat(page, 1900);

  await page.getByRole('button', { name: /1× \/ semaine/i }).click();
  await beat(page, 1400);

  // Langues + ville
  await type(page, '#languages', 'fr, en', { clear: true });
  await beat(page, 500);
  await type(page, '#location', 'Paris');
  await beat(page, 2400);

  // Terminer → tableau de bord
  await page.getByRole('button', { name: /Terminer/i }).click();

  // ─── 5. Tableau de bord ────────────────────────────────────────
  await page.waitForURL(/\/mentora\/dashboard/, { timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await beat(page, 4000);
});

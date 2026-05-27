import { test } from '@playwright/test';
import { beat, type, login } from './_helpers';

/**
 * TUTORIEL VIDÉO — Onboarding MENTOR
 * Parcours : connexion → wizard 4 étapes (Profil, Expertise, Engagement,
 * Charte) → tableau de bord.
 * Vidéo finale : demo/recordings/mentor-onboarding.webm
 *
 * Compte requis (seed) : demo-mentor@digizelle.test
 *   npx tsx prisma/seed-demo-accounts.ts
 */

const EMAIL = 'thomas.mercier@gmail.com';
const PASSWORD = 'DemoMentor2026!';

test('mentor-onboarding', async ({ page }) => {
  test.setTimeout(200_000);

  // ─── 1. Connexion ──────────────────────────────────────────────
  await login(page, EMAIL, PASSWORD, '/mentora/become-a-mentor');

  // ─── 2. Étape 1 — Profil ───────────────────────────────────────
  const step1 = page.getByRole('heading', { name: /Profil mentor/i });
  await step1.waitFor({ timeout: 30_000 });
  await step1.scrollIntoViewIfNeeded();
  await beat(page, 2600);

  await type(
    page,
    '#headline',
    "Engineering Lead — j'aide les juniors a structurer leur code",
  );
  await beat(page, 800);
  await type(
    page,
    '#bio',
    "Lead frontend, 8 ans d'experience en React et TypeScript. J'accompagne les developpeuses junior sur leur montee en competences, la preparation d'entretiens et les choix d'architecture.",
  );
  await beat(page, 1000);
  await page.locator('#years').fill('8');
  await beat(page, 600);
  await type(page, '#linkedin', 'https://www.linkedin.com/in/demo-mentor');
  await beat(page, 1600);
  await page.getByRole('button', { name: /Suivant/i }).click();

  // ─── 3. Étape 2 — Expertise ────────────────────────────────────
  const step2 = page.getByRole('heading', { name: /^Expertise$/i });
  await step2.waitFor();
  await step2.scrollIntoViewIfNeeded();
  await beat(page, 1900);

  // Puces de compétences curées (au moins une est obligatoire).
  // `button[title]` ne cible que les puces Chip — pas les cartes ni la nav.
  const chips = page.locator('button[title]');
  for (const i of [0, 1, 2]) {
    await chips.nth(i).click();
    await page.waitForTimeout(450);
  }
  await beat(page, 800);

  // Compétence personnalisée
  await type(
    page,
    'input[aria-label="Ajouter une compétence personnalisée"]',
    'Design systems',
  );
  await beat(page, 400);
  await page.getByRole('button', { name: /Ajouter/i }).click();
  await beat(page, 900);

  await page.getByRole('button', { name: /Senior/ }).click();
  await beat(page);
  await page.getByRole('button', { name: 'Avancé', exact: true }).click();
  await beat(page);

  // Profils de mentorées accompagnées (cases à cocher)
  await page.getByRole('checkbox', { name: /Premier job/i }).check();
  await beat(page, 500);
  await page.getByRole('checkbox', { name: /Jeunes diplômées/i }).check();
  await beat(page, 1400);
  await page.getByRole('button', { name: /Suivant/i }).click();

  // ─── 4. Étape 3 — Engagement / Disponibilité ───────────────────
  const step3 = page.getByRole('heading', { name: /^Disponibilité$/i });
  await step3.waitFor();
  await step3.scrollIntoViewIfNeeded();
  await beat(page, 1900);

  await page.getByRole('button', { name: 'À distance', exact: true }).click();
  await beat(page);
  await page.locator('#maxMentees').fill('4');
  await beat(page, 600);
  await page.locator('#responseTime').selectOption('WITHIN_DAY');
  await beat(page, 2000);
  await page.getByRole('button', { name: /Suivant/i }).click();

  // ─── 5. Étape 4 — Charte ───────────────────────────────────────
  const step4 = page.getByRole('heading', { name: /Charte du mentor/i });
  await step4.waitFor();
  await step4.scrollIntoViewIfNeeded();
  await beat(page, 3400); // laisser lire les 5 engagements

  await page.getByRole('checkbox').check();
  await beat(page, 1800);
  await page.getByRole('button', { name: /Soumettre ma candidature/i }).click();

  // ─── 6. Tableau de bord ────────────────────────────────────────
  await page.waitForURL(/\/mentora\/dashboard/, { timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await beat(page, 4000);
});

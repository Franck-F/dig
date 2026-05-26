import type { Page, Locator } from '@playwright/test';

/**
 * Outils partagés par les deux scripts de walkthrough.
 */

/** Pause — laisse au spectateur le temps de lire avant l'action suivante. */
export const beat = (page: Page, ms = 1300): Promise<void> => page.waitForTimeout(ms);

/**
 * Saisie « tapée » caractère par caractère, visible à l'écran.
 * `selector` peut être une chaîne CSS ou un Locator déjà construit.
 */
export async function type(
  page: Page,
  selector: string | Locator,
  text: string,
  { clear = false, delay = 26 }: { clear?: boolean; delay?: number } = {},
): Promise<void> {
  const field = typeof selector === 'string' ? page.locator(selector) : selector;
  await field.scrollIntoViewIfNeeded();
  await field.click();
  if (clear) await field.fill('');
  await field.pressSequentially(text, { delay });
}

/**
 * Accepte le bandeau cookies — de façon VISIBLE à l'écran : on attend
 * que le bandeau apparaisse, on marque une pause pour qu'il soit lisible
 * dans la vidéo, puis on clique « Tout accepter ». Le consentement est
 * mémorisé → le bandeau ne réapparaît plus ensuite.
 */
export async function acceptCookies(page: Page): Promise<void> {
  const accept = page.getByRole('button', { name: /Tout accepter/i });
  try {
    await accept.waitFor({ state: 'visible', timeout: 12_000 });
    await beat(page, 1500); // laisse voir le bandeau
    await accept.click();
    await beat(page, 800);
  } catch {
    /* pas de bandeau cookies — on continue */
  }
}

/**
 * Connexion par identifiants puis navigation vers `target`.
 * Le compte de démo a `emailVerified` + `roleConfirmed` + `mentoraEnabled`
 * posés par le seed → il tombe directement sur le wizard.
 */
export async function login(
  page: Page,
  email: string,
  password: string,
  target: string,
): Promise<void> {
  await page.goto('/login?next=' + encodeURIComponent(target), {
    waitUntil: 'domcontentloaded',
  });
  await acceptCookies(page);
  await beat(page, 1400);
  await type(page, '#login-email', email);
  await beat(page, 500);
  await type(page, '#login-password', password);
  await beat(page, 900);
  await page.getByRole('button', { name: /Se connecter/i }).click();
  // Après connexion : on attend de quitter /login, puis on va sur le wizard.
  // `domcontentloaded` → la navigation n'attend pas qu'une ressource tierce
  // (police, analytics…) finisse de charger, ce qui pourrait la figer.
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), {
    timeout: 45_000,
  });
  await page.goto(target, { waitUntil: 'domcontentloaded' });
}

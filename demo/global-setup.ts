import { execSync } from 'node:child_process';

/**
 * Réinitialise les comptes de démo AVANT chaque session d'enregistrement.
 *
 * Indispensable : un wizard terminé crée un profil en base, et la page
 * d'onboarding redirige alors vers le tableau de bord. Le seed supprime
 * ces profils → les deux wizards repartent vides à chaque exécution de
 * `playwright test`.
 */
export default function globalSetup(): void {
  console.log('\n→ Réinitialisation des comptes de démo (wizards vierges)…');
  execSync('npx tsx prisma/seed-demo-accounts.ts', {
    stdio: 'inherit',
    timeout: 120_000, // garde-fou : un seed figé ne bloque pas tout le run
  });
  console.log('');
}

/**
 * Demo accounts seed — comptes dédiés à l'enregistrement des vidéos
 * tutoriels d'onboarding (mentorée + mentor).
 *
 * Crée / réinitialise deux comptes (identités crédibles pour la vidéo) :
 *   • lea.moreau@gmail.com      — STUDENT, accès Mentorat, SANS
 *       MenteeProfile  → arrive sur un wizard /mentora/onboarding vierge
 *   • thomas.mercier@gmail.com  — STUDENT, accès Mentorat, SANS
 *       MentorProfile  → arrive sur un wizard /mentora/become-a-mentor vierge
 *
 * Le script est idempotent ET réinitialisant : à chaque exécution il
 * supprime les MenteeProfile / MentorProfile créés par ces comptes
 * (les suppressions en cascade nettoient skills, disponibilités, demandes…)
 * pour que chaque enregistrement reparte d'un formulaire vide.
 *
 * Tous les comptes ont `emailVerified` + `passwordHash` posés → connexion
 * immédiate par identifiants, comme `seed-test-accounts.ts`.
 *
 * Usage :
 *   npx tsx prisma/seed-demo-accounts.ts          # crée / réinitialise
 *   npx tsx prisma/seed-demo-accounts.ts clean    # supprime les 2 comptes
 */
import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const ACCOUNTS = [
  {
    label: 'MENTORÉE',
    email: 'lea.moreau@gmail.com',
    password: 'DemoMentee2026!',
    firstName: 'Léa',
    lastName: 'Moreau',
    target: '/mentora/onboarding',
  },
  {
    label: 'MENTOR',
    email: 'thomas.mercier@gmail.com',
    password: 'DemoMentor2026!',
    firstName: 'Thomas',
    lastName: 'Mercier',
    target: '/mentora/become-a-mentor',
  },
] as const;

async function reset() {
  for (const acc of ACCOUNTS) {
    const passwordHash = await hash(acc.password, 12);
    const name = `${acc.firstName} ${acc.lastName}`;
    const data = {
      firstName: acc.firstName,
      lastName: acc.lastName,
      name,
      role: UserRole.STUDENT,
      emailVerified: new Date(),
      passwordHash,
      // roleConfirmed: true + mentoraEnabled: true → le compte passe les
      // gates d'accès et tombe directement sur le wizard, sans /welcome/role.
      roleConfirmed: true,
      mentoraEnabled: true,
    };
    const user = await prisma.user.upsert({
      where: { email: acc.email },
      update: data,
      create: { email: acc.email, ...data },
      select: { id: true },
    });
    // Repart d'un wizard vide : on supprime les profils créés lors d'un
    // précédent enregistrement (cascade → skills / dispo / demandes).
    await prisma.mentorProfile.deleteMany({ where: { userId: user.id } });
    await prisma.menteeProfile.deleteMany({ where: { userId: user.id } });
    console.log(
      `  ✓ ${acc.label.padEnd(9)} ${acc.email}  /  ${acc.password}   → ${acc.target}`,
    );
  }
}

async function clean() {
  for (const acc of ACCOUNTS) {
    // onDelete: Cascade sur User → supprime profils, skills, dispo, etc.
    const deleted = await prisma.user.deleteMany({ where: { email: acc.email } });
    console.log(`  ✓ supprimé ${acc.email} (${deleted.count} compte)`);
  }
}

async function main() {
  const mode = process.argv[2] === 'clean' ? 'clean' : 'reset';
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`Comptes de démo Digizelle — mode : ${mode}`);
  console.log('─────────────────────────────────────────────────────────────');
  if (mode === 'clean') await clean();
  else await reset();
  console.log('─────────────────────────────────────────────────────────────');
  console.log(mode === 'clean' ? 'Comptes de démo supprimés.' : 'Comptes de démo prêts.');
  console.log('─────────────────────────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

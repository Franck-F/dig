/**
 * Demo data seed — populates the DB with a realistic, story-friendly
 * snapshot for partner / investor demos and screen recordings.
 *
 * What it creates (all idempotent — re-runnable):
 *   • 8 mentor accounts with ACTIVE MentorProfile + skills + availability
 *   • 12 mentee accounts with MenteeProfile + goal skills
 *   • 8 active Mentorships (mentor ↔ mentee pairs)
 *   • ~40 Sessions distributed across mentorships (past completed +
 *     2 upcoming scheduled per pair), deterministic dates so re-runs
 *     land on the same calendar
 *   • 40 MentorshipMessages (5 per mentorship) with read/unread mix
 *   • 16 MentorshipGoal rows (1 achieved + 1 in-progress per mentorship)
 *
 * Idempotency strategy:
 *   - Users upserted by email (all `*@demo.digizelle.test`).
 *   - Profiles upserted by userId.
 *   - Mentorships upserted by [mentorProfileId, menteeProfileId].
 *   - Sessions / messages / goals / reviews keyed off the mentorship and
 *     a deterministic offset → idempotent.
 *
 * Skill catalog must already be seeded (`npm run db:seed`). Skill slugs
 * not found in the DB are silently skipped — the seed is best-effort
 * on top of whatever taxonomy the env has.
 *
 * Cleanup:
 *   npx tsx prisma/seed-demo-data.ts clean
 *
 * Run with:  npm run seed:demo-data
 */
import {
  PrismaClient,
  MentorStatus,
  MenteeLevel,
  PreferredFormat,
  ResponseTime,
  SkillLevel,
  UserRole,
  MentorshipStatus,
  MentorshipFrequency,
  SessionStatus,
} from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const PASSWORD = 'Demo!2026';
const EMAIL_DOMAIN = '@demo.digizelle.test';

// ─────────────── Mentors ─────────────────────────────────────────────
type MentorSeed = {
  emailLocal: string;
  firstName: string;
  lastName: string;
  headline: string;
  bio: string;
  yearsExperience: number;
  location: string;
  languages: string[];
  maxMentees: number;
  responseTime: ResponseTime;
  skillSlugs: string[];
};

const MENTORS: MentorSeed[] = [
  {
    emailLocal: 'sofia.khelifi',
    firstName: 'Sofia',
    lastName: 'Khelifi',
    headline: 'Engineering Lead Frontend — j\'aide les juniors à structurer leur code',
    bio: 'Lead frontend chez OnePoint, ex-Doctolib. 8 ans d\'expérience React, TypeScript, design systems. J\'accompagne sur la prise de poste, la préparation d\'entretien et les choix d\'architecture.',
    yearsExperience: 8,
    location: 'Paris',
    languages: ['fr', 'en'],
    maxMentees: 4,
    responseTime: ResponseTime.WITHIN_DAY,
    skillSlugs: ['react', 'typescript', 'developpement-frontend', 'identite-visuelle'],
  },
  {
    emailLocal: 'karim.yousfi',
    firstName: 'Karim',
    lastName: 'Yousfi',
    headline: 'Staff Backend Engineer — Node / Postgres / scaling',
    bio: '10 ans en backend, dont 5 sur des produits SaaS B2B à scale. J\'accompagne sur l\'archi distribuée, les choix de base de données et la première mise en prod.',
    yearsExperience: 10,
    location: 'Lyon',
    languages: ['fr', 'en'],
    maxMentees: 5,
    responseTime: ResponseTime.WITHIN_DAY,
    skillSlugs: ['developpement-backend', 'nextjs', 'devops'],
  },
  {
    emailLocal: 'diane.lambert',
    firstName: 'Diane',
    lastName: 'Lambert',
    headline: 'Senior Product Manager — du discovery au launch',
    bio: 'PM senior dans la fintech, 7 ans. J\'aide à structurer un product roadmap, prioriser, et défendre des idées en comité.',
    yearsExperience: 7,
    location: 'Paris',
    languages: ['fr', 'en'],
    maxMentees: 3,
    responseTime: ResponseTime.WITHIN_WEEK,
    skillSlugs: ['product-management', 'gestion-du-temps', 'leadership'],
  },
  {
    emailLocal: 'thomas.mercier-demo',
    firstName: 'Thomas',
    lastName: 'Mercier',
    headline: 'UX Designer — recherche, prototypage, design systems',
    bio: 'Designer produit depuis 6 ans, freelance puis chez Qonto. Spécialiste UX research et systèmes de design. J\'accompagne sur la posture de designer et la communication avec la tech.',
    yearsExperience: 6,
    location: 'Nantes',
    languages: ['fr', 'en'],
    maxMentees: 3,
    responseTime: ResponseTime.WITHIN_DAY,
    skillSlugs: ['ux-design', 'identite-visuelle', 'product-management'],
  },
  {
    emailLocal: 'naima.el-ouali',
    firstName: 'Naïma',
    lastName: 'El-Ouali',
    headline: 'Data Engineer — Snowflake, dbt, pipelines temps réel',
    bio: 'Data engineer chez BlaBlaCar puis Spendesk. 6 ans sur des stacks modern data. J\'accompagne sur la prise en main d\'un nouveau stack data et la posture data-eng vs analytics.',
    yearsExperience: 6,
    location: 'Bordeaux',
    languages: ['fr', 'en'],
    maxMentees: 4,
    responseTime: ResponseTime.WITHIN_DAY,
    skillSlugs: ['data-engineering', 'developpement-backend'],
  },
  {
    emailLocal: 'jeanne.costa',
    firstName: 'Jeanne',
    lastName: 'Costa',
    headline: 'CTO startup — passée par la reconversion à 30 ans',
    bio: 'Ex-prof de maths reconvertie dev à 30 ans, aujourd\'hui CTO d\'une startup HealthTech. Je suis très à l\'aise avec les profils en reconversion et les premiers rôles tech.',
    yearsExperience: 9,
    location: 'Marseille',
    languages: ['fr', 'en'],
    maxMentees: 5,
    responseTime: ResponseTime.WITHIN_WEEK,
    skillSlugs: ['career-coaching', 'leadership', 'developpement-frontend'],
  },
  {
    emailLocal: 'marc.petit',
    firstName: 'Marc',
    lastName: 'Petit',
    headline: 'Coach carrière tech — préparation entretiens & négociation',
    bio: 'Ancien recruteur tech à Doctolib et Stripe, devenu coach carrière. Je prépare les candidats aux entretiens techniques (algo, system design) et à la négociation de salaire.',
    yearsExperience: 5,
    location: 'Paris',
    languages: ['fr', 'en'],
    maxMentees: 6,
    responseTime: ResponseTime.WITHIN_HOUR,
    skillSlugs: ['career-coaching', 'preparation-aux-entretiens', 'negociation-salariale'],
  },
  {
    emailLocal: 'amina.benali',
    firstName: 'Amina',
    lastName: 'Benali',
    headline: 'Senior DevOps — Kubernetes, CI/CD, observabilité',
    bio: 'DevOps senior dans la fintech, 8 ans. J\'aime accompagner les profils dev qui veulent basculer en plateforme/infra.',
    yearsExperience: 8,
    location: 'Toulouse',
    languages: ['fr', 'en'],
    maxMentees: 3,
    responseTime: ResponseTime.WITHIN_DAY,
    skillSlugs: ['devops', 'developpement-backend'],
  },
];

// ─────────────── Mentees ─────────────────────────────────────────────
type MenteeSeed = {
  emailLocal: string;
  firstName: string;
  lastName: string;
  goals: string;
  level: MenteeLevel;
  preferredFormat: PreferredFormat;
  currentChallenges: string;
  location: string;
  languages: string[];
  goalSkillSlugs: string[];
};

const MENTEES: MenteeSeed[] = [
  {
    emailLocal: 'lea.moreau-demo',
    firstName: 'Léa',
    lastName: 'Moreau',
    goals: 'Décrocher mon premier poste de développeuse front-end junior d\'ici la fin de l\'été.',
    level: MenteeLevel.BEGINNER,
    preferredFormat: PreferredFormat.REMOTE,
    currentChallenges: 'Je termine ma formation Le Wagon et je galère à structurer mon portfolio + à pratiquer les questions d\'entretien.',
    location: 'Paris',
    languages: ['fr', 'en'],
    goalSkillSlugs: ['react', 'typescript', 'preparation-aux-entretiens'],
  },
  {
    emailLocal: 'inès.chevalier',
    firstName: 'Inès',
    lastName: 'Chevalier',
    goals: 'Reconversion depuis le marketing vers le product management produit tech.',
    level: MenteeLevel.INTERMEDIATE,
    preferredFormat: PreferredFormat.HYBRID,
    currentChallenges: 'J\'ai du mal à montrer mes compétences product alors que je n\'ai que de l\'expérience marketing.',
    location: 'Paris',
    languages: ['fr', 'en'],
    goalSkillSlugs: ['product-management', 'career-coaching'],
  },
  {
    emailLocal: 'yasmine.haddad',
    firstName: 'Yasmine',
    lastName: 'Haddad',
    goals: 'Lancer mon side-project SaaS — coaching scolaire en Île-de-France.',
    level: MenteeLevel.INTERMEDIATE,
    preferredFormat: PreferredFormat.REMOTE,
    currentChallenges: 'Je sais coder mais je bloque sur la roadmap produit et la mise en prod.',
    location: 'Saint-Denis',
    languages: ['fr'],
    goalSkillSlugs: ['developpement-frontend', 'product-management', 'nextjs'],
  },
  {
    emailLocal: 'camille.lefevre',
    firstName: 'Camille',
    lastName: 'Lefèvre',
    goals: 'Monter en compétences sur la data engineering pour évoluer en interne.',
    level: MenteeLevel.INTERMEDIATE,
    preferredFormat: PreferredFormat.REMOTE,
    currentChallenges: 'Mon poste actuel ne me forme pas, je cherche un cadre extérieur pour structurer mon apprentissage.',
    location: 'Lyon',
    languages: ['fr', 'en'],
    goalSkillSlugs: ['data-engineering'],
  },
  {
    emailLocal: 'noor.bouchama',
    firstName: 'Noor',
    lastName: 'Bouchama',
    goals: 'Décrocher mon premier poste de UX designer junior, après un BUT MMI.',
    level: MenteeLevel.BEGINNER,
    preferredFormat: PreferredFormat.REMOTE,
    currentChallenges: 'Mon book est trop scolaire, je veux le rendre plus pro.',
    location: 'Lille',
    languages: ['fr', 'en'],
    goalSkillSlugs: ['ux-design', 'identite-visuelle'],
  },
  {
    emailLocal: 'sarah.dubois',
    firstName: 'Sarah',
    lastName: 'Dubois',
    goals: 'Préparer mon passage en lead développeuse front-end après 4 ans en équipe.',
    level: MenteeLevel.ADVANCED,
    preferredFormat: PreferredFormat.HYBRID,
    currentChallenges: 'J\'hésite entre rester sur la technique ou prendre du management. Besoin d\'un avis externe.',
    location: 'Paris',
    languages: ['fr', 'en'],
    goalSkillSlugs: ['leadership', 'developpement-frontend'],
  },
  {
    emailLocal: 'rania.tabet',
    firstName: 'Rania',
    lastName: 'Tabet',
    goals: 'Reconversion vers la tech après 5 ans en finance.',
    level: MenteeLevel.BEGINNER,
    preferredFormat: PreferredFormat.REMOTE,
    currentChallenges: 'Je sors d\'un bootcamp et je ne sais pas quel premier rôle viser (front, back, data ?).',
    location: 'Paris',
    languages: ['fr', 'en'],
    goalSkillSlugs: ['career-coaching', 'developpement-frontend'],
  },
  {
    emailLocal: 'fatou.diop',
    firstName: 'Fatou',
    lastName: 'Diop',
    goals: 'Décrocher un poste en data engineering à Lyon ou Paris.',
    level: MenteeLevel.INTERMEDIATE,
    preferredFormat: PreferredFormat.HYBRID,
    currentChallenges: 'J\'ai un master data mais aucune vraie expérience de pipeline en prod.',
    location: 'Lyon',
    languages: ['fr', 'en'],
    goalSkillSlugs: ['data-engineering', 'preparation-aux-entretiens'],
  },
  {
    emailLocal: 'alia.rahmani',
    firstName: 'Alia',
    lastName: 'Rahmani',
    goals: 'Devenir freelance UX dans les 12 prochains mois.',
    level: MenteeLevel.ADVANCED,
    preferredFormat: PreferredFormat.REMOTE,
    currentChallenges: 'Comment me positionner sur le marché du freelance senior.',
    location: 'Nantes',
    languages: ['fr', 'en'],
    goalSkillSlugs: ['ux-design', 'negociation-salariale'],
  },
  {
    emailLocal: 'manon.girard',
    firstName: 'Manon',
    lastName: 'Girard',
    goals: 'Préparer les entretiens technique pour des postes back-end.',
    level: MenteeLevel.INTERMEDIATE,
    preferredFormat: PreferredFormat.REMOTE,
    currentChallenges: 'Stress en live coding et difficulté à structurer mes réponses sur le system design.',
    location: 'Rennes',
    languages: ['fr', 'en'],
    goalSkillSlugs: ['preparation-aux-entretiens', 'developpement-backend'],
  },
  {
    emailLocal: 'lina.benzouina',
    firstName: 'Lina',
    lastName: 'Benzouina',
    goals: 'Lancer une newsletter tech professionnelle.',
    level: MenteeLevel.INTERMEDIATE,
    preferredFormat: PreferredFormat.REMOTE,
    currentChallenges: 'Trouver un angle éditorial et un rythme tenable.',
    location: 'Paris',
    languages: ['fr', 'en'],
    goalSkillSlugs: ['marketing', 'product-management'],
  },
  {
    emailLocal: 'eva.fernandez',
    firstName: 'Eva',
    lastName: 'Fernandez',
    goals: 'Évoluer de développeuse junior à senior en 2 ans.',
    level: MenteeLevel.INTERMEDIATE,
    preferredFormat: PreferredFormat.REMOTE,
    currentChallenges: 'Pas de mentor dans mon équipe actuelle, je veux structurer mon plan d\'apprentissage.',
    location: 'Strasbourg',
    languages: ['fr', 'en'],
    goalSkillSlugs: ['developpement-frontend', 'career-coaching'],
  },
];

// ─────────────── Mentorships (mentor ↔ mentee) ───────────────────────
// Each tuple: mentor emailLocal, mentee emailLocal, weeks since started,
// preferred frequency, status.
const MENTORSHIPS: Array<{
  mentor: string;
  mentee: string;
  weeksAgo: number;
  frequency: MentorshipFrequency;
  status: MentorshipStatus;
}> = [
  { mentor: 'sofia.khelifi', mentee: 'lea.moreau-demo', weeksAgo: 6, frequency: MentorshipFrequency.WEEKLY, status: MentorshipStatus.ACTIVE },
  { mentor: 'diane.lambert', mentee: 'inès.chevalier', weeksAgo: 8, frequency: MentorshipFrequency.BIWEEKLY, status: MentorshipStatus.ACTIVE },
  { mentor: 'karim.yousfi', mentee: 'yasmine.haddad', weeksAgo: 4, frequency: MentorshipFrequency.WEEKLY, status: MentorshipStatus.ACTIVE },
  { mentor: 'naima.el-ouali', mentee: 'camille.lefevre', weeksAgo: 10, frequency: MentorshipFrequency.BIWEEKLY, status: MentorshipStatus.ACTIVE },
  { mentor: 'thomas.mercier-demo', mentee: 'noor.bouchama', weeksAgo: 3, frequency: MentorshipFrequency.WEEKLY, status: MentorshipStatus.ACTIVE },
  { mentor: 'jeanne.costa', mentee: 'sarah.dubois', weeksAgo: 12, frequency: MentorshipFrequency.MONTHLY, status: MentorshipStatus.ACTIVE },
  { mentor: 'marc.petit', mentee: 'rania.tabet', weeksAgo: 2, frequency: MentorshipFrequency.WEEKLY, status: MentorshipStatus.ACTIVE },
  { mentor: 'amina.benali', mentee: 'fatou.diop', weeksAgo: 5, frequency: MentorshipFrequency.BIWEEKLY, status: MentorshipStatus.ACTIVE },
];

// ─────────────── Helpers ─────────────────────────────────────────────
const email = (local: string) => `${local}${EMAIL_DOMAIN}`;
const daysAgo = (n: number) => new Date(Date.now() - n * 86400 * 1000);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86400 * 1000);

async function upsertMentor(m: MentorSeed) {
  const passwordHash = await hash(PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: email(m.emailLocal) },
    update: {
      role: UserRole.MENTOR,
      emailVerified: new Date(),
      passwordHash,
      roleConfirmed: true,
      mentoraEnabled: true,
      firstName: m.firstName,
      lastName: m.lastName,
      name: `${m.firstName} ${m.lastName}`,
    },
    create: {
      email: email(m.emailLocal),
      role: UserRole.MENTOR,
      emailVerified: new Date(),
      passwordHash,
      roleConfirmed: true,
      mentoraEnabled: true,
      firstName: m.firstName,
      lastName: m.lastName,
      name: `${m.firstName} ${m.lastName}`,
    },
    select: { id: true },
  });

  const profile = await prisma.mentorProfile.upsert({
    where: { userId: user.id },
    update: {
      headline: m.headline,
      bio: m.bio,
      yearsExperience: m.yearsExperience,
      timezone: 'Europe/Paris',
      location: m.location,
      languages: m.languages,
      isAcceptingMentees: true,
      maxConcurrentMentees: m.maxMentees,
      responseTime: m.responseTime,
      status: MentorStatus.ACTIVE,
      publishedAt: new Date(),
    },
    create: {
      userId: user.id,
      headline: m.headline,
      bio: m.bio,
      yearsExperience: m.yearsExperience,
      timezone: 'Europe/Paris',
      location: m.location,
      languages: m.languages,
      isAcceptingMentees: true,
      maxConcurrentMentees: m.maxMentees,
      responseTime: m.responseTime,
      status: MentorStatus.ACTIVE,
      publishedAt: new Date(),
    },
    select: { id: true },
  });

  // Skills (best-effort — silently skip unknown slugs)
  if (m.skillSlugs.length > 0) {
    const skillRows = await prisma.skill.findMany({
      where: { slug: { in: m.skillSlugs } },
      select: { id: true },
    });
    for (const sk of skillRows) {
      await prisma.mentorSkill.upsert({
        where: { mentorProfileId_skillId: { mentorProfileId: profile.id, skillId: sk.id } },
        update: { level: SkillLevel.EXPERT, isFeatured: true },
        create: {
          mentorProfileId: profile.id,
          skillId: sk.id,
          level: SkillLevel.EXPERT,
          isFeatured: true,
          yearsOfPractice: Math.min(m.yearsExperience, 8),
        },
      });
    }
  }

  // A couple of recurring availability slots so the discovery filters
  // « has availability this week » turn green.
  const slots: { dayOfWeek: number; startMinute: number; endMinute: number }[] = [
    { dayOfWeek: 2, startMinute: 18 * 60, endMinute: 20 * 60 }, // Tue 18-20
    { dayOfWeek: 4, startMinute: 12 * 60, endMinute: 14 * 60 }, // Thu 12-14
    { dayOfWeek: 6, startMinute: 10 * 60, endMinute: 12 * 60 }, // Sat 10-12
  ];
  for (const s of slots) {
    const existing = await prisma.availabilityRule.findFirst({
      where: {
        mentorProfileId: profile.id,
        dayOfWeek: s.dayOfWeek,
        startMinute: s.startMinute,
        endMinute: s.endMinute,
      },
      select: { id: true },
    });
    if (!existing) {
      await prisma.availabilityRule.create({
        data: { mentorProfileId: profile.id, timezone: 'Europe/Paris', ...s },
      });
    }
  }

  return { userId: user.id, profileId: profile.id };
}

async function upsertMentee(m: MenteeSeed) {
  const passwordHash = await hash(PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: email(m.emailLocal) },
    update: {
      role: UserRole.STUDENT,
      emailVerified: new Date(),
      passwordHash,
      roleConfirmed: true,
      mentoraEnabled: true,
      firstName: m.firstName,
      lastName: m.lastName,
      name: `${m.firstName} ${m.lastName}`,
    },
    create: {
      email: email(m.emailLocal),
      role: UserRole.STUDENT,
      emailVerified: new Date(),
      passwordHash,
      roleConfirmed: true,
      mentoraEnabled: true,
      firstName: m.firstName,
      lastName: m.lastName,
      name: `${m.firstName} ${m.lastName}`,
    },
    select: { id: true },
  });

  const profile = await prisma.menteeProfile.upsert({
    where: { userId: user.id },
    update: {
      goals: m.goals,
      level: m.level,
      languages: m.languages,
      timezone: 'Europe/Paris',
      location: m.location,
      currentChallenges: m.currentChallenges,
      preferredFormat: m.preferredFormat,
    },
    create: {
      userId: user.id,
      goals: m.goals,
      level: m.level,
      languages: m.languages,
      timezone: 'Europe/Paris',
      location: m.location,
      currentChallenges: m.currentChallenges,
      preferredFormat: m.preferredFormat,
    },
    select: { id: true },
  });

  // Goal skills
  if (m.goalSkillSlugs.length > 0) {
    const skillRows = await prisma.skill.findMany({
      where: { slug: { in: m.goalSkillSlugs } },
      select: { id: true, slug: true },
    });
    for (let i = 0; i < skillRows.length; i++) {
      await prisma.menteeGoalSkill.upsert({
        where: {
          menteeProfileId_skillId: { menteeProfileId: profile.id, skillId: skillRows[i].id },
        },
        update: { priority: i + 1 },
        create: { menteeProfileId: profile.id, skillId: skillRows[i].id, priority: i + 1 },
      });
    }
  }

  return { userId: user.id, profileId: profile.id };
}

async function ensureMentorship(
  mentorProfileId: string,
  menteeProfileId: string,
  weeksAgo: number,
  frequency: MentorshipFrequency,
  status: MentorshipStatus,
) {
  const startedAt = daysAgo(weeksAgo * 7);
  const existing = await prisma.mentorship.findUnique({
    where: { mentorProfileId_menteeProfileId: { mentorProfileId, menteeProfileId } },
    select: { id: true },
  });
  if (existing) {
    await prisma.mentorship.update({
      where: { id: existing.id },
      data: { status, agreedFrequency: frequency, startedAt },
    });
    return existing.id;
  }
  const created = await prisma.mentorship.create({
    data: {
      mentorProfileId,
      menteeProfileId,
      startedAt,
      agreedFrequency: frequency,
      status,
    },
    select: { id: true },
  });
  return created.id;
}

async function seedSessions(mentorshipId: string, weeksAgo: number) {
  // Distribute sessions every ~2 weeks back to start + 2 upcoming.
  const weeksGap = 2;
  const past = Math.max(1, Math.floor(weeksAgo / weeksGap));
  for (let i = past; i >= 1; i--) {
    const scheduledAt = daysAgo(i * weeksGap * 7);
    const existing = await prisma.session.findFirst({
      where: { mentorshipId, scheduledAt },
      select: { id: true },
    });
    if (!existing) {
      await prisma.session.create({
        data: {
          mentorshipId,
          scheduledAt,
          durationMinutes: 45,
          status: SessionStatus.COMPLETED,
        },
      });
    }
  }
  // Two upcoming
  for (const inDays of [4, 18]) {
    const scheduledAt = daysFromNow(inDays);
    const existing = await prisma.session.findFirst({
      where: { mentorshipId, scheduledAt },
      select: { id: true },
    });
    if (!existing) {
      await prisma.session.create({
        data: {
          mentorshipId,
          scheduledAt,
          durationMinutes: 45,
          status: SessionStatus.SCHEDULED,
        },
      });
    }
  }
}

async function seedMessages(
  mentorshipId: string,
  mentorUserId: string,
  menteeUserId: string,
) {
  const existingCount = await prisma.mentorshipMessage.count({ where: { mentorshipId } });
  if (existingCount >= 4) return; // already seeded
  const turns: Array<{ from: string; body: string; daysAgo: number; readByOther: boolean }> = [
    { from: menteeUserId, body: 'Bonjour, ravie de démarrer ce mentorat ! J\'aimerais profiter de la première session pour clarifier mes objectifs.', daysAgo: 28, readByOther: true },
    { from: mentorUserId, body: 'Hello ! Avec plaisir. Tu peux me lister tes 3 priorités principales avant qu\'on se voie ?', daysAgo: 27, readByOther: true },
    { from: menteeUserId, body: 'OK, c\'est noté. Je t\'envoie ça d\'ici demain.', daysAgo: 27, readByOther: true },
    { from: mentorUserId, body: 'Super travail sur le portfolio que tu m\'as partagé hier. On en parle vendredi ?', daysAgo: 5, readByOther: true },
    { from: menteeUserId, body: 'Top, vendredi parfait. J\'ai aussi une question sur la prep d\'entretien si on a le temps.', daysAgo: 3, readByOther: false },
  ];
  for (const t of turns) {
    await prisma.mentorshipMessage.create({
      data: {
        mentorshipId,
        senderUserId: t.from,
        body: t.body,
        sentAt: daysAgo(t.daysAgo),
        readByOtherAt: t.readByOther ? daysAgo(t.daysAgo - 1) : null,
      },
    });
  }
}

async function seedGoals(mentorshipId: string) {
  const existingCount = await prisma.mentorshipGoal.count({ where: { mentorshipId } });
  if (existingCount > 0) return;
  await prisma.mentorshipGoal.createMany({
    data: [
      {
        mentorshipId,
        description: 'Refondre mon portfolio : refaire le site avec 3 projets bien documentés.',
        isAchieved: true,
        achievedAt: daysAgo(10),
      },
      {
        mentorshipId,
        description: 'Préparer 5 entretiens techniques (algo, system design, comportemental).',
        isAchieved: false,
      },
    ],
  });
}

// ─────────────── Main ────────────────────────────────────────────────
async function reset() {
  console.log('→ Mentors');
  const mentorMap = new Map<string, { userId: string; profileId: string }>();
  for (const m of MENTORS) {
    const ids = await upsertMentor(m);
    mentorMap.set(m.emailLocal, ids);
    console.log(`  ✓ ${m.firstName} ${m.lastName} <${email(m.emailLocal)}>`);
  }

  console.log('\n→ Mentees');
  const menteeMap = new Map<string, { userId: string; profileId: string }>();
  for (const m of MENTEES) {
    const ids = await upsertMentee(m);
    menteeMap.set(m.emailLocal, ids);
    console.log(`  ✓ ${m.firstName} ${m.lastName} <${email(m.emailLocal)}>`);
  }

  console.log('\n→ Mentorships + sessions + messages + goals');
  for (const rel of MENTORSHIPS) {
    const mentor = mentorMap.get(rel.mentor);
    const mentee = menteeMap.get(rel.mentee);
    if (!mentor || !mentee) {
      console.log(`  ! missing endpoint for ${rel.mentor} ↔ ${rel.mentee}`);
      continue;
    }
    const mentorshipId = await ensureMentorship(
      mentor.profileId,
      mentee.profileId,
      rel.weeksAgo,
      rel.frequency,
      rel.status,
    );
    await seedSessions(mentorshipId, rel.weeksAgo);
    await seedMessages(mentorshipId, mentor.userId, mentee.userId);
    await seedGoals(mentorshipId);
    console.log(`  ✓ ${rel.mentor} ↔ ${rel.mentee} (${rel.weeksAgo}w, ${rel.frequency})`);
  }

  console.log('\nDone.');
  console.log(`Login: any of the ${MENTORS.length + MENTEES.length} demo accounts / password "${PASSWORD}"`);
}

async function clean() {
  const emails = [
    ...MENTORS.map((m) => email(m.emailLocal)),
    ...MENTEES.map((m) => email(m.emailLocal)),
  ];
  // onDelete: Cascade on User → cascades to all profiles, mentorships,
  // sessions, messages, goals, etc.
  const r = await prisma.user.deleteMany({ where: { email: { in: emails } } });
  console.log(`Deleted ${r.count} demo users (cascade through profiles / mentorships / sessions / etc.)`);
}

async function main() {
  const mode = process.argv[2] === 'clean' ? 'clean' : 'reset';
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`Digizelle demo data seed — mode: ${mode}`);
  console.log(`Account domain: ${EMAIL_DOMAIN}  ·  Shared password: ${PASSWORD}`);
  console.log('─────────────────────────────────────────────────────────────\n');
  if (mode === 'clean') await clean();
  else await reset();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

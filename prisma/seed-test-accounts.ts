/**
 * Test accounts seed.
 *
 * Creates four ready-to-use accounts:
 *   • admin@digizelle.test    — role ADMIN + isSuperAdmin: true,
 *                                password "Admin!2026". The bootstrap
 *                                super admin: only one allowed to
 *                                manage other admins.
 *   • admin2@digizelle.test   — role ADMIN + isSuperAdmin: false,
 *                                password "Admin2!2026". Regular admin
 *                                — day-to-day admin work, no power
 *                                over the super admin.
 *   • mentor@digizelle.test   — role MENTOR with an ACTIVE MentorProfile
 *                                + featured skills + accepting mentees,
 *                                password "Mentor!2026"
 *   • mentee@digizelle.test   — role STUDENT with a MenteeProfile (goals,
 *                                level, languages, timezone) and 3 goal
 *                                skills, password "Mentee!2026"
 *
 * All accounts are emailVerified so they can log in immediately via
 * credentials. Re-running the script upserts (idempotent).
 *
 * Run with:  npx tsx prisma/seed-test-accounts.ts
 */
import {
  PrismaClient,
  MenteeLevel,
  MentorStatus,
  PreferredFormat,
  ResponseTime,
  SkillLevel,
  UserRole,
} from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = "admin@digizelle.test";
const ADMIN_PASSWORD = "Admin!2026";

const ADMIN2_EMAIL = "admin2@digizelle.test";
const ADMIN2_PASSWORD = "Admin2!2026";

const MENTOR_EMAIL = "mentor@digizelle.test";
const MENTOR_PASSWORD = "Mentor!2026";

const MENTEE_EMAIL = "mentee@digizelle.test";
const MENTEE_PASSWORD = "Mentee!2026";

async function main() {
  console.log("→ Seeding test accounts…");

  // ── SUPER ADMIN ──────────────────────────────────────────────────────────
  // Bootstrap super admin — the only account flagged with
  // `isSuperAdmin: true`. Re-running the seed re-asserts the flag so it
  // can't be accidentally cleared by another script.
  const adminHash = await hash(ADMIN_PASSWORD, 12);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      role: UserRole.ADMIN,
      isSuperAdmin: true,
      emailVerified: new Date(),
      passwordHash: adminHash,
    },
    create: {
      email: ADMIN_EMAIL,
      firstName: "Admin",
      lastName: "Digizelle",
      name: "Admin Digizelle",
      role: UserRole.ADMIN,
      isSuperAdmin: true,
      emailVerified: new Date(),
      passwordHash: adminHash,
    },
    select: { id: true, email: true, role: true, isSuperAdmin: true },
  });
  console.log(
    `  ✓ Super admin: ${admin.email} (role=${admin.role}, isSuperAdmin=${admin.isSuperAdmin})`,
  );

  // ── ADMIN (non-super) ────────────────────────────────────────────────────
  // Standard admin account — full admin powers EXCEPT the operations
  // gated behind `isSuperAdmin = true` (managing other admins, etc.).
  const admin2Hash = await hash(ADMIN2_PASSWORD, 12);
  const admin2 = await prisma.user.upsert({
    where: { email: ADMIN2_EMAIL },
    update: {
      role: UserRole.ADMIN,
      isSuperAdmin: false,
      emailVerified: new Date(),
      passwordHash: admin2Hash,
    },
    create: {
      email: ADMIN2_EMAIL,
      firstName: "Admin",
      lastName: "Staff",
      name: "Admin Staff",
      role: UserRole.ADMIN,
      isSuperAdmin: false,
      emailVerified: new Date(),
      passwordHash: admin2Hash,
    },
    select: { id: true, email: true, role: true, isSuperAdmin: true },
  });
  console.log(
    `  ✓ Admin: ${admin2.email} (role=${admin2.role}, isSuperAdmin=${admin2.isSuperAdmin})`,
  );

  // ── MENTOR ───────────────────────────────────────────────────────────────
  const mentorHash = await hash(MENTOR_PASSWORD, 12);
  const mentor = await prisma.user.upsert({
    where: { email: MENTOR_EMAIL },
    update: {
      role: UserRole.MENTOR,
      emailVerified: new Date(),
      passwordHash: mentorHash,
    },
    create: {
      email: MENTOR_EMAIL,
      firstName: "Sofia",
      lastName: "Khelifi",
      name: "Sofia Khelifi",
      role: UserRole.MENTOR,
      emailVerified: new Date(),
      passwordHash: mentorHash,
    },
    select: { id: true, email: true, role: true },
  });
  console.log(`  ✓ Mentor user: ${mentor.email} (role=${mentor.role})`);

  // MentorProfile — visible & acceptant in the discovery / matching engine.
  const mentorProfile = await prisma.mentorProfile.upsert({
    where: { userId: mentor.id },
    update: {
      headline: "Engineering Lead — Frontend & Mentoring",
      bio: "Lead frontend chez OnePoint, ex-Doctolib. 8 ans d'expérience React, TypeScript, design systems. J'aide les jeunes à structurer leur portfolio, préparer les entretiens et choisir leur stack.",
      yearsExperience: 8,
      timezone: "Europe/Paris",
      location: "Paris, France",
      languages: ["fr", "en"],
      isAcceptingMentees: true,
      maxConcurrentMentees: 5,
      responseTime: ResponseTime.WITHIN_DAY,
      status: MentorStatus.ACTIVE,
      publishedAt: new Date(),
    },
    create: {
      userId: mentor.id,
      headline: "Engineering Lead — Frontend & Mentoring",
      bio: "Lead frontend chez OnePoint, ex-Doctolib. 8 ans d'expérience React, TypeScript, design systems. J'aide les jeunes à structurer leur portfolio, préparer les entretiens et choisir leur stack.",
      yearsExperience: 8,
      timezone: "Europe/Paris",
      location: "Paris, France",
      languages: ["fr", "en"],
      isAcceptingMentees: true,
      maxConcurrentMentees: 5,
      responseTime: ResponseTime.WITHIN_DAY,
      status: MentorStatus.ACTIVE,
      publishedAt: new Date(),
    },
    select: { id: true },
  });
  console.log(`  ✓ MentorProfile: ${mentorProfile.id} (status=ACTIVE)`);

  // 5 featured skills for the discovery card. Best-effort: only adds skills
  // that already exist in the catalogue (run `npm run db:seed` first to
  // create the skill catalog).
  const SKILL_SLUGS = ["react", "typescript", "ux-design", "product-management", "career-coaching"];
  const existingSkills = await prisma.skill.findMany({
    where: { slug: { in: SKILL_SLUGS } },
    select: { id: true, slug: true },
  });
  if (existingSkills.length === 0) {
    console.log("  ! No skills in DB yet — run `npm run db:seed` to populate the skill catalog.");
  } else {
    for (const skill of existingSkills) {
      await prisma.mentorSkill.upsert({
        where: { mentorProfileId_skillId: { mentorProfileId: mentorProfile.id, skillId: skill.id } },
        update: { level: SkillLevel.EXPERT, isFeatured: true },
        create: {
          mentorProfileId: mentorProfile.id,
          skillId: skill.id,
          level: SkillLevel.EXPERT,
          isFeatured: true,
          yearsOfPractice: 6,
        },
      });
    }
    console.log(`  ✓ Linked ${existingSkills.length} featured skill(s) to mentor.`);
  }

  // ── MENTEE ───────────────────────────────────────────────────────────────
  const menteeHash = await hash(MENTEE_PASSWORD, 12);
  const mentee = await prisma.user.upsert({
    where: { email: MENTEE_EMAIL },
    update: {
      // We keep STUDENT here even if the schema's UserRole is { STUDENT,
      // MENTOR, PARTNER, ADMIN }. STUDENT is the default mentee role.
      role: UserRole.STUDENT,
      emailVerified: new Date(),
      passwordHash: menteeHash,
    },
    create: {
      email: MENTEE_EMAIL,
      firstName: "Amina",
      lastName: "Berthaj",
      name: "Amina Berthaj",
      role: UserRole.STUDENT,
      emailVerified: new Date(),
      passwordHash: menteeHash,
    },
    select: { id: true, email: true, role: true },
  });
  console.log(`  ✓ Mentee user: ${mentee.email} (role=${mentee.role})`);

  // MenteeProfile — fully filled so /mentora/onboarding skips the wizard
  // (the page redirects to /mentora/dashboard when goals + languages +
  // timezone are populated).
  const menteeProfile = await prisma.menteeProfile.upsert({
    where: { userId: mentee.id },
    update: {
      goals:
        "Trouver mon premier poste de développeuse front-end junior et préparer les entretiens techniques.",
      level: MenteeLevel.BEGINNER,
      languages: ["fr", "en"],
      timezone: "Europe/Paris",
      location: "Paris, France",
      currentChallenges:
        "Je termine ma formation et j'ai du mal à structurer mon portfolio + à pratiquer les questions d'algorithmie.",
      preferredFormat: PreferredFormat.REMOTE,
    },
    create: {
      userId: mentee.id,
      goals:
        "Trouver mon premier poste de développeuse front-end junior et préparer les entretiens techniques.",
      level: MenteeLevel.BEGINNER,
      languages: ["fr", "en"],
      timezone: "Europe/Paris",
      location: "Paris, France",
      currentChallenges:
        "Je termine ma formation et j'ai du mal à structurer mon portfolio + à pratiquer les questions d'algorithmie.",
      preferredFormat: PreferredFormat.REMOTE,
    },
    select: { id: true },
  });
  console.log(`  ✓ MenteeProfile: ${menteeProfile.id}`);

  // Goal skills — overlap with the mentor's featured skills so the matching
  // engine returns Sofia at the top of the recommendations panel.
  const MENTEE_GOAL_SKILL_SLUGS = ["react", "typescript", "career-coaching"];
  const goalSkills = await prisma.skill.findMany({
    where: { slug: { in: MENTEE_GOAL_SKILL_SLUGS } },
    select: { id: true, slug: true },
  });
  if (goalSkills.length === 0) {
    console.log("  ! No skills in DB — goal-skill seeding skipped (run `npm run db:seed` first).");
  } else {
    for (let i = 0; i < goalSkills.length; i++) {
      const skill = goalSkills[i];
      await prisma.menteeGoalSkill.upsert({
        where: {
          menteeProfileId_skillId: { menteeProfileId: menteeProfile.id, skillId: skill.id },
        },
        update: { priority: i + 1 },
        create: {
          menteeProfileId: menteeProfile.id,
          skillId: skill.id,
          priority: i + 1,
        },
      });
    }
    console.log(`  ✓ Linked ${goalSkills.length} goal skill(s) to mentee.`);
  }

  console.log("");
  console.log("─────────────────────────────────────────────────────────────");
  console.log("Test accounts ready.");
  console.log("");
  console.log(`  SUPER ADMIN →  ${ADMIN_EMAIL}    /   ${ADMIN_PASSWORD}`);
  console.log(`  ADMIN       →  ${ADMIN2_EMAIL}   /   ${ADMIN2_PASSWORD}`);
  console.log(`  MENTOR      →  ${MENTOR_EMAIL}   /   ${MENTOR_PASSWORD}`);
  console.log(`  MENTEE      →  ${MENTEE_EMAIL}   /   ${MENTEE_PASSWORD}`);
  console.log("");
  console.log("All have emailVerified set so they can log in immediately.");
  console.log("Login at  http://localhost:3000/login");
  console.log("─────────────────────────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

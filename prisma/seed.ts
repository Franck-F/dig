/**
 * Combined seed: Mentorat skill taxonomy (~30 entries) + Community defaults
 * (6 channels, 10 badges).
 *
 * Idempotent: re-running upserts by `slug` / `kind`. Safe to run on prod
 * after migrate.
 *
 * Run with:  npx prisma db seed   (or)   npm run db:seed
 */
import {
  PrismaClient,
  SkillCategory,
  ChannelType,
  BadgeKind,
} from "@prisma/client";

const prisma = new PrismaClient();

type SeedSkill = {
  name: string;
  slug: string;
  category: SkillCategory;
  parentSlug?: string;
  aliases?: string[];
};

type SeedChannel = {
  slug: string;
  name: string;
  description: string;
  emoji: string;
  coverColor: string;
  type: ChannelType;
  isDefault: boolean;
  position: number;
};

type SeedBadge = {
  slug: string;
  kind: BadgeKind;
  name: string;
  description: string;
  iconEmoji: string;
  color: string;
  isAuto: boolean;
};

// Order matters: parents must come before children so we can resolve parentSlug → id.
const SKILLS: SeedSkill[] = [
  // ── TECHNICAL (12) ────────────────────────────────────────────────────
  {
    name: "Développement frontend",
    slug: "developpement-frontend",
    category: "TECHNICAL",
    aliases: ["Frontend", "Front-end", "Front end", "Web frontend"],
  },
  {
    name: "Développement backend",
    slug: "developpement-backend",
    category: "TECHNICAL",
    aliases: ["Backend", "Back-end", "Back end", "Serveur"],
  },
  {
    name: "Développement fullstack",
    slug: "developpement-fullstack",
    category: "TECHNICAL",
    parentSlug: "developpement-backend",
    aliases: ["Fullstack", "Full-stack", "Full stack"],
  },
  {
    name: "React",
    slug: "react",
    category: "TECHNICAL",
    parentSlug: "developpement-frontend",
    aliases: ["Reactjs", "React.js", "ReactJS"],
  },
  {
    name: "Next.js",
    slug: "nextjs",
    category: "TECHNICAL",
    parentSlug: "developpement-frontend",
    aliases: ["Next", "NextJS", "Next js"],
  },
  {
    name: "Node.js",
    slug: "nodejs",
    category: "TECHNICAL",
    parentSlug: "developpement-backend",
    aliases: ["Node", "NodeJS", "Node js"],
  },
  {
    name: "Python",
    slug: "python",
    category: "TECHNICAL",
    parentSlug: "developpement-backend",
    aliases: ["Py", "Python3"],
  },
  {
    name: "TypeScript",
    slug: "typescript",
    category: "TECHNICAL",
    aliases: ["TS", "Typescript"],
  },
  {
    name: "DevOps",
    slug: "devops",
    category: "TECHNICAL",
    aliases: ["CI/CD", "SRE", "Infrastructure"],
  },
  {
    name: "Cloud (AWS, GCP, Azure)",
    slug: "cloud",
    category: "TECHNICAL",
    aliases: ["AWS", "GCP", "Azure", "Cloud computing"],
  },
  {
    name: "Mobile (iOS, Android)",
    slug: "mobile",
    category: "TECHNICAL",
    aliases: ["iOS", "Android", "React Native", "Flutter", "Swift", "Kotlin"],
  },
  {
    name: "Data engineering",
    slug: "data-engineering",
    category: "TECHNICAL",
    aliases: ["Data eng", "ETL", "Data pipeline", "Big data"],
  },

  // ── SOFT (5) ──────────────────────────────────────────────────────────
  {
    name: "Communication",
    slug: "communication",
    category: "SOFT",
    aliases: ["Communication interpersonnelle", "Communication écrite"],
  },
  {
    name: "Leadership",
    slug: "leadership",
    category: "SOFT",
    aliases: ["Management", "Direction d'équipe"],
  },
  {
    name: "Prise de parole en public",
    slug: "prise-de-parole",
    category: "SOFT",
    aliases: ["Public speaking", "Présentation", "Pitch"],
  },
  {
    name: "Gestion du temps",
    slug: "gestion-du-temps",
    category: "SOFT",
    aliases: ["Time management", "Productivité", "Organisation"],
  },
  {
    name: "Résolution de conflits",
    slug: "resolution-de-conflits",
    category: "SOFT",
    aliases: ["Conflict resolution", "Médiation"],
  },

  // ── CAREER (5) ────────────────────────────────────────────────────────
  {
    name: "Reconversion professionnelle",
    slug: "reconversion-professionnelle",
    category: "CAREER",
    aliases: ["Career transition", "Changement de carrière", "Reconversion"],
  },
  {
    name: "Relecture de CV",
    slug: "relecture-cv",
    category: "CAREER",
    parentSlug: "reconversion-professionnelle",
    aliases: ["CV review", "Curriculum vitae", "Resume"],
  },
  {
    name: "Préparation aux entretiens",
    slug: "preparation-entretiens",
    category: "CAREER",
    parentSlug: "reconversion-professionnelle",
    aliases: ["Interview prep", "Coaching entretien", "Mock interview"],
  },
  {
    name: "Négociation salariale",
    slug: "negociation-salariale",
    category: "CAREER",
    parentSlug: "reconversion-professionnelle",
    aliases: ["Salary negotiation", "Négo salaire"],
  },
  {
    name: "Networking",
    slug: "networking",
    category: "CAREER",
    aliases: ["Réseautage", "Réseau professionnel"],
  },

  // ── BUSINESS (4) ──────────────────────────────────────────────────────
  {
    name: "Product management",
    slug: "product-management",
    category: "BUSINESS",
    aliases: ["PM", "Gestion de produit", "Product owner"],
  },
  {
    name: "UX research",
    slug: "ux-research",
    category: "BUSINESS",
    aliases: ["Recherche utilisateur", "User research"],
  },
  {
    name: "Entrepreneuriat",
    slug: "entrepreneuriat",
    category: "BUSINESS",
    aliases: ["Entrepreneurship", "Startup", "Création d'entreprise"],
  },
  {
    name: "Marketing",
    slug: "marketing",
    category: "BUSINESS",
    aliases: ["Marketing digital", "Growth", "Acquisition"],
  },

  // ── CREATIVE (4) ──────────────────────────────────────────────────────
  {
    name: "UI design",
    slug: "ui-design",
    category: "CREATIVE",
    aliases: ["Interface design", "Design d'interface", "Figma"],
  },
  {
    name: "Identité visuelle",
    slug: "identite-visuelle",
    category: "CREATIVE",
    aliases: ["Visual identity", "Branding", "Charte graphique"],
  },
  {
    name: "Rédaction de contenu",
    slug: "redaction-contenu",
    category: "CREATIVE",
    aliases: ["Content writing", "Copywriting", "Rédaction web"],
  },
  {
    name: "Storytelling",
    slug: "storytelling",
    category: "CREATIVE",
    aliases: ["Narration", "Récit de marque"],
  },
];

// ─── Community channels (6 defaults) ────────────────────────────────────
// Brand palette: #7301FF (primary), #A34BF5 (light), #F46FB1 (accent), #24325F (deep)
const CHANNELS: SeedChannel[] = [
  {
    slug: "annonces",
    name: "#annonces",
    description:
      "Annonces officielles de l'association : événements, campagnes, jalons. Lecture pour tous, écriture réservée à l'équipe.",
    emoji: "📣",
    coverColor: "#24325F",
    type: "ANNOUNCEMENT",
    isDefault: true,
    position: 0,
  },
  {
    slug: "general",
    name: "#general",
    description:
      "Le salon central de la communauté. Présentez-vous, discutez, posez vos questions ouvertes.",
    emoji: "💬",
    coverColor: "#7301FF",
    type: "PUBLIC",
    isDefault: true,
    position: 10,
  },
  {
    slug: "projets",
    name: "#projets",
    description:
      "Partagez vos projets, demandez du feedback, trouvez des collaborateurs.",
    emoji: "🚀",
    coverColor: "#A34BF5",
    type: "PUBLIC",
    isDefault: true,
    position: 20,
  },
  {
    slug: "frontend",
    name: "#frontend",
    description:
      "React, Next.js, Tailwind, design système : tout ce qui touche au front.",
    emoji: "🎨",
    coverColor: "#F46FB1",
    type: "PUBLIC",
    isDefault: false,
    position: 30,
  },
  {
    slug: "career",
    name: "#career",
    description:
      "Reconversion, recherche d'emploi, négociation, relecture de CV : entraide carrière.",
    emoji: "💼",
    coverColor: "#7301FF",
    type: "PUBLIC",
    isDefault: false,
    position: 40,
  },
  {
    slug: "hackathon",
    name: "#hackathon",
    description:
      "Challenges, hackathons, équipes en formation. Rejoignez ou lancez un projet rapide.",
    emoji: "⚡",
    coverColor: "#A34BF5",
    type: "PUBLIC",
    isDefault: false,
    position: 50,
  },
];

// ─── Community badges (10 baseline) ─────────────────────────────────────
// Slug = lowercased BadgeKind enum (kebab/underscore-free) for stable URLs.
const BADGES: SeedBadge[] = [
  {
    slug: "first-post",
    kind: "FIRST_POST",
    name: "Premier post",
    description: "Vous avez publié votre tout premier post dans la communauté.",
    iconEmoji: "✏️",
    color: "#7301FF",
    isAuto: true,
  },
  {
    slug: "ten-posts",
    kind: "TEN_POSTS",
    name: "Plume active",
    description: "Vous avez publié 10 posts. La communauté vous lit !",
    iconEmoji: "📚",
    color: "#A34BF5",
    isAuto: true,
  },
  {
    slug: "first-comment",
    kind: "FIRST_COMMENT",
    name: "Première réponse",
    description: "Vous avez commenté un post pour la première fois.",
    iconEmoji: "💬",
    color: "#F46FB1",
    isAuto: true,
  },
  {
    slug: "hundred-reactions",
    kind: "HUNDRED_REACTIONS",
    name: "100 réactions",
    description: "Vos contributions ont reçu plus de 100 réactions cumulées.",
    iconEmoji: "🔥",
    color: "#F46FB1",
    isAuto: true,
  },
  {
    slug: "first-challenge-win",
    kind: "FIRST_CHALLENGE_WIN",
    name: "Premier podium",
    description: "Vous avez remporté votre premier challenge communautaire.",
    iconEmoji: "🏆",
    color: "#7301FF",
    isAuto: true,
  },
  {
    slug: "hackathon-winner",
    kind: "HACKATHON_WINNER",
    name: "Vainqueur de hackathon",
    description: "Vous avez gagné un hackathon Digizelle.",
    iconEmoji: "🥇",
    color: "#A34BF5",
    isAuto: false,
  },
  {
    slug: "mentor",
    kind: "MENTOR_BADGE",
    name: "Mentor·e",
    description:
      "Mentor·e actif·ve sur Mentorat. Disponible pour accompagner la communauté.",
    iconEmoji: "🧭",
    color: "#24325F",
    isAuto: true,
  },
  {
    slug: "partner",
    kind: "PARTNER_BADGE",
    name: "Partenaire",
    description:
      "Représentant·e d'une organisation partenaire de Digizelle.",
    iconEmoji: "🤝",
    color: "#24325F",
    isAuto: true,
  },
  {
    slug: "founder",
    kind: "FOUNDER",
    name: "Fondateur·rice",
    description: "Membre fondateur·rice de l'association Digizelle.",
    iconEmoji: "🌱",
    color: "#7301FF",
    isAuto: false,
  },
  {
    slug: "moderator",
    kind: "MODERATOR",
    name: "Modérateur·rice",
    description:
      "Veille au bon climat de la communauté et au respect de la charte.",
    iconEmoji: "🛡️",
    color: "#24325F",
    isAuto: false,
  },
];

async function seedSkills() {
  console.log(`Seeding ${SKILLS.length} skills…`);

  // Two-pass to resolve parents safely (idempotent on slug).
  // Pass 1: upsert without parent; Pass 2: link parents.
  const idBySlug = new Map<string, string>();

  for (const s of SKILLS) {
    const row = await prisma.skill.upsert({
      where: { slug: s.slug },
      create: {
        name: s.name,
        slug: s.slug,
        category: s.category,
        aliases: s.aliases ?? [],
      },
      update: {
        name: s.name,
        category: s.category,
        aliases: s.aliases ?? [],
      },
      select: { id: true, slug: true },
    });
    idBySlug.set(row.slug, row.id);
  }

  for (const s of SKILLS) {
    if (!s.parentSlug) continue;
    const parentId = idBySlug.get(s.parentSlug);
    if (!parentId) {
      console.warn(`  ! parent slug "${s.parentSlug}" not found for "${s.slug}"`);
      continue;
    }
    await prisma.skill.update({
      where: { slug: s.slug },
      data: { parentSkillId: parentId },
    });
  }

  const total = await prisma.skill.count();
  console.log(`  Skills in DB: ${total}.`);
}

async function seedChannels() {
  console.log(`Seeding ${CHANNELS.length} community channels…`);

  for (const c of CHANNELS) {
    await prisma.channel.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        name: c.name,
        description: c.description,
        emoji: c.emoji,
        coverColor: c.coverColor,
        type: c.type,
        isDefault: c.isDefault,
        position: c.position,
      },
      update: {
        name: c.name,
        description: c.description,
        emoji: c.emoji,
        coverColor: c.coverColor,
        type: c.type,
        isDefault: c.isDefault,
        position: c.position,
      },
    });
  }

  const total = await prisma.channel.count();
  console.log(`  Channels in DB: ${total}.`);
}

async function seedBadges() {
  console.log(`Seeding ${BADGES.length} community badges…`);

  for (const b of BADGES) {
    await prisma.badge.upsert({
      where: { kind: b.kind },
      create: {
        kind: b.kind,
        slug: b.slug,
        name: b.name,
        description: b.description,
        iconEmoji: b.iconEmoji,
        color: b.color,
        isAuto: b.isAuto,
      },
      update: {
        slug: b.slug,
        name: b.name,
        description: b.description,
        iconEmoji: b.iconEmoji,
        color: b.color,
        isAuto: b.isAuto,
      },
    });
  }

  const total = await prisma.badge.count();
  console.log(`  Badges in DB: ${total}.`);
}

async function main() {
  await seedSkills();
  await seedChannels();
  await seedBadges();
  console.log("Seed done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

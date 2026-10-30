/**
 * Short onboarding trainings surfaced in Mentorat > Ressources, with
 * per-user completion tracked in `MentoraTrainingCompletion`. Modelled on
 * Entourage Pro's "Formations" (2–5 min modules + overall progress).
 *
 * Editorial content lives here (French only, like the rest of the
 * programme's guides). Pure, relative imports only so it runs under
 * `node --test`.
 */

export type TrainingAudience = 'mentee' | 'mentor' | 'all';

export type TrainingModule = {
  slug: string;
  title: string;
  summary: string;
  durationMin: number;
  audience: TrainingAudience;
  steps: { heading: string; body: string }[];
};

export const TRAININGS: readonly TrainingModule[] = [
  {
    slug: 'bien-demarrer',
    title: 'Découvrir Mentora et bien démarrer',
    summary: 'Le fonctionnement du programme et les premières actions pour lancer votre parcours.',
    durationMin: 5,
    audience: 'all',
    steps: [
      {
        heading: 'Le principe',
        body: 'Mentora met en relation des personnes qui se lancent dans la tech avec des professionnel·les bénévoles. Un mentorat, c’est un échange régulier, en confiance, autour d’objectifs que vous définissez ensemble.',
      },
      {
        heading: 'Complétez votre profil',
        body: 'Un profil complet (présentation, compétences, objectifs) permet un meilleur matching. Prenez cinq minutes pour le relire depuis Paramètres profil.',
      },
      {
        heading: 'Faites le premier pas',
        body: 'Côté mentorée : parcourez « Trouver un mentor » et envoyez une demande courte et sincère. Côté mentor : répondez aux demandes rapidement, même pour décliner.',
      },
      {
        heading: 'Restez en contact',
        body: 'La messagerie et les sessions se trouvent dans votre espace. L’équipe Digizelle reste joignable depuis la carte « Votre contact » de l’accueil.',
      },
    ],
  },
  {
    slug: 'role-du-mentor',
    title: 'Qui sont les mentors et comment peuvent-ils m’aider ?',
    summary: 'Comprendre le rôle des mentors et ce qu’ils peuvent vous apporter.',
    durationMin: 2,
    audience: 'mentee',
    steps: [
      {
        heading: 'Des pros bénévoles',
        body: 'Les mentors travaillent dans la tech et donnent de leur temps. Ils ne sont ni recruteurs ni formateurs : ils partagent leur expérience et leur réseau.',
      },
      {
        heading: 'Ce qu’ils peuvent faire',
        body: 'Relire un CV ou un portfolio, préparer un entretien, éclairer un choix de formation, ouvrir une porte dans leur réseau, vous aider à reprendre confiance.',
      },
      {
        heading: 'Ce qu’ils ne font pas',
        body: 'Ils ne garantissent pas un emploi et ne font pas le travail à votre place. Le mentorat avance au rythme de vos objectifs.',
      },
    ],
  },
  {
    slug: 'bien-communiquer',
    title: 'Bien communiquer avec son mentor',
    summary: 'Les clés pour échanger sereinement et créer une relation de confiance.',
    durationMin: 5,
    audience: 'mentee',
    steps: [
      {
        heading: 'Un premier message clair',
        body: 'Présentez-vous en deux phrases, dites ce que vous cherchez et pourquoi ce mentor. Un message court et précis obtient plus de réponses.',
      },
      {
        heading: 'Préparez vos sessions',
        body: 'Arrivez avec une ou deux questions, et notez les actions décidées ensemble. Vous les retrouverez dans l’onglet Objectifs du mentorat.',
      },
      {
        heading: 'Respectez le temps de chacun',
        body: 'Prévenez si vous devez annuler, et donnez des nouvelles entre deux sessions. Un mentor qui voit vos progrès reste motivé.',
      },
      {
        heading: 'En cas de difficulté',
        body: 'Si la relation ne fonctionne pas ou si un comportement vous met mal à l’aise, contactez l’équipe Digizelle. Vous pouvez aussi signaler un message.',
      },
    ],
  },
  {
    slug: 'posture-mentor',
    title: 'La posture du mentor Digizelle',
    summary: 'Écoute, bienveillance et cadre : ce qu’on attend d’un mentor.',
    durationMin: 5,
    audience: 'mentor',
    steps: [
      {
        heading: 'Écouter avant de conseiller',
        body: 'Commencez par comprendre le parcours, les contraintes et les envies de votre mentorée. Les meilleurs conseils partent de sa situation, pas de la vôtre.',
      },
      {
        heading: 'Encourager l’autonomie',
        body: 'Posez des questions, proposez des pistes, laissez-la décider. L’objectif est qu’elle reparte avec ses propres solutions.',
      },
      {
        heading: 'Poser un cadre',
        body: 'Mettez-vous d’accord sur la fréquence, le format et les objectifs dès le départ. Un cadre clair évite les malentendus.',
      },
      {
        heading: 'Respecter la charte',
        body: 'Confidentialité, bienveillance, pas de relation commerciale. En cas de doute, l’équipe Digizelle est là pour vous aider.',
      },
    ],
  },
  {
    slug: 'premiere-session',
    title: 'Mener une première session réussie',
    summary: 'Un déroulé simple pour une première rencontre utile.',
    durationMin: 5,
    audience: 'mentor',
    steps: [
      {
        heading: 'Avant la session',
        body: 'Relisez le profil et la demande de votre mentorée. Notez deux ou trois questions pour lancer la discussion.',
      },
      {
        heading: 'Pendant',
        body: 'Faites connaissance, clarifiez ses attentes, puis fixez ensemble un ou deux objectifs concrets pour les semaines à venir.',
      },
      {
        heading: 'Après',
        body: 'Ajoutez les objectifs dans l’onglet Objectifs du mentorat et proposez la prochaine session. Un petit message de suivi fait toujours plaisir.',
      },
    ],
  },
];

export function trainingsFor(role: 'mentor' | 'mentee'): TrainingModule[] {
  return TRAININGS.filter((m) => m.audience === role || m.audience === 'all');
}

export function isKnownTrainingSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && TRAININGS.some((m) => m.slug === slug);
}

export function computeTrainingProgress(
  modules: readonly TrainingModule[],
  completedSlugs: Iterable<string>,
): { done: number; total: number; percent: number } {
  const completed = new Set(completedSlugs);
  const total = modules.length;
  const done = modules.filter((m) => completed.has(m.slug)).length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

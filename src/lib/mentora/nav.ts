/**
 * Single source of truth for the Mentorat sidebar, shared by the
 * dashboard, `/mentora/[slug]` and `/mentora/discover` layouts.
 *
 * Kept deliberately short (Entourage Pro benchmark, Oct 2026): the bell
 * covers notifications, the avatar menu covers "Mon profil", and the
 * availability editor lives inside profile settings.
 *
 * Pure + relative imports only so it runs under `node --test`.
 */

/** Structurally identical to `AppShellNavItem` (components/app-shell/AppShell). */
export type MentoraNavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: number | null;
  matchPrefix?: boolean;
};

export type MentoraNavKind = 'mentor' | 'mentee' | 'none';

export type MentoraNavLabels = {
  home: string;
  discover: string;
  mentors: string;
  mentees: string;
  sessions: string;
  messages: string;
  resources: string;
  settings: string;
  becomeMentee: string;
  becomeMentor: string;
};

export type MentoraNavLabelKey =
  | 'nav.mentora.home'
  | 'nav.mentora.discover'
  | 'nav.mentora.mentors'
  | 'nav.mentora.mentees'
  | 'nav.mentora.sessions'
  | 'nav.mentora.messages'
  | 'nav.mentora.resources'
  | 'nav.mentora.becomeMentee'
  | 'nav.mentora.becomeMentor'
  | 'nav.community.settings';

/** Maps the `app.shell` translator onto the labels `buildMentoraNav` needs. */
export function mentoraNavLabels(t: (key: MentoraNavLabelKey) => string): MentoraNavLabels {
  return {
    home: t('nav.mentora.home'),
    discover: t('nav.mentora.discover'),
    mentors: t('nav.mentora.mentors'),
    mentees: t('nav.mentora.mentees'),
    sessions: t('nav.mentora.sessions'),
    messages: t('nav.mentora.messages'),
    resources: t('nav.mentora.resources'),
    settings: t('nav.community.settings'),
    becomeMentee: t('nav.mentora.becomeMentee'),
    becomeMentor: t('nav.mentora.becomeMentor'),
  };
}

/** Dashboard pages retired in the slim-down — see `legacy-redirects.ts`. */
export const MENTORA_REMOVED_ROUTES: readonly string[] = [
  '/mentora/dashboard/agenda',
  '/mentora/dashboard/feedbacks',
  '/mentora/dashboard/activity',
  '/mentora/dashboard/goals',
  '/mentora/dashboard/availability',
  '/mentora/dashboard/profile',
];

export function buildMentoraNav(
  kind: MentoraNavKind,
  opts: { isAdmin: boolean; labels: MentoraNavLabels },
): MentoraNavItem[] {
  const { isAdmin, labels } = opts;

  const home: MentoraNavItem = { href: '/mentora/dashboard', label: labels.home, icon: '◉' };
  const discover: MentoraNavItem = {
    href: '/mentora/discover',
    label: labels.discover,
    icon: '✦',
    matchPrefix: true,
  };
  const sessions: MentoraNavItem = {
    href: '/mentora/dashboard/sessions',
    label: labels.sessions,
    icon: '◌',
    matchPrefix: true,
  };
  const messages: MentoraNavItem = {
    href: '/mentora/dashboard/messages',
    label: labels.messages,
    icon: '✉',
    matchPrefix: true,
  };
  const resources: MentoraNavItem = {
    href: '/mentora/dashboard/resources',
    label: labels.resources,
    icon: '◇',
    matchPrefix: true,
  };
  // Settings are user-level, not space-level: same canonical page as Community.
  const settings: MentoraNavItem = {
    href: '/account/settings',
    label: labels.settings,
    icon: '⚙',
    matchPrefix: true,
  };

  if (kind === 'mentor') {
    return [
      home,
      { href: '/mentora/dashboard/mentorships', label: labels.mentees, icon: '☷', matchPrefix: true },
      sessions,
      messages,
      resources,
      settings,
    ];
  }

  if (kind === 'mentee') {
    return [
      home,
      discover,
      { href: '/mentora/dashboard/mentorships', label: labels.mentors, icon: '☷', matchPrefix: true },
      sessions,
      messages,
      resources,
      settings,
    ];
  }

  if (isAdmin) {
    // No role profile: admins get pilotage shortcuts instead of being pushed
    // towards "Devenir mentorée / Devenir mentor".
    return [
      { href: '/mentora/admin', label: 'Pilotage', icon: '◉' },
      { href: '/mentora/admin/mentors', label: 'Mentors', icon: '☷', matchPrefix: true },
      { href: '/mentora/admin/mentees', label: 'Mentorées', icon: '✦', matchPrefix: true },
      { href: '/mentora/admin/matching', label: 'Matching', icon: '⇋', matchPrefix: true },
      { href: '/mentora/admin/moderation', label: 'Modération', icon: '◇', matchPrefix: true },
      { href: '/mentora/admin/reports', label: 'Rapports', icon: '◌', matchPrefix: true },
      settings,
    ];
  }

  return [
    home,
    discover,
    { href: '/mentora/onboarding', label: labels.becomeMentee, icon: '◇' },
    { href: '/mentora/become-a-mentor', label: labels.becomeMentor, icon: '☷' },
    settings,
  ];
}

/**
 * Permanent redirects for the Mentorat dashboard pages retired in the
 * Oct 2026 slim-down, so bookmarks and old email links never 404.
 * Wired into `next.config.ts` → `redirects()`.
 *
 * Sources are exact paths (no `:param` / wildcard) on purpose:
 * `/mentora/dashboard/profile` must not capture `/profile/edit`.
 */
export type LegacyRedirect = { source: string; destination: string; permanent: true };

export const MENTORA_LEGACY_REDIRECTS: LegacyRedirect[] = [
  // Agenda was the mentor week view of the same data as Sessions.
  { source: '/mentora/dashboard/agenda', destination: '/mentora/dashboard/sessions', permanent: true },
  // Reviews stay visible on the public mentor profile.
  { source: '/mentora/dashboard/feedbacks', destination: '/mentora/dashboard', permanent: true },
  { source: '/mentora/dashboard/activity', destination: '/mentora/dashboard/notifications', permanent: true },
  // Goals live in the mentorship detail view (Objectifs tab).
  { source: '/mentora/dashboard/goals', destination: '/mentora/dashboard/mentorships', permanent: true },
  {
    source: '/mentora/dashboard/availability',
    destination: '/mentora/dashboard/profile/edit#disponibilites',
    permanent: true,
  },
  { source: '/mentora/dashboard/profile', destination: '/mentora/dashboard/profile/edit', permanent: true },
];

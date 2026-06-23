/**
 * Pure retention-policy date math (RGPD Art. 5.1.e). Centralises the durations
 * promised in docs/rgpd/registre-traitements.md so the purge cron and its tests
 * share one source of truth. I/O-free → unit-tested.
 */
export const RETENTION = {
  /** registre T-01 : compte inactif > 3 ans → suppression. */
  inactiveAccountYears: 3,
  /** notifications lues : 90 jours après lecture. */
  readNotificationDays: 90,
  /** notifications non lues : 1 an. */
  unreadNotificationDays: 365,
  /** messages de contact : 1 an. */
  contactMessageDays: 365,
  /** actions de modération : 3 ans (preuve en cas de récidive). */
  moderationYears: 3,
  /** journal d'audit : 5 ans (preuve en cas de litige). */
  auditLogYears: 5,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365 * DAY_MS;

export function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

export function yearsAgo(now: Date, years: number): Date {
  return new Date(now.getTime() - years * YEAR_MS);
}

export type RetentionCutoffs = {
  inactiveAccounts: Date;
  readNotifications: Date;
  unreadNotifications: Date;
  contactMessages: Date;
  moderationActions: Date;
  auditLogs: Date;
};

/** Compute every retention cutoff date relative to `now`. */
export function retentionCutoffs(now: Date): RetentionCutoffs {
  return {
    inactiveAccounts: yearsAgo(now, RETENTION.inactiveAccountYears),
    readNotifications: daysAgo(now, RETENTION.readNotificationDays),
    unreadNotifications: daysAgo(now, RETENTION.unreadNotificationDays),
    contactMessages: daysAgo(now, RETENTION.contactMessageDays),
    moderationActions: yearsAgo(now, RETENTION.moderationYears),
    auditLogs: yearsAgo(now, RETENTION.auditLogYears),
  };
}

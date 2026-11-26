/**
 * Auto-completion of sessions nobody closed (B8, minimal): a SCHEDULED
 * session that ended more than 48 h ago becomes COMPLETED so the mentee
 * can review it. Pure core; the cron injects the writes. The 48 h delay
 * is the default of open question 3 in docs/mentora-rebuild/02-architecture.md.
 */

export const AUTO_COMPLETE_AFTER_HOURS = 48;

const HOUR_MS = 3600_000;

/**
 * Upper bound on `scheduledAt` for the cron query: a session cannot have
 * ended 48 h ago without having started at least 48 h ago. The exact end
 * check (start + duration) runs on the candidates.
 */
export function autoCompleteCandidatesBefore(now: Date): Date {
  return new Date(now.getTime() - AUTO_COMPLETE_AFTER_HOURS * HOUR_MS);
}

export function isDueForAutoCompletion(
  session: { scheduledAt: Date; durationMinutes: number },
  now: Date,
): boolean {
  const endsAt = session.scheduledAt.getTime() + session.durationMinutes * 60_000;
  return endsAt <= now.getTime() - AUTO_COMPLETE_AFTER_HOURS * HOUR_MS;
}

export type DueSession = { id: string; menteeUserId: string; mentorUserId: string };

export type SessionAutoCompletionDeps = {
  /** Flip one session to COMPLETED if it is still SCHEDULED; false when it no longer was. */
  markCompleted: (id: string) => Promise<boolean>;
  inviteReview: (session: DueSession) => Promise<unknown>;
};

export async function runSessionAutoCompletion(
  due: DueSession[],
  deps: SessionAutoCompletionDeps,
): Promise<{ completed: number; failed: number }> {
  let completed = 0;
  let failed = 0;
  for (const s of due) {
    let changed = false;
    try {
      changed = await deps.markCompleted(s.id);
    } catch (err) {
      failed++;
      console.error('[mentora auto-complete] failed to complete session', s.id, err);
      continue;
    }
    if (!changed) continue;
    completed++;
    await deps.inviteReview(s);
  }
  return { completed, failed };
}

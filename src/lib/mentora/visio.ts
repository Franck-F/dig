/**
 * Visio (video meeting) URL helpers.
 *
 * Mentorat sessions with `format === REMOTE_VIDEO` need a meeting URL.
 * We default to **Jitsi Meet** (https://meet.jit.si) — no API key,
 * no account, no per-minute cost. The room name is derived
 * deterministically from the session id so it's stable across
 * refreshes and shareable.
 *
 * To swap to Daily.co / Whereby later: replace `buildVisioRoomUrl`
 * with a server-side REST call that allocates a room and returns its
 * URL. The call sites (`scheduleSession` + session UI) consume only
 * the helper, not the underlying provider.
 *
 * The room prefix doubles as a low-friction brand surface — anyone who
 * sees the URL in their calendar knows where it came from.
 */

const JITSI_BASE = 'https://meet.jit.si';
const ROOM_PREFIX = 'mentorat-digizelle';

/**
 * Slugify a session id into a URL-safe room fragment.
 *
 * cuids are already URL-safe but mixing case in Jitsi room names is
 * lowercased server-side anyway — collapse to a single canonical form
 * so the same session always gets the same room.
 */
function roomFragment(sessionId: string): string {
  return sessionId.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Build the public meeting URL for a session.
 *
 * Pure function — no I/O, safe to call from server actions and the
 * client. Returns null on falsy input so callers can fall back
 * to a user-provided link.
 */
export function buildVisioRoomUrl(sessionId: string | null | undefined): string | null {
  if (!sessionId) return null;
  return `${JITSI_BASE}/${ROOM_PREFIX}-${roomFragment(sessionId)}`;
}

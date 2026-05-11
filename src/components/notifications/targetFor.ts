/**
 * Map a notification type + payload to the deep link that should be
 * opened when the user clicks "Ouvrir" in the detail pane.
 *
 * Shared between the Community and Mentorat inboxes — both surfaces
 * see the same Notification rows, just filtered by type. Returning
 * `null` means there's no canonical destination (the notification
 * is purely informational, e.g. a badge award where the user just
 * wants to acknowledge it).
 *
 * Centralising this mapping keeps the routing knowledge in one
 * place: when a new notification type ships we only update this
 * file plus the i18n bundles.
 */
type Payload = Record<string, unknown>;

export function targetFor(type: string, payload: Payload): string | null {
  const get = (key: string) =>
    typeof payload[key] === 'string' ? (payload[key] as string) : null;

  switch (type) {
    case 'REQUEST_RECEIVED':
      return '/mentora/dashboard/requests?tab=received';
    case 'REQUEST_ACCEPTED':
    case 'REQUEST_DECLINED':
    case 'REQUEST_WITHDRAWN':
    case 'REQUEST_EXPIRED':
      return '/mentora/dashboard/requests';
    case 'SESSION_SCHEDULED':
    case 'SESSION_REMINDER':
    case 'SESSION_CANCELLED':
    case 'SESSION_RESCHEDULED': {
      const sid = get('sessionId');
      return sid ? `/mentora/dashboard/sessions/${sid}` : '/mentora/dashboard/sessions';
    }
    case 'NEW_MESSAGE': {
      const mid = get('mentorshipId');
      return mid
        ? `/mentora/dashboard/mentorships/${mid}?tab=messages`
        : '/mentora/dashboard/messages';
    }
    case 'REVIEW_RECEIVED':
    case 'MENTOR_APPROVED':
    case 'MENTOR_REJECTED':
      return '/mentora/dashboard/profile/edit';

    /* Community-side notifications — link to the relevant community surface */
    case 'POST_REPLY':
    case 'COMMENT_REPLY':
    case 'MENTION':
    case 'REACTION_RECEIVED': {
      const pid = get('postId');
      return pid ? `/community/posts/${pid}` : '/community';
    }
    case 'CHANNEL_INVITE':
    case 'CHANNEL_JOIN_REQUESTED':
    case 'CHANNEL_JOIN_APPROVED': {
      const slug = get('channelSlug');
      return slug ? `/community/c/${slug}` : '/community/channels';
    }
    case 'BADGE_AWARDED': {
      const slug = get('badgeSlug');
      return slug ? `/community/badges/${slug}` : '/community/badges';
    }
    case 'CHALLENGE_NEW':
    case 'CHALLENGE_RESULT':
    case 'CHALLENGE_VOTE_RECEIVED': {
      const cid = get('challengeId');
      return cid ? `/community/challenges/${cid}` : '/community/challenges';
    }
    case 'MODERATION_ACTION':
    case 'REPORT_RECEIVED':
      return '/community/notifications';

    default:
      return null;
  }
}

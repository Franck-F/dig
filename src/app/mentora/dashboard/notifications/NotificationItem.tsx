'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { markNotificationRead } from '@/lib/actions/mentora/notifications';
import { fmtDateTime } from '../_components/format';

type Payload = Record<string, unknown>;

/**
 * One notification row.
 *
 * Click on the row → expand inline to show the body (so the user can read the
 * full notification without leaving the page). When expanded, an "Ouvrir"
 * button appears if a target route exists, plus a "Marquer comme lu" button.
 *
 * The previous behaviour (single click marks read + navigates) was hiding the
 * notification's content entirely — useful for actionable types but bad for
 * informational ones like BADGE_AWARDED. The expand-first pattern lets every
 * row reveal its body without losing the click-through to the related surface.
 */
export default function NotificationItem({
  id,
  type,
  payload,
  createdAt,
  readAt,
}: {
  id: string;
  type: string;
  payload: Payload;
  createdAt: string;
  readAt: string | null;
}) {
  const t = useTranslations('mentora.notifications');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const isUnread = !readAt;
  const target = targetFor(type, payload);
  const title = safeTranslation(t, `types.${type}`);
  const body = safeTranslation(t, `bodies.${type}`);

  function handleToggle() {
    setOpen((v) => !v);
    // Marking as read happens on first expansion — the user has clearly
    // engaged with this notification by clicking it.
    if (isUnread && !open) {
      startTransition(async () => {
        try {
          await markNotificationRead({ notificationId: id });
          router.refresh();
        } catch {
          // Non-fatal.
        }
      });
    }
  }

  function handleNavigate(e: React.MouseEvent) {
    e.stopPropagation();
    if (!target) return;
    startTransition(async () => {
      try {
        if (isUnread) await markNotificationRead({ notificationId: id });
      } catch {
        // Non-fatal — proceed with navigation.
      }
      router.push(target);
      router.refresh();
    });
  }

  function handleMarkRead(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    startTransition(async () => {
      try {
        await markNotificationRead({ notificationId: id });
      } catch {
        // Ignore — best effort.
      }
      router.refresh();
    });
  }

  return (
    <div
      className="dz-card"
      style={{
        padding: 16,
        background: isUnread ? 'rgba(115,1,255,0.05)' : undefined,
        cursor: 'pointer',
        transition: 'box-shadow 0.3s cubic-bezier(0.16,1,0.3,1)',
      }}
      onClick={handleToggle}
      role="button"
      aria-expanded={open}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleToggle();
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: isUnread ? '#7301FF' : 'transparent',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: isUnread ? 600 : 500, fontSize: 14 }}>{title}</div>
          <div className="dz-small" style={{ marginTop: 2 }}>{fmtDateTime(createdAt)}</div>
        </div>
        <span
          aria-hidden
          style={{
            color: '#7301FF',
            fontSize: 18,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
            flexShrink: 0,
          }}
        >
          ⌄
        </span>
      </div>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: '1px solid rgba(115,1,255,0.10)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <p
            className="dz-body"
            style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: '#1a1f3a' }}
          >
            {body}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {target && (
              <button
                type="button"
                onClick={handleNavigate}
                disabled={pending}
                className="dz-btn dz-btn-primary dz-btn-sm"
              >
                {t('open')} →
              </button>
            )}
            {isUnread && (
              <button
                type="button"
                onClick={handleMarkRead}
                disabled={pending}
                className="dz-btn dz-btn-ghost dz-btn-sm"
              >
                {t('markRead')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */

function safeTranslation(
  t: ReturnType<typeof useTranslations<'mentora.notifications'>>,
  key: string,
): string {
  // Defensive — unknown keys (future enum values) shouldn't surface raw paths.
  try {
    const v = t(key as Parameters<typeof t>[0]);
    // next-intl returns the raw key on miss in dev — detect and hide.
    if (typeof v === 'string' && v.startsWith('mentora.notifications.')) return '';
    return v;
  } catch {
    return '';
  }
}

function targetFor(type: string, payload: Payload): string | null {
  const get = (key: string) => (typeof payload[key] === 'string' ? (payload[key] as string) : null);
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

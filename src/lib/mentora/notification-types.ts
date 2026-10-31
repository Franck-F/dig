import type { NotificationType } from '@prisma/client';

/**
 * Notification types shown in the Mentorat bell (the Community ones live in
 * the same table and are filtered out). Shared by every Mentorat layout.
 */
export const MENTORA_NOTIFICATION_TYPES = [
  'REQUEST_RECEIVED',
  'REQUEST_ACCEPTED',
  'REQUEST_DECLINED',
  'REQUEST_WITHDRAWN',
  'REQUEST_EXPIRED',
  'SESSION_SCHEDULED',
  'SESSION_REMINDER',
  'SESSION_CANCELLED',
  'SESSION_RESCHEDULED',
  'SESSION_COMPLETED',
  'NEW_MESSAGE',
  'REVIEW_RECEIVED',
  'MENTOR_APPROVED',
  'MENTOR_REJECTED',
] as const satisfies readonly NotificationType[];

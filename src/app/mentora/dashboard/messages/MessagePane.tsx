'use client';

/**
 * MessagePane — re-export of the per-mentorship `MessagesTab` chat island
 * to keep a stable import surface from `messages/MessagePane`.
 *
 * The inbox at `/mentora/dashboard/messages` defers to the mentorship detail
 * page (`?tab=messages`) for v1. If we later want a side-by-side inbox + thread
 * view (à la Gmail), this re-export gives us a ready-made, audited chat
 * component to drop in without splitting the source of truth.
 */
import MessagesTab from '../mentorships/[id]/_tabs/MessagesTab';

export default MessagesTab;

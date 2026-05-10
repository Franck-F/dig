import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/mentora/messages?mentorshipId=…
 *
 * Returns the message history of a single mentorship for the
 * `MessagesTab` chat island used on /mentora/dashboard/mentorships/[id]
 * and the inbox at /mentora/dashboard/messages.
 *
 * Membership check: the viewer must be either the mentor or the
 * mentee of the mentorship — anyone else gets a 403 (we deliberately
 * 403 rather than 404 so the client can distinguish "doesn't exist"
 * from "not allowed" if we ever surface friendlier errors).
 *
 * Side effect: stamps `readByOtherAt` on every unread message NOT
 * authored by the viewer, so the unread dot in the inbox clears the
 * moment the chat opens. Same behaviour the previous server action
 * `markThreadRead` provides — we duplicate it here so the GET endpoint
 * is self-sufficient (no extra round-trip required from the client).
 *
 * Response shape — kept tight on purpose so the client stays cheap:
 *   { messages: Array<{ id, body, senderUserId, sentAt: ISO string }> }
 */
export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ messages: [] }, { status: 401 });
  }

  const url = new URL(request.url);
  const mentorshipId = url.searchParams.get('mentorshipId');
  if (!mentorshipId) {
    return NextResponse.json({ error: 'missing_mentorshipId' }, { status: 400 });
  }

  // Membership check via a small targeted query — cheaper than the
  // full helper since we don't need cycle / status here.
  const mentorship = await prisma.mentorship.findUnique({
    where: { id: mentorshipId },
    select: {
      id: true,
      mentorProfile: { select: { userId: true } },
      menteeProfile: { select: { userId: true } },
    },
  });
  if (!mentorship) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const isMember =
    mentorship.mentorProfile.userId === userId ||
    mentorship.menteeProfile.userId === userId;
  if (!isMember) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const messages = await prisma.mentorshipMessage.findMany({
    where: { mentorshipId },
    orderBy: { sentAt: 'asc' },
    select: {
      id: true,
      body: true,
      senderUserId: true,
      sentAt: true,
    },
    take: 500,
  });

  // Best-effort mark-as-read pass for messages authored by the OTHER
  // party. Non-blocking — we don't await the response of this; if it
  // fails the messages still return.
  prisma.mentorshipMessage
    .updateMany({
      where: {
        mentorshipId,
        senderUserId: { not: userId },
        readByOtherAt: null,
      },
      data: { readByOtherAt: new Date() },
    })
    .catch(() => {
      /* swallow — read-stamping is opportunistic */
    });

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      senderUserId: m.senderUserId,
      sentAt: m.sentAt.toISOString(),
    })),
  });
}

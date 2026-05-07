import 'server-only';
import { prisma } from '@/lib/prisma';

/**
 * GDPR Article 20 — Right to data portability.
 *
 * Builds a single JSON document containing every row in the database that
 * carries a foreign key to the requesting user. Out-of-scope:
 *   - Password hash, OAuth access tokens, refresh tokens, ID tokens
 *     (security — never leave the server in plaintext).
 *   - VerificationCode / VerificationToken (transient, short-lived).
 *   - Other users' data, even when joined (e.g. comment threads return only
 *     the user's own comments, not siblings).
 *
 * Format: machine-readable JSON, schema-versioned (v1) so downstream tools
 * can adapt as the model evolves. Dates are ISO-8601 strings (Prisma's
 * default JSON.stringify output).
 *
 * Performance: each section runs in parallel via Promise.all. Total row
 * count is bounded by per-user activity — typical export ≤ a few thousand
 * rows, fits comfortably in memory and a single response body.
 */
export type DataExport = {
  schemaVersion: 1;
  generatedAt: string;
  user: unknown;
  accounts: unknown[];
  mentorProfile: unknown;
  menteeProfile: unknown;
  mentorSkills: unknown[];
  menteeGoalSkills: unknown[];
  availabilityRules: unknown[];
  availabilityExceptions: unknown[];
  mentorshipsAsMentor: unknown[];
  mentorshipsAsMentee: unknown[];
  mentorshipRequestsSent: unknown[];
  mentorshipRequestsReceived: unknown[];
  mentorshipMessages: unknown[];
  sessions: unknown[];
  reviewsAuthored: unknown[];
  reviewsReceived: unknown[];
  notifications: unknown[];
  communityMember: unknown;
  channelMemberships: unknown[];
  posts: unknown[];
  comments: unknown[];
  reactions: unknown[];
  bookmarks: unknown[];
  mentionsReceived: unknown[];
  challengeSubmissions: unknown[];
  challengeVotes: unknown[];
  reportsAuthored: unknown[];
  badges: unknown[];
  newsletterSubscriber: unknown;
  contactMessages: unknown[];
  auditLogAuthored: unknown[];
};

export async function buildUserDataExport(userId: string): Promise<DataExport> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      image: true,
      role: true,
      emailVerified: true,
      marketingEmailsEnabled: true,
      emailBouncedAt: true,
      emailBouncedReason: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const email = user.email;

  const [
    accounts,
    mentorProfile,
    menteeProfile,
    mentorSkills,
    menteeGoalSkills,
    availabilityRules,
    availabilityExceptions,
    mentorshipsAsMentor,
    mentorshipsAsMentee,
    mentorshipRequestsSent,
    mentorshipRequestsReceived,
    mentorshipMessages,
    sessions,
    reviewsAuthored,
    reviewsReceived,
    notifications,
    communityMember,
    channelMemberships,
    posts,
    comments,
    reactions,
    bookmarks,
    mentionsReceived,
    challengeSubmissions,
    challengeVotes,
    reportsAuthored,
    badges,
    newsletterSubscriber,
    contactMessages,
    auditLogAuthored,
  ] = await Promise.all([
    // Accounts: OAuth links — provider + providerAccountId only, never tokens.
    prisma.account.findMany({
      where: { userId },
      select: {
        provider: true,
        providerAccountId: true,
        type: true,
      },
    }),
    prisma.mentorProfile.findUnique({ where: { userId } }),
    prisma.menteeProfile.findUnique({ where: { userId } }),
    prisma.mentorSkill.findMany({ where: { mentorProfile: { userId } } }),
    prisma.menteeGoalSkill.findMany({ where: { menteeProfile: { userId } } }),
    prisma.availabilityRule.findMany({ where: { mentorProfile: { userId } } }),
    prisma.availabilityException.findMany({ where: { mentorProfile: { userId } } }),
    prisma.mentorship.findMany({ where: { mentorProfile: { userId } } }),
    prisma.mentorship.findMany({ where: { menteeProfile: { userId } } }),
    prisma.mentorshipRequest.findMany({ where: { fromMentee: { userId } } }),
    prisma.mentorshipRequest.findMany({ where: { toMentor: { userId } } }),
    prisma.mentorshipMessage.findMany({
      where: { senderUserId: userId },
      select: {
        id: true,
        mentorshipId: true,
        body: true,
        attachmentUrl: true,
        sentAt: true,
        readByOtherAt: true,
      },
    }),
    prisma.session.findMany({
      where: {
        OR: [
          { mentorship: { mentorProfile: { userId } } },
          { mentorship: { menteeProfile: { userId } } },
        ],
      },
    }),
    prisma.review.findMany({ where: { authorUserId: userId } }),
    prisma.review.findMany({
      where: { mentorship: { mentorProfile: { userId } } },
      select: {
        id: true,
        mentorshipId: true,
        sessionId: true,
        rating: true,
        comment: true,
        isPublic: true,
        helpfulnessVotes: true,
        createdAt: true,
      },
    }),
    prisma.notification.findMany({ where: { userId } }),
    prisma.communityMember.findUnique({ where: { userId } }),
    prisma.channelMembership.findMany({ where: { member: { userId } } }),
    prisma.post.findMany({
      where: { author: { userId } },
      select: {
        id: true,
        channelId: true,
        title: true,
        body: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        publishedAt: true,
        editedAt: true,
        editReason: true,
        removedAt: true,
        removalReason: true,
      },
    }),
    prisma.comment.findMany({
      where: { author: { userId } },
      select: {
        id: true,
        postId: true,
        parentCommentId: true,
        body: true,
        status: true,
        createdAt: true,
        editedAt: true,
        removedAt: true,
        removalReason: true,
      },
    }),
    prisma.reaction.findMany({ where: { member: { userId } } }),
    prisma.bookmark.findMany({ where: { member: { userId } } }),
    prisma.mention.findMany({ where: { targetMember: { userId } } }),
    prisma.challengeSubmission.findMany({ where: { author: { userId } } }),
    prisma.challengeVote.findMany({ where: { voter: { userId } } }),
    // Reports: only those filed by the user. Reports against them are
    // legitimate-interest moderation records and don't ship in a personal
    // portability export.
    prisma.report.findMany({
      where: { reporter: { userId } },
      select: {
        id: true,
        reason: true,
        details: true,
        status: true,
        postId: true,
        commentId: true,
        createdAt: true,
        resolvedAt: true,
      },
    }),
    prisma.memberBadge.findMany({
      where: { member: { userId } },
      include: { badge: true },
    }),
    email
      ? prisma.newsletterSubscriber.findFirst({ where: { email } })
      : Promise.resolve(null),
    email
      ? prisma.contactMessage.findMany({ where: { email } })
      : Promise.resolve([]),
    // Audit log: only entries where the user is the actor (admin/mod actions
    // they performed). Audit entries about them are intentionally excluded.
    prisma.auditLog.findMany({
      where: { actorUserId: userId },
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        payload: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    user,
    accounts,
    mentorProfile,
    menteeProfile,
    mentorSkills,
    menteeGoalSkills,
    availabilityRules,
    availabilityExceptions,
    mentorshipsAsMentor,
    mentorshipsAsMentee,
    mentorshipRequestsSent,
    mentorshipRequestsReceived,
    mentorshipMessages,
    sessions,
    reviewsAuthored,
    reviewsReceived,
    notifications,
    communityMember,
    channelMemberships,
    posts,
    comments,
    reactions,
    bookmarks,
    mentionsReceived,
    challengeSubmissions,
    challengeVotes,
    reportsAuthored,
    badges,
    newsletterSubscriber,
    contactMessages,
    auditLogAuthored,
  };
}

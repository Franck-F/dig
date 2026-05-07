import 'server-only';

import { prisma } from '@/lib/prisma';

/**
 * Server-side detection of abuse patterns. Each function runs a Postgres
 * aggregation and returns members or events that warrant a moderator's
 * attention. Designed to be cheap enough to load synchronously on the
 * `/community/admin/flags` page — most queries hit indexes that already
 * exist (Report.againstMemberId, Mention.targetMemberId, Comment.authorId).
 *
 * AIPD action item §3.1 (cyber-harcèlement) — these surface the patterns
 * the mod team needs to triage but never auto-act. Decisions remain
 * human (and dual for BANs).
 */

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type RepeatOffenderRow = {
  memberId: string;
  handle: string;
  displayName: string | null;
  reportCount: number;
  distinctReporters: number;
  firstReportAt: Date;
  lastReportAt: Date;
};

/**
 * Members against whom ≥ 3 reports landed in the last 7 days from
 * ≥ 2 distinct reporters. The double threshold cuts the noise of one
 * grudgey reporter mass-flagging the same person.
 */
export async function findRepeatOffenders(): Promise<RepeatOffenderRow[]> {
  const since = new Date(Date.now() - SEVEN_DAYS_MS);
  const rows = await prisma.$queryRaw<
    Array<{
      member_id: string;
      handle: string;
      display_name: string | null;
      report_count: bigint;
      distinct_reporters: bigint;
      first_report_at: Date;
      last_report_at: Date;
    }>
  >`
    SELECT
      r."againstMemberId" AS member_id,
      m.handle AS handle,
      m."displayName" AS display_name,
      COUNT(*) AS report_count,
      COUNT(DISTINCT r."reporterId") AS distinct_reporters,
      MIN(r."createdAt") AS first_report_at,
      MAX(r."createdAt") AS last_report_at
    FROM "Report" r
    JOIN "CommunityMember" m ON m.id = r."againstMemberId"
    WHERE r."createdAt" >= ${since}
      AND r."againstMemberId" IS NOT NULL
      AND m."deletedAt" IS NULL
    GROUP BY r."againstMemberId", m.handle, m."displayName"
    HAVING COUNT(*) >= 3 AND COUNT(DISTINCT r."reporterId") >= 2
    ORDER BY report_count DESC, last_report_at DESC
    LIMIT 50;
  `;
  return rows.map((r) => ({
    memberId: r.member_id,
    handle: r.handle,
    displayName: r.display_name,
    reportCount: Number(r.report_count),
    distinctReporters: Number(r.distinct_reporters),
    firstReportAt: r.first_report_at,
    lastReportAt: r.last_report_at,
  }));
}

export type HyperactiveReporterRow = {
  memberId: string;
  handle: string;
  displayName: string | null;
  reportCount: number;
  distinctTargets: number;
  firstReportAt: Date;
  lastReportAt: Date;
};

/**
 * Members who filed ≥ 4 reports in the last 24 h. Could be legitimate
 * (mass-spam wave) or could be coordinated harassment-by-reporting.
 * The mod queue still applies — this just surfaces the prolific
 * reporter so a human can scan their motives.
 */
export async function findHyperactiveReporters(): Promise<HyperactiveReporterRow[]> {
  const since = new Date(Date.now() - ONE_DAY_MS);
  const rows = await prisma.$queryRaw<
    Array<{
      member_id: string;
      handle: string;
      display_name: string | null;
      report_count: bigint;
      distinct_targets: bigint;
      first_report_at: Date;
      last_report_at: Date;
    }>
  >`
    SELECT
      r."reporterId" AS member_id,
      m.handle AS handle,
      m."displayName" AS display_name,
      COUNT(*) AS report_count,
      COUNT(DISTINCT r."againstMemberId") AS distinct_targets,
      MIN(r."createdAt") AS first_report_at,
      MAX(r."createdAt") AS last_report_at
    FROM "Report" r
    JOIN "CommunityMember" m ON m.id = r."reporterId"
    WHERE r."createdAt" >= ${since}
      AND m."deletedAt" IS NULL
    GROUP BY r."reporterId", m.handle, m."displayName"
    HAVING COUNT(*) >= 4
    ORDER BY report_count DESC
    LIMIT 50;
  `;
  return rows.map((r) => ({
    memberId: r.member_id,
    handle: r.handle,
    displayName: r.display_name,
    reportCount: Number(r.report_count),
    distinctTargets: Number(r.distinct_targets),
    firstReportAt: r.first_report_at,
    lastReportAt: r.last_report_at,
  }));
}

export type MentionStormRow = {
  memberId: string;
  handle: string;
  displayName: string | null;
  mentionCount: number;
  distinctAuthors: number;
  windowStartedAt: Date;
};

/**
 * Members mentioned by ≥ 3 distinct authors with a total of ≥ 10
 * mentions in the last 24 h. A pile-on (e.g. one user singled out and
 * tagged repeatedly across threads) shows up here even when no
 * individual report has been filed yet. Often the earliest signal of
 * coordinated harassment.
 */
export async function findMentionStorms(): Promise<MentionStormRow[]> {
  const since = new Date(Date.now() - ONE_DAY_MS);
  const rows = await prisma.$queryRaw<
    Array<{
      member_id: string;
      handle: string;
      display_name: string | null;
      mention_count: bigint;
      distinct_authors: bigint;
      window_started_at: Date;
    }>
  >`
    SELECT
      mn."targetMemberId" AS member_id,
      m.handle AS handle,
      m."displayName" AS display_name,
      COUNT(*) AS mention_count,
      COUNT(DISTINCT mn."authorId") AS distinct_authors,
      MIN(mn."createdAt") AS window_started_at
    FROM "Mention" mn
    JOIN "CommunityMember" m ON m.id = mn."targetMemberId"
    WHERE mn."createdAt" >= ${since}
      AND m."deletedAt" IS NULL
    GROUP BY mn."targetMemberId", m.handle, m."displayName"
    HAVING COUNT(*) >= 10 AND COUNT(DISTINCT mn."authorId") >= 3
    ORDER BY mention_count DESC, distinct_authors DESC
    LIMIT 30;
  `;
  return rows.map((r) => ({
    memberId: r.member_id,
    handle: r.handle,
    displayName: r.display_name,
    mentionCount: Number(r.mention_count),
    distinctAuthors: Number(r.distinct_authors),
    windowStartedAt: r.window_started_at,
  }));
}

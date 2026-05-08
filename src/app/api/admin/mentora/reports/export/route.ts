import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { logAdmin } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/admin/mentora/reports/export?kind=…
 *
 * Returns a CSV file scoped to one of the report sections shown on
 * `/mentora/admin/reports`. Strictly admin-only — every call is audit-logged
 * (potentially sensitive aggregate data).
 *
 * Supported `kind` values:
 *   - `sessions`     — every Session row with mentorship + user names
 *   - `mentorships`  — every Mentorship with both side identities
 *   - `requests`     — every MentorshipRequest with status
 *   - `reviews`      — every Review with rating + comment + author
 *   - `mentors`      — every MentorProfile (status, languages, exp years)
 *   - `mentees`      — every MenteeProfile (goals truncated)
 *
 * The intent is to give admins a quick way to pivot in Excel / Sheets,
 * not to be a full BI export. We cap each kind to the most recent
 * 5 000 rows to keep the file small and the response fast — anything
 * larger should go through the data warehouse.
 */

type Kind =
  | 'sessions'
  | 'mentorships'
  | 'requests'
  | 'reviews'
  | 'mentors'
  | 'mentees';

const ALLOWED: ReadonlySet<Kind> = new Set([
  'sessions',
  'mentorships',
  'requests',
  'reviews',
  'mentors',
  'mentees',
]);

const MAX_ROWS = 5000;

/** RFC 4180-ish: wrap when the cell contains a comma, quote, or newline. */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (s.includes('"')) s = s.replace(/"/g, '""');
  if (/[",\n\r]/.test(s)) s = `"${s}"`;
  return s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  // BOM so Excel opens the UTF-8 file with the right encoding.
  const lines: string[] = ['﻿' + headers.map(csvCell).join(',')];
  for (const r of rows) lines.push(r.map(csvCell).join(','));
  return lines.join('\r\n') + '\r\n';
}

function userName(u: { name: string | null; firstName: string | null; lastName: string | null; email: string }): string {
  if (u.name) return u.name;
  const composed = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return composed || u.email;
}

async function buildPayload(kind: Kind): Promise<{ csv: string; filename: string }> {
  const today = new Date().toISOString().slice(0, 10);
  switch (kind) {
    case 'sessions': {
      const rows = await prisma.session.findMany({
        take: MAX_ROWS,
        orderBy: { scheduledAt: 'desc' },
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          durationMinutes: true,
          mentorship: {
            select: {
              id: true,
              mentorProfile: {
                select: {
                  user: { select: { name: true, firstName: true, lastName: true, email: true } },
                },
              },
              menteeProfile: {
                select: {
                  user: { select: { name: true, firstName: true, lastName: true, email: true } },
                },
              },
            },
          },
        },
      });
      const csv = toCsv(
        ['session_id', 'scheduled_at', 'status', 'duration_minutes', 'mentor', 'mentor_email', 'mentee', 'mentee_email'],
        rows.map((s) => [
          s.id,
          s.scheduledAt,
          s.status,
          s.durationMinutes,
          userName(s.mentorship.mentorProfile.user),
          s.mentorship.mentorProfile.user.email,
          userName(s.mentorship.menteeProfile.user),
          s.mentorship.menteeProfile.user.email,
        ]),
      );
      return { csv, filename: `mentora-sessions-${today}.csv` };
    }
    case 'mentorships': {
      const rows = await prisma.mentorship.findMany({
        take: MAX_ROWS,
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          status: true,
          startedAt: true,
          endedAt: true,
          mentorProfile: {
            select: {
              user: { select: { name: true, firstName: true, lastName: true, email: true } },
            },
          },
          menteeProfile: {
            select: {
              user: { select: { name: true, firstName: true, lastName: true, email: true } },
            },
          },
          _count: { select: { sessions: true, reviews: true } },
        },
      });
      const csv = toCsv(
        ['mentorship_id', 'status', 'started_at', 'ended_at', 'mentor', 'mentor_email', 'mentee', 'mentee_email', 'session_count', 'review_count'],
        rows.map((m) => [
          m.id,
          m.status,
          m.startedAt,
          m.endedAt,
          userName(m.mentorProfile.user),
          m.mentorProfile.user.email,
          userName(m.menteeProfile.user),
          m.menteeProfile.user.email,
          m._count.sessions,
          m._count.reviews,
        ]),
      );
      return { csv, filename: `mentora-mentorships-${today}.csv` };
    }
    case 'requests': {
      const rows = await prisma.mentorshipRequest.findMany({
        take: MAX_ROWS,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          createdAt: true,
          respondedAt: true,
          fromMentee: {
            select: {
              user: { select: { name: true, firstName: true, lastName: true, email: true } },
            },
          },
          toMentor: {
            select: {
              user: { select: { name: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
      });
      const csv = toCsv(
        ['request_id', 'status', 'created_at', 'responded_at', 'mentee', 'mentee_email', 'mentor', 'mentor_email'],
        rows.map((r) => [
          r.id,
          r.status,
          r.createdAt,
          r.respondedAt,
          userName(r.fromMentee.user),
          r.fromMentee.user.email,
          userName(r.toMentor.user),
          r.toMentor.user.email,
        ]),
      );
      return { csv, filename: `mentora-requests-${today}.csv` };
    }
    case 'reviews': {
      const rows = await prisma.review.findMany({
        take: MAX_ROWS,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          author: { select: { name: true, firstName: true, lastName: true, email: true } },
          mentorship: {
            select: {
              mentorProfile: {
                select: {
                  user: { select: { name: true, firstName: true, lastName: true, email: true } },
                },
              },
            },
          },
        },
      });
      const csv = toCsv(
        ['review_id', 'created_at', 'rating', 'mentor', 'author', 'comment'],
        rows.map((r) => [
          r.id,
          r.createdAt,
          r.rating,
          userName(r.mentorship.mentorProfile.user),
          userName(r.author),
          (r.comment ?? '').replace(/\s+/g, ' ').trim().slice(0, 500),
        ]),
      );
      return { csv, filename: `mentora-reviews-${today}.csv` };
    }
    case 'mentors': {
      const rows = await prisma.mentorProfile.findMany({
        take: MAX_ROWS,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          headline: true,
          yearsExperience: true,
          languages: true,
          createdAt: true,
          user: { select: { name: true, firstName: true, lastName: true, email: true } },
          _count: { select: { mentorships: true } },
        },
      });
      const csv = toCsv(
        ['mentor_id', 'status', 'name', 'email', 'headline', 'years_experience', 'languages', 'mentorships_count', 'created_at'],
        rows.map((m) => [
          m.id,
          m.status,
          userName(m.user),
          m.user.email,
          (m.headline ?? '').replace(/\s+/g, ' ').trim().slice(0, 200),
          m.yearsExperience,
          (m.languages ?? []).join('|'),
          m._count.mentorships,
          m.createdAt,
        ]),
      );
      return { csv, filename: `mentora-mentors-${today}.csv` };
    }
    case 'mentees': {
      const rows = await prisma.menteeProfile.findMany({
        take: MAX_ROWS,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          languages: true,
          timezone: true,
          goals: true,
          createdAt: true,
          user: { select: { name: true, firstName: true, lastName: true, email: true } },
          _count: { select: { mentorships: true } },
        },
      });
      const csv = toCsv(
        ['mentee_id', 'name', 'email', 'timezone', 'languages', 'goals', 'mentorships_count', 'created_at'],
        rows.map((m) => [
          m.id,
          userName(m.user),
          m.user.email,
          m.timezone,
          (m.languages ?? []).join('|'),
          (m.goals ?? '').replace(/\s+/g, ' ').trim().slice(0, 300),
          m._count.mentorships,
          m.createdAt,
        ]),
      );
      return { csv, filename: `mentora-mentees-${today}.csv` };
    }
  }
}

export async function GET(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (me?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get('kind') ?? '').toLowerCase();
  if (!ALLOWED.has(raw as Kind)) {
    return NextResponse.json(
      { error: 'invalid_kind', allowed: Array.from(ALLOWED) },
      { status: 400 },
    );
  }
  const kind = raw as Kind;

  try {
    const { csv, filename } = await buildPayload(kind);
    await logAdmin(userId, {
      action: 'reports.export',
      targetType: 'Report',
      targetId: kind,
      payload: { kind, rows: csv.split('\r\n').length - 2 },
    });
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[reports.export]', kind, e);
    return NextResponse.json({ error: 'export_failed' }, { status: 500 });
  }
}

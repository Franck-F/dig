import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { logAdmin } from '@/lib/audit/log';
import { buildUserDataExport } from '@/lib/rgpd/export';
import { checkUserActionRateLimit } from '@/lib/rate-limit/user-action-limiter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/account/export
 *
 * GDPR Article 20 — Right to data portability. Returns a JSON file with the
 * authenticated user's full footprint. Auth-gated, rate-limited (2/day per
 * userId), audit-logged.
 *
 * Why a route handler instead of a server action?
 *   Server actions are great for mutations + redirects but we want the
 *   browser to surface a native download dialog with `Content-Disposition`
 *   set, which is straightforward over HTTP.
 *
 * Why JSON, not ZIP-with-CSVs?
 *   The data graph has nested + polymorphic relations (mentions polymorphic
 *   over post/comment, reports polymorphic over post/comment, reactions on
 *   post/comment). JSON is the only format that round-trips this without
 *   denormalising. Schema is versioned (v1) so downstream tooling can
 *   evolve.
 */
export async function GET(_req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const limit = checkUserActionRateLimit('dataExport', userId);
  if (!limit.ok) {
    const headers = new Headers({ 'Retry-After': String(limit.retryAfterSec) });
    return NextResponse.json(
      { error: 'rate_limited', retryAfterSec: limit.retryAfterSec },
      { status: 429, headers },
    );
  }

  let payload;
  try {
    payload = await buildUserDataExport(userId);
  } catch (err) {
    console.error('[export] failed to build payload', { userId, err });
    return NextResponse.json({ error: 'export_failed' }, { status: 500 });
  }

  // Best-effort audit trail. Failures inside `logAdmin` are swallowed.
  await logAdmin(userId, {
    action: 'account.self_export',
    targetType: 'User',
    targetId: userId,
    payload: { schemaVersion: payload.schemaVersion },
  });

  const body = JSON.stringify(payload, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `digizelle-export-${userId}-${date}.json`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

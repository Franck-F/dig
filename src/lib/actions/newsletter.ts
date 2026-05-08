'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from './_shared';
import { logAdmin } from '@/lib/audit/log';
import {
  drainEmailQueue,
  enqueueEmails,
  getCampaignStatus,
} from '@/lib/email/queue';
import { buildUnsubscribeUrl } from '@/lib/email/unsubscribe-token';
import { getDpoEmail } from '@/lib/contact';

export type NewsletterState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; error: string };

const schema = z.object({
  email: z.string().email('Email invalide').max(200),
  source: z.string().max(80).optional(),
});

export async function subscribeNewsletter(_prev: NewsletterState, formData: FormData): Promise<NewsletterState> {
  const parsed = schema.safeParse({
    email: formData.get('email'),
    source: formData.get('source') ?? undefined,
  });

  if (!parsed.success) {
    return { status: 'error', error: parsed.error.issues[0]?.message ?? 'Email invalide' };
  }

  const { email, source } = parsed.data;

  try {
    await prisma.newsletterSubscriber.upsert({
      where: { email },
      update: { active: true },
      create: { email, source },
    });
  } catch {
    return { status: 'error', error: "Erreur d'inscription. Réessayez plus tard." };
  }

  return { status: 'success' };
}

// ─── Admin newsletter campaign ──────────────────────────────────────────
//
// Stateless send: we resolve the audience to a unique email list, then push
// to Resend in small batches. No campaign history table for now — the admin
// UI surfaces the result inline (sent / failed / total).

export type Audience = 'subscribers' | 'mentors' | 'mentees' | 'community' | 'all';

const campaignSchema = z.object({
  subject: z.string().trim().min(5, 'Sujet trop court').max(200, 'Sujet trop long'),
  body: z.string().trim().min(10, 'Contenu trop court').max(10000, 'Contenu trop long'),
  audience: z.enum(['subscribers', 'mentors', 'mentees', 'community', 'all']),
});

type AudienceRecipient = { email: string; userId: string | null };

async function resolveAudienceEmails(audience: Audience): Promise<AudienceRecipient[]> {
  // De-dup by email; map to userId when the recipient has an account
  // (for the unsubscribe token). NewsletterSubscriber rows have no
  // User.id so they get null — those receive a generic unsub message
  // pointing at /contact for now (full subscriber-side unsub flow is
  // tracked as a follow-up).
  const map = new Map<string, string | null>();
  const wantsAll = audience === 'all';

  if (wantsAll || audience === 'subscribers') {
    const rows = await prisma.newsletterSubscriber.findMany({
      where: { active: true },
      select: { email: true },
    });
    for (const r of rows) {
      const e = r.email.toLowerCase();
      if (!map.has(e)) map.set(e, null);
    }
  }

  // For all User-backed audiences we apply two filters at the DB layer:
  //  1. Soft-deleted accounts must not receive marketing.
  //  2. Users who explicitly opted out (marketingEmailsEnabled=false)
  //     must not receive marketing — this is the RGPD opt-out honoured
  //     here so an existing unsub stays effective on the next campaign.
  const userQuery = (
    extra: import('@prisma/client').Prisma.UserWhereInput,
  ): import('@prisma/client').Prisma.UserWhereInput => ({
    ...extra,
    deletedAt: null,
    marketingEmailsEnabled: true,
    // Bounced / complaint addresses must not be mailed again — protects
    // our IP reputation. Cleared by an admin or by an email change.
    emailBouncedAt: null,
    email: { not: '' },
  });

  if (wantsAll || audience === 'mentors') {
    const rows = await prisma.user.findMany({
      where: userQuery({ mentorProfile: { isNot: null } }),
      select: { id: true, email: true },
    });
    for (const r of rows) if (r.email) map.set(r.email.toLowerCase(), r.id);
  }

  if (wantsAll || audience === 'mentees') {
    const rows = await prisma.user.findMany({
      where: userQuery({ menteeProfile: { isNot: null } }),
      select: { id: true, email: true },
    });
    for (const r of rows) if (r.email) map.set(r.email.toLowerCase(), r.id);
  }

  if (wantsAll || audience === 'community') {
    const rows = await prisma.user.findMany({
      where: userQuery({ communityMember: { isNot: null } }),
      select: { id: true, email: true },
    });
    for (const r of rows) if (r.email) map.set(r.email.toLowerCase(), r.id);
  }

  return [...map.entries()].map(([email, userId]) => ({ email, userId }));
}

export async function countAudience(
  audience: Audience,
): Promise<{ status: 'success'; count: number } | { status: 'error'; error: string }> {
  try {
    const me = await requireUser();
    if (me.role !== 'ADMIN') return { status: 'error', error: 'unauthorized' };
    const list = await resolveAudienceEmails(audience);
    return { status: 'success', count: list.length };
  } catch {
    return { status: 'error', error: 'unauthorized' };
  }
}

/**
 * Newsletter send is now a 2-phase operation:
 *   1. Enqueue every recipient as an EmailQueueItem (instant; tagged with
 *      a campaign id so the admin UI can poll progress).
 *   2. Best-effort synchronous drain inside the same request — sends as
 *      many as fit in the function's 10s budget. Whatever's left
 *      finishes on the next cron pass (sessions-reminder also drains
 *      the queue, P0 task #9 wires this).
 *
 * The admin UI receives the campaign tag and polls `getNewsletterCampaignStatus`
 * to render live progress (queued / sent / failed) without holding the
 * request open.
 */
export async function sendNewsletterCampaign(input: {
  subject: string;
  body: string;
  audience: Audience;
}): Promise<
  | { status: 'success'; campaignTag: string; recipientCount: number; mocked: boolean }
  | { status: 'error'; error: string }
> {
  try {
    const me = await requireUser();
    if (me.role !== 'ADMIN') return { status: 'error', error: 'unauthorized' };

    const parsed = campaignSchema.safeParse(input);
    if (!parsed.success) {
      return {
        status: 'error',
        error: parsed.error.issues[0]?.message ?? 'invalid_input',
      };
    }

    const { subject, body, audience } = parsed.data;
    const recipients = await resolveAudienceEmails(audience);

    if (recipients.length === 0) {
      return { status: 'error', error: 'no_recipients' };
    }

    // Campaign tag = audience + ISO timestamp. Stable across an enqueue
    // call; if the admin re-clicks Send within the same second the
    // (audienceTag, to) unique constraint dedups, so no duplicate emails.
    const campaignTag = `newsletter:${audience}:${new Date().toISOString()}`;

    // Render per-recipient: each user gets a unique unsubscribe link
    // bound to their userId via signed token. NewsletterSubscriber
    // entries (no userId) get a generic "contact us to unsubscribe"
    // line — full subscriber-side flow is a follow-up.
    const enqueued = await enqueueEmails(
      campaignTag,
      recipients.map(({ email, userId }) => {
        const unsubUrl = userId ? buildUnsubscribeUrl(userId, 'marketing') : null;
        const html = renderNewsletterHtml({ subject, body, unsubUrl });
        return {
          to: email,
          subject,
          html,
          text: body + (unsubUrl ? `\n\nSe désabonner : ${unsubUrl}` : ''),
        };
      }),
    );

    // Best-effort first drain pass to start delivering immediately. We
    // cap at 30 items so we stay well under the 10s function budget;
    // remaining items wait for the next drain (cron or admin re-trigger).
    let mocked = false;
    try {
      const r = await drainEmailQueue(30);
      mocked = r.mocked;
    } catch (err) {
      // Drain failure shouldn't fail the enqueue — the cron will retry.
      console.error('[newsletter] in-request drain failed', err);
    }

    await logAdmin(me.userId, {
      action: 'newsletter.send',
      targetType: 'Newsletter',
      payload: {
        audience,
        subject: subject.slice(0, 200),
        recipientCount: recipients.length,
        enqueued,
        campaignTag,
      },
    });

    return {
      status: 'success',
      campaignTag,
      recipientCount: recipients.length,
      mocked,
    };
  } catch {
    return { status: 'error', error: 'send_failed' };
  }
}

/**
 * Polled by the admin UI to render live campaign progress. The drainer
 * may have moved items SENDING / SENT / FAILED since enqueue; this
 * returns the snapshot so the UI can update its counters.
 */
export async function getNewsletterCampaignStatus(
  campaignTag: string,
): Promise<
  | {
      status: 'success';
      pending: number;
      sending: number;
      sent: number;
      failed: number;
      total: number;
    }
  | { status: 'error'; error: string }
> {
  try {
    const me = await requireUser();
    if (me.role !== 'ADMIN') return { status: 'error', error: 'unauthorized' };
    const counts = await getCampaignStatus(campaignTag);
    return { status: 'success', ...counts };
  } catch {
    return { status: 'error', error: 'unauthorized' };
  }
}

/**
 * Manual drain trigger — admin can hit this from the campaign progress
 * panel if the cron is too slow for their needs (e.g. 500-recipient
 * campaign, they want the rest delivered now). Bounded by drainBatch +
 * loop iterations to stay within the function timeout.
 */
export async function triggerNewsletterDrain(): Promise<
  | { status: 'success'; sent: number; retried: number; failed: number; iterations: number }
  | { status: 'error'; error: string }
> {
  try {
    const me = await requireUser();
    if (me.role !== 'ADMIN') return { status: 'error', error: 'unauthorized' };
    // Up to 5 iterations × 30 items = 150 max processed per call (well
    // under the 10s budget given Resend's 150ms median latency).
    const { drainEmailQueueFully } = await import('@/lib/email/queue');
    const r = await drainEmailQueueFully(5, 30);
    return {
      status: 'success',
      sent: r.totalSent,
      retried: r.totalRetried,
      failed: r.totalFailed,
      iterations: r.iterations,
    };
  } catch {
    return { status: 'error', error: 'drain_failed' };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderNewsletterHtml({
  subject,
  body,
  unsubUrl,
}: {
  subject: string;
  body: string;
  unsubUrl: string | null;
}): string {
  // Plain-text body: split on blank lines into <p>, single newline → <br>.
  // URL auto-linker: anything starting with http(s):// becomes <a>.
  const linker = (s: string) =>
    s.replace(
      /(https?:\/\/[^\s<]+)/g,
      (m) => `<a href="${m}" style="color:#7301FF;text-decoration:underline">${m}</a>`,
    );
  const paragraphs = body
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#2c1c4f">${linker(
          escapeHtml(p),
        ).replace(/\n/g, '<br/>')}</p>`,
    )
    .join('');

  const dpoEmail = getDpoEmail();

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f7f4ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4ff;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px -8px rgba(115,1,255,0.18);">
            <tr>
              <td style="background:linear-gradient(135deg,#7301FF,#A34BF5);padding:24px 32px;color:#ffffff;">
                <div style="font-size:13px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;opacity:0.85;">Digizelle</div>
                <h1 style="margin:8px 0 0;font-size:24px;font-weight:800;letter-spacing:-0.01em;">${escapeHtml(subject)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px;">
                ${paragraphs}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 28px;color:#7a6a9a;font-size:13px;line-height:1.6;border-top:1px solid #ece5fb;margin-top:24px;">
                <p style="margin:24px 0 6px;">— L'équipe Digizelle</p>
                <p style="margin:0 0 14px;">Vous recevez cet email car vous êtes membre, mentor, mentoré·e ou inscrit·e à la newsletter Digizelle.</p>
                <p style="margin:0;font-size:12px;color:#a097c0;">
                  ${
                    unsubUrl
                      ? `<a href="${unsubUrl}" style="color:#7a6a9a;text-decoration:underline">Se désabonner en 1 clic</a> · `
                      : `Pour vous désabonner, écrivez à ${escapeHtml(dpoEmail)} · `
                  }<a href="mailto:${escapeHtml(dpoEmail)}" style="color:#7a6a9a;text-decoration:underline">DPO</a> · Digizelle, EPITECH Le Kremlin-Bicêtre, France
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from './_shared';
import { sendEmail } from '@/lib/email/resend';
import { logAdmin } from '@/lib/audit/log';

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

export type CampaignResult =
  | {
      status: 'success';
      sent: number;
      failed: number;
      total: number;
      mocked: boolean;
    }
  | { status: 'error'; error: string };

const campaignSchema = z.object({
  subject: z.string().trim().min(5, 'Sujet trop court').max(200, 'Sujet trop long'),
  body: z.string().trim().min(10, 'Contenu trop court').max(10000, 'Contenu trop long'),
  audience: z.enum(['subscribers', 'mentors', 'mentees', 'community', 'all']),
});

async function resolveAudienceEmails(audience: Audience): Promise<string[]> {
  const set = new Set<string>();
  const wantsAll = audience === 'all';

  if (wantsAll || audience === 'subscribers') {
    const rows = await prisma.newsletterSubscriber.findMany({
      where: { active: true },
      select: { email: true },
    });
    for (const r of rows) set.add(r.email.toLowerCase());
  }

  if (wantsAll || audience === 'mentors') {
    const rows = await prisma.user.findMany({
      where: { mentorProfile: { isNot: null }, email: { not: '' } },
      select: { email: true },
    });
    for (const r of rows) if (r.email) set.add(r.email.toLowerCase());
  }

  if (wantsAll || audience === 'mentees') {
    const rows = await prisma.user.findMany({
      where: { menteeProfile: { isNot: null }, email: { not: '' } },
      select: { email: true },
    });
    for (const r of rows) if (r.email) set.add(r.email.toLowerCase());
  }

  if (wantsAll || audience === 'community') {
    const rows = await prisma.user.findMany({
      where: { communityMember: { isNot: null }, email: { not: '' } },
      select: { email: true },
    });
    for (const r of rows) if (r.email) set.add(r.email.toLowerCase());
  }

  return [...set];
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

export async function sendNewsletterCampaign(input: {
  subject: string;
  body: string;
  audience: Audience;
}): Promise<CampaignResult> {
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
    const emails = await resolveAudienceEmails(audience);

    if (emails.length === 0) {
      return { status: 'error', error: 'no_recipients' };
    }

    const html = renderNewsletterHtml({ subject, body });
    const text = body;

    let sent = 0;
    let failed = 0;
    let mocked = false;
    const BATCH_SIZE = 10;

    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const batch = emails.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((to) => sendEmail({ to, subject, html, text })),
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.ok) {
          sent++;
          if ('mocked' in r.value && r.value.mocked) mocked = true;
        } else {
          failed++;
        }
      }
    }

    await logAdmin(me.userId, {
      action: 'newsletter.send',
      targetType: 'Newsletter',
      payload: {
        audience,
        subject: subject.slice(0, 200),
        recipientCount: emails.length,
        sent,
        failed,
        mocked,
      },
    });

    return { status: 'success', sent, failed, total: emails.length, mocked };
  } catch {
    return { status: 'error', error: 'send_failed' };
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
}: {
  subject: string;
  body: string;
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
                <p style="margin:0;">Vous recevez cet email car vous êtes membre, mentor, mentoré·e ou inscrit·e à la newsletter Digizelle.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

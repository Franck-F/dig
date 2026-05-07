/**
 * Email template — weekly community recap.
 *
 * Sent on Mondays to opt-in members. Highlights the top posts of the
 * past 7 days from the channels the member is in, plus a short
 * activity card. Marketing-class email — gated on
 * `User.marketingEmailsEnabled` AND `CommunityMember.digestEnabled`.
 *
 * Carries the 1-click unsubscribe URL the queue's `headers` field
 * also routes via List-Unsubscribe / List-Unsubscribe-Post (RFC 8058).
 */

export type WeeklyDigestPostHighlight = {
  id: string;
  channelSlug: string;
  channelName: string;
  channelEmoji: string | null;
  title: string | null;
  bodyExcerpt: string;
  authorHandle: string;
  authorDisplayName: string | null;
  reactionCount: number;
  commentCount: number;
};

export type WeeklyDigestEmailInput = {
  firstName?: string | null;
  posts: WeeklyDigestPostHighlight[];
  newMembersCount: number;
  unsubscribeUrl: string;
  siteUrl: string;
  weekLabel: string;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export function communityWeeklyDigestEmail({
  firstName,
  posts,
  newMembersCount,
  unsubscribeUrl,
  siteUrl,
  weekLabel,
}: WeeklyDigestEmailInput): RenderedEmail {
  const subject = `Cette semaine sur Digizelle — ${weekLabel}`;
  const greeting = firstName ? `Bonjour ${firstName},` : 'Bonjour,';
  const postsCount = posts.length;

  const text = [
    `Cette semaine sur Digizelle — ${weekLabel}`,
    '',
    greeting,
    '',
    `${postsCount} post${postsCount > 1 ? 's' : ''} ${postsCount > 1 ? 'ont' : 'a'} marqué la semaine dans la communauté.`,
    `${newMembersCount} nouveau${newMembersCount > 1 ? 'x' : ''} membre${newMembersCount > 1 ? 's' : ''} ${newMembersCount > 1 ? 'nous ont rejoint·e·s' : 'nous a rejoint·e'}.`,
    '',
    ...posts.flatMap((p) => [
      `→ ${p.title ?? p.bodyExcerpt.slice(0, 60)}`,
      `   #${p.channelSlug} · @${p.authorHandle} · ${p.reactionCount} réactions · ${p.commentCount} commentaires`,
      `   ${siteUrl}/community/posts/${p.id}`,
      '',
    ]),
    `Te désinscrire des emails marketing : ${unsubscribeUrl}`,
    '',
    "L'équipe Digizelle",
  ].join('\n');

  const postsHtml = posts
    .map(
      (p) => `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">
          <tr>
            <td style="padding:14px 16px;background:#FAF8FF;border:1px solid #EFE9FF;border-radius:12px;">
              <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#7301FF;margin-bottom:6px;">
                ${escapeHtml(p.channelEmoji ?? '#')} ${escapeHtml(p.channelName)} · @${escapeHtml(p.authorHandle)}
              </div>
              <a href="${escapeAttr(siteUrl)}/community/posts/${escapeAttr(p.id)}" style="color:#1a1f3a;text-decoration:none;">
                <div style="font-size:16px;font-weight:700;color:#1a1f3a;margin-bottom:6px;">
                  ${escapeHtml(p.title ?? 'Post')}
                </div>
                <div style="font-size:13px;color:#3a2960;line-height:1.5;">
                  ${escapeHtml(p.bodyExcerpt.slice(0, 200))}${p.bodyExcerpt.length > 200 ? '…' : ''}
                </div>
              </a>
              <div style="margin-top:10px;font-size:12px;color:#8b91ad;">
                ❤ ${p.reactionCount} · 💬 ${p.commentCount}
              </div>
            </td>
          </tr>
        </table>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F7F4FF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a2e;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F4FF;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(115,1,255,0.10);">
      <tr>
        <td style="background:linear-gradient(135deg,#7301FF 0%,#A34BF5 50%,#F46FB1 100%);padding:36px 32px;text-align:center;color:#ffffff;">
          <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">Digizelle</div>
          <div style="font-size:24px;font-weight:700;margin-top:6px;">Cette semaine</div>
          <div style="font-size:14px;opacity:0.85;margin-top:4px;">${escapeHtml(weekLabel)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 14px;font-size:16px;line-height:1.5;">${escapeHtml(greeting)}</p>

          <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#3a3a5a;">
            ${postsCount} post${postsCount > 1 ? 's' : ''} ${postsCount > 1 ? 'ont' : 'a'} marqué la semaine dans la communauté ·
            ${newMembersCount} nouveau${newMembersCount > 1 ? 'x' : ''} membre${newMembersCount > 1 ? 's' : ''} ${newMembersCount > 1 ? 'nous ont rejoint·e·s' : 'nous a rejoint·e'}.
          </p>

          ${postsHtml}

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;">
            <tr>
              <td align="center">
                <a href="${escapeAttr(siteUrl)}/community" style="display:inline-block;padding:12px 24px;border-radius:12px;background:linear-gradient(135deg,#7301FF,#A34BF5);color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;">
                  Voir le fil de la communauté
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 32px;background:#FAF8FF;border-top:1px solid #EFE9FF;text-align:center;font-size:12px;color:#6b6b8a;line-height:1.6;">
          Tu reçois cet email parce que tu es membre de la communauté Digizelle et que tu as
          activé le digest hebdomadaire.
          <br />
          <a href="${escapeAttr(unsubscribeUrl)}" style="color:#7301FF;text-decoration:none;">Me désinscrire des emails marketing</a>
          ·
          <a href="${escapeAttr(siteUrl)}/community/settings" style="color:#7301FF;text-decoration:none;">Mes préférences</a>
          <br /><br />
          Digizelle — association loi 1901 · <a href="${escapeAttr(siteUrl)}" style="color:#7301FF;text-decoration:none;">digizelle.fr</a>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

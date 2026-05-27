/**
 * Daily digest sent to users with unread MentorshipMessages aged 24-48h.
 * Plain-text + HTML, brand-aligned with the rest of the transactional
 * email family.
 */

export type UnreadDigestParams = {
  firstName: string;
  count: number;
  lastSender: string;
  /** Truncated body of the most recent unread message (≤ ~220 chars). */
  preview: string;
  /** Full URL to the messages dashboard. */
  appUrl: string;
};

export function buildUnreadDigest(p: UnreadDigestParams): {
  subject: string;
  html: string;
  text: string;
} {
  const s = p.count > 1 ? 's' : '';
  const subject = `${p.count} message${s} non lu${s} sur Mentorat`;

  const greeting = p.firstName.trim()
    ? `Bonjour ${p.firstName},`
    : 'Bonjour,';

  const text = [
    greeting,
    '',
    `Tu as ${p.count} message${s} non lu${s} sur Mentorat.`,
    `Dernier message de ${p.lastSender} :`,
    `« ${p.preview} »`,
    '',
    `Lire et répondre : ${p.appUrl}`,
    '',
    '— L\'équipe Digizelle Mentorat',
  ].join('\n');

  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;padding:32px 16px;background:#faf7ff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1a1f3a">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:18px;box-shadow:0 10px 24px rgba(115,1,255,0.08)">
    <tr><td style="padding:32px 32px 8px">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;color:#7301FF;margin-bottom:8px">Mentorat — Messages</div>
      <h1 style="font-size:26px;font-weight:800;margin:0 0 16px;letter-spacing:-0.01em">${p.count} message${s} non lu${s}</h1>
      <p style="font-size:15px;line-height:1.55;margin:0 0 12px">${escapeHtml(greeting)}</p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px">Tu as <strong>${p.count} message${s} non lu${s}</strong> sur Mentorat. Dernier message de <strong>${escapeHtml(p.lastSender)}</strong> :</p>
      <blockquote style="margin:18px 0;padding:14px 16px;border-left:3px solid #7301FF;background:#faf7ff;border-radius:0 8px 8px 0;color:#3a2960;font-size:14px;line-height:1.5">${escapeHtml(p.preview)}</blockquote>
      <p style="margin:28px 0">
        <a href="${escapeAttr(p.appUrl)}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#7301FF,#A34BF5);color:#fff;text-decoration:none;border-radius:11px;font-weight:700;font-size:15px">Lire et répondre →</a>
      </p>
      <p style="font-size:12px;color:#8b91ad;margin:32px 0 0">— L'équipe Digizelle Mentorat</p>
    </td></tr>
  </table>
</body></html>`;

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

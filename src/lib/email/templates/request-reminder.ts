/**
 * Reminder sent to a mentor whose `MentorshipRequest` is about to expire
 * — 24 to 48 hours before the 14-day deadline. Plain-text + HTML,
 * brand-aligned with the rest of the transactional family.
 */

export type RequestReminderParams = {
  /** Mentor first name for the greeting. */
  mentorFirstName: string;
  /** Mentee display name shown in the body. */
  menteeName: string;
  /** Truncated message from the mentee (≤ ~220 chars). */
  preview: string;
  /** How many full days remain before auto-expiry (1 or 2). */
  daysRemaining: number;
  /** Full URL to the requests dashboard. */
  appUrl: string;
};

export function buildRequestReminder(p: RequestReminderParams): {
  subject: string;
  html: string;
  text: string;
} {
  const dayWord = p.daysRemaining > 1 ? `${p.daysRemaining} jours` : '1 jour';
  const subject = `Plus que ${dayWord} pour répondre à ${p.menteeName} sur Mentorat`;

  const greeting = p.mentorFirstName.trim()
    ? `Bonjour ${p.mentorFirstName},`
    : 'Bonjour,';

  const text = [
    greeting,
    '',
    `Tu as une demande de mentorat de ${p.menteeName} en attente depuis presque deux semaines.`,
    `Plus que ${dayWord} pour y répondre avant qu'elle n'expire automatiquement.`,
    '',
    `Sa demande :`,
    `« ${p.preview} »`,
    '',
    `Accepter ou décliner : ${p.appUrl}`,
    '',
    '— L\'équipe Digizelle Mentorat',
  ].join('\n');

  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;padding:32px 16px;background:#faf7ff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1a1f3a">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:18px;box-shadow:0 10px 24px rgba(115,1,255,0.08)">
    <tr><td style="padding:32px 32px 8px">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;color:#A34BF5;margin-bottom:8px">Mentorat — Demande en attente</div>
      <h1 style="font-size:26px;font-weight:800;margin:0 0 16px;letter-spacing:-0.01em">Plus que ${escapeHtml(dayWord)}</h1>
      <p style="font-size:15px;line-height:1.55;margin:0 0 12px">${escapeHtml(greeting)}</p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 12px">Tu as une demande de mentorat de <strong>${escapeHtml(p.menteeName)}</strong> en attente depuis presque deux semaines.</p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px">Plus que <strong>${escapeHtml(dayWord)}</strong> pour y répondre avant qu'elle n'expire automatiquement.</p>
      <blockquote style="margin:18px 0;padding:14px 16px;border-left:3px solid #A34BF5;background:#faf7ff;border-radius:0 8px 8px 0;color:#3a2960;font-size:14px;line-height:1.5">${escapeHtml(p.preview)}</blockquote>
      <p style="margin:28px 0">
        <a href="${escapeAttr(p.appUrl)}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#A34BF5,#7301FF);color:#fff;text-decoration:none;border-radius:11px;font-weight:700;font-size:15px">Voir la demande →</a>
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

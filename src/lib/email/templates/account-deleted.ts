/**
 * Email template — account self-deletion confirmation.
 *
 * Sent immediately after the user clicks "Supprimer mon compte" in
 * settings. Carries two purposes:
 *
 *  1. Confirmation reassuring legitimate users — your account is queued
 *     for deletion, here's the grace-period info.
 *  2. Tripwire for stolen-session attacks — if someone deleted the
 *     account from a session the real user didn't authorise, the
 *     real user sees the email and can contact the DPO within the
 *     30-day grace window to restore.
 *
 * Sent via the EmailQueueItem outbox so a transient SMTP failure
 * doesn't lose the notice.
 */

export type AccountDeletedEmailInput = {
  firstName?: string | null;
  graceDays: number;
  dpoEmail: string;
  locale?: 'fr';
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export function accountDeletedEmail({
  firstName,
  graceDays,
  dpoEmail,
  locale: _locale = 'fr',
}: AccountDeletedEmailInput): RenderedEmail {
  void _locale;
  const subject = 'Confirmation de suppression de compte Digizelle';

  const greeting = firstName ? `Bonjour ${firstName},` : 'Bonjour,';

  const text = [
    'Confirmation de suppression de compte',
    '',
    greeting,
    '',
    'Nous confirmons la suppression de ton compte Digizelle.',
    '',
    `Ton email, prénom, nom, photo et profils mentor / mentee ont été anonymisés immédiatement. Tes contributions à la communauté restent visibles avec « Compte supprimé » comme auteur.`,
    '',
    `Tu as ${graceDays} jours pour annuler cette suppression. Au-delà, la purge sera définitive et irréversible (RGPD Art. 17).`,
    '',
    `Pour annuler, contacte ${dpoEmail} en justifiant de ton identité.`,
    '',
    `Tu n'es pas à l'origine de cette suppression ? Contacte ${dpoEmail} immédiatement — il s'agit probablement d'un accès non autorisé à ton compte.`,
    '',
    "L'équipe Digizelle",
  ].join('\n');

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
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(115,1,255,0.12);">
      <tr>
        <td style="background:linear-gradient(135deg,#7301FF 0%,#A34BF5 50%,#F46FB1 100%);padding:36px 32px;text-align:center;color:#ffffff;">
          <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">Digizelle</div>
          <div style="font-size:24px;font-weight:700;margin-top:6px;">Compte supprimé</div>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">${escapeHtml(greeting)}</p>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#3a3a5a;">Nous confirmons la suppression de ton compte Digizelle.</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;">
            <tr>
              <td style="padding:14px 16px;background:#F2EBFF;border-radius:12px;font-size:13px;line-height:1.6;color:#3a2960;">
                <strong style="color:#7301FF;">Ce qui a été anonymisé :</strong> email, prénom, nom, photo, profil mentor / mentee, connexions OAuth.
                <br />
                <strong style="color:#7301FF;">Ce qui reste visible (sous forme anonyme) :</strong> posts, commentaires, sessions de mentorat, avis publiés.
              </td>
            </tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:14px 16px;background:#FFF4FA;border:1px solid rgba(217,78,146,0.22);border-radius:12px;font-size:13px;line-height:1.6;color:#3a2960;">
                <strong style="color:#a8235e;">Délai de grâce de ${graceDays} jours.</strong> Au-delà, la suppression est définitive et irréversible (RGPD Art. 17). Pour annuler, écris à <a href="mailto:${escapeHtml(dpoEmail)}" style="color:#7301FF;font-weight:600;">${escapeHtml(dpoEmail)}</a>.
              </td>
            </tr>
          </table>

          <p style="margin:24px 0 0;font-size:13px;color:#6b6b8a;line-height:1.5;">
            <strong>Tu n&rsquo;es pas à l&rsquo;origine de cette suppression ?</strong> Contacte
            <a href="mailto:${escapeHtml(dpoEmail)}" style="color:#7301FF;">${escapeHtml(dpoEmail)}</a>
            immédiatement — il s&rsquo;agit probablement d&rsquo;un accès non autorisé à ton compte. Nous pourrons restaurer dans le délai de grâce.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px;background:#FAF8FF;border-top:1px solid #EFE9FF;text-align:center;font-size:12px;color:#6b6b8a;">
          Digizelle — association loi 1901 · <a href="https://digizelle.fr" style="color:#7301FF;text-decoration:none;">digizelle.fr</a>
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

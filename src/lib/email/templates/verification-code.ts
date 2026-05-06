/**
 * Email template — signup email verification.
 *
 * Inline styles + table layout for email-client compatibility (Outlook,
 * Gmail web, iOS/Android Mail). No external CSS, no remote fonts. The
 * gradient header mirrors the brand login surface.
 */

export type VerificationCodeEmailInput = {
  code: string; // 6-digit code, already string-formatted
  locale?: 'fr';
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export function verificationCodeEmail({
  code,
  // locale param reserved for future i18n; only `fr` supported today.
  locale: _locale = 'fr',
}: VerificationCodeEmailInput): RenderedEmail {
  void _locale;
  const subject = 'Confirme ton email — Digizelle';

  const text = [
    'Bienvenue sur Digizelle !',
    '',
    `Ton code de vérification : ${code}`,
    '',
    'Saisis-le dans la fenêtre de connexion pour activer ton compte.',
    'Le code expire dans 10 minutes.',
    '',
    "Si tu n'es pas à l'origine de cette demande, ignore cet email.",
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
          <div style="font-size:24px;font-weight:700;margin-top:6px;">Confirme ton email</div>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">Bienvenue ! On finalise ton inscription.</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3a3a5a;">Saisis ce code dans la fenêtre Digizelle pour activer ton compte&nbsp;:</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding:8px 0 24px;">
                <div style="display:inline-block;font-family:'SF Mono','Monaco','Consolas',monospace;font-size:36px;font-weight:700;letter-spacing:10px;padding:18px 28px;background:#F2EBFF;border:2px solid #7301FF;border-radius:14px;color:#7301FF;">
                  ${escapeHtml(code)}
                </div>
              </td>
            </tr>
          </table>
          <p style="margin:0 0 8px;font-size:13px;color:#6b6b8a;">Ce code expire dans <strong>10 minutes</strong>.</p>
          <p style="margin:24px 0 0;font-size:13px;color:#6b6b8a;line-height:1.5;">Si tu n'es pas à l'origine de cette demande, ignore cet email — aucun compte n'est créé tant que le code n'est pas saisi.</p>
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

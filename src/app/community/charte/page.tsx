import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Charte de la communauté · Digizelle',
  description:
    'Charte de la communauté Digizelle — règles, modération, valeurs. Lecture obligatoire avant l\'onboarding.',
};

/**
 * Public charter page. Public read so it can be linked from the
 * onboarding wizard (auth-gated) and from the footer (anon).
 *
 * AIPD action item (community AIPD §5) — must exist before the
 * community opens publicly. Co-located with the legal pages style
 * for visual consistency.
 */
export default function CharterPage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '64px 24px' }}>
      <Link
        href="/community"
        style={{
          fontSize: 13,
          color: '#7301FF',
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        ← Communauté
      </Link>

      <div
        style={{
          marginTop: 18,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: '#7301FF',
        }}
      >
        Communauté · Cadre
      </div>
      <h1 style={{ margin: '8px 0 14px', fontSize: 36, fontWeight: 800, color: '#1a1f3a' }}>
        Charte de la communauté
      </h1>
      <p style={{ margin: 0, fontSize: 14, color: '#545b7a' }}>
        Version 1.0 — mai 2026 · révisée annuellement
      </p>

      <article
        style={{
          marginTop: 28,
          fontSize: 16,
          lineHeight: 1.7,
          color: '#1a1f3a',
        }}
      >
        <p>
          La communauté Digizelle est un espace d&apos;apprentissage, d&apos;entraide
          et d&apos;ouverture pour les jeunes — particulièrement les jeunes femmes —
          qui découvrent le numérique. La charte fixe nos règles communes ; en
          rejoignant la communauté, tu en acceptes les termes.
        </p>

        <h2 style={H2}>1. Esprit</h2>
        <ul style={UL}>
          <li><strong>Bienveillance par défaut.</strong> On suppose la bonne foi avant de juger.</li>
          <li><strong>Curiosité encouragée.</strong> Aucune question n&apos;est bête. Aucune erreur n&apos;est ridicule.</li>
          <li><strong>Inclusion active.</strong> On accueille les débutantes ; on adapte le vocabulaire.</li>
          <li><strong>Apprendre ensemble.</strong> On partage ce qu&apos;on sait, on demande ce qu&apos;on ignore.</li>
        </ul>

        <h2 style={H2}>2. Ce qui n&apos;est jamais accepté</h2>
        <p>
          Ces comportements entraînent une sanction immédiate (mute,
          suspension ou bannissement selon la gravité), sans avertissement préalable :
        </p>
        <ul style={UL}>
          <li>Insultes, harcèlement, intimidation — y compris en privé.</li>
          <li>Propos sexistes, racistes, homophobes, transphobes, validistes,
              ou discriminatoires de toute autre nature.</li>
          <li>Diffusion de coordonnées personnelles d&apos;autres membres
              (doxxing) sans leur consentement explicite.</li>
          <li>Contenu pornographique, violent, choquant, ou inadapté à un
              public mineur.</li>
          <li>Apologie ou banalisation d&apos;actes illicites.</li>
          <li>Spam, démarchage commercial, scams.</li>
          <li>Usurpation d&apos;identité ou faux profils.</li>
        </ul>

        <h2 style={H2}>3. Ce qu&apos;on évite</h2>
        <p>
          Pas une faute en soi, mais on te rappellera à l&apos;ordre si ça se répète :
        </p>
        <ul style={UL}>
          <li>Hors-sujet répété dans un channel dédié (utilise le bon channel).</li>
          <li>Tonalité cassante ou condescendante envers une débutante.</li>
          <li>Réponse expéditive du type « google it » sans plus d&apos;aide.</li>
          <li>Spoilers de défis en cours, fuites de solutions.</li>
        </ul>

        <h2 style={H2}>4. Modération</h2>
        <p>
          Une équipe de modérateurs et modératrices, identifiable par un badge
          spécifique, veille sur la communauté. Voici comment on travaille :
        </p>
        <ul style={UL}>
          <li><strong>Signalements anonymes.</strong> Tu peux signaler un message ou un membre via le bouton dédié — l&apos;auteur du signalement n&apos;est jamais révélé.</li>
          <li><strong>Sanctions graduées.</strong> Avertissement → sourdine → suspension → bannissement, selon la gravité et l&apos;historique.</li>
          <li><strong>Bannissement à 4 yeux.</strong> Une décision de bannissement requiert <strong>deux modérateurs distincts</strong> (proposition + confirmation) pour éviter qu&apos;un compte modérateur compromis ou de mauvaise foi puisse exclure unilatéralement.</li>
          <li><strong>Audit log immuable.</strong> Toute action de modération est tracée avec horodatage, motif et acteur — consultable par l&apos;administration.</li>
          <li><strong>Recours.</strong> Tu peux contester une sanction par email à <a href="mailto:dpo@calebasse.com" style={A}>dpo@calebasse.com</a>. Réponse sous 14 jours.</li>
        </ul>

        <h2 style={H2}>5. Mineurs (15–17 ans)</h2>
        <p>
          La plateforme Digizelle est ouverte à partir de 15 ans (article 8 du
          RGPD). Pour les 15-17 ans :
        </p>
        <ul style={UL}>
          <li>Aucun profilage publicitaire n&apos;est appliqué.</li>
          <li>La modération exerce une vigilance renforcée sur les channels où ils participent.</li>
          <li>Tes parents ou tuteurs peuvent demander à tout moment la suppression de tes données via dpo@calebasse.com.</li>
          <li>Si tu te sens en danger : contacte le <a href="https://www.e-enfance.org/numero-3018-2/" target="_blank" rel="noreferrer" style={A}>3018</a> (numéro national contre les violences numériques, anonyme et gratuit).</li>
        </ul>

        <h2 style={H2}>6. Contenus que tu publies</h2>
        <ul style={UL}>
          <li>Tu restes propriétaire de ce que tu écris ou partages.</li>
          <li>Tu accordes à Digizelle une licence non-exclusive pour afficher
              tes contenus dans la communauté.</li>
          <li>À la suppression de ton compte, tes contenus deviennent anonymes
              (auteur remplacé par « Compte supprimé ») et sont purgés à J+30.</li>
          <li>Les images doivent te concerner ou être libres de droits ;
              pas de doxxing photo, jamais.</li>
        </ul>

        <h2 style={H2}>7. Données personnelles</h2>
        <p>
          La gestion de tes données est encadrée par la <Link href="/privacy" style={A}>politique de confidentialité</Link>.
          Le DPO de Digizelle (<a href="mailto:dpo@calebasse.com" style={A}>dpo@calebasse.com</a>)
          répond sous 30 jours à toute demande d&apos;exercice de tes droits
          (accès, rectification, effacement, portabilité, opposition).
        </p>

        <h2 style={H2}>8. Évolution</h2>
        <p>
          La charte est révisée au moins annuellement par le DPO et l&apos;équipe
          modération. Les modifications substantielles sont annoncées dans le
          channel <code style={CODE}>annonces</code> au moins 14 jours avant
          leur entrée en vigueur ; tu peux résilier ton adhésion à la
          communauté à tout moment depuis tes paramètres si tu n&apos;es plus
          d&apos;accord.
        </p>

        <h2 style={H2}>9. Contact</h2>
        <p>
          Modération : signalement intégré à l&apos;UI ou{' '}
          <a href="mailto:moderation@calebasse.com" style={A}>moderation@calebasse.com</a>
          .<br />
          Conformité RGPD / DPO : <a href="mailto:dpo@calebasse.com" style={A}>dpo@calebasse.com</a>.<br />
          Communication : <a href="mailto:communication@calebasse.com" style={A}>communication@calebasse.com</a>.
        </p>
      </article>

      <div
        style={{
          marginTop: 32,
          padding: 16,
          borderRadius: 14,
          background: 'rgba(115,1,255,0.04)',
          border: '1px solid rgba(115,1,255,0.20)',
          fontSize: 13,
          color: '#3a2960',
          lineHeight: 1.6,
        }}
      >
        Cette charte est ce qu&apos;on appelle un{' '}
        <em>code de conduite</em> ; en rejoignant la communauté tu en
        acceptes les termes. Une mise à jour substantielle te sera
        notifiée 14 jours avant son entrée en vigueur.
      </div>
    </main>
  );
}

const H2: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  color: '#1a1f3a',
  margin: '32px 0 12px',
};
const UL: React.CSSProperties = { paddingLeft: 22, margin: '8px 0 12px' };
const A: React.CSSProperties = { color: '#7301FF', fontWeight: 600 };
const CODE: React.CSSProperties = {
  background: 'rgba(115,1,255,0.06)',
  padding: '1px 6px',
  borderRadius: 4,
  fontSize: 13,
  color: '#7301FF',
};

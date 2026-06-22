---
titre: Bascule CSP — Report-Only → Enforced
type: Procédure ops
sévérité: P2 (sécurité)
prérequis: 7 jours d'observation Sentry sans violation
dernière_revue: 2026-05-07
prochaine_revue: 2027-05-07
---

# Bascule de la CSP en mode enforced

> **État actuel** — la Content-Security-Policy est **enforced par défaut**
> dans le code (`next.config.ts` : `cspEnforce = process.env.CSP_REPORT_ONLY
> !== '1'`). Le navigateur bloque donc les ressources non conformes ; les
> violations restent reportées à Sentry via `report-uri`. La policy conserve
> `'unsafe-inline'` pour `script-src` + `style-src` (script de thème inline +
> `style={{}}` omniprésent), donc l'enforce ne bloque que les ressources
> **externes hors allowlist**. Ce runbook sert à (a) vérifier l'enforce sans
> risque et (b) revenir à Report-Only au besoin.

## Pré-requis (checklist avant bascule)

- [ ] Sentry → Issues → filtre `event.type:csp` : **0 violation**
      sur les 7 derniers jours.
- [ ] Vérifier que le filtre Sentry capture bien Production *uniquement*
      (`environment:production`). Les Previews ont des origines
      tierces aléatoires qui ne représentent pas la prod.
- [ ] `npm run build` local passe sans warning lié à CSP.
- [ ] Test manuel des chemins suivants sur un déploiement **preview** de la
      branche (l'enforce étant le défaut, le preview est déjà enforced) :
  - [ ] `/` (home + footer)
  - [ ] `/community` (feed + sanitizer)
  - [ ] `/community/charte`
  - [ ] `/community/admin/rgpd` (rendu marked + style inline)
  - [ ] `/account/2fa/setup` (QR via api.qrserver.com)
  - [ ] `/account/2fa/challenge`
  - [ ] `/login` (Google/GitHub/Discord OAuth)
  - [ ] Newsletter campaign send (admin)
  - [ ] CSP-report ingestion vers Sentry (Network tab)

## Mise en production

L'enforce est le **défaut du code** : il s'applique dès que la branche est
mergée et déployée — aucune variable d'env à ajouter.

1. S'assurer que `CSP_REPORT_ONLY` n'est **pas** défini en Production sur
   Vercel (sinon le header resterait en Report-Only).
2. Merger la PR → le déploiement Production sert `Content-Security-Policy`
   (enforced) + `upgrade-insecure-requests`.
3. Tester immédiatement (5 min) le chemin
   *home → login → community → admin* :
   - Ouvrir la DevTools console → onglet Issues. Aucun blocage CSP attendu.
4. Garder un œil sur Sentry pendant 24 h :
   - Toute nouvelle violation = vraisemblablement un *vrai* blocage.
   - Si > 5 violations sur 1 h → rollback (ci-dessous) et enquête.

## Rollback

```bash
# Vercel CLI — repasser en Report-Only sans toucher au code
vercel env add CSP_REPORT_ONLY production   # valeur : 1
vercel --prod --force
```

Le header repasse à `Content-Security-Policy-Report-Only` au prochain
déploiement. Aucun data loss, aucun reset utilisateur — c'est un revert
headers-only. (Retirer la variable rebascule en enforced.)

## Une fois enforced

- Tout ajout d'un nouveau prestataire (ex. nouveau CDN, nouveau
  iframe) **doit** passer par une PR qui modifie `cspDirectives`
  dans `next.config.ts` AVANT de pousser le code qui l'utilise.
- Un modèle de PR : « Add `<host>` to CSP `<directive>` » avec
  capture d'écran du chemin qui a besoin de la directive.
- Sentry continue à recevoir les rapports (la directive `report-uri`
  est conservée même en mode enforced) — on les traite en bug.

## Historique

| Date       | Auteur | Motif                                      |
| ---------- | ------ | ------------------------------------------ |
| 2026-05-07 | Franck | Documentation initiale, à appliquer T+7 j. |
| 2026-06-22 | Claude | Enforce passé en défaut du code ; levier inversé `CSP_ENFORCE`→`CSP_REPORT_ONLY` (opt-out Report-Only). |

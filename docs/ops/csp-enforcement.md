---
titre: Bascule CSP — Report-Only → Enforced
type: Procédure ops
sévérité: P2 (sécurité)
prérequis: 7 jours d'observation Sentry sans violation
dernière_revue: 2026-05-07
prochaine_revue: 2027-05-07
---

# Bascule de la CSP en mode enforced

> **Pourquoi** — la Content-Security-Policy est aujourd'hui en mode
> Report-Only : le navigateur signale les violations à Sentry sans
> rien bloquer. Une fois qu'on est sûr que la liste de directives
> couvre tout le trafic légitime, on bascule en enforced — alors le
> navigateur bloque. Une bascule prématurée casse silencieusement
> l'app pour un sous-ensemble d'utilisateurs.

## Pré-requis (checklist avant bascule)

- [ ] Sentry → Issues → filtre `event.type:csp` : **0 violation**
      sur les 7 derniers jours.
- [ ] Vérifier que le filtre Sentry capture bien Production *uniquement*
      (`environment:production`). Les Previews ont des origines
      tierces aléatoires qui ne représentent pas la prod.
- [ ] `npm run build` local passe sans warning lié à CSP.
- [ ] Test manuel des chemins suivants en preview avec `CSP_ENFORCE=1` :
  - [ ] `/` (home + footer)
  - [ ] `/community` (feed + sanitizer)
  - [ ] `/community/charte`
  - [ ] `/community/admin/rgpd` (rendu marked + style inline)
  - [ ] `/account/2fa/setup` (QR via api.qrserver.com)
  - [ ] `/account/2fa/challenge`
  - [ ] `/login` (Google/GitHub/Discord OAuth)
  - [ ] Newsletter campaign send (admin)
  - [ ] CSP-report ingestion vers Sentry (Network tab)

## Bascule

1. Vercel → Project → Settings → Environment Variables
   - **Production** uniquement (laisser Preview en Report-Only) :
     ajouter `CSP_ENFORCE=1`.
2. Redéploiement forcé : `vercel --prod --force`.
3. Tester immédiatement (5 min) le chemin
   *home → login → community → admin* :
   - Ouvrir la DevTools console → onglet Issues. Aucun blocage CSP attendu.
4. Garder un œil sur Sentry pendant 24 h :
   - Toute nouvelle violation = vraisemblablement un *vrai* blocage.
   - Si > 5 violations sur 1 h → rollback (`CSP_ENFORCE=""`) et
     enquête.

## Rollback

```bash
# Vercel CLI
vercel env rm CSP_ENFORCE production
vercel --prod --force
```

Le header repasse à `Content-Security-Policy-Report-Only` au prochain
déploiement. Aucun data loss, aucun reset utilisateur — c'est un
revert headers-only.

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

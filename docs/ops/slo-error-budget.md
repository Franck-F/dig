---
titre: SLO et budget d'erreur
type: Référence ops
fondement: Site Reliability Engineering — Google
dernière_revue: 2026-05-07
prochaine_revue: 2027-05-07
---

# SLO & budget d'erreur

> **Pourquoi** — décider sans subjectif quand on doit prioriser
> stabilité plutôt que vélocité. Une fois le budget d'erreur du
> trimestre épuisé, on gèle les déploiements non-critiques jusqu'à
> ce que les indicateurs reviennent au vert.

## Objectifs (SLO)

Les seuils ci-dessous sont volontairement modestes pour une asso à
budget Hobby. Une fois la base utilisateur ≥ 1k MAU, ré-évaluer.

| Indicateur                    | Cible    | Source                | Mesuré sur |
| ----------------------------- | -------- | --------------------- | ---------- |
| Disponibilité du site         | 99.5 %   | Vercel Edge logs      | mensuel    |
| Disponibilité auth (login)    | 99.5 %   | Sentry transactions   | mensuel    |
| Erreurs 5xx                   | < 0.5 %  | Vercel Edge / Sentry  | hebdo      |
| LCP médian (mobile)           | ≤ 2.5 s  | Web Vitals            | hebdo      |
| INP médian                    | ≤ 200 ms | Web Vitals            | hebdo      |
| CLS médian                    | ≤ 0.1    | Web Vitals            | hebdo      |
| TTFB p95                      | ≤ 800 ms | Web Vitals            | hebdo      |
| Email digest delivery         | ≥ 95 %   | Resend dashboard      | hebdo      |
| Email bounces                 | < 2 %    | Resend webhook        | hebdo      |
| Slow Prisma queries (>500 ms) | < 1 %    | Sentry breadcrumbs    | hebdo      |
| Cron success rate             | ≥ 95 %   | Vercel Cron logs      | hebdo      |

## Budget d'erreur (Error Budget)

À 99.5 % de disponibilité sur 30 jours, le budget est :

- **0.5 % × 30 j × 24 h × 60 min = 216 minutes / mois**
- **216 / 30 ≈ 7 minutes / jour**

Conséquences quand on dépasse le budget :

| Consommé | État         | Action                                                           |
| -------- | ------------ | ---------------------------------------------------------------- |
| < 50 %   | Vert         | Vélocité normale.                                                |
| 50-80 %  | Jaune        | Revue post-mortem chaque incident. Pas de feature risquée.       |
| 80-100 % | Orange       | Gel des déploiements non-critiques. Focus stabilité.             |
| > 100 %  | Rouge        | Freeze total. Tous les correctifs visent à restaurer le SLO.     |

Le budget se reconstitue mensuellement à T+1.

## Dashboards Sentry à créer

Sentry Organisations → Discover → New Query — sauvegarder :

1. **Web Vitals dashboard**
   - Visualisation : Time Series
   - Métriques : `webvital.lcp.p50`, `webvital.lcp.p95`,
     `webvital.inp.p50`, `webvital.cls.p50`, `webvital.ttfb.p95`
   - Période : derniers 7 jours
   - Filtre : `environment:production`

2. **Slow queries dashboard**
   - Filtre : `breadcrumbs.category:prisma level:warning`
   - Visualisation : Top 10 par `breadcrumbs.message`
   - Action : ajouter un index ou refactorer si la même requête revient
     plus de 100×/semaine.

3. **Auth flow health**
   - Filtre : `transaction:[/api/auth/* /login]`
   - Métriques : taux d'erreur, p50/p95 latence
   - Alertes déjà configurées (voir docs/ops/sentry-alerts.md).

4. **Email outbox**
   - Filtre : `transaction:/api/cron/sessions-reminder OR /api/cron/community-digest`
   - Métriques : taux d'erreur, durée
   - Si la durée p95 dépasse la fenêtre Vercel (60 s sur Hobby), il
     faut paginer le drain ou bouger en background job.

## Indicateurs business adjacents

Pas des SLO purs mais à suivre car ils signalent la santé de la
plateforme côté utilisateur :

| Indicateur                      | Cible         | Source                |
| ------------------------------- | ------------- | --------------------- |
| Sign-up → email vérifié (24h)   | ≥ 70 %        | Prisma — `User.emailVerified` |
| 1ère visite → 1er post (30 j)   | ≥ 30 %        | Prisma — `Post.createdAt` ≤ +30 j |
| 2FA activé / utilisateurs admin | 100 %         | Prisma — `User.totpEnabledAt` |
| Désinscriptions newsletter / sem| < 1 %         | Prisma — `User.marketingEmailsEnabled` flips |
| Modération SLA (signal → décision) | < 24 h ouvré | `Report.resolvedAt` − `Report.createdAt` |

## Procédure post-incident

À chaque incident dépassant 5 minutes de downtime, ou trois 5xx
consécutifs sur le même endpoint :

1. **Compte rendu** dans `docs/runbooks/post-mortems/YYYY-MM-DD-<slug>.md`
2. **Timeline** : symptômes, détection, cause racine, mitigation, retour
   à la normale.
3. **Action items** : tickets GitHub, dates, assignés.
4. **Diff de budget** : combien de minutes consommées + montant
   restant pour le mois.

## Revue trimestrielle

Tous les trois mois (en même temps que le comité de modération) :
- Compte rendu des incidents et budget consommé.
- Réajustement éventuel des SLO si le SLA est trop serré ou trop lâche
  pour la maturité du projet.
- Plan d'amélioration (typiquement : indexes Prisma, cache Vercel,
  Upstash, monitoring spécifique).

## Historique

| Date       | Auteur | Motif                          |
| ---------- | ------ | ------------------------------ |
| 2026-05-07 | Franck | Création initiale (Phase 5).   |

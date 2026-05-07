---
titre: Configuration Sentry — alertes recommandées
type: Configuration plate-forme à appliquer manuellement
dernière_revue: 2026-05-07
prochaine_revue: 2027-05-07
---

# Sentry — alertes recommandées

> **Pourquoi** — Sentry capture les erreurs et CSP-reports mais reste
> silencieux par défaut. Ce document liste les **alertes minimales** à
> activer pour qu'un incident en production déclenche un email / Slack
> dans les 5 minutes.

## Pré-requis

- Project Sentry déjà créé (`dig-ln/javascript-nextjs`).
- Au moins un canal de notification configuré : Email DPO, et/ou Slack
  webhook + intégration Sentry → Slack.

## Convention de niveau

| Niveau    | Action attendue                       | Canal                  |
| --------- | ------------------------------------- | ---------------------- |
| Critical  | Astreinte immédiate, fix sous 1 h     | Slack #incident + Email |
| High      | Réagir sous 1 h en heures ouvrées     | Slack #incident         |
| Medium    | Triage sous 24 h                      | Slack #digizelle-alerts |
| Low       | Backlog                               | Email digest hebdo      |

## Alertes à créer

> Sentry → Project → Alerts → **Create Alert**. Le squelette JSON ci-dessous
> peut être collé dans **Alerts → Migrate from rules → Import** quand
> l'éditeur visuel est trop lent à cliquer.

### 1. P1 — Critical : pic de 5XX

- **Trigger** : `event.type:error level:[error,fatal]` ≥ 10 events
  in 5 min.
- **Filter** : `environment:production`.
- **Action** : Slack #incident + Email DPO + Email Tech Lead.
- **Cooldown** : 5 min entre re-déclenchements.

> Sens : un déploiement vient de partir en vrille ou un sous-traitant
> est down. Astreinte immédiate.

### 2. P1 — Critical : webhook Resend cassé

- **Trigger** : `transaction:POST /api/webhooks/resend` AND
  `event.level:[error,fatal]` ≥ 3 in 5 min.
- **Action** : Slack + Email Tech Lead.

> Sens : on accumule des bounces non capturés → IP de sending Resend va
> être pénalisée. À fixer dans la journée.

### 3. P1 — Critical : auth catastrophique

- **Trigger** : `transaction:* /api/auth/*` AND
  `event.level:[error,fatal]` ≥ 5 in 5 min.
- **Action** : Slack #incident.

> Sens : plus personne ne peut se connecter. Vérifier AUTH_SECRET, DB,
> Supabase region.

### 4. P2 — High : taux d'erreur cron

- **Trigger** : `transaction:GET /api/cron/*` AND `event.level:[error]` ≥ 1.
- **Action** : Email Tech Lead.

> Le cron tourne 1×/jour : un échec = 24 h sans rappels de session +
> file d'emails non drainée. À reprendre rapidement.

### 5. P2 — High : volume de CSP-reports

- **Trigger** : `event.type:csp` ≥ 50 in 1 h.
- **Filter** : `environment:production`.
- **Action** : Email Tech Lead.

> Sens : soit un CDN tiers vient d'être ajouté hors allowlist, soit on
> est l'objet d'une tentative d'injection. Inspecter avant de
> permettre la directive.

### 6. P3 — Medium : nouvelle erreur (regression)

- **Trigger** : `event.type:error` AND `is:first_seen`
  AND `environment:production`.
- **Action** : Slack #digizelle-alerts.

> Sens : une erreur jamais vue est apparue. Probablement un edge case ;
> à triager mais pas urgent.

### 7. P3 — Medium : mute pour les bruits connus

- **Filter pour TOUTES les alertes ci-dessus** :
  - exclure `error.type:NEXT_NOT_FOUND` (404 normaux)
  - exclure `error.type:NextError` `error.value:NEXT_REDIRECT`
  - exclure `error.type:PrismaClientKnownRequestError`
    `error.value:*P2025*` (record not found, géré côté action)

Ces filtres sont déjà en partie dans `sentry.server.config.ts` via
`ignoreErrors` mais on les répète côté Sentry pour les erreurs qui
arriveraient par un chemin imprévu.

## Releases & Source Maps

Configurer le release tracking pour avoir des stack traces lisibles :

- Vercel → Project → Settings → Environment Variables
  - `SENTRY_AUTH_TOKEN` : token avec scope `project:releases`,
    `project:read`.
- Le wrap `withSentryConfig` dans `next.config.ts` upload les
  source-maps automatiquement à chaque build prod.
- Vérifier après le premier déploiement : Sentry → Releases doit
  lister la version courante avec un nombre de fichiers > 0.

## Quotas

Plan Team Sentry → 50 k events/mois est largement suffisant pour
l'usage actuel. Surveiller via Sentry → Settings → Subscription.
Si on dépasse, c'est probablement un loop infini → traiter comme
P1 Critical.

## Historique

| Date       | Auteur | Motif                                       |
| ---------- | ------ | ------------------------------------------- |
| 2026-05-07 | Franck | Documentation initiale, à appliquer T+0.    |

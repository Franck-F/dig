---
titre: Environnement de staging — Vercel + Supabase
type: Configuration plate-forme à appliquer manuellement
dernière_revue: 2026-05-07
prochaine_revue: 2027-05-07
---

# Environnement de staging

> **Pourquoi** — chaque PR Vercel génère déjà un Preview Deployment qui
> compile le bundle, mais ces previews **partagent la base de données
> production**. Tester une migration ou un script de seed sur un Preview
> casse les données réelles. Un staging dédié supprime ce risque et
> sert aussi de bac à sable pour la démo aux partenaires.

## Architecture cible

```
┌──────────────────┐    ┌──────────────────┐
│  GitHub: main    │ ─► │  Vercel: prod    │ ─► Supabase: digizelle-prod
└──────────────────┘    └──────────────────┘            (eu-west-3)

┌──────────────────┐    ┌──────────────────┐
│ GitHub: staging  │ ─► │  Vercel: staging │ ─► Supabase: digizelle-staging
└──────────────────┘    └──────────────────┘            (eu-west-3)

┌──────────────────┐    ┌──────────────────┐
│ GitHub: PR #N    │ ─► │  Vercel: preview │ ─► Supabase: digizelle-staging
└──────────────────┘    └──────────────────┘    (mêmes credentials que staging)
```

- `main` → production. Domaine `digizelle.fr`. DB prod réelle.
- `staging` → staging permanent. Domaine `staging.digizelle.fr`. DB staging.
- PR previews → utilisent les credentials staging pour ne jamais toucher prod.

## Étape 1 — Créer la base Supabase staging

1. Connecte-toi à https://app.supabase.com.
2. **New project** :
   - Nom : `digizelle-staging`
   - Région : **eu-west-3 (Paris)** — même que prod, sinon les latences
     d'export/import diffèrent.
   - Plan : Free tier (suffisant pour staging).
   - Mot de passe DB : générer 32 chars random, stocker dans 1Password
     « Supabase — staging — DB password ».
3. Une fois provisionné, copier dans 1Password « Vercel staging env » :
   - `DATABASE_URL` (Project Settings → Database → Connection string → URI,
     mode **Transaction Pooler**, suffixé `?pgbouncer=true&connection_limit=1`)
   - `DIRECT_URL` (mode **Session pooler** ou direct, sans pgbouncer params)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Settings → API → service_role)

## Étape 2 — Migrer le schéma sur staging

```bash
# Avec les credentials staging dans .env.staging.local (ne pas commit) :
DATABASE_URL="postgresql://...staging..." \
DIRECT_URL="postgresql://...staging..." \
npx prisma migrate deploy
```

Attendu : les 9 migrations passent en quelques secondes (ou 11+
selon ce qui a été appliqué entre temps).

## Étape 3 — Créer la branche `staging` sur GitHub

```bash
git checkout main
git pull
git checkout -b staging
git push -u origin staging
```

Configurer la branch protection sur `staging` aussi (mêmes règles que
main, voir `branch-protection.md`) — le contournement de prod doit être
aussi protégé que prod.

## Étape 4 — Configurer Vercel

### 4a. Créer un environnement « staging » sur le projet Vercel

Vercel → Project → Settings → Environments → **Create Environment**

- Nom : `staging`
- Source : Git Branch → `staging`
- Domain : `staging.digizelle.fr` (CNAME à créer côté DNS) ou
  l'auto-domaine `digizelle-staging.vercel.app` pour démarrer.

### 4b. Variables d'environnement pour staging

Settings → Environment Variables — pour chaque variable, cocher uniquement
**Staging** (pas Production, pas Development) :

| Clé                          | Valeur                                                                     |
| ---------------------------- | -------------------------------------------------------------------------- |
| `AUTH_SECRET`                | Nouveau secret 64 hex (différent de prod)                                  |
| `NEXTAUTH_URL`               | `https://staging.digizelle.fr` (ou l'URL Vercel)                           |
| `NEXT_PUBLIC_SITE_URL`       | identique à NEXTAUTH_URL                                                   |
| `DATABASE_URL`               | (Supabase staging Transaction pooler)                                      |
| `DIRECT_URL`                 | (Supabase staging direct)                                                  |
| `NEXT_PUBLIC_SUPABASE_URL`   | (staging)                                                                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (staging anon)                                                          |
| `SUPABASE_SERVICE_ROLE_KEY`  | (staging service role)                                                     |
| `RESEND_API_KEY`             | utiliser une **API key Resend distincte** + sandbox domain                  |
| `RESEND_WEBHOOK_SECRET`      | distinct de prod                                                           |
| `NEXT_PUBLIC_SENTRY_DSN`     | DSN Sentry — **environnement « staging »** côté Sentry                     |
| `SENTRY_DSN`                 | identique                                                                  |
| `SENTRY_AUTH_TOKEN`          | identique à prod (lien-builds Sentry, lecture seule de toute façon)        |
| `GOOGLE_CLIENT_ID/SECRET`    | distincts (créer des credentials OAuth séparés pour staging dans GCP)      |
| `GITHUB_CLIENT_ID/SECRET`    | distincts                                                                  |
| `DISCORD_CLIENT_ID/SECRET`   | distincts                                                                  |

### 4c. Rediriger les Preview Deployments vers staging-DB

Pour que les PR previews ne touchent jamais la prod, on copie les env vars
staging sur l'environnement **Preview** (pas Production) :

Settings → Environment Variables → pour chaque clé liée à la DB, ajouter
une copie cochée **Preview** avec la valeur staging (DATABASE_URL,
DIRECT_URL, SUPABASE_*, RESEND_API_KEY).

`AUTH_SECRET` Preview : peut rester égal à prod ou à staging — Preview
n'est pas exposé publiquement, le risque est faible.

## Étape 5 — Workflow de promotion

```
PR opens          → Preview deployment    (DB staging)
PR merges → main  → Production deployment (DB prod)
                    + automatic CI
release/X.Y.Z    → tag, post-mortem si nécessaire
```

Pour un test sur staging avant prod :

```bash
git checkout staging
git merge main          # ou cherry-pick
git push origin staging
# Vercel déploie → tester sur staging.digizelle.fr
# Si OK → merger main vers prod via PR habituelle
```

## Étape 6 — Cron sur staging ?

Les crons Vercel (`/api/cron/sessions-reminder`) ne s'exécutent **que sur
production** par défaut. Le plan Hobby ne permet pas de cron sur Preview.
Pour tester un cron sur staging, créer un endpoint `/api/cron/test-trigger`
authentifié et le frapper manuellement avec curl.

## Étape 7 — Données de seed pour staging

`prisma/seed.ts` peut être adapté pour pousser un dataset de démo sur
staging (10 mentors, 30 mentees, channels seed, posts d'exemple). Garder
des emails `+staging` pour qu'ils ne se mélangent pas avec d'éventuels
utilisateurs réels.

## Coûts estimés

| Composant       | Plan staging | Coût mensuel |
| --------------- | ------------ | ------------ |
| Vercel staging  | Hobby        | 0 €          |
| Supabase staging| Free         | 0 €          |
| Resend staging  | Free 3000/mo | 0 €          |
| Sentry staging  | Inclus       | 0 €          |

Tant qu'on n'augmente pas le volume sur staging, le surcoût reste nul.

## Historique

| Date       | Auteur | Motif                                |
| ---------- | ------ | ------------------------------------ |
| 2026-05-07 | Franck | Documentation initiale.              |

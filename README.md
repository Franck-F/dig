# Digizelle webapp

[![CI](https://github.com/Franck-F/dig/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Franck-F/dig/actions/workflows/ci.yml)

Plateforme open-source de l'association loi 1901 **Digizelle** —
inclusion numérique des jeunes (en particulier les jeunes femmes) en
Île-de-France et au-delà.

Une seule application Next.js qui combine **vitrine publique**, **mentorat
1:1 (Mentora)**, **communauté UGC**, et **back-office admin**.

→ Pour la doc produit (audiences, parcours, charte UX, vision long terme)
voir [`PROJECT.md`](./PROJECT.md).

→ Pour la doc technique (architecture, conventions, runbooks) voir
[`ARCHITECTURE.md`](./ARCHITECTURE.md) et le dossier
[`docs/`](./docs/).

## Quick start

```bash
# 1. Cloner + installer
git clone https://github.com/Franck-F/dig.git
cd dig
npm install

# 2. Configurer l'environnement
cp .env.example .env
# remplir au minimum DATABASE_URL, DIRECT_URL, AUTH_SECRET

# 3. Provisionner la base
npx prisma migrate deploy
npm run db:seed

# 4. Lancer le dev server
npm run dev
# → http://localhost:3000
```

## Scripts npm

| Script                  | Effet                                                            |
| ----------------------- | ---------------------------------------------------------------- |
| `npm run dev`           | Dev server Next.js avec Turbopack                                |
| `npm run build`         | Build production : applique d'abord `prisma migrate deploy` sur la `DATABASE_URL` |
| `npm run build:ci`      | Build sans migration (ce que lance la CI)                        |
| `npm run build:analyze` | Build + génère le bundle analyzer treemap (`.next/analyze/`)     |
| `npm run start`         | Serve le build                                                   |
| `npm run lint`          | ESLint flat config                                               |
| `npm run typecheck`     | `tsc --noEmit`                                                   |
| `npm test`              | Tests unitaires (Node test runner)                               |
| `npm run test:coverage` | Idem + rapport de couverture stdout                              |
| `npm run test:integration` | Tests d'intégration sur un vrai PostgreSQL de test (voir plus bas) |
| `npm run test:db:up` / `test:db:down` / `test:db:reset` | Démarre, arrête ou recrée le PostgreSQL de test (Docker) |
| `npm run metrics:mentora` | Compteurs de dette Mentora, échoue si l'un augmente            |
| `npm run bundle:mentora` | Poids JS par route Mentora, après `build:ci`                    |
| `npm run db:migrate`    | Crée et applique une migration en dev                            |
| `npm run db:migrate:deploy` | Applique les migrations en staging/prod                      |
| `npm run db:seed`       | Peuple la base de données                                        |
| `npm run db:studio`     | Ouvre Prisma Studio                                              |

### Tests d'intégration

Ils exécutent les actions serveur Mentora contre une base PostgreSQL de test, jamais celle de `.env` :

```bash
npm run test:db:up
export DATABASE_URL_TEST=postgresql://test:test@localhost:54329/digizelle_test
npm run test:integration
```

Le setup refuse toute URL dont la base ne se termine pas par `_test`, qui n'est pas locale (sauf `TEST_DB_ALLOW_REMOTE=1`) ou qui est égale à `DATABASE_URL`. Les cas marqués `todo` décrivent des bugs connus, à corriger en phase 2 de `docs/mentora-rebuild/03-plan.md`. Après un changement de migration, `npm run test:db:reset` repart d'une base vide.

### Build local et typecheck

Supprimer `.next/dev` avant un build ou un `npm run typecheck` local. `tsconfig.json` inclut `.next/dev/types/**/*.ts`, et un `next dev` ancien y laisse des types de routes périmés : le typecheck échoue alors sur `.next/dev/types/routes.d.ts`. Le dossier n'est pas versionné, donc la CI n'est pas touchée.

```bash
rm -rf .next/dev
DATABASE_URL=postgresql://user:pass@localhost:5432/db npm run build:ci
```

Avec une `DATABASE_URL` factice, le build ne lit pas la base de `.env`.

## Variables d'environnement

Voir [`.env.example`](./.env.example) — ~15 variables réparties en :

- **Base** : `DATABASE_URL` (pooler Supabase), `DIRECT_URL` (direct, pour
  les migrations).
- **Auth.js** : `AUTH_SECRET` (HMAC), URL OAuth (Google, GitHub, Discord —
  optionnels).
- **Email** : `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` (bounces /
  complaints).
- **Cron** : `CRON_SECRET` pour authentifier les routes `/api/cron/*`.
- **Observabilité** : `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`,
  `NEXT_PUBLIC_SENTRY_DSN`.
- **Rate-limit** : `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
  (optionnels — fallback in-memory si absents).
- **CSP** : enforced par défaut ; `CSP_REPORT_ONLY=1` pour repasser en
  Report-Only (fenêtre d'observation).

## Structure rapide

```
src/
├── app/              # Next.js App Router (RSC + client islands)
│   ├── (public)/    # Vitrine
│   ├── community/   # Forum / channels / défis
│   ├── mentora/     # Mentorat 1:1
│   ├── account/     # Sécurité (2FA)
│   └── api/         # Route handlers (webhooks, cron, exports)
├── lib/              # Logique serveur (actions, email, audit, RGPD…)
├── components/       # Composants partagés
├── hooks/            # React hooks (focus trap, scroll lock…)
├── i18n/             # Config next-intl
└── test-setup/       # Loader hooks pour `npm test`
prisma/
├── schema.prisma    # 50+ modèles
└── migrations/      # 11 migrations versionnées
docs/
├── rgpd/            # Registre, AIPD, DPA, charte
├── runbooks/        # Procédures incident
└── ops/             # Branch protection, CSP, SLO, staging…
```

## Statut

État actuel : **production-ready**, 6 phases de durcissement livrées
(P0 → P5). Voir [`CHANGELOG.md`](./CHANGELOG.md) pour le détail.

| Phase | Périmètre                                                         |
| ----- | ----------------------------------------------------------------- |
| P0    | Stop-the-bleeding (CSP, headers, rate-limit, Sentry, soft-delete) |
| P1    | RGPD opérationnel (registre, DPO, export, suppression, mineurs)   |
| P2    | Scale (2FA mods, Upstash, indexes, image validation, Sentry)      |
| P3    | UX governance (peer-2FA reset, charte, dual-mod BAN, CSP enforce) |
| P4    | Sécurité avancée (mentor 2FA, recherche FT, anti-harcèlement)     |
| P5    | Refactor & observability (focus trap, Web Vitals, slow-query)     |
| P6    | Finalisation (tests unit, bundle analyzer, handover docs)         |

## Licence

Code source : voir `LICENSE` (à finaliser avant ouverture publique).
Contenu (texte, images, logos) : © Digizelle — tous droits
réservés sauf mention contraire.

## Contact

- Tech / contributions : Franck — Tech Lead
- Communication / partenariats : contact@digizelle.fr
- RGPD / DPO : contact@digizelle.fr
- Issues / bugs : https://github.com/Franck-F/dig/issues

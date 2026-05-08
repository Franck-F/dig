# Digizelle webapp

Plateforme open-source de l'association loi 1901 **Digizelle / Laboratoire
Calebasse** — inclusion numérique des jeunes (en particulier les jeunes
femmes) en Île-de-France et au-delà.

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
| `npm run build`         | Build production                                                 |
| `npm run build:analyze` | Build + génère le bundle analyzer treemap (`.next/analyze/`)     |
| `npm run start`         | Serve le build                                                   |
| `npm run lint`          | ESLint flat config                                               |
| `npm run typecheck`     | `tsc --noEmit`                                                   |
| `npm test`              | Tests unitaires (Node test runner, 76 tests)                     |
| `npm run test:coverage` | Idem + rapport de couverture stdout                              |
| `npm run db:migrate`    | Crée et applique une migration en dev                            |
| `npm run db:migrate:deploy` | Applique les migrations en staging/prod                      |
| `npm run db:seed`       | Peuple la base de données                                        |
| `npm run db:studio`     | Ouvre Prisma Studio                                              |

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
- **CSP** : `CSP_ENFORCE=1` pour basculer en mode enforced
  (défaut : Report-Only).

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
Contenu (texte, images, logos) : © Laboratoire Calebasse — tous droits
réservés sauf mention contraire.

## Contact

- Tech / contributions : Franck — Tech Lead
- Communication / partenariats : communication@calebasse.com
- RGPD / DPO : dpo@calebasse.com
- Issues / bugs : https://github.com/Franck-F/dig/issues

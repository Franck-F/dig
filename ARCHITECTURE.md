# Architecture

> Plongée dans la mécanique interne du repo. Pour la doc produit (ce que
> fait le site), voir [`PROJECT.md`](./PROJECT.md). Pour les procédures
> opérationnelles voir [`docs/`](./docs/).

## Stack

| Couche             | Outil                                                                  |
| ------------------ | ---------------------------------------------------------------------- |
| Framework          | **Next.js 16** App Router, React 19, Turbopack                         |
| Langage            | **TypeScript** strict                                                  |
| Base de données    | **Postgres** via Supabase (pooler `DATABASE_URL`, direct `DIRECT_URL`) |
| ORM                | **Prisma 6** (50+ modèles)                                             |
| Auth               | **Auth.js v5 (NextAuth)** JWT + Prisma Adapter                         |
| Email              | **Resend** + outbox `EmailQueueItem` + Svix webhook bounces            |
| i18n               | **next-intl 4** (locale `fr`, `messages/fr.json`)                      |
| Observabilité      | **Sentry** (browser + server + edge), Web Vitals, Prisma slow-query    |
| Rate-limit         | Token bucket in-memory ou **Upstash Redis** (auto-détection env)       |
| Hash               | bcryptjs (cost 12)                                                     |
| Validation         | zod                                                                    |
| Hébergement        | **Vercel** Hobby (région CDG)                                          |
| 2FA                | RFC 6238 TOTP (HMAC-SHA1, Node crypto, zéro dépendance)                |

## Structure

### `src/app/` — routes

Next.js App Router. Chaque dossier = un segment de route.

```
app/
├── layout.tsx                  ← root layout (providers, JSON-LD, Web Vitals)
├── globals.css
├── (public)/                   ← vitrine
│   ├── about, team, projects, programs, events, blog, contact
│   ├── legal, privacy, cookies ← pages légales (RGPD)
│   └── login                   ← UI auth + Modal focus trap
├── community/
│   ├── (feed)                  ← /community
│   ├── c/[slug]                ← un channel
│   ├── posts/[id]              ← détail post (+ /edit)
│   ├── members/[handle]
│   ├── challenges
│   ├── search                  ← Postgres tsvector
│   ├── charte                  ← code de conduite
│   ├── settings                ← profil + RGPD (export, delete)
│   ├── onboarding
│   └── admin/                  ← shell admin (2FA gated)
│       ├── moderation, channels, badges, users, challenges
│       ├── flags               ← détection patterns harcèlement
│       ├── audit-log
│       └── rgpd                ← lecteur registre + AIPD
├── mentora/
│   ├── (public)                ← annuaire mentors
│   ├── [slug]                  ← profil mentor public
│   ├── become-a-mentor, onboarding
│   ├── dashboard/              ← mentor/mentee shell (2FA gated pour mentors actifs)
│   │   ├── profile, availability, mentorships, requests
│   │   ├── messages, sessions, notifications
│   └── admin/                  ← shell admin Mentora (2FA gated)
│       ├── cycles, mentors, mentees, matching
│       ├── moderation, reports
├── account/
│   └── 2fa/                    ← setup, challenge, manage, regen backup codes
├── email/
│   └── unsubscribe             ← 1-click unsub (RFC 8058)
└── api/
    ├── auth/[...nextauth]      ← NextAuth catch-all
    ├── account/export          ← RGPD Art. 20 (JSON download)
    ├── webhooks/resend         ← bounces / complaints (Svix)
    └── cron/
        ├── sessions-reminder   ← daily 9 UTC + drain email queue
        └── community-digest    ← daily 8 UTC (digest journalier + weekly Mondays)
```

### `src/lib/` — logique serveur

```
lib/
├── prisma.ts                   ← client global + slow-query middleware (Phase 5)
├── actions/                    ← server actions, gated par requireUser/requireAdmin
│   ├── auth.ts                 ← signIn, signUp, verify, reset, OAuth
│   ├── account.ts              ← requestSelfDelete (avec email confirmation)
│   ├── two-factor.ts           ← setup, challenge, disable, peer reset, regen
│   ├── community/              ← member, posts, comments, reactions, reports
│   │   ├── _helpers.ts         ← err codes, ok/err, requireXxx
│   │   └── admin/              ← moderation (BAN dual-mod), challenges, channels
│   ├── mentora/                ← profile, requests, sessions, messages, reviews
│   └── newsletter.ts           ← campaigns + outbox + status polling
├── auth/
│   ├── totp.ts                 ← RFC 6238 (zéro dep)
│   └── admin-2fa-cookie.ts     ← cookie HMAC 8h gating admin entry
├── community/
│   ├── search.ts               ← Postgres FT (tsvector + GIN)
│   ├── search-query.ts         ← (testable) normaliser tsquery
│   ├── iso-week.ts             ← (testable) ISO 8601 helpers
│   ├── weekly-digest.ts        ← Monday content recap
│   ├── abuse-patterns.ts       ← détecteur cyber-harcèlement
│   ├── sanitizer.ts            ← marked + DOMPurify
│   ├── mentions.ts, hashtags.ts, ranker.ts, badges.ts
│   ├── notifications.ts, rateLimit.ts (community-scoped)
│   └── email.ts                ← templated sendCommunityTemplatedEmail
├── email/
│   ├── resend.ts               ← Resend client (logs si pas de key)
│   ├── queue.ts                ← EmailQueueItem outbox (claim/lock/retry)
│   ├── unsubscribe-token.ts    ← HMAC tokens 1-clic (RFC 8058)
│   └── templates/              ← verification-code, password-reset,
│                                  account-deleted, community-weekly-digest
├── images/
│   └── validate.ts             ← magic-number sniff + size cap (PNG/JPEG/WebP/GIF)
├── rate-limit/
│   ├── auth-limiter.ts         ← signIn/signUp/verify/reset (IP + email)
│   ├── user-action-limiter.ts  ← post-auth actions (export)
│   └── upstash.ts              ← Redis backend (REST API, 0 dep)
├── rgpd/
│   └── export.ts               ← Art. 20 JSON builder
├── soft-delete/
│   └── user.ts                 ← anonymisation + grace period
├── audit/
│   └── log.ts                  ← AuditLog writer + reader
├── mentora/
│   ├── matching.ts             ← scoring algo (testable)
│   ├── notifications.ts, current-profile.ts, …
└── seo/
    └── jsonld.ts
```

### `src/components/` — UI partagée

```
components/
├── app-shell/
│   ├── AppShell.tsx            ← sidebar + topbar (mentora dashboard, admin)
│   ├── AppShellSidebar.tsx, AppShellTopbar.tsx
│   ├── NotificationsBell.tsx   ← popover avec focus trap
├── boundary/
│   ├── SectionErrorPanel.tsx   ← shared error UI (Sentry-instrumented)
│   └── Skeletons.tsx
├── motion-footer.tsx           ← GSAP cinematic footer
├── HeroParallax.tsx, Reveal.tsx, AnimatedNumber.tsx
├── CookieConsent.tsx, CookieConsentProvider.tsx
├── ThemeProvider.tsx
├── WebVitalsReporter.tsx       ← LCP/INP/CLS → Sentry
├── ScrollRevealAuto.tsx
├── Frame.tsx, Header.tsx
└── ui/                         ← shadcn/ui primitives
```

### `src/hooks/`

- `useFocusTrap.ts` — Tab/Shift+Tab wrap + restore focus (WCAG 2.4.3)
- `useScrollLock.ts` — body scroll lock partagé / refcounté
- `useDebouncedValue.ts`, autres helpers

## Patterns clés

### Server actions

Toutes les mutations passent par des `'use server'` actions, jamais par
des routes `/api/*` REST custom.

- **Helpers de gating** : `requireUser`, `requireMentorOwner`,
  `requireCommunityMember`, `requireCommunityAdmin`. Refusent l'action
  avec un `ActionResult { status: 'error', error: 'unauthorized' }`.
- **Audit log** : tout admin action appelle `logAdmin(actorUserId, …)`
  après succès.
- **Validation** : zod schema en haut de chaque action.
- **Rate-limit** : `checkAuthRateLimit('signIn', email)` avant tout
  travail DB / bcrypt.

### Email outbox

`EmailQueueItem` = table-as-queue. Les flows :

1. **Newsletter / digest** : `enqueueEmails(audienceTag, items)` insère
   en `PENDING`. Le cron `sessions-reminder` appelle `drainEmailQueue` qui
   claim 8 items à la fois, envoie via Resend, settle en `SENT` /
   retry exponential / `FAILED`.
2. **Webhook bounces** : `/api/webhooks/resend` écoute `email.bounced`,
   `email.complained`, `email.delivery_delayed` (Svix-signed) → flag
   `User.emailBouncedAt` + filtre côté send.

### 2FA gate

Une seule classe de cookie HMAC-signé 8 h (`dz-admin-2fa`) protège
3 surfaces sensibles, en cascade :

```
ADMIN role     ──► /community/admin/* + /mentora/admin/*
isModerator    ──► /community/admin/*
ACTIVE mentor  ──► /mentora/dashboard/*
```

Le layout RSC redirige vers `/account/2fa/setup` si pas configuré, vers
`/account/2fa/challenge` si cookie périmé. Le cookie est partagé : un
admin qui est aussi mentor ne challenge qu'une fois.

### Modération à 4 yeux

Toute décision `BAN_USER` exige une `BAN_PROPOSAL` préalable d'un autre
modérateur dans les 24 h. Implémentation : reuse de la table
`ModerationAction`, vérif applicative dans `banUser` server action.
Empêche un compte mod compromis ou de mauvaise foi de bannir
unilatéralement.

### Soft-delete + grace period

`softDeleteUser(userId, actorId, reason?)` :
1. Anonymise immédiatement (email → `deleted-<rand>@anonymous.local`,
   prénom/nom/photo/passwordHash → null).
2. Cascade aux profils mentor/mentee, à `CommunityMember`.
3. Supprime les rows `Account` (OAuth links) et `VerificationCode`.
4. `User.deletedAt = now`.

Cron mensuel (à venir Phase 7) : `purgeExpiredSoftDeletes(30)` hard-
delete les rows > 30 j. Pendant la grace, un autre admin peut restaurer
via `restoreUser(userId)`.

### Anti-énumération

`signIn` :
- Si user inexistant → bcrypt compare contre un hash dummy fixe.
- Si user existant, mauvais MDP → bcrypt compare normal.
- Pas avant la vérif MDP : message `emailNotVerified` n'est révélé
  qu'**après** une match correcte (pas un yes/no oracle).

`requestPasswordReset` retourne **toujours** success même quand l'email
n'existe pas + même quand le rate-limit déclenche, pour éviter une
oracle.

### Recherche

`Post.searchTsv` est une **stored generated column** Postgres :
`setweight(to_tsvector('french', title), 'A') || setweight(…, body, 'B')`.
GIN index. L'application appelle `to_tsquery('french', $1)` via
`prisma.$queryRaw` — l'input passe par `normaliseQuery()` qui strip les
opérateurs tsquery et impose un cap à 6 tokens.

### Observabilité

- **Sentry** : `sentry.client/server/edge.config.ts` avec masquage des
  replays, redaction des request bodies.
- **Web Vitals** : `WebVitalsReporter.tsx` (next/web-vitals →
  `Sentry.setMeasurement` + breadcrumbs).
- **Prisma slow-query** : `$extends` middleware qui tag `>500ms` en
  breadcrumb et `>1500ms` en `captureMessage`.
- **Audit log** : append-only `AuditLog` model, lecteur sur
  `/community/admin/audit-log`.
- **CSP reports** : `report-uri` dans le header → Sentry security
  endpoint.
- **SLO** : 99.5 % dispo, < 0.5 % 5xx, LCP ≤ 2.5 s — voir
  [`docs/ops/slo-error-budget.md`](./docs/ops/slo-error-budget.md).

## Tests

Stratégie : **tests unitaires sur les modules purs**. Pas de tests
d'intégration DB pour l'instant — coût/valeur trop élevé au stade
actuel ; l'observabilité Sentry capture les régressions en preview /
staging.

```
src/lib/community/__tests__/
  ├── mentions.test.ts          (parser regex)
  ├── ranker.test.ts            (scoring)
  ├── rateLimit.test.ts         (token bucket)
  ├── sanitizer.test.ts         (marked + DOMPurify)
  ├── search.test.ts            (tsquery normaliser, anti-injection)
  └── weekly-digest.test.ts     (ISO 8601 week math)
src/lib/mentora/__tests__/
  └── matching.test.ts          (mentor scoring algo)
src/lib/auth/__tests__/
  └── totp.test.ts              (RFC 6238)
src/lib/email/__tests__/
  └── unsubscribe-token.test.ts (HMAC tokens)
src/lib/images/__tests__/
  └── validate.test.ts          (magic-number sniff, anti-spoofing)
```

Total : **76 tests, 0 fail**. CI exige typecheck + lint + tests passent
avant merge sur `main` (voir `.github/workflows/ci.yml`).

Test runtime : `node --test --experimental-strip-types` — Node 25 fait
le type stripping nativement, Node 22+ avec le flag. Un loader hook
(`src/test-setup/register-loader.mjs`) intercepte le marker
`server-only` pour qu'on puisse tester des modules serveur sans webpack.

## Migrations Prisma

11 migrations versionnées dans `prisma/migrations/`. Toutes sont
**idempotentes** (`IF NOT EXISTS` partout) — un environnement qui
aurait reçu un `prisma db push` antérieur ne crashe pas.

Chronologie :

```
20260505071653_init_mentora_community
20260505075631_auth_verification
20260507120000_audit_log                       ← P0
20260507130000_soft_delete                     ← P0
20260507140000_session_reminder_sent_at        ← P0
20260507150000_email_queue                     ← P0
20260507160000_marketing_opt_out               ← P0
20260507170000_email_bounced                   ← P0
20260507180000_user_birth_year                 ← P1 (RGPD Art. 8)
20260507190000_user_totp                       ← P1 (2FA)
20260507200000_index_user_deleted_account_userid ← P2 (perf)
20260507210000_ban_proposal_type               ← P3 (dual-mod BAN)
20260507220000_post_fulltext_search            ← P4 (recherche)
20260507230000_weekly_digest_tracker           ← P4 (digest hebdo)
```

## Cron architecture

Vercel Hobby permet 2 crons. On a piggy-backé pour rester dans la limite :

| Endpoint                          | Schedule  | Jobs                                                              |
| --------------------------------- | --------- | ----------------------------------------------------------------- |
| `/api/cron/sessions-reminder`     | `0 9 * * *` | rappel sessions du jour + drain email queue                       |
| `/api/cron/community-digest`      | `0 8 * * *` | digest notifications quotidien + challenges advance + auto-restore + anniversaire badges + **digest hebdo Mondays** |

Auth : `Authorization: Bearer ${CRON_SECRET}`.

## Where to look

- **Quelque chose ne marche pas en prod** → Sentry + `docs/runbooks/`
- **RGPD / DPO question** → `docs/rgpd/`
- **Rotation de secret** → `docs/runbooks/auth-secret-rotation.md`
- **Reset 2FA admin** → `docs/runbooks/2fa-admin-reset.md`
- **Bascule CSP enforced** → `docs/ops/csp-enforcement.md`
- **Provisionner staging** → `docs/ops/staging-environment.md`
- **Suivre les SLO** → `docs/ops/slo-error-budget.md`

# Changelog

Toutes les évolutions notables du projet Digizelle webapp.

Format inspiré de [Keep a Changelog](https://keepachangelog.com/), versioning
[SemVer](https://semver.org/) (à activer au premier tag public).

## [Unreleased]

Phases de durcissement P0-P6 mergées sur `main`. Pas de tag SemVer
posé pour l'instant — un `v0.1.0` sera créé avant la première démo
publique ; le présent fichier sera scindé en sections versionnées à ce
moment-là.

---

## P6 — Finalisation (2026-05-08)

### Added

- 76 tests unitaires sur les modules purs (`search-query`, `iso-week`,
  `totp`, `unsubscribe-token`, `image validate`).
- Focus trap (`useFocusTrap` hook) wired dans **tous** les dialogues
  de l'app — login, cookies, RequestMentorshipModal, ReportMenu,
  UserModerationPanel, ChallengeCreatorModal, NewsletterCampaignModal,
  WhyMatchTooltip, ProgramDetailsModal, NotificationsBell.
- `next-bundle-analyzer` câblé via `ANALYZE=1 npm run build:analyze`.
- `README.md` réécrit en handover guide.
- `ARCHITECTURE.md` — plongée structurelle (stack, layout, patterns,
  observability, tests, migrations, cron).
- `CHANGELOG.md` — ce fichier.
- Test runtime : loader hook `src/test-setup/register-loader.mjs`
  intercepte `server-only` pour faire tourner les modules serveur
  sous `node --test`.

### Changed

- `isoWeekLabel` rend en `timeZone: 'UTC'` pour garantir
  l'invariance time-of-day → même range.
- `verifyTotp` clamp le counter à 0 (protège `Buffer.writeUInt32BE`
  contre les valeurs négatives lors des tests à `nowMs = 0`).
- `verifyTotp` renvoie `false` plutôt que de propager une exception
  sur secret base32 invalide.

### Deferred to Phase 7

- Pagination cursor-based sur le feed community (tâche 61)
- Optimistic UI sur les réactions / bookmarks (tâche 62)

---

## P5 — Refactor & observability (2026-05-07)

### Added

- `useFocusTrap` hook (WCAG 2.4.3) — Tab/Shift+Tab wrap, restoration
  du focus à la fermeture, sélecteurs react-aria-conformes. Wiré dans
  LoginForm + CookieConsent.
- Web Vitals reporter (`WebVitalsReporter.tsx`) — LCP, INP, CLS, FCP,
  TTFB envoyés à Sentry comme measurements + breadcrumbs auto-tagués
  warning au-dessus du seuil "needs improvement".
- Prisma `$extends` slow-query middleware — > 500 ms = breadcrumb,
  > 1500 ms = `Sentry.captureMessage`. Aucun argument inspecté
  (PII-safe).
- `prefers-reduced-motion` honoré dans `Reveal` et `AnimatedNumber`
  (WCAG 2.3.3).
- `docs/ops/slo-error-budget.md` — 11 SLO mesurables, budget 216
  min/mois en 4 paliers, 4 dashboards Sentry à créer, KPI business
  adjacents, procédure post-mortem.

### Changed

- React 19 strict-mode warnings : `react-hooks/purity` désactivée
  (false positive sur RSC), patterns intrinsèques documentés
  (useActionState reactors, hydration localStorage, animations rAF).
- 4 unescaped JSX apostrophes (LoginForm,
  NewsletterCampaignModal, animated-characters-login-page).
- File-level `eslint-disable react-hooks/refs` sur les composants
  d'animation 21st.dev (1.2 KLOC qui lisent `.current` durant
  render pour piloter des inline transforms).

---

## P4 — Sécurité avancée & engagement (2026-05-07)

### Added

- 2FA mandatory pour les ACTIVE mentors (`/mentora/dashboard/*`).
  Cookie partagé avec le admin gate.
- Recherche full-text Postgres : `Post.searchTsv` (generated column,
  setweight title=A + body=B), GIN index, dictionnaire `'french'`.
  Anti tsquery-injection. UI `/community/search?q=`.
- Détecteur de patterns d'abus (`abuse-patterns.ts`) — repeat
  offenders, hyperactive reporters, mention storms. Page admin
  `/community/admin/flags`, audit-loggée.
- Email digest hebdomadaire (Mondays only) — top 5 posts/sem dans les
  channels du membre. Outbox + 1-click unsub.
- `docs/rgpd/comite-revue-moderation.md` — process trimestriel,
  composition (DPO + admin + pair externe), KPI, requête SQL.

### Changed

- `disableTotp` bloque aussi les ACTIVE mentors (en plus des admins
  et modérateurs).

---

## P3 — UX governance & sécurité (2026-05-07)

### Added

- Reset 2FA peer-to-peer (`adminResetUserTotp`) — un ADMIN débloque
  un autre admin/mod sans device. UI sur
  `/community/admin/users/[handle]`. Self-target refusé. Motif
  obligatoire (5-500 chars), audit-loggé.
- Email confirmation à la suppression de compte (capture
  email/firstName AVANT softDeleteUser, envoi via outbox).
- Régénération codes de secours 2FA (10 nouveaux après preuve TOTP).
- Charte de la communauté (`/community/charte`), code de conduite
  public + lien dans onboarding.
- Double-mod BAN : `proposeBan` + `banUser` exigent deux
  modérateurs distincts dans une fenêtre 24 h. Migration
  `BAN_PROPOSAL` enum.
- Code coverage dans CI (`test:coverage`, Node test runner natif).
- Flag CSP enforcement (`CSP_ENFORCE=1`) — Report-Only par défaut.
- Runbook `docs/runbooks/2fa-admin-reset.md`.
- Procédure CSP enforcement `docs/ops/csp-enforcement.md`.

---

## P2 — Scale & hardening (2026-05-07)

### Added

- 2FA mandatory pour les modérateurs communauté (en plus des admins).
- Registre des violations RGPD (`docs/rgpd/registre-violations.md`,
  Art. 33 §5).
- AIPD Mentora et AIPD Community
  (`docs/rgpd/aipd-mentora.md`, `…aipd-community.md`).
- Upstash Redis backend pour les rate-limiters
  (`src/lib/rate-limit/upstash.ts`, REST API, 0 dep, fail-open).
- Hot-path indexes Prisma : `User.deletedAt`, `Account.userId`.
- Validation upload images server-side (`validateImageDataUri`) —
  MIME + size + magic-number sniff. Wiré sur avatar, mentor photo,
  challenge cover, post attachments.
- `docs/ops/sentry-alerts.md` — 7 alertes graduées.
- Dependabot (`.github/dependabot.yml`).
- PR template (`.github/pull_request_template.md`).

### Changed

- ESLint warnings 59 → 34 (purity rule désactivée, apostrophes
  fixées, disable comments justifiés).

---

## P1 — RGPD opérationnel (2026-05-07)

### Added

- Registre des activités de traitement (Art. 30 RGPD) —
  `docs/rgpd/registre-traitements.md` couvrant T-01 à T-10.
  Rendu côté admin sur `/community/admin/rgpd`.
- Modèle DPA Art. 28 (`docs/rgpd/dpa-modele.md`).
- DPO formalisé (`contact@digizelle.fr`), intégré dans politique de
  confidentialité, footer, zone "Supprimer mon compte".
- Politique de confidentialité actualisée — adresse Kremlin-Bicêtre,
  Sentry sub-processor, 2FA + export documentés.
- Export RGPD Art. 20 (`/api/account/export` JSON download).
  Rate-limit 2/jour. UI dans Paramètres.
- Suppression compte enrichie — récap "anonymisé immédiatement vs
  conservé sous forme anonyme", grace 30 j, lien export.
- `User.birthYear` (Art. 8 — défense en profondeur sur l'âge minimal
  15 ans).
- Cookie consent TTL 13 mois (recommandation CNIL 2020-091).
- 2FA TOTP (RFC 6238 from-scratch sur Node crypto, 0 dep). Backup
  codes bcrypt, cookie HMAC 8 h. Mandatory pour ADMINs.
- `signIn` anti-énumération (bcrypt dummy hash + révélation
  `emailNotVerified` post-vérif MDP).
- `signUp` per-email rate limit (3/h) en plus du per-IP (5/h).
- Runbooks `auth-secret-rotation.md` + `rgpd-incident.md`.
- CI GitHub Actions (lint + typecheck + prisma validate + test +
  build).
- Procédures `docs/ops/branch-protection.md` et
  `docs/ops/staging-environment.md`.

---

## P0 — Stop-the-bleeding (2026-05-07)

### Added

- Security headers (CSP Report-Only avec allowlist Supabase / Resend
  / Sentry / Vercel ; HSTS 2 y preload ; X-Frame DENY ; COOP / CORP).
- Rate-limit auth (token bucket in-memory, double-key IP + email).
- AuditLog model + viewer admin.
- Sentry browser/server/edge configs.
- Honey-pot signup + age gate 15 ans (case à cocher).
- Soft-delete avec anonymisation immédiate + grace 30 j.
- `Session.reminderSentAt` (résout N+1 dans cron rappels).
- EmailQueueItem outbox (claim/lock/retry, 8-wide parallel sends).
- Unsubscribe 1-clic RFC 8058 (HMAC tokens + UI + opt-out flag).
- Webhook Resend (Svix) — captures bounces + complaints.
- `?next=` redirect handling après auth (avec `safeNextPath`).
- Error boundaries (`error.tsx`) + loading skeletons (`loading.tsx`)
  sur toutes les sections.

### Fixed

- N+1 dans le cron sessions-reminder (table colonne au lieu de
  JSONB path).

---

## Convention pour les futures releases

À chaque tag SemVer :

1. Promouvoir la section `[Unreleased]` en section `[X.Y.Z] —
   YYYY-MM-DD`.
2. Recréer une section `[Unreleased]` vide.
3. Sous-sections autorisées : **Added**, **Changed**, **Deprecated**,
   **Removed**, **Fixed**, **Security**.
4. Une ligne par changement utilisateur-visible. Le commit message
   garde les détails techniques.
5. Lier vers les issues / PR GitHub quand pertinent.

Les patches automatiques de Dependabot ne donnent pas lieu à une
entrée du changelog sauf si elles changent un comportement
utilisateur-visible.

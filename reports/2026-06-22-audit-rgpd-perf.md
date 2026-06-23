---
title: "Audit RGPD + Performance — digizelle-webapp-public"
date: 2026-06-22
method: Audit multi-agents read-only (5 finders ciblés + vérification adversariale + synthèse)
scope: Complète les 2 dimensions en timeout du 1er audit (reports/2026-06-22-audit-multi-agents.md)
stats: 34 findings — 13 confirmés (code relu), 0 réfuté, 21 medium/low non vérifiés
---

> ⚠️ **Bottom line : l'état RGPD est bloquant pour une ouverture publique.** Plusieurs garanties promises (charte, registre CNIL, emails) ne sont **pas exécutées en code** — sur une app manipulant des PII de **mineures (15-17 ans)** en UE. À corriger avant tout lancement public. La perf est fonctionnelle mais structurellement sous-optimale (tout est rendu dynamiquement, aucune page CDN).

---

# Audit RGPD + Performance — digizelle-webapp-public

## 1. Resume executif

L'application est destinee a un public europeen incluant des mineures de 15-17 ans, ce qui place le RGPD au plus haut niveau d'exigence. **Etat RGPD : non conforme et bloquant pour une ouverture publique.** Les trois mecanismes structurants promis a la CNIL et aux utilisateurs (purge irreversible a J+30, anonymisation immediate de l'authorship, durees de conservation appliquees) sont documentes mais jamais executes en code : la fonction de purge existe sans aucun appelant ni cron, le pseudo/avatar d'un membre supprime restent affiches publiquement, et les posts d'un compte supprime continuent d'apparaitre dans le feed avec son vrai identifiant. S'ajoutent un tracking tiers (Sentry + Session Replay) actif avant tout consentement en contradiction avec la page cookies, et l'absence d'exclusion des mineures des audiences marketing. **Etat perf : fonctionnel mais structurellement sous-optimal.** Toute l'app (vitrine comprise) est rendue dynamiquement a chaque requete a cause du layout racine, aucune page n'est servie depuis le CDN ; s'y ajoutent des N+1 dans les crons, des findMany non bornes agreges en JS, et zero code splitting cote bundle. Les risques majeurs sont d'abord juridiques (engagements RGPD non tenus, public mineur, sanction CNIL aggravee), puis de scalabilite/cout serveur.

## 2. RGPD — bloquants avant ouverture publique (CONFIRMES)

### 2.1 La purge irreversible a J+30 n'est jamais executee
- **Severite :** critical
- **Emplacement :** `src/lib/soft-delete/user.ts:186-225` ; `vercel.json:1-6` ; `src/lib/actions/account.ts:22-23`
- **Preuve :** `purgeExpiredSoftDeletes(graceDays=30)` est definie (hard-delete + nettoyage Storage sur 4 buckets) mais n'a **aucun appelant** dans tout le depot. `vercel.json` ne declare que 2 crons (`sessions-reminder`, `community-digest`) ; aucune route `/api/cron/purge*`. Le code le marque TODO (`account.ts:22`, `user.ts:21`, `schema.prisma:76`). Pourtant la charte (`charte/page.tsx:138`), le registre (`registre-traitements.md:62,79,106`) et l'email de suppression presentent la purge comme effective. Nuance : le soft-delete anonymise immediatement le PII critique (email, nom, image, passwordHash, OAuth), mais `birthYear` n'est pas efface et les corps de posts/commentaires/messages + lignes de profil soft-deletees subsistent indefiniment.
- **Recommandation :** Creer `/api/cron/purge-soft-deletes` protegee par `isAuthorizedCronRequest`, appelant `purgeExpiredSoftDeletes(30)`, declaree dans `vercel.json` (quotidien) + alerte sur echec. A defaut immediat, corriger charte/registre/email.
- **Effort :** M

### 2.2 Sentry et Session Replay charges sans consentement
- **Severite :** critical
- **Emplacement :** `sentry.client.config.ts:8-44` ; `src/components/WebVitalsReporter.tsx:37-69` ; `src/app/layout.tsx:157` ; `messages/fr.json:3443,3515`
- **Preuve :** `Sentry.init` s'execute inconditionnellement au top-level (seul garde-fou `enabled: Boolean(dsn)`), avec Session Replay actif (`replaysSessionSampleRate 0.01`, `replaysOnErrorSampleRate 1.0`). `WebVitalsReporter` envoie LCP/INP/CLS a Sentry a chaque page load, monte inconditionnellement, sans lire `useCookieConsent`. L'infra de consentement existe (`CookieConsentProvider`, categorie `analytics`) mais est ignoree. La page `/cookies` affirme « aucun cookie de profilage tiers » / « aucun cookie tiers » — factuellement faux. Aggravant : public mineur, ePrivacy Art. 82 / CNIL exigent un consentement prealable.
- **Recommandation :** Gater `Sentry.init` + WebVitals sur `consent.analytics` ; desactiver Session Replay par defaut (`replaysSessionSampleRate 0`) ; a minima declarer Sentry comme tiers sur `/cookies`.
- **Effort :** M

### 2.3 Mineures non exclues des audiences marketing Resend
- **Severite :** critical
- **Emplacement :** `src/lib/actions/newsletter.ts:39-54,99-141` ; `src/lib/community/weekly-digest.ts:69-73` ; `src/lib/email/resend-audiences.ts:53-86` ; `messages/fr.json:3203`
- **Preuve :** FAQ + charte promettent « aucun profilage publicitaire » pour les 15-17 ans ; l'age est connu (`User.birthYear`). Mais `resolveAudienceEmails` filtre `deletedAt`/`marketingEmailsEnabled`/`emailBouncedAt` et **jamais `birthYear`** ; idem weekly digest ; `addContactToAudience` ajoute tout email sans controle d'age. Les mineures recoivent campagnes et digests. Nuance : techniquement marketing direct / liste plutot que « profilage » Art. 4(4) — le titre surestime un peu, mais l'ecart code-vs-engagement est reel.
- **Recommandation :** Calculer `isMinor` depuis `birthYear` et exclure dans `resolveAudienceEmails` + `weekly-digest` ; attester l'age avant `addContactToAudience`.
- **Effort :** M

### 2.4 Authorship des contenus non anonymisee (handle/avatar conserves)
- **Severite :** high
- **Emplacement :** `src/lib/soft-delete/user.ts:91-99` ; `src/lib/community/feed-fetch.ts:70,95-99` ; `prisma/schema.prisma:824-827`
- **Preuve :** `softDeleteUser` efface les champs `User`, mais sur `CommunityMember` il ne pose **que** `deletedAt` (commentaire : « Leave handle + status intact … hard purge at J+30 strips it »). Or `handle`/`displayName`/`avatarUrl` sont des PII publiques rendues telles quelles par le feed. Aucune substitution « Compte supprime » n'existe en code (seulement promise dans email/DangerZone/charte, annoncee **immediate**). La purge J+30 n'etant jamais invoquee, le pseudo/avatar d'une mineure restent affiches publiquement de facon permanente.
- **Recommandation :** Anonymiser aussi `CommunityMember` dans la transaction `softDeleteUser` (`handle`->`deleted-<id>`, vider `displayName`/`avatarUrl`) OU filtrer/rendre « Compte supprime » dans `feed-fetch`. Ne pas dependre de la purge J+30 (engagement immediat).
- **Effort :** M

### 2.5 Les posts d'un compte soft-delete restent publiquement visibles
- **Severite :** high
- **Emplacement :** `src/lib/community/feed-fetch.ts:56-74`
- **Preuve :** `fetchCommunityFeedPage` filtre `status PUBLISHED` + channel mais **aucune** condition `author.deletedAt: null`. Le soft-delete ne change pas `Post.status` → les contenus d'un membre supprime restent affiches avec son vrai handle. Le chemin jumeau `search.ts:86` applique pourtant `AND m."deletedAt" IS NULL` — `feed-fetch.ts` est la deviation. Cumule avec 2.4.
- **Recommandation :** Ajouter `author.deletedAt: null` au `where` du feed (conformement a `search.ts`). Auditer de meme tous les lookups Post/Comment/Review/Mention (`ranker.ts`, `challenge-winners.ts`, vues thread/profil).
- **Effort :** M

## 3. RGPD — autres findings (NON VERIFIES — a confirmer)

- **3.1 [medium]** Suppression des comptes inactifs > 3 ans non implementee — pas de `lastLoginAt` sur `User` ni cron (`registre-traitements.md:62`). → ajouter `lastLoginAt` + cron, ou retirer la promesse.
- **3.2 [medium]** Aucune duree de conservation appliquee par traitement (notifs 90j/1an, contact 1an, sessions/messages 3 ans, audit 5 ans) — aucune purge applicative (`menteeRetentionYears` = reglage sans code). Art. 5.1.e. → jobs de purge par categorie dans le cron RGPD.
- **3.3 [medium]** Export Art. 15/20 incomplet (`src/lib/rgpd/export.ts`) — omet `birthYear`, 2FA, flags role/produit, l'objet `CommunityMember`, signalements/sanctions. → completer + distinguer Art. 15 / Art. 20.
- **3.4 [low]** `/community/admin/rgpd` rend les `.md` mais sans outil DSAR (recherche user, export tiers, file d'effacement, suivi du delai 30j non traces). → actions DSAR journalisees dans `AuditLog` ou runbook documente.

## 4. Performance — quick wins (impact eleve / effort S)

| Item | Emplacement | Gain | Effort |
|---|---|---|---|
| N+1 inbox messages : `.map(count)` -> un `groupBy(['mentorshipId'])` + take borne | `mentora/dashboard/messages/page.tsx:64-87` | -N requetes | S |
| Index `@@index([startedAt])` sur `Mentorship` + requete unique sur la plage | `schema.prisma:552-573` ; `mentora/admin/cycles/page.tsx:57-69` | scan->index | S |
| Index couvrant digest non-lus (`@@index([readByOtherAt, sentAt])`) + take borne | `unread-message-digest.ts:37-70` | scan->index | S |
| `<img>` -> `next/image` (remotePatterns deja OK) | `mentora/[slug]/page.tsx:173` ; `mentees/[handle]/page.tsx:333` ; `dashboard/profile/page.tsx:940` ; `posts/[id]/page.tsx:316` | WebP/AVIF, srcset, lazy | S |
| `width/height` + `loading=lazy` sur pieces jointes post (anti-CLS) | `posts/[id]/page.tsx:316-330` | CLS | S |
| Supprimer `revalidate` mort la ou `force-dynamic` (`/community/**`) | `community/page.tsx:9-10` (+6) | coherence | S |
| Supprimer code mort `logo-cloud-3.tsx` + `infinite-slider.tsx` (rend framer-motion retirable) | idem | -dependance | S |
| `next/dynamic(ssr:false)` les illustrations decoratives du login | `login/page.tsx` | -JS auth | S |

## 5. Performance — findings par theme

### 5.1 Base de donnees (Prisma) — CONFIRMES
- **[high] N+1 seriel cron weekly-digest** (`weekly-digest.ts:102-189`) : findMany membres non borne + 2N+ round-trips serie. → borner, charger groupe, `updateMany`. **L**
- **[high] N+1 seriel cron sessions-reminder** (`route.ts:60-86`) : findMany sans take + 2 notify (create + findUnique) + update par session en serie + fetch Resend serialise. → precharger emails `in:[]`, `createMany`, `updateMany`, lots `allSettled`. **L**
- **[high] mentora/admin : toutes les mentorships + reviews chargees, top-3 agrege en JS** (`mentora/admin/page.tsx:150-255`). → `groupBy`/`$queryRaw` LIMIT 3. **M**
- **[high] detail post : comments + reactions non bornes, comptage emoji en JS** (`posts/[id]/page.tsx:106-173`). → `groupBy(['emoji'])` + pagination commentaires. **M**
- *(non verifies)* analytics `take:20000` agrege JS ; N+1 feed connecte (count par channel) ; recommendMentors 200 profils relations non bornees.

### 5.2 Bundle client & images — CONFIRMES
- **[high] Zero code splitting** dans tout `src/` (aucun `next/dynamic`/lazy/Suspense). → dynamiser modals/wizards + lint. **M**
- **[high] gsap (CinematicFooter) sur ~24 pages publiques dont login** (`Frame.tsx:5,44`). → `dynamic(ssr:false)` derriere `!hideFooter`, ou footer RSC CSS. **M**
- **[high] framer-motion HeroParallax gate le LCP de l'accueil** (`HeroParallax.tsx` ; `page.tsx:115-126`). → parallax CSS/rAF, mascot LCP en SSR direct. **M**
- *(non verifie)* wizards monolithiques (1100-1539 l.) → split par etape + dynamic. **L**

### 5.3 Cache, revalidation, config
- **[high — CONFIRME] Le root layout force le rendu dynamique de TOUTE l'app** (`layout.tsx:77-92` ; `i18n/request.ts:55-72`) : `getLocale()` (cookies/headers) + `auth()` + `prisma.user.findUnique` dans le layout racine → toutes les routes filles (vitrine comprise) en SSR par requete, zero page CDN, `auth()` execute meme pour les anonymes. **Le plus gros levier perf.** → segment `[locale]` + `generateStaticParams`/`setRequestLocale` pour SSG/ISR de la vitrine, OU sortir `auth()`/prisma du layout racine + `revalidate`. **L**
- *(non verifies)* bundle i18n complet (~220 KB) serialise par page → `pick` par namespace ; `force-dynamic`+`revalidate` contradictoires `/community/**` ; `force-dynamic` cargo-culte (mentora public) ; WebVitals hors transaction (no-op) ; pas d'`optimizePackageImports` ; 3x Mascot3D autour du hero accueil.

## 6. Sequencement recommande

**Phase 0 — Bloquants legaux (avant TOUTE ouverture publique)** — les 5 findings confirmes de la §2, par ordre d'exposition :
1. **2.2** Gater Sentry/WebVitals sur le consentement + couper Session Replay (tracking tiers actif = infraction immediate visible).
2. **2.4 + 2.5** Anonymiser `CommunityMember` au soft-delete ET filtrer `author.deletedAt` dans le feed + tous les lookups (PII de mineures affichee publiquement).
3. **2.1** Cron `/api/cron/purge-soft-deletes` + alerte (effacement non tenu).
4. **2.3** Exclure les mineures (`isMinor` via `birthYear`) des audiences/digests.
- Mesure transitoire si une correction tarde : **corriger charte/registre/cookies/email** pour ne pas affirmer des garanties non implementees.

**Phase 1 — RGPD complementaire (§3, a verifier puis livrer)** : durees de conservation (3.2) + purge inactifs (3.1) dans le meme cron RGPD que 2.1 ; export Art. 15/20 complet (3.3) ; outillage DSAR + AuditLog (3.4).

**Phase 2 — Perf, plus gros levier** : decoupler la vitrine du layout dynamique (§5.3, `[locale]`/SSG-ISR).

**Phase 3 — Perf DB scalabilite** : crons N+1 + findMany non bornes.

**Phase 4 — Quick wins bundle/images (§4) + code splitting.**

**Phase 5 — Polish** : i18n par namespace, nettoyage force-dynamic/revalidate, Web Vitals, optimizePackageImports, LCP accueil.

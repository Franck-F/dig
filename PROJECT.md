# Digizelle — Documentation produit & technique

> Plateforme web de l'association loi 1901 **Digizelle**, dédiée à
> l'inclusion numérique des jeunes (en particulier les jeunes femmes) en
> Île-de-France et au-delà. Le site combine une **vitrine publique**, un
> **module de mentorat (Mentora)**, une **communauté en ligne** et un
> **back-office admin** dans une seule application Next.js.

---

## 1. Vision & promesse

Digizelle s'adresse à trois audiences :

| Audience | Ce qu'elle vient chercher |
|---|---|
| **Jeunes apprenantes** (mentorées) | Trouver un mentor, suivre des sessions, échanger en communauté, monter en compétence |
| **Mentors bénévoles** | Accompagner 1 à 5 mentorées, gérer leur agenda, partager des ressources |
| **Partenaires & visiteurs** | Découvrir l'association, ses programmes, ses événements, ses projets |

Le site doit faire les trois en restant **un seul produit cohérent** :
- côté public, c'est une vitrine premium ;
- côté connecté, c'est un SaaS de mentorat + plateforme communautaire.

---

## 2. Stack technique

| Couche | Technologie |
|---|---|
| Framework | **Next.js 16.2.4** — App Router, RSC, Server Actions, Turbopack |
| Runtime UI | **React 19** (Suspense, useTransition, useActionState) |
| Langage | **TypeScript strict** |
| Styling | Glassmorphism custom (`globals.css`), Tailwind 3 disponible mais peu utilisé |
| Base de données | **Postgres** (Supabase, pooled `DATABASE_URL` + `DIRECT_URL`) |
| ORM | **Prisma 6** (49 modèles) |
| Auth | **Auth.js v5 (NextAuth)** — JWT strategy + PrismaAdapter, providers credentials + Google + Discord + GitHub |
| Hash mot de passe / codes | bcryptjs |
| Validation | zod |
| i18n | **next-intl 4.11** (locale `fr`, namespaces dans `messages/fr.json`) |
| Email | **Resend** + fallback log si `RESEND_API_KEY` absent |
| Animations | GSAP + ScrollTrigger (footer cinétique) |
| Mascotte 3D | three.js / iframe-free, `Mascot3D` custom |
| Cookies / RGPD | `CookieConsentProvider` + bandeau persistant |
| SEO | JSON-LD (Organization, WebSite, CollectionPage, BreadcrumbList), `sitemap.ts`, `robots.ts`, `manifest.ts` |

---

## 3. Architecture des coquilles

L'application a **trois shells distincts** qui s'imbriquent selon la route et l'état de session.

### 3.1 `<Frame>` — Coquille publique
- Header sticky en glassmorphism + footer cinétique (motion-footer GSAP).
- Utilisé pour toutes les pages marketing et public-only.
- Le `<Header>` est **conscient de la session** via le context `SessionContextProvider` :
  - Connecté : pill « Mon espace » + avatar à droite, lien « Mentora » → `/mentora/dashboard`.
  - Anonyme : boutons « Connexion » + « Rejoindre ».

### 3.2 `<AppShell>` — Coquille connectée
- Sidebar 260 px à gauche (logo, switcher Mentora ↔ Communauté, nav par rôle, profile card en bas).
- Topbar 20 px de padding, sticky, avec titre + sous-titre, search input, badge notifications, bouton de déconnexion.
- Burger responsive < 960 px.
- Theme toggle ☀ / ☾ intégré.
- Server action `signOutAction` passée en prop.

### 3.3 `<OnboardingShell>` — Coquille onboarding
- Aside gauche 420 px en dégradé (violet/rose pour mentee, violet/navy pour mentor).
- Stepper vertical, mascotte 3D en bas, étape X/N.
- Topbar minimal avec barre de progression et bouton « Reprendre plus tard ».

### 3.4 Aiguillage automatique

| Route | Coquille |
|---|---|
| `/`, `/about`, `/programs`, `/team`, `/projects`, `/events`, `/blog`, `/contact`, `/mentora` (landing), `/mentora/discover`, `/mentora/[slug]`, `/login`, `/legal`, `/privacy`, `/cookies` | `<Frame>` |
| `/app` | Layout dédié (gradient hero, pas d'AppShell — c'est l'écran de choix d'univers) |
| `/community/**` | **Auto** : `<AppShell>` si session, `<Frame>` sinon (cf. `community/layout.tsx`) |
| `/mentora/dashboard/**` | `<AppShell>` mentor/mentee selon le rôle |
| `/mentora/admin/**` | `<AppShell>` admin (gated `role === 'ADMIN'`) |
| `/mentora/onboarding`, `/mentora/become-a-mentor` | `<OnboardingShell>` |
| `/community/onboarding` | Wizard interne (TODO : passer en `OnboardingShell`) |

---

## 4. Espaces & fonctionnalités

### 4.1 Vitrine publique

#### Page d'accueil `/`
Hero vidéo + manifeste, programmes phares, mentora teaser, témoignages, CTA newsletter, mascotte 3D animée.

#### `/about`, `/programs`, `/team`, `/projects`, `/events`, `/blog`, `/contact`
Pages éditoriales statiques avec animations GSAP, données soit hardcodées (équipe), soit en BDD (événements, articles).

#### `/mentora` (landing publique)
Vitrine du programme Mentora pour les visiteurs : mission, stats, CTA « Découvrir les mentors » → `/mentora/discover`.

#### `/mentora/discover`
Catalogue public de mentors avec filtres (compétences, séniorité, langues). Filtres URL pour partage.

#### `/mentora/[slug]`
Profil public d'un mentor : bio, expertises, stats, créneaux, bouton « Demander un mentorat » (gate auth).

#### `/community` (anonyme)
Landing communauté : hero, stats live (membres / posts / canaux), value props, showcase canaux, fil public en lecture seule + soft paywall.

---

### 4.2 Hub post-login `/app`

Premier écran après authentification. Salutation personnalisée, pill « connectée le … », deux **cartes univers** :

- **Mentora** — mascotte centrée, badge dynamique « N mentorats actifs », CTA → `/mentora/dashboard` (ou `/mentora/onboarding` si pas de profil).
- **Communauté** — constellation d'avatars, CTA → `/community`.

Bandeau **« Accès rapide »** 4 tuiles **alimentées par BDD live** :
1. Prochaine session (ou « Réserver une session »)
2. Notifications non lues
3. Canal communautaire suggéré
4. Événements (lien `/events`)

Si l'utilisateur a `role === 'ADMIN'` : pill **« ✦ Admin Mentora »** dans le header pointant sur `/mentora/admin`.

---

### 4.3 Mentora — Espace mentorée

`/mentora/dashboard` (vue par défaut quand `kind === 'mentee'`)

| Bloc | Contenu |
|---|---|
| KPI strip | Sessions cumulées, heures de mentorat, objectifs atteints, complétude profil |
| Prochaines sessions | Liste des 3 prochaines sessions confirmées avec mentor + bouton « Rejoindre » |
| Mes mentors | Cards avec avatar, métier, note, nb sessions, bouton « Message » |
| Parcours | Barres de progression sur les objectifs (4 max) |
| Recommandations IA | Card gradient « 3 mentors selon tes objectifs » → `/mentora/discover` |
| Messages récents | 3 derniers fils + badge non lu |
| Ressources partagées | Documents partagés par les mentors |

#### Sous-routes mentee
- `/mentora/dashboard/mentorships` — liste de tous les mentorats actifs / passés
- `/mentora/dashboard/mentorships/[id]` — page mentorat avec onglets : Sessions / Messages / Objectifs / Notes
- `/mentora/dashboard/sessions` — agenda complet
- `/mentora/dashboard/sessions/new` — proposer un créneau (slot picker)
- `/mentora/dashboard/sessions/[id]` — détail d'une session avec actions (rejoindre, annuler, replanifier)
- `/mentora/dashboard/messages` — messagerie type Slack DM
- `/mentora/dashboard/notifications` — centre de notifications
- `/mentora/dashboard/profile/edit` — éditeur de profil avec preview

---

### 4.4 Mentora — Espace mentor

`/mentora/dashboard` (vue par défaut quand `kind === 'mentor'`)

| Bloc | Contenu |
|---|---|
| KPI strip | Mentorées actives, sessions à venir, feedbacks à donner, note moyenne |
| Mes mentorées | Liste avec progression, badge « Réponse attendue » si urgent, filtres tabs (tous/actifs/en attente/terminés) |
| Activité récente | Timeline des derniers événements (envoi de portfolio, session terminée, ressources ajoutées…) |
| Cette semaine | Mini-agenda avec date / heure / nom de la mentorée |
| Card impact gradient | Heures de mentorat données, nombre de mentorées aidées, embauches, level-ups |

#### Sous-routes mentor (en plus de celles partagées)
- `/mentora/dashboard/availability` — éditeur de règles récurrentes + exceptions (vacances, blocages)
- `/mentora/dashboard/profile/edit` — bio, expertises, séniorité, langues, charte
- `/mentora/dashboard/requests` — demandes de mentorat reçues (accepter / refuser)

---

### 4.5 Mentora — Espace admin

`/mentora/admin` (gated `role === 'ADMIN'`).

| Bloc | Contenu |
|---|---|
| Phase strip | Cycle actif (ex: « Printemps 2026 »), barre de progression 4 phases |
| KPI 5 tiles | Mentors / Mentorées / Matching % / Sessions / Satisfaction |
| Sessions par mois | Bar chart 12 mois (`$queryRaw`) |
| État du matching | 4 status counters (Matchés / En cours / À examiner / Refus) + table top 5 matchings |
| Alertes | Candidatures incomplètes, mentors inactifs >30j, sondage mi-cycle |
| Top mentors | Top 3 par nb sessions + note moyenne |
| Communication | Card gradient pour newsletter / mailing |

Sous-route placeholder : `/mentora/admin/matching`.

---

### 4.6 Communauté connectée `/community/**`

Quand l'utilisateur est authentifié, **toutes** les routes `/community/**` sont enveloppées par `<AppShell>` (sidebar : Fil / Canaux / Membres / Défis / Favoris / Notifications).

#### Page `/community` (membre)
3 colonnes :
- **Gauche** : « Mes canaux » (liens) + tendances (#hashtags)
- **Centre** : Stories strip (canaux + bouton « Nouveau post ») → composer (ouvre `/community/posts/new`) → fil de posts
- **Droite** : carte gradient « N membres actifs » + Top contributeurs (top 5 sur 30j) + bookmarks

#### Sous-routes
- `/community/c/[slug]` — fil d'un canal spécifique
- `/community/posts/[id]` — détail post avec commentaires + réactions + bookmark + signalement
- `/community/posts/new` — composer riche (markdown, mentions, hashtags, sanitized via DOMPurify)
- `/community/posts/[id]/edit` — édition (auteur uniquement)
- `/community/members` — annuaire avec filtres
- `/community/members/[handle]` — profil public membre
- `/community/tag/[tag]` — posts par hashtag
- `/community/bookmarks` — posts sauvegardés
- `/community/notifications` — centre notifs
- `/community/onboarding` — wizard de création de profil community
- `/community/challenges` — liste des défis
- `/community/challenges/[id]` — détail + soumission + votes
- `/community/admin/**` — modération (channels / users / badges / reports)

---

### 4.7 Onboarding mentee `/mentora/onboarding`

5 étapes dans `<OnboardingShell>` (gradient violet/rose, mascotte) :
1. **Profil** — photo, prénom, nom, email, ville
2. **Parcours** — niveau actuel, expérience
3. **Objectifs** — objectif principal (premier job / reconversion / projet / montée en compétence) + domaines d'intérêt + objectif en 1 phrase
4. **Préférences** — type de mentor souhaité, formats préférés
5. **Disponibilités** — fréquence, créneaux hebdo (matrice jour × tranche), fuseau horaire → récap matching IA

À la finalisation : redirection vers `/mentora/dashboard` avec recommandations live.

---

### 4.8 Onboarding mentor `/mentora/become-a-mentor`

5 étapes dans `<OnboardingShell>` (gradient violet/navy) :
1. **Profil** — photo, prénom, nom, poste, entreprise, bio (≤280), LinkedIn, portfolio
2. **Expertises** — domaines (3 max), séniorité (Junior / Confirmé / Senior / Expert), profils mentorables (étudiantes, premier job, etc.), langues
3. **Engagement** — capacité (1-2 / 3-4 / 5+), durée session, format (visio / présentiel / mix), créneaux récurrents, engagement minimum 4 mois
4. **Charte mentor** — 5 principes (bienveillance, confidentialité, ponctualité, non-discrimination, bénévolat) + signature électronique
5. **Validation** — visio avec l'équipe Digizelle (planifiée ensuite)

---

## 5. Authentification & autorisation

### 5.1 Modes de connexion
- **Credentials** (email + mot de passe) avec **vérification par code 6 chiffres** envoyé par mail (TTL 10 min, max 5 tentatives, cooldown resend 60 s).
- **OAuth** : Google, Discord, GitHub (Apple écarté car payant).
- **Reset mot de passe** : code 6 chiffres avec même contrat sécurité que la vérif email.

### 5.2 Inscription
- Formulaire dans `/login` (onglet Inscription) → POST `signUp` server action → email avec code → modal de vérification → marqueur `emailVerified` posé.
- Après vérification : redirection vers `/login` (la connexion ne se fait pas auto).

### 5.3 Connexion
- Identifiants : `signIn` server action (`useActionState`) → succès → `router.push('/app')`.
- OAuth : `signInWithProvider(provider)` → `redirectTo: '/app'`.

### 5.4 Déconnexion
- Server action `signOut({ redirectTo: '/' })` exposée par toutes les coquilles connectées.

### 5.5 Gates
Définis dans [`src/auth.config.ts`](src/auth.config.ts) au niveau du middleware Edge :

```
isProtected =
  /dashboard | /admin |
  /app/** |
  /mentora/dashboard/** | /mentora/admin/** |
  /mentora/onboarding | /mentora/become-a-mentor |
  /community/onboarding | /community/posts/new |
  /community/posts/*/edit | /community/bookmarks |
  /community/settings | /community/notifications |
  /community/challenges/*/submit | /community/admin/**
```

Les rôles fins (`MENTOR` only sur availability, `ADMIN` only sur admin) sont vérifiés au niveau de la page (DB-aware, le middleware Edge ne peut pas lire la BDD).

### 5.6 SessionContextProvider
- `src/components/SessionContextProvider.tsx` — context client minimal hydraté server-side dans `app/layout.tsx`.
- Expose `{ isAuthenticated, name, initial, role, hasMentorProfile, hasMenteeProfile }` consommable depuis tout composant client.
- Évite le polling de `/api/auth/session`.

---

## 6. Modèle de données (Prisma)

### 6.1 Cœur identité
- `User` — id, email, passwordHash, name, role (`STUDENT`/`MENTOR`/`PARTNER`/`ADMIN`), emailVerified, accounts, profils
- `Account`, `VerificationToken` (Auth.js adapter)
- `VerificationCode` — codes 6 chiffres avec purpose (`EMAIL_VERIFICATION` / `PASSWORD_RESET`)

### 6.2 Mentora (15 modèles)
- `MentorProfile`, `MenteeProfile`
- `Skill`, `MentorSkill`, `MenteeGoalSkill`
- `MentorshipRequest`, `MentorshipRequestTopic`
- `Mentorship`, `MentorshipGoal`
- `AvailabilityRule`, `AvailabilityException`
- `Session` (status: SCHEDULED / IN_PROGRESS / COMPLETED / CANCELLED, format: REMOTE / IN_PERSON)
- `Review`, `MentorshipMessage`, `Notification`

### 6.3 Communauté (17 modèles)
- `CommunityMember` — handle, displayName, avatarUrl, status, isModerator
- `Channel`, `ChannelMembership`
- `Post`, `PostHashtag`, `PostTag`
- `Comment`, `Reaction`, `Bookmark`, `Mention`
- `Challenge`, `ChallengeSubmission`, `ChallengeVote`
- `Report`, `ModerationAction`
- `Badge`, `MemberBadge`

### 6.4 Site (vitrine)
- `ContactMessage` — formulaire de contact
- `NewsletterSubscriber` — inscriptions newsletter

### 6.5 Seed
[`prisma/seed.ts`](prisma/seed.ts) idempotent en deux passes : 30 Skills + 6 Channels + 10 Badges.

---

## 7. Server actions principales

| Domaine | Actions |
|---|---|
| Auth | `signIn`, `signUp`, `verifyEmailCode`, `resendVerificationCode`, `requestPasswordReset`, `confirmPasswordReset`, `signInWithProvider` |
| Mentora — onboarding | `submitMenteeOnboarding`, `submitMentorApplication` |
| Mentora — discovery | `recommendMentorsForMe`, `searchMentors`, `getFeaturedMentors` |
| Mentora — requests | `requestMentorship`, `acceptMentorshipRequest`, `declineMentorshipRequest` |
| Mentora — mentorships | `pauseMentorship`, `resumeMentorship`, `endMentorship` |
| Mentora — sessions | `proposeSession`, `confirmSession`, `rescheduleSession`, `cancelSession`, `markSessionCompleted` |
| Mentora — availability | `upsertAvailabilityRule`, `addAvailabilityException` |
| Mentora — messages / notes / goals | CRUD complet par onglet |
| Community — posts | `createPost`, `updatePost`, `deletePost`, `reactToPost`, `bookmarkPost` |
| Community — comments | `createComment`, `updateComment`, `deleteComment`, `reactToComment` |
| Community — challenges | `submitToChallenge`, `voteForSubmission` |
| Community — moderation | `reportContent`, `moderationAction`, `assignBadge` |
| Site | `submitContact`, `subscribeNewsletter` |

---

## 8. Internationalisation

- Locale unique pour l'instant : **`fr`**.
- Toute la copie est dans [`messages/fr.json`](messages/fr.json) (~3000 lignes).
- Namespaces principaux : `common`, `header`, `footer`, `home`, `about`, `programs`, `mentora`, `team`, `projects`, `events`, `blog`, `contact`, `login`, `community`, `app` (hub + shell), `legal`, `privacy`, `cookies`, `notFound`.

---

## 9. SEO & RGPD

### SEO
- Metadata par route via `generateMetadata`.
- JSON-LD : Organization + WebSite (root layout), CollectionPage + BreadcrumbList (community), Person (équipe), Event (événements), Article (blog).
- `sitemap.ts`, `robots.ts`, `manifest.ts`.
- OpenGraph + Twitter card images.

### RGPD
- `CookieConsent` component avec catégories (essentials / preferences / analytics / marketing).
- Pré-hydration script dans root layout pour éviter le FOUC sombre/clair seulement si consent preferences=true.
- Page `/cookies` éditoriale.
- Page `/privacy` éditoriale.

---

## 10. Setup local

```bash
# Prérequis : Node 20+, pnpm ou npm, accès à un Postgres (Supabase recommandé)

# 1. Variables d'environnement
cp .env.example .env
# remplir : DATABASE_URL, DIRECT_URL, AUTH_SECRET, RESEND_API_KEY (optionnel),
#          AUTH_GOOGLE_ID/SECRET, AUTH_DISCORD_ID/SECRET, AUTH_GITHUB_ID/SECRET (optionnels)

# 2. Dépendances
npm install

# 3. Base de données
npx prisma migrate dev    # crée la DB locale + applique migrations
npx prisma db seed        # peuple skills + channels + badges

# 4. Dev server
npm run dev               # http://localhost:3000

# 5. Type check
npx tsc --noEmit

# 6. Build prod
npm run build
npm start
```

### Comptes de test
Pas de seed par défaut pour les utilisateurs. Crée des comptes via `/login` → onglet Inscription :
- Pour tester l'admin : modifier manuellement en BDD `User.role = 'ADMIN'`.
- Pour tester un mentor / mentee : passer par les onboardings respectifs.

---

## 11. Conventions de code

- **Server components par défaut**, client components marqués `'use client'` uniquement quand nécessaire (hooks, événements, theme).
- **Server actions** dans `src/lib/actions/**`, namespace par domaine.
- **Database access** : toujours via `prisma` (depuis `src/lib/prisma.ts`), jamais d'instance locale.
- **Auth** : toujours via `auth()` (Node) côté pages, `auth().user.id` est la source de vérité.
- **Inline styles** acceptés (cohérent avec le système de design existant).
- **i18n** : pas de string FR hardcodée dans les composants, sauf dans les fichiers `_components/` éphémères.
- **Erreurs Prisma** : enrobées dans `safe()` (try/catch + fallback) quand le rendu doit toujours réussir.

---

## 12. État actuel

### ✅ Fait
- Vitrine publique complète (10+ pages)
- Auth complète (credentials + OAuth × 3 + verif email + reset password)
- Mentora end-to-end (15 modèles, 30+ server actions, onboardings mentee + mentor, dashboard par rôle, sessions, messages, ressources, notifications)
- Community end-to-end (17 modèles, feed, channels, posts, comments, reactions, bookmarks, hashtags, mentions, badges, modération, challenges)
- Hub post-login `/app`
- Espace admin Mentora
- 3 coquilles partagées (Frame / AppShell / OnboardingShell)
- Layouts auth-aware (community switche entre AppShell et Frame selon session)
- Header public conscient de la session
- i18n FR complet
- SEO + JSON-LD
- TypeScript strict, `tsc --noEmit` clean

### 🔄 En cours / à finir
- `/community/onboarding` à passer dans `<OnboardingShell>` pour cohérence visuelle
- Configuration des credentials OAuth (Google / Discord / GitHub) en env
- Tests E2E (rien pour l'instant)
- Migration Auth.js verification schema (`Account`, `VerificationToken`, `VerificationCode`)
- Locale `en` en option

### 🎯 Roadmap suggérée
1. **Auth en prod** — créer les apps OAuth, brancher les env vars, tester les 3 providers
2. **Données de démo** — seed users + mentorships + posts pour les démos investisseurs
3. **Notifications email** — relance auto sur invitations / sessions / messages (cron)
4. **Visio intégrée** — Daily.co ou Whereby pour les sessions
5. **Mobile app** (React Native ou PWA polish)
6. **Analytics RGPD-friendly** — Plausible ou Umami
7. **Newsletter** — pipeline Resend Audiences
8. **Challenges hackathon** — automatisation des votes + remise des prix

---

## 13. Glossaire

| Terme | Sens |
|---|---|
| **Mentora** | Module de mentorat 1-to-1 |
| **Mentorée** | Apprenante côté mentora |
| **Mentor** | Bénévole accompagnant 1-5 mentorées |
| **Cycle** | Promotion mentora (saisonnière, ex Printemps 2026) |
| **Matching** | Algorithme de couplage mentor ↔ mentorée (6 composantes pondérées) |
| **Session** | Rendez-vous unitaire entre mentor et mentorée |
| **Channel** | Canal communautaire thématique |
| **Post** / **Comment** / **Reaction** / **Bookmark** | Briques sociales standard |
| **Challenge** | Défi communautaire avec soumissions et votes |
| **Badge** | Récompense attribuée automatiquement ou manuellement |

---

## 14. Référents techniques

| Sujet | Fichier de référence |
|---|---|
| Auth (config Edge) | [`src/auth.config.ts`](src/auth.config.ts) |
| Auth (full Node) | [`src/auth.ts`](src/auth.ts) |
| Schéma BDD | [`prisma/schema.prisma`](prisma/schema.prisma) |
| Server actions auth | [`src/lib/actions/auth.ts`](src/lib/actions/auth.ts) |
| Server actions mentora | [`src/lib/actions/mentora/**`](src/lib/actions/mentora) |
| Server actions community | [`src/lib/community/**`](src/lib/community) |
| Coquille publique | [`src/components/Frame.tsx`](src/components/Frame.tsx) + [`Header.tsx`](src/components/Header.tsx) + [`motion-footer.tsx`](src/components/motion-footer.tsx) |
| Coquille connectée | [`src/components/app-shell/AppShell.tsx`](src/components/app-shell/AppShell.tsx) |
| Coquille onboarding | [`src/components/app-shell/OnboardingShell.tsx`](src/components/app-shell/OnboardingShell.tsx) |
| Context session | [`src/components/SessionContextProvider.tsx`](src/components/SessionContextProvider.tsx) |
| Hub post-login | [`src/app/app/page.tsx`](src/app/app/page.tsx) |
| Layout community auth-aware | [`src/app/community/layout.tsx`](src/app/community/layout.tsx) |
| Dispatcher /community | [`src/app/community/page.tsx`](src/app/community/page.tsx) |
| Dashboard mentora | [`src/app/mentora/dashboard/layout.tsx`](src/app/mentora/dashboard/layout.tsx) + `_components/{MentorOverview,MenteeOverview}.tsx` |
| Admin mentora | [`src/app/mentora/admin/`](src/app/mentora/admin) |
| i18n FR | [`messages/fr.json`](messages/fr.json) |

---

*Doc rédigée le 5 mai 2026. Mettre à jour à chaque évolution structurelle (nouveau module, nouvelle coquille, refonte routage).*

---
title: Audit multi-agents — digizelle-webapp-public
date: 2026-06-22
method: Audit multi-agents read-only (fan-out par dimension + vérification adversariale)
branch: design/page-positioning (WIP non commité inclus dans le périmètre)
---

# Métadonnée d'audit

**Méthode.** Fan-out d'agents spécialisés en **lecture seule**, un par dimension, puis
**vérification adversariale** : chaque finding *critical/high* a été relu par un second
agent chargé de le **réfuter** en lisant le code réel (par défaut `isReal=false` si non
confirmé). Seuls les findings confirmés sont marqués comme tels ; les findings medium/low
n'ont **pas** été vérifiés et sont étiquetés *(non vérifié)*.

**Statistiques.**

| Métrique | Valeur |
|----------|--------|
| Findings totaux remontés | 49 |
| Findings haute-priorité vérifiés | 16 |
| **Confirmés** (réels, code relu) | **15** |
| Réfutés (faux positifs éliminés) | 1 |
| Non vérifiés (medium/low) | 33 |

> ⚠️ **Couverture incomplète — 5 dimensions sur 7.**
> Deux finders ont échoué en cours d'exécution (*API Error: Stream idle timeout*) :
> - **Performance & bundle** — non couvert
> - **Conformité RGPD** — non couvert
>
> Les dimensions **Sécurité, Code, Architecture, Design/UX, Accessibilité** sont
> complètes. Les aspects RGPD apparaissent **indirectement** via la sécurité (IDOR
> exposant des PII de mentees, export CSV PII) mais **aucun audit RGPD dédié** (rétention,
> consentement, mineurs, droits d'accès/export/suppression) n'a été réalisé. Ces deux
> dimensions sont à relancer pour une couverture complète.

---

# Audit digizelle-webapp-public

## 1. Resume executif

La base de code est globalement soignee et reflechie : decoupage par domaines (mentora / community / account), server-actions systematiquement gatees, validation zod, sanitization markdown stricte (marked + DOMPurify), webhook Resend signe (Svix), CSRF/headers de securite complets et `.env` non commite. L'audit a neanmoins confirme **15 findings haute-priorite** repartis sur les 5 dimensions. Les risques majeurs : deux failles de securite exploitables (2FA brute-forcable sans rate-limit, IDOR exposant le profil complet de toute mentee a n'importe quel mentor auto-promu), deux bugs de concurrence (depassement de capacite mentor, double-notification de challenge), une fuite d'enumeration d'emails, une injection de formule CSV, et un pattern de gestion d'erreurs qui masque toute panne en `unauthorized` (et l'invisibilise dans Sentry). Cote architecture/design : inversion de dependance lib->app, absence de couche d'acces aux donnees (86 fichiers Prisma directs), god-components de 1100-1545 lignes, et plusieurs echecs WCAG AA bloquants sur tout le perimetre public (pas de `<main>`/skip link, menu mobile sans piege de focus, contrastes insuffisants).

## 2. Quick wins (impact eleve / effort S, a faire en premier)

| # | Finding | Dimension | Emplacement |
|---|---------|-----------|-------------|
| 1 | Injection de formule CSV dans l'export admin (prefixer `=+-@\t\r`) | Securite / Code | `api/admin/mentora/reports/export/route.ts:50-57` |
| 2 | `handleError` mappe toute erreur inattendue en `unauthorized` + pas de Sentry | Code | `actions/community/_helpers.ts:133-138` ; `actions/mentora/_helpers.ts:114-118` |
| 3 | Absence de `<main>` + skip link dans `Frame` (toutes pages publiques) | Accessibilite | `components/Frame.tsx:23-29` |
| 4 | Menu mobile `role=dialog` sans `useFocusTrap` (le hook existe deja) | Accessibilite | `components/Header.tsx:147-226` |
| 5 | Contraste `--ink-muted #8b91ad` = 3.11:1 (< 4.5:1) — simple token | Accessibilite | `design-system.css:83` |
| 6 | CTA "Decouvrir" : 3/4 couleurs sous 4.5:1 sur fond blanc | Accessibilite | `app/page.tsx:298-319` |
| 7 | Export CSV admin (PII) hors gate cookie 2FA — ajouter `hasFreshAdmin2faCookie` | Securite | `api/admin/mentora/reports/export/route.ts:288-310` |
| 8 | Gradient-text aplati globalement (dead code / classe trompeuse) | Design | `design-system.css:2302-2311` |

## 3. Findings priorises par dimension

### Securite applicative

**[HIGH] Aucun rate-limit sur la verification TOTP et les codes de secours (2FA brute-forcable)** — `actions/two-factor.ts:133-200, 225-278, 290-327` — `verifyTotpChallenge` appelle `verifyTotp`/`compare(code, backupHash)` sans aucun `checkAuthRateLimit`, compteur d'echecs ni lockout (grep = 0 match). Un code TOTP a 10^6 combinaisons avec fenetre temporelle ; toute session authentifiee peut marteler `/account/2fa/challenge` pour franchir le second facteur d'un compte ADMIN/moderateur/mentor. Le limiter Upstash existe mais n'est jamais branche sur le flux 2FA, qui est pourtant la surface a plus fort privilege. — *Reco* : rate-limit dedie keye sur userId (ex. 5 essais / 15 min + lockout), compteur `failedTotpAttempts`/`lockedUntil` persiste, verifie AVANT `verifyTotp` ; appliquer aussi a `disableTotp`/`regenerateBackupCodes` ; logger en audit/Sentry. — **Effort M**

**[HIGH] IDOR : tout MENTOR peut lire le profil complet de n'importe quelle mentee** — `app/mentora/mentees/[handle]/page.tsx:133-211` — apres le gate de role, `prisma.user.findUnique({ where: { id: handle }, include: { menteeProfile: { include: { goalSkills } } } })` ou `handle` est l'userId cible. Aucune verification d'une `Mentorship` entre le viewer et la mentee : `viewerMentorProfileId` ne scope que le bloc "historique avec moi", mais objectifs, defis, competences, langues, localisation, timezone et stats globales sont charges/affiches inconditionnellement. Le role MENTOR est auto-attribuable en self-service (`actions/welcome.ts` confirmAccess ecrit `role='MENTOR'` sans validation admin), donc tout nouveau compte peut enumerer les donnees personnelles RGPD de toutes les mentees via l'URL. — *Reco* : verifier l'existence d'une `Mentorship`/`MentorshipRequest` viewer<->mentee AVANT de charger `menteeProfile`, sinon `notFound()` ; acces large reserve a ADMIN. — **Effort M**

**[MEDIUM] CSP en Report-Only par defaut avec `script-src 'unsafe-inline'`** — `next.config.ts:75-92, 117-122` — `cspEnforce = process.env.CSP_ENFORCE === '1'` et `.env.example:116` livre `CSP_ENFORCE=""` -> Report-Only en prod tant que non flippe ; `script-src` garde `unsafe-inline` sans nonce. En Report-Only une injection echappant a DOMPurify s'executerait sans filet. — *Reco* : basculer `CSP_ENFORCE=1` apres fenetre d'observation, planifier le retrait d'`unsafe-inline` via nonce middleware ; documenter/alerter si la prod sert encore Report-Only. — **Effort M**

**[MEDIUM] Formulaire de contact public sans rate-limit ni anti-spam** — `actions/contact.ts:21-74` — `submitContact()` fait `prisma.contactMessage.create()` + envoi Resend sans `checkAuthRateLimit`, honeypot ni captcha (contrairement a `signUp`). `replyTo` est controle par l'attaquant. Surface de DoS applicatif et de relais de spam au cout d'un POST anonyme. — *Reco* : rate-limit par IP/email (bucket `contact`), honeypot comme `signUp`, plafonner taille/frequence. — **Effort S**

**[MEDIUM] `allowDangerousEmailAccountLinking` actif sur les 3 providers OAuth** — `auth.ts:68-94` — Google/GitHub/Discord lient automatiquement un compte OAuth a un compte credentials des que l'email correspond. Discord peut renvoyer un email non verifie selon les cas : un attaquant creant un compte OAuth avec l'email d'une victime prendrait le controle sans mot de passe. — *Reco* : conserver le linking auto uniquement pour Google/GitHub, exiger `account.email_verified === true` pour Discord (ou etape de confirmation avant fusion). — **Effort S**

**[MEDIUM] Export CSV admin (PII) protege par role mais pas par le gate cookie 2FA** — `api/admin/mentora/reports/export/route.ts:288-310` — verifie session + `role === 'ADMIN'` mais n'appelle pas `hasFreshAdmin2faCookie()`. Une session ADMIN au cookie 2FA expire ne peut pas voir la page Rapports mais peut `GET .../export?kind=mentees` et exfiltrer emails/noms/commentaires/objectifs (jusqu'a 5000 lignes), court-circuitant la step-up 2FA. — *Reco* : ajouter `hasFreshAdmin2faCookie(userId)` sur ce handler (et tout `/api/admin/*`). — **Effort S**

**[LOW] Rate-limiters auth/2FA en fail-open + fallback in-memory non partage entre instances** — `rate-limit/auth-limiter.ts:160-186, 38-76` — `checkUpstashWindow()` retourne `{ ok: true }` des que Redis est injoignable ; sans Upstash le fallback Map est par-instance, donc la limite est multipliee par le nombre d'instances Vercel. Combine au 2FA sans limite, la posture anti-brute-force depend entierement d'Upstash. — *Reco* : rendre Upstash obligatoire en prod (echec boot/alerte), fail-closed borne pour les actions a haut privilege. — **Effort S**

**[LOW] Regex mentions/hashtags dupliquees manuellement dans le sanitizer** — `community/sanitizer.ts:22-27` — `MENTION_REGEX`/`HASHTAG_REGEX` copies depuis `mentions.ts`/`hashtags.ts` avec un commentaire "mirror the change here". Une divergence future pourrait ouvrir un point d'injection markdown/lien non couvert. — *Reco* : centraliser les regex dans un module pur unique, ou ajouter un test d'egalite des sources. — **Effort S**

### Correction du code & gestion d'erreurs

**[HIGH] `handleError` mappe toute erreur inattendue sur `unauthorized` (echec silencieux trompeur)** — `actions/community/_helpers.ts:133-138` ; `actions/mentora/_helpers.ts:114-118` — apres `console.error`, le catch-all retourne `err('unauthorized')` / `{ error: 'mentora.errors.unauthorized' }` pour TOUTE erreur non typee. Utilise dans 24 fichiers d'actions (9 catch dans `posts.ts` seul). Une panne DB / bug / erreur Prisma se presente a l'utilisateur comme une erreur d'auth (invitation a se reconnecter), et ces erreurs reelles ne remontent jamais a Sentry (seulement `console.error`) — invisibles en prod. — *Reco* : code d'erreur generique distinct (`serverError`/`unexpected`), reserver `unauthorized` aux vraies erreurs d'auth, et `Sentry.captureException` dans `handleError`. — **Effort S**

**[HIGH] Race condition de capacite : un mentor peut depasser `maxConcurrentMentees`** — `actions/mentora/requests.ts:128-177` — `acceptMentorshipRequest` lit le count des mentorships ACTIVE HORS transaction (`toMentor._count.mentorships`, l.114-130) puis cree/active le `Mentorship` dans `$transaction` SANS re-comptage interne. L'unicite `@@unique([mentorProfileId, menteeProfileId])` ne dedoublonne que la meme paire, pas la capacite totale ; aucun `isolationLevel` (PostgreSQL READ COMMITTED par defaut). Deux accepts quasi-simultanes voient le meme count perime et depassent la limite. `sendMentorshipRequest` (l.40-55) a le meme schema. — *Reco* : re-compter via `tx.mentorship.count()` DANS la transaction + throw `capacityReached`, idealement avec verrou de ligne / compteur atomique. — **Effort M**

**[HIGH] `pickWinnersAndAnnounce` sans garde de statut : notifications en double** — `actions/community/admin/challenges.ts:236-278` — la fonction ne charge jamais le challenge ni ne verifie son statut ; la transaction fait `challenge.update({ where: { id } })` (par id seul, pas `updateMany` conditionnel sur `status:'VOTING'`). Appelee par le cron (`route.ts:118`) ET `closeChallengeManually` (l.214) : une course admin/cron re-emet le fan-out `CHALLENGE_RESULT` (l.267-272, hors transaction, sans dedup) pour chaque auteur. *Nuance* : le volet "badges en double" est FAUX — `evaluateBadges` est idempotent (index unique + skip-if-existing). — *Reco* : early-return si `status==='CLOSED'`/`resultsAnnouncedAt!=null`, ou `updateMany({ where:{ id, status:'VOTING' } })` et fan-out seulement si `count===1`. — **Effort M**

**[HIGH] Fuite d'enumeration d'emails dans `requestPasswordReset` via le rate-limiter** — `actions/auth.ts:520-534` + `rate-limit/auth-limiter.ts:204-240` — le commentaire l.522-523 ("the limiter only ticks for valid emails") est FAUX : `checkAuthRateLimit` incremente le bucket email inconditionnellement AVANT le `findUnique` (l.527). De plus le chemin couteux (issueCode -> `bcrypt.hash(code,10)` + `sendEmail` reel) ne s'execute que si `user && user.passwordHash` : pour un compte inexistant, retour immediat sans bcrypt ni I/O. Timing + livraison d'email = deux canaux lateraux distinguant les comptes, defaisant l'intention "always success". — *Reco* : corriger le commentaire ; neutraliser le timing (travail equivalent meme si user absent, ou envoi async systematique). — **Effort M**

**[HIGH] Injection de formule CSV dans l'export admin** — `api/admin/mentora/reports/export/route.ts:50-57` — `csvCell` gere l'echappement RFC 4180 mais ne neutralise pas les cellules commencant par `= + - @` (ni TAB/CR). Champs user-controlled exportes tels quels : `userName`/emails (l.66-70), `review.comment`, `mentor.headline`, `mentee.goals`. Un mentee mettant `=HYPERLINK(...)`/`=cmd|'/c calc'` en prenom voit la formule s'executer a l'ouverture du CSV (BOM UTF-8 + `Content-Type text/csv` -> Excel) par un admin. — *Reco* : prefixer d'une apostrophe toute cellule dont le 1er caractere est `=+-@\t\r`, dans `csvCell` pour couvrir tous les `kind`. — **Effort S**

**[MEDIUM] Drainer d'emails : re-query par `lockedAt: now` fragile** *(non verifie)* — `email/queue.ts:111-135` — apres le claim `updateMany`, relecture par egalite stricte sur le timestamp `lockedAt: now` ; toute troncature de precision de la colonne DateTime ferait que `toProcess` reste vide alors que `claimed > 0` -> emails reclames (SENDING) jamais envoyes jusqu'a expiration du lock 5 min. — *Reco* : relire par `claimToken` (uuid dedie) ou par `id+status SENDING` sans la clause `lockedAt: now`. — **Effort M**

**[MEDIUM] Rate-limit Upstash depend de `EXPIRE ... NX` (Redis 7+) ; sinon cle sans TTL = blocage permanent** *(non verifie)* — `rate-limit/upstash.ts:103-119` — le pipeline `INCR` + `EXPIRE key win NX` n'est jamais lu pour `EXPIRE` ; sur Redis < 7 `NX` echoue/est ignore, la cle reste sans TTL, le compteur ne se reinitialise jamais -> rate-limit permanent une fois la capacite atteinte. — *Reco* : `EXPIRE` sans `NX` quand `INCR === 1`, ou verifier le retour `EXPIRE` ; documenter la dependance Redis >= 7.0. — **Effort S**

**[MEDIUM] `createPost` : double-decrement du token rate-limit POSTS_5MIN quand POSTS_DAILY echoue** *(non verifie)* — `actions/community/posts.ts:72-75` + `community/rateLimit.ts:81-83` — `consume()` decremente a chaque appel ; si POSTS_5MIN passe mais POSTS_DAILY est epuise (ou erreur apres consommation : channel notFound, forbidden, sanitization...), le credit 5min est perdu pour une creation inexistante. Meme schema dans `toggleReaction`. — *Reco* : peek les deux buckets avant de decrementer, ne consommer qu'au succes (juste avant commit). — **Effort M**

**[LOW] `verifyEmailCode`/`confirmPasswordReset` : limite effective de 6 au lieu de 5 (off-by-one)** *(non verifie)* — `actions/auth.ts:434-448 ; 572-585` — `if (updated.attempts > MAX_CODE_ATTEMPTS)` avec compteur partant de 0 : le verrou ne se declenche qu'au 6e essai. Mineur cote securite mais ecart avec l'intention. — *Reco* : utiliser `>= MAX_CODE_ATTEMPTS`. — **Effort S**

**[LOW] `expirePendingRequests` : notifications partielles non transactionnelles** *(non verifie)* — `actions/mentora/requests.ts:314-334` — `updateMany` passe les requetes a EXPIRED, puis la boucle de notification ; si un `notify()` throw, les requetes restantes sont deja EXPIRED mais ne seront jamais re-balayees (cron filtre sur PENDING) -> notifications perdues silencieusement. — *Reco* : decoupler la stamp EXPIRED de l'envoi (`Promise.allSettled`) ou reprise via `notifiedAt`. — **Effort M**

**[LOW] `GET /api/mentora/messages` : mark-as-read fire-and-forget sur serverless** *(non verifie)* — `api/mentora/messages/route.ts:75-86` — `updateMany` lance sans `await` avec `.catch` vide ; sur Vercel la fonction peut etre gelee avant resolution -> point "non lu" non vide de facon non deterministe. — *Reco* : `await` avant la reponse, ou `waitUntil()`. — **Effort S**

**[LOW] `postSessionReview` : aucune mise a jour de l'agregat de note du mentor** *(non verifie)* — `actions/mentora/reviews.ts:61-79` — cree le Review sans mettre a jour de compteur/moyenne agrege (contrairement au pattern denormalise systematique ailleurs). Risque d'incoherence si l'UI affiche un champ agrege. — *Reco* : confirmer la presence d'un `ratingAvg`/`ratingCount` ; si oui, recalculer dans la transaction du create. — **Effort M**

### Architecture & frontieres de modules

**[HIGH] Inversion de dependance : `src/lib` importe vers le haut dans `src/app`** — `lib/community/feed-fetch.ts:4` ; `lib/actions/community/feed-load-more.tsx:5` — `feed-fetch.ts` fait `import type { PostCardData } from '@/app/community/_components/PostCard'` (type defini dans le composant de presentation) et `feed-load-more.tsx` fait un import VALEUR de `PostCard` puis retourne un `ReactNode` pre-rendu depuis une server action. La couche logique est donc couplee a l'UI/i18n : impossible de tester/reutiliser sans tirer tout l'arbre de rendu. (Seules 2 occurrences `@/app/` dans tout `src/lib` — violation reelle mais localisee.) — *Reco* : definir `PostCardData`/`RankedPost` dans `lib/community` comme source de verite et faire que `PostCard` l'importe ; `feed-load-more` doit renvoyer un DTO, pas du JSX. — **Effort M**

**[HIGH] Absence de couche d'acces aux donnees : 86 fichiers appellent Prisma en direct** — `src/app/**` (ex. `mentora/admin/page.tsx:2`, `mentora/dashboard/profile/page.tsx:4`, `community/admin/audit-log/page.tsx`) — les RSC construisent leurs requetes inline (~16 `prisma.*` en `Promise.all` dans `admin/page.tsx`, ~20 dans `profile/page.tsx`) en parallele de la logique de requete des `actions/*`. La meme entite `MentorProfile` est lue avec 3 formes de `select`/`include` divergentes (`profile-queries.ts:18`, `admin/mentors/page.tsx:57`, `discovery.ts:149`) ; aucun dossier `queries/`/`loaders/`. `ARCHITECTURE.md` ne documente que les mutations. — *Reco* : loaders read-only par domaine (`lib/community/queries/*`, `lib/mentora/queries/*`), bannir l'import direct de `@/lib/prisma` dans les pages, centraliser les `select`/`include` partages. — **Effort L**

**[HIGH] God-components RSC : pages de 1100-1545 lignes melant fetch, metier et rendu** — `mentora/dashboard/profile/page.tsx (1545)` ; `become-a-mentor/MentorApplicationWizard.tsx (1539)` ; `onboarding/OnboardingWizard.tsx (1381)` ; `settings/_components/TwoFactorCard.tsx (1153)` ; `mentora/admin/page.tsx (1150)` — `profile/page.tsx` melange fetch Prisma (2 `Promise.all` de 8-9 requetes brutes), derivation metier (initiales, completude, badges derives, paliers de seniorite) et rendu complet (88 blocs `style={{}}` inline). Son entete documente une derive spec<->schema (`company`, `seniority`, `charterSignedAt`... absents du schema Prisma). Les wizards sont des composants client monolithiques portant tout l'etat multi-etapes. — *Reco* : extraire la derivation vers des helpers purs (`lib/mentora`), les sous-sections en composants enfants, le fetch vers un loader ; decouper les wizards par etape. Cible < 300 lignes/page. — **Effort L**

**[MEDIUM] Dette d'accretion : shims de re-export et types dupliques** *(non verifie)* — `actions/mentora/discover.ts` ; `community/search-query.ts` + `search.ts` ; `mentora/_helpers.ts` vs `actions/_shared.ts` — `discover.ts` est un pur shim re-exportant `discovery.ts` ; `normaliseQuery` a une chaine de triple re-export ; `ActionResult`/`successResult`/`requireUser` sont definis deux fois. Trahit un assemblage par specs/partitions divergees. — *Reco* : harmoniser sur un seul nom (`discovery`), collapser la chaine `normaliseQuery`, faire que `mentora/_helpers` reutilise `_shared`. — **Effort M**

**[MEDIUM] `ARCHITECTURE.md` desynchronise de la realite du code** *(non verifie)* — `ARCHITECTURE.md` vs `package.json`, `i18n/routing.ts`, `src/app/app/`, `lib/access/product-access.ts` — i18n decrit comme `fr` seul alors que `routing.ts` declare `['fr','en']` ; tout le hub `/app` + `/welcome/role` + `product-access` (coeur de la nav connectee) n'est pas documente. — *Reco* : mettre a jour la section i18n bilingue et ajouter la surface `/app` au diagramme de routes et au gating. — **Effort S**

**[MEDIUM] Split-brain du styling : `design-system.css` massif vs 663 hex de marque inline** *(non verifie)* — `design-system.css` (2544 lignes) ; `src/app/**/*.tsx` (663 litteraux `#7301FF`/`#A34BF5`/`#F46FB1`) — deux systemes coexistent : changer un token de marque exige un grep-replace sur des centaines de sites au lieu d'une variable CSS. — *Reco* : definir les couleurs de marque en variables CSS, bannir les hex inline via lint, migrer progressivement. — **Effort L**

**[LOW] Server action retournant un arbre React + `handleError` masquant les erreurs** *(non verifie)* — `feed-load-more.tsx:25` ; `_helpers.ts:133/114` — variante des findings d'inversion de dependance et de `handleError` ci-dessus (frontiere action devenue canal de rendu UI serialise + catch-all `unauthorized`). — *Reco* : renvoyer des DTO, ajouter un code `unexpected`/`serverError` distinct. — **Effort S**

**[LOW] Composants partages a plat : `src/components` melange providers, animation, PWA, domaine** *(non verifie)* — `src/components/` (racine plate) — providers, effets/animation, PWA, chrome de page et composants quasi-domaine (login) coexistent a plat ; frontiere "transverse" floue. — *Reco* : regrouper par preoccupation (`providers`, `motion`, `pwa`, `layout`), deplacer le specifique-login sous `src/app/login/_components`. — **Effort M**

### Design visuel & coherence du design system

**[HIGH] Gradient-text aplati globalement : contredit l'usage reel (71 occurrences) ET DESIGN.md** — `design-system.css:2302-2311` ; usages `app/page.tsx:78,155,355,385,445,557` + 37 autres fichiers — le polish pass force `.dz-grad-text, .dz-shimmer-text { background:none; -webkit-text-fill-color: var(--brand-violet); animation:none }`, neutralisant 71 emphases gradient/shimmer (38 fichiers) en violet plat. *Nuance* : cet override IMPLEMENTE en realite DESIGN.md:257 ("the wordmark is the only sanctioned gradient") plutot qu'il ne le viole ; le vrai defaut est du dead code / un nom de classe trompeur (severite plus proche de medium). — *Reco* : trancher conformement a la charte — supprimer ces classes des pages et les remplacer par une emphase explicite (`.dz-emph` violet uni), OU reserver le gradient au seul wordmark. Faire un seul choix visible dans le markup. — **Effort M**

**[MEDIUM] Classes utilitaires referencees sans definition de base CSS** *(non verifie)* — `app/page.tsx:69,92,116,145/200,164,63` — `dz-hero-grid`, `dz-hero-proof`, `dz-hero` n'ont aucune regle globale (`dz-manifest-card`/`dz-manifesto` seulement en `<style>` inline, `dz-hero-mascot` seulement en media query) : le layout tient entierement sur les inline-styles JSX, les classes etant des hooks vides. Le layout casse silencieusement si on retire l'inline-style. — *Reco* : definir ces classes dans `design-system.css` (porter le grid/gap en CSS) ou les supprimer. — **Effort M**

**[MEDIUM] Mismatch de nommage : le CSS cible `.dz-hero-stats` mais la page utilise `.dz-hero-proof`** *(non verifie)* — `design-system.css:1882-1884` vs `app/page.tsx:92` — les regles `.dz-hero-stats` (responsive hero) ne matchent aucun element rendu (CSS mort) ; le gap mobile retombe sur une regle generique. — *Reco* : renommer pour aligner CSS et markup. — **Effort S**

**[MEDIUM] Pas de composants de design system reutilisables : tout passe par classes + inline-styles dupliques** *(non verifie)* — `app/page.tsx:212-326, 376-433, 604-645` ; aucun `Card.tsx`/`Button.tsx`/`EmptyState.tsx` — chaque carte/bouton/chip est reconstruit en inline-style, ce qui force ~300 lignes d'attribute-selectors `[style*="..."]` pour le dark/responsive (fragile : `#ffffff` -> `#FFFFFF` casse le theme). — *Reco* : extraire 3-4 primitives React (Card, Eyebrow, Chip, EmptyState) consommant les tokens, migrer les pages a fort trafic. — **Effort L**

**[MEDIUM] Etats vides incoherents et sans identite de marque** *(non verifie)* — `community/members/page.tsx:172-175` (bare `<p>`) vs `community/notifications/page.tsx:181-183` (`.dz-card` centre) — deux traitements visuels pour le meme concept, sans icone/mascotte alors que la marque repose sur les mascottes. Aucun composant `EmptyState`. — *Reco* : creer `<EmptyState icon|mascot title body action>` et l'utiliser partout. — **Effort M**

**[LOW] DESIGN.md decrit l'elevation/glass de facon contradictoire** *(non verifie)* — `DESIGN.md:187-234` (flat) vs `:3` (frosted glass) — l'intro vend "frosted violet glass" mais les sections 4-5 et le CSS final imposent le flat ; un lecteur de l'intro reintroduira du glass par erreur. — *Reco* : aligner intro/frontmatter sur la decision finale (flat, glass reserve aux overlays chrome). — **Effort S**

**[LOW] Tokens d'espacement DESIGN.md non exposes en variables CSS** *(non verifie)* — `DESIGN.md:61-67` vs `design-system.css:6-91` — l'echelle (xs..hero) est documentee mais `:root` ne definit aucune `--space-*` ; tous les espacements sont des nombres magiques inline, l'echelle n'est pas enforceable et derive. — *Reco* : exposer `--space-xs..--space-hero` dans `:root` et les consommer. — **Effort M**

**[LOW] Headings inline (`fontSize: 38/56/76`) hors systeme `.dz-h*`, non fluidifies** *(non verifie)* — `app/page.tsx:251` + ~13 fichiers — titres inline ne beneficiant ni du clamp ni du letter-spacing du systeme, avec `fontWeight 800` absent de l'echelle DESIGN.md ; figes sur tablette/desktop. — *Reco* : remplacer par `.dz-h1/.dz-h2`, aligner `fontWeight` sur 700. — **Effort S**

### Accessibilite (WCAG) & i18n

**[HIGH] Aucun landmark `<main>` ni lien d'evitement dans `Frame` (pages publiques + accueil)** — `components/Frame.tsx:23-29` ; `app/page.tsx:51-647` — `Frame` rend `<Header/>{children}<CinematicFooter/>` sans `<main>` ni skip link ; l'accueil empile des `<section>` sans element englobant. 25 routes publiques (about, team, programs, events, blog, faq, contact, legal...) sont concernees. `<main>` n'existe que dans `AppShell`/`community`/`account`, hors de la chaine `Frame`. Echec WCAG 2.4.1 (A) et 1.3.1 (A). — *Reco* : envelopper `{children}` dans `<main id="main-content" tabIndex={-1}>` + skip link (`.dz-sr-only`/`:focus`) en debut de page, libelle i18n. — **Effort S**

**[HIGH] Menu mobile (`role=dialog aria-modal`) sans piege ni gestion du focus** — `components/Header.tsx:147-226` (panel) ; burger `132-142` — le panneau porte `role="dialog" aria-modal="true"` mais le composant n'importe pas `useFocusTrap` (seul un listener Escape) : focus reste sur le burger, Tab sort vers le contenu masque, pas de restitution a la fermeture. Le hook `useFocusTrap` existe et est deja utilise par 12 fichiers (dont `RequestMentorshipModal`, `CookieConsent`). Le burger utilise `aria-label={t('ariaNav')}` (meme libelle que la nav) et n'a pas `aria-controls`. Echec 2.1.2/2.4.3/4.1.2. — *Reco* : `useFocusTrap` sur le panel + `aria-label` dedie (`header.openMenu`, la cle existe deja) + `aria-controls`. — **Effort S**

**[HIGH] Couleur de texte secondaire `--ink-muted (#8b91ad)` sous 4.5:1** — `design-system.css:83`, `:532` (.dz-small), `:752` (.dz-stat .lbl) ; `app/page.tsx:133` — `#8b91ad` sur blanc = 3.11:1, ~2.77:1 sur le wash `#f6efff`. Utilise pour `.dz-small` (14px), labels de stats (14px), bandeau partenaires (12px). A 14px ce n'est pas du grand texte -> minimum 4.5:1. Echec 1.4.3. Mode sombre OK (`#948cb8` passe). — *Reco* : assombrir le token vers ~`#61667f` (~5.65:1 sur blanc). Simple changement de token. — **Effort S**

**[HIGH] Boutons CTA "Decouvrir" des cartes programmes : texte couleur sur pastille blanche sous 4.5:1** — `app/page.tsx:298-319` (`color: p.color`) ; couleurs `:24-27` — sur fond blanc `rgba(255,255,255,0.95)` : atelier `#F46FB1` = 2.71:1, hackathon `#3B7BFF` = 3.84:1, masterclass `#A34BF5` = 4.30:1 (marginal) — 3/4 echouent 1.4.3 pour du texte 13px gras (pas du grand texte). Seul mentora `#24325F` passe. — *Reco* : pour le texte du bouton, imposer une couleur de marque assez foncee (ex. `var(--brand-violet)` = 6.61:1) ; reserver `p.color` aux elements decoratifs/larges. — **Effort S**

**[MEDIUM] Animations infinies non neutralisees sous `prefers-reduced-motion`** *(non verifie)* — `design-system.css:436-437,202-204,177,1445,1502` ; `app/page.tsx:227` (dzFloat inline) — la media query reduce ne cible que quelques classes ; restent actives `dz-pulse`, `dz-orbit-*`, `dz-float-blob`, `dz-shimmer`, `dz-app-bg` et le `dzFloat` inline du robot (non desactivable par CSS). Echec 2.3.3 (AAA), risque vestibulaire 2.2.2. — *Reco* : etendre le bloc reduce a ces animations, retirer le `dzFloat` inline au profit d'une classe. — **Effort M**

**[MEDIUM] 87 cles EN manquantes retombant en francais sans `lang="fr"`** *(non verifie)* — `messages/en.json` vs `messages/fr.json` ; `i18n/request.ts:24-46` — FR=3080 cles, EN=2999 (97,2%), 87 absentes concentrees sur home (45) et mentora (42). Le `deepMerge` substitue le FR sans `<span lang="fr">` : un lecteur d'ecran EN lira du francais avec la prosodie anglaise sur l'accueil (faq/events/testimonials). Echec 3.1.2 (A). — *Reco* : completer les cles EN prioritaires, entourer le contenu FR irreductible de `lang="fr"`, controle CI qui echoue si EN diverge. — **Effort M**

**[MEDIUM] Textes en dur non traduits dans le Header ("Mon espace")** *(non verifie)* — `components/Header.tsx:101,120,212` — 3 occurrences litterales "Mon espace" (bouton desktop, aria-label, bouton mobile) au lieu d'une cle next-intl ; reste en francais pour un visiteur EN. Echec 3.1.2. — *Reco* : `t('myArea')` pour le texte et l'aria-label. — **Effort S**

**[MEDIUM] `LocaleSwitcher` : contraste du libelle au repos (#9aa0b5) tres insuffisant** *(non verifie)* — `components/LocaleSwitcher.tsx:46` — `#9aa0b5` sur header clair = 2.48:1 pour un texte 11px ; le composant ne s'ancre qu'au hover/focus, donc l'etat par defaut echoue 1.4.3. — *Reco* : relever la couleur par defaut a >= 4.5:1 (ex. `#5b6178`). — **Effort S**

**[MEDIUM] Groupes de boutons-choix sans semantique de groupe ni etat selectionne** *(non verifie)* — `contact/ContactForm.tsx:76-89` ; `RequestMentorshipModal.tsx:236-251` — listes de `<button>` avec style different pour l'actif mais sans `aria-pressed`/`role=radiogroup` : un lecteur d'ecran ne sait pas lequel est selectionne (info purement visuelle). Incoherence : le picker de sujets de la meme modale utilise correctement `aria-pressed`. Echec 1.3.1/4.1.2. — *Reco* : `aria-pressed` (toggle) ou `role=radiogroup`/`radio`+`aria-checked`+navigation fleches. — **Effort S**

**[LOW] Formatage des nombres force en `fr-FR` quelle que soit la locale** *(non verifie)* — `components/AnimatedNumber.tsx:71` — `n.toLocaleString('fr-FR')` code en dur ; un utilisateur EN voit les separateurs francais sur les stats hero. — *Reco* : `useLocale()` + `n.toLocaleString(locale)`. — **Effort S**

**[LOW] Banniere cookies : `role=dialog` avec `aria-live` mais sans `aria-modal` ni gestion de focus** *(non verifie)* — `components/CookieConsent.tsx:145-149` — dialog non modal sans deplacement de focus = melange de patterns (la modale de preferences, elle, est exemplaire). — *Reco* : passer la banniere en `role="region" aria-label=...` (aria-live conserve), ou lui donner un vrai comportement modal. — **Effort S**

**[LOW] FAQ accueil : indicateur "+" decoratif ne refletant pas l'etat ouvert/ferme** *(non verifie)* — `app/page.tsx:563-588` — `<details>/<summary>` natif (accessible, bon point) mais le "+" ne pivote pas a l'ouverture (pas de regle `details[open] summary span`). Mineur (la semantique native porte l'etat). — *Reco* : `details[open] summary .indicator { transform: rotate(45deg) }`. — **Effort S**

## 4. Sequencement recommande

**Phase 0 — Securite exploitable (immediat).** Traiter d'abord les deux failles activement exploitables : le **rate-limit 2FA** (TOTP/backup brute-forcables sur la surface a plus fort privilege) et l'**IDOR mentees** (fuite de PII RGPD a tout compte auto-promu MENTOR). Y joindre les deux quick wins securite a effort S a fort ratio : **injection CSV** et **gate cookie 2FA sur l'export CSV**. Ces quatre items ferment les vecteurs d'attaque concrets.

**Phase 1 — Quick wins observabilite & A11y (semaine 1).** Corriger **`handleError`** (effort S, debloque tout le diagnostic prod via Sentry et arrete de tromper l'utilisateur) en premier car il conditionne la detection de tous les autres incidents. Puis la grappe d'accessibilite a effort S qui couvre tout le perimetre public : **`<main>`/skip link dans `Frame`**, **focus trap du menu mobile**, **contrastes** (`--ink-muted`, CTA "Decouvrir", `LocaleSwitcher`). Fort impact utilisateur, risque de regression faible.

**Phase 2 — Bugs de concurrence & coherence (semaine 2-3).** **Race condition de capacite** et **`pickWinnersAndAnnounce`** (effort M chacun) : transformer les check-then-act en operations atomiques/idempotentes dans la transaction. Y inclure la **fuite d'enumeration `requestPasswordReset`** et les durcissements securite medium (CSP enforce, rate-limit contact, OAuth Discord). Verifier en parallele les findings *non verifies* a fort impact (drainer d'emails, EXPIRE NX, double-decrement rate-limit) avant de les corriger.

**Phase 3 — Refactoring structurel (fond, planifie).** Les chantiers a effort L : introduire la **couche d'acces aux donnees** (loaders read-only par domaine) — prerequis qui facilite ensuite le decoupage des **god-components** et resout l'**inversion de dependance** lib->app. En parallele cote design, extraire les **primitives React** (Card/Button/EmptyState) pour eteindre le split-brain du styling et les etats vides incoherents, puis trancher le cas **gradient-text** (dead code). Mettre a jour **`ARCHITECTURE.md`** et **DESIGN.md** en fin de phase pour refleter la realite. Ces items sont de la dette de maintenabilite : a sequencer apres la securite et l'a11y, mais a ne pas reporter indefiniment car ils conditionnent la velocite future.

---

## Dimensions non couvertes (à relancer)

- **Performance & bundle** — finder interrompu (timeout). À relancer : taille de bundle, RSC vs client, `next/image`, requêtes Prisma (N+1, index), cache/revalidation, Web Vitals.
- **Conformité RGPD dédiée** — finder interrompu (timeout). À relancer : confrontation `docs/rgpd/` ↔ code (rétention, consentement, mineurs, droits d'accès/export/suppression, cookies, bounces email).

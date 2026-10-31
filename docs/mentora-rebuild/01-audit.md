# Mentora : audit (état du code au 2026-10-30, branche main)

Périmètre : `src/app/mentora/**`, `src/lib/mentora/**`, `src/lib/actions/mentora/**`, `src/components/app-shell/**`, modèles Prisma Mentora, `src/app/api/mentora`, `src/app/api/admin/mentora`, `src/app/api/cron`, namespace `mentora` de `messages/*.json`, `design-system.css`.

Méthode : lecture du code + scripts Node en lecture seule (liens, i18n, métriques, tailles de bundle). Aucune base de données contactée, aucune migration, pas de serveur dev. Tout ce qui n'a pas pu être vérifié est marqué **non vérifié**.

Sévérités : **bloquant** (donnée fausse, flux cassé, faille ou casse en production), **majeur** (flux dégradé ou incohérence visible), **mineur** (dette, confort).

## 0. Résumé exécutif

Mentora n'est pas mal codé ligne à ligne : les actions serveur ont un schéma zod, des contrôles de propriété (membre du mentorat) et des tests sur le matching et le scheduling pur. L'impression d'amateurisme vient de problèmes systémiques :

1. Les parcours bout en bout ont des trous (statuts jamais écrits, états jamais affichés, emails jamais formatés, erreurs jamais traduites).
2. Aucune machine à états ni couche domaine : chaque action ré-implémente ses gardes, d'où transitions incohérentes et courses.
3. L'interface est faite de styles inline copiés/collés (1 530 occurrences) et de helpers dupliqués (21 fonctions `initials/fullName/displayName`).
4. Les réglages admin (capacité, fenêtre de candidature, rétention) et les cycles sont décoratifs : rien ne les applique.

## 1. Bugs fonctionnels et flux cassés

### 1.1 Bloquants

**B1. Les emails transactionnels partent bruts (clés i18n qui ne correspondent pas).**
`src/lib/mentora/notifications.ts:26` construit la clé `notifications.emails.REQUEST_RECEIVED` ; `messages/fr.json` contient `mentora.notifications.emails.requestReceived` (camelCase) avec les variables `{recipientName}`, `{senderName}`, alors que le code passe `name`, `requestId`, etc. (`notifications.ts:75-85`). Résultat : sujet de repli `[Mentorat] REQUEST_RECEIVED` et corps `Type: REQUEST_RECEIVED` suivi du JSON. Vérifié par script : les clés `notifications.emails.<TYPE>.subject` n'existent ni en fr ni en en pour les 7 types envoyés par mail (REQUEST_RECEIVED, REQUEST_ACCEPTED, REQUEST_DECLINED, SESSION_SCHEDULED, SESSION_REMINDER, SESSION_CANCELLED, MENTOR_APPROVED). De plus la langue de l'email est celle de l'acteur (`getTranslations` dans l'action de l'expéditeur) et non celle du destinataire, et `scheduledAt` est passé en ISO UTC brut.

**B2. Les erreurs serveur ne sont jamais traduites : l'utilisateur lit `mentora.errors.capacityReached`.**
`src/lib/actions/mentora/_helpers.ts:43` renvoie `mentora.errors.<code>` ; le namespace `mentora.errors` n'existe pas dans `messages/*.json` (script : 0 clé). Les composants affichent la chaîne telle quelle : `_components/RequestMentorshipModal.tsx:121-122,298`, `dashboard/requests/RequestActions.tsx:205-216`. Toute erreur métier (doublon, capacité, créneau pris, statut invalide) apparaît comme un identifiant technique.

**B3. Toute erreur inattendue est présentée comme "unauthorized".**
`_helpers.ts:122`. Combiné à B2 et B4, une panne de base ou une contrainte unique ressemble à un problème de droits. Le commentaire du code reconnaît que c'est provisoire.

**B4. Contrainte unique `(fromMenteeId, toMentorId, status)` : un second refus, retrait ou expiration vers le même mentor fait planter l'action.**
`prisma/schema.prisma:544`. Après une demande DECLINED, le mentee peut renvoyer une demande (seul PENDING est contrôlé, `requests.ts:60`). Si elle est refusée à nouveau, l'`update` vers DECLINED viole l'unicité (P2002), l'action tombe dans B3 et le mentor lit "unauthorized". Idem pour WITHDRAWN et EXPIRED ; dans `expire-requests.ts:32` un `updateMany` : une seule violation annule tout le lot du cron. La contrainte voulait empêcher les doublons PENDING ; il faut un index unique partiel `WHERE status = 'PENDING'`.

**B5. `adminApproveMentor` écrase le rôle de l'utilisateur par MENTOR, y compris un ADMIN.**
`profile.ts:522` : `data: { role: 'MENTOR' }` sans condition. Un admin qui candidate comme mentor perd son rôle ADMIN à l'approbation. Le rôle est une valeur unique (UserRole : STUDENT, MENTOR, PARTNER, ADMIN, schema.prisma:151) alors que mentor, mentee et admin se cumulent ; un PARTNER est écrasé aussi.

**B6. Un candidat mentor en attente ne voit jamais son état.**
`src/lib/mentora/getCurrentRoleProfile.ts:108` : `kind: 'mentor'` seulement si `role === 'MENTOR'`, rôle posé uniquement à l'approbation. Après le wizard, `become-a-mentor/MentorApplicationWizard.tsx:459` redirige vers `/mentora/dashboard?tab=profile&pending=1` ; aucun fichier ne lit `tab` ni `pending` (grep). Le candidat tombe sur le dashboard mentee ou sur la carte codée en dur "Créez votre profil pour commencer" (`dashboard/page.tsx:~40`). Aucun écran "candidature en revue / refusée (reviewNote) / à compléter".

**B7. `completeSession` notifie le mentee avec `REVIEW_RECEIVED`.**
`sessions.ts:235`. Le mentee reçoit "Vous avez reçu un avis" quand le mentor clôture la séance. Il manque un type `SESSION_COMPLETED` / `REVIEW_REQUESTED` : le mentee n'est jamais invité à laisser un avis.

**B8. États jamais écrits : cycle de vie incomplet.**
`IN_PROGRESS`, `NO_SHOW` (Session) et `TERMINATED` (Mentorship) ne sont écrits nulle part (grep : lectures et affichages uniquement). Une séance passée reste `SCHEDULED` tant que le mentor ne clique pas "terminer" ; sinon pas d'avis possible (`reviews.ts` exige COMPLETED), statistiques de séances fausses (`discovery.ts:380`), badges et rapports admin faux. Aucune action ne met fin à un mentorat (seul `completeMentorship`, réservé au mentor) : le mentee ne peut pas clore.

**B9. Double réservation possible.**
`scheduleSession` (`sessions.ts:30-143`) : lecture des règles et séances puis `session.create` (`:89`) sans transaction ni contrainte d'exclusion ; deux réservations concurrentes du même créneau passent. Aussi : seules les séances `SCHEDULED` du mentor bloquent (`:67`), les conflits côté mentee ne sont pas vérifiés, un mentorat `PAUSED` peut réserver (seuls COMPLETED/TERMINATED sont rejetés, `:43`).

**B10. `reactivateMentor` contourne la validation ; `suspendMentor` est cosmétique.**
`moderation.ts:84-112` : tout statut différent de ACTIVE passe à ACTIVE (`:99`), y compris DRAFT et PENDING_REVIEW, sans `publishedAt` ni rôle MENTOR. `suspendMentor` ne touche ni les mentorats actifs, ni les séances à venir, ni les demandes PENDING, et ne notifie personne ; le mentor suspendu garde l'accès au dashboard et à la messagerie.

### 1.2 Majeurs

- **M1. Capacité vérifiée hors transaction.** `acceptMentorshipRequest` (`requests.ts:~120-130`) compte les mentorats ACTIVE avant la transaction ; deux acceptations simultanées dépassent `maxConcurrentMentees`. Idem à l'envoi (`:56`).
- **M2. Demande expirée encore acceptable** jusqu'au passage du cron quotidien : `expiresAt` n'est jamais comparé à `now` à l'acceptation. Pas de contrôle du statut du mentor (un mentor SUSPENDED peut accepter) ni de `deletedAt`.
- **M3. Auto-mentorat possible.** `sendMentorshipRequest` ne vérifie pas `mentor.userId !== ctx.userId` (un utilisateur avec les deux profils peut se demander lui-même) ni l'existence d'un mentorat ACTIVE/PAUSED.
- **M4. Objectifs dupliqués et texte anglais codé en dur.** Chaque thème de la demande devient un `MentorshipGoal` de description `Topic from initial request` (`requests.ts:168`), recréé à chaque ré-acceptation. Les objectifs ne peuvent pas être supprimés depuis l'UI (`deleteMentorshipGoal` jamais importé).
- **M5. Cycles et réglages programme décoratifs.** `Cycle` n'est lu et écrit que par les pages admin, sans lien avec Mentorship/Session. `MentoraProgrammeSettings` (capacityMin/Max, applicationOpensAt/ClosesAt, menteeRetentionYears, require2faAdmin, matchingDimensions) n'est lu que par la page de réglages (`platform-settings.ts:117,174`, `admin/settings/page.tsx:108`) : aucune application. Aucune purge de rétention RGPD n'existe alors que l'UI promet 3 ans.
- **M6. Actions admin sans 2FA.** Seul `admin/layout.tsx:41-50` impose TOTP. `cycles.ts:37`, `moderation.ts:40`, `profile.ts:506,541`, `requests.ts:280` vérifient seulement le rôle ADMIN : une action serveur peut être invoquée sans passer par le layout. L'export CSV, lui, vérifie le cookie 2FA.
- **M7. 2FA du dashboard mentor** (`dashboard/layout.tsx:55-70`) imposé aux mentors ACTIVE avec réutilisation du cookie `dz-admin-2fa` : couplage non documenté, et `require2faAdmin` des réglages n'est pas branché dessus.
- **M8. Notifications de cycle de vie manquantes.** Pause, reprise, clôture de mentorat, objectifs, notes partagées : aucune notification. `NEW_MESSAGE` crée une `Notification` par message (pas de regroupement), sans email ; le digest cron 24-48 h compense en partie.
- **M9. Rappels de séance.** Cron quotidien à 09:00 UTC (`vercel.json`), fenêtre 48 h (`api/cron/sessions-reminder/route.ts:46`) : une séance réservée après l'exécution pour le jour même n'est jamais rappelée ; rappels envoyés aussi pour mentorats terminés ; `stampFailures` quasi mort car `notify` ne lève jamais. Tout (rappels, expiration, digest, drain de la file d'emails) tient dans une seule requête : **non vérifié** si la durée max suffit.
- **M10. Fuseaux horaires.** `dashboard/_components/format.ts:8-26` et `dashboard/sessions/page.tsx:123-125` créent des `Intl.DateTimeFormat` en fr-FR sans `timeZone`, dans des composants serveur : l'heure affichée est celle du serveur (UTC sur Vercel, **non vérifié** si `TZ` est défini), pas celle du viewer ni du mentor. Concerné : `sessions/[id]/page.tsx:87`, mentorships, overviews. Seul `SlotPicker.tsx:292` (client) formate dans le fuseau du navigateur. `AvailabilityRule.timezone` (snapshot) n'est jamais lu : changer le fuseau du profil décale silencieusement toutes les disponibilités. `dayBucket` (`format.ts:~45`) utilise aussi le fuseau serveur. Le moteur `scheduling.ts` (DST, calcul par jour dans le fuseau du mentor) est correct.
- **M11. Découverte.** (a) filtre `format` validé mais jamais appliqué (`discovery.ts:61`) ; (b) `minRating` appliqué après la pagination (`:337-338`) : pages incomplètes, `total` faux ; (c) la branche Prisma n'exclut pas `deletedAt` (seul le SQL brut le fait, `:190,205`) ; (d) `recommendMentorsForMe` charge 200 profils avec compétences, mentorats et tous les avis pour en afficher 20 (`:358-366`) ; (e) la moyenne des notes passe par un `groupBy` par mentorat puis un `findMany` de tous les mentorats.
- **M12. Photos en data-URI en base** (jusqu'à ~1 Mo côté mentor, `profile.ts:~26` ; ~800 Ko côté mentee, `:391`), renvoyées dans chaque liste (`MentorCard`, JSON-LD `[slug]/page.tsx:147`, admin). Poids potentiel de plusieurs Mo par page de découverte (non mesuré ; calcul théorique 12 profils par page). La photo mentee n'est pas validée par `validateImageDataUri`, contrairement au mentor.
- **M13. Profil "public" non public.** `[slug]/page.tsx:75` redirige vers `/login` ; le "slug" est le `userId` (`discovery.ts:495`), exposé dans les URLs. `force-dynamic` (`:18`) rend inopérants les `revalidatePath` sur `/mentora/` + userId (`reviews.ts:78`) et interdit cache et SEO. Attente produit côté landing : **non vérifié**.
- **M14. URLs non restreintes.** `linkedinUrl` (`profile.ts`), `meetingUrl` (`sessions.ts:26`) et `attachmentUrl` (`messages.ts:18`) utilisent `z.string().url()` qui accepte `javascript:` ; rendus dans des `href` (`sessions/[id]/page.tsx:102`). À restreindre à http(s) ; exploitabilité **non vérifiée**. Un profil ACTIVE peut aussi être modifié sans re-modération (`updateMentorProfile`, `profile.ts:104-133`).
- **M15. Candidature mentor.** `submitMentorApplication` (`profile.ts:186`) accepte des créneaux sans contrôle fin supérieure au début (`availability.ts` le fait) et ignore en silence les slugs inconnus. Aucun appel à `submitMentorForReview` dans le wizard (appelé uniquement depuis `MentorProfileForm.tsx:171`) : **à vérifier par e2e** si le wizard fait passer le profil de DRAFT à PENDING_REVIEW. Sinon la file d'approbation admin ne voit jamais les candidats du wizard, ce qui serait bloquant.
- **M16. Lien mort.** Le bouton de modification d'une ressource pointe vers `/mentora/dashboard/resources/<id>/edit` (`resources/page.tsx:489`), route inexistante (404). Un script a vérifié tous les liens statiques `/mentora/**` contre les 28 pages : c'est le seul lien cassé.

### 1.3 Mineurs

- `reviews.ts` : garde `selfReview` inatteignable ; l'avis n'est pas lié à un mentorat actif.
- `completeSession` et `cancelSession` sans contrôle temporel (on peut terminer une séance future) ; `cancelSession` ne vérifie pas le statut du mentorat.
- `requireMentor` et `requireMentee` jamais utilisés ; `requireMentor` et `requireMentorOwner` identiques (`_helpers.ts:65-82`).
- `addAvailabilityException` : date non validée (un 45 du 14e mois déborde via `Date.UTC`) ; `hourlyRate` toujours accepté alors que le produit est bénévole (`profile.ts:49`).
- `nudgePendingMentorshipRequests` : jusqu'à 200 notifications en boucle séquentielle, renvoie "unauthorized" sur tout échec.
- Fichiers de ré-export de 2 à 24 lignes : `current-profile.ts`, `discover.ts`, `mentor-skills.ts`, `mentor-profile.ts`, `mentee-profile.ts`. `upsertMenteeProfile` est un alias de `updateMenteeProfile` (deux noms pour une action).
- Build local : `npm run build:ci` compile en 39 s puis échoue au typecheck sur `.next/dev/types/routes.d.ts:64` (artefact d'un ancien `next dev`, ignoré par git). **Non vérifié** que la CI soit touchée ; supprimer `.next/dev` avant build.

## 2. Autorisations : qui peut lire et écrire quoi

Bien fait : `requireMentorshipMember` protège messages, séances, objectifs, avis ; `GET /api/mentora/messages` vérifie l'appartenance ; `mentorNotesPrivate` est écrit par le mentor seul ; `mentee-access.ts` (testé) règle l'accès aux fiches mentee.

À corriger :
- `requireUser` (`_helpers.ts:51-62`) ne contrôle ni `deletedAt` ni compte bloqué, et relit le rôle en base à chaque action (2 requêtes minimum par action).
- Un mentor SUSPENDED garde le rôle MENTOR : accès dashboard, fiches mentee, messagerie (B10).
- `GET /api/mentora/messages` fait une écriture (marquage lu) sur un GET et plafonne à 500 messages sans pagination.
- Lecture de `mentorNotesPrivate` côté mentee : la page de séance charge le champ ; **non vérifié** qu'il n'est jamais sérialisé vers un composant client. À couvrir par test.
- Les actions admin n'exigent pas le 2FA (M6) ; pas de garde unique `requireAdmin` (implémentations séparées dans `cycles.ts:37`, `moderation.ts:40`, et inline dans `profile.ts` et `requests.ts`).

## 3. Incohérences

### 3.1 Logique dupliquée

- **Shell/layout en 4 copies.** `dashboard/layout.tsx` (458 lignes), `discover/layout.tsx` (255), `[slug]/layout.tsx` (227), `admin/layout.tsx` (123) refont chacun la même séquence : auth, rôle, notifications (count + 5 dernières), traductions, nav, initiales, `<AppShell>`. Divergence réelle : le compteur de non-lus est limité aux types Mentora dans `dashboard/layout.tsx:82` et `discover/layout.tsx:58`, mais pas dans `[slug]/layout.tsx:56` ni `admin/layout.tsx:53`. Le badge de la cloche n'affiche donc pas le même nombre selon la page. `AppShell.tsx` (779 lignes) et `OnboardingShell.tsx` (364) sont deux shells distincts.
- **Helpers d'affichage recopiés** : 21 définitions de `initialsFor/initials/fullName/displayName` dans `src/app` et `src/lib` (ex. `admin/matching/page.tsx:42,49`, `admin/mentees/page.tsx:62,69`, `dashboard/sessions/page.tsx:27`, `dashboard/messages/page.tsx:12`, `mentees/[handle]/page.tsx:21,28`).
- **Statut vers libellé en 4 endroits** : `dashboard/sessions/page.tsx:21`, `dashboard/sessions/[id]/page.tsx:160`, `_tabs/SessionsTab.tsx:96`, `_components/StatusPill.tsx:20`.
- **Formatage de dates** : `format.ts` (fr-FR figé, sans fuseau), `Intl.DateTimeFormat` locaux dans `sessions/page.tsx:123`, `SlotPicker.tsx:292`, `messages/page.tsx:29` et une quinzaine d'autres fichiers. Aucun ne lit la locale active de next-intl : l'interface EN affiche des dates FR.
- **Trois implémentations de la garde admin** (section 2) et deux cloches de notifications (`app-shell/NotificationsBell.tsx` et `dashboard/notifications/NotificationBell.tsx`, cette dernière morte).
- **Complétion de profil** : une seule formule (`lib/mentora/home.ts:75,93`, testée), correcte ; les pages admin recalculent leurs propres pourcentages (`admin/page.tsx:32`, `admin/reports/page.tsx:93`).

### 3.2 Nommage et copy

- **Mentee en français** : `mentorée` 20 occurrences, `mentoré` 46, `mentee` 25, `binôme` 3 dans `messages/fr.json`. Aucune règle de terminologie : choisir un terme (recommandation en 02-architecture).
- **Rôles** : `UserRole` unique alors que les profils sont indépendants (`MentorProfile`, `MenteeProfile`) ; le code mélange `role`, `kind` (`getCurrentRoleProfile`) et présence de profil. Le dashboard dispatche sur `kind`, d'autres écrans sur `role`.
- **i18n** : namespace `mentora` = 1 196 clés fr, 1 169 en ; 27 clés fr sans équivalent en (ex. `profile.pageTitle`, `profile.edit`, `profile.viewPublic`, `profile.completeness`). 83 clés dont le nom de feuille n'apparaît nulle part dans `src` (estimation prudente de clés mortes : surtout `dashboard.home`, `becomeAMentor.step4`, `*.feedback`). Environ 101 lignes de texte français codé en dur dans 21 fichiers de `app/mentora` et `app-shell` (plus lourds : `admin/reports/page.tsx` 15, `resources/new/ResourceForm.tsx` 13, `mentees/[handle]/page.tsx` 10, `admin/matching/page.tsx` 9, `admin/page.tsx` 9, `NewsletterCampaignModal.tsx` 9, `AppShell.tsx` 4, `dashboard/layout.tsx` 4) ; `dashboard/page.tsx` en contient aussi. Un texte anglais est écrit en base (M4).
- **Erreurs d'actions** : deux conventions. `_helpers.ts` renvoie un code `mentora.errors.<code>` (non traduit, B2) ; `cycles.ts` et `moderation.ts` renvoient `forbidden`, `server_error`, `invalid_input` avec leur propre type `ActionResult` redéfini localement (`cycles.ts:23`, `moderation.ts:30`).

### 3.3 Styles

- Un seul système de classes (`dz-*` dans `design-system.css`) mais utilisé comme garniture : 1 530 `style=` inline dans 77 fichiers contre 622 `className`. Aucun fichier du périmètre n'utilise de classes Tailwind.
- 91 couleurs hexadécimales distinctes en dur dans `src` (`#7301ff` 549 fois, `#1a1f3a` 215, `#a34bf5` 206) au lieu des variables CSS du design system.
- `design-system.css` : 2 684 lignes, 110 classes `dz-` ou `mt-` définies, 29 jamais référencées (26 %).
- Écrans équivalents divergents : listes de séances, demandes et mentorats avec trois mises en page de carte différentes ; états vides, chargement et erreur non systématiques (3 `error.tsx` et 4 `loading.tsx` seulement pour 28 pages).

## 4. Poids et rembourrage (mesures)

| Mesure | Valeur |
|---|---|
| Fichiers du périmètre (`app/mentora`, `lib/mentora`, `lib/actions/mentora`, `app-shell`, `api/mentora`) | 126 fichiers, 28 794 lignes |
| Fichiers `use client` | 35 fichiers, 11 022 lignes (38 % des lignes) |
| `style=` inline | 1 530 occurrences, 77 fichiers (contre 622 `className`) |
| Plus gros fichiers | MentorApplicationWizard 1 540 ; OnboardingWizard 1 382 ; admin/page 1 151 ; NewsletterCampaignModal 869 ; AppShell 780 ; mentees/[handle] 759 ; MentorProfileForm 714 ; admin/matching 595 |
| Inline le plus dense | admin/page 91 ; MentorApplicationWizard 81 ; OnboardingWizard 70 ; landing mentora/page 68 |
| Exports de `lib/` jamais importés ailleurs | 37 (dont des types) ; actions mortes : `setAvailabilityRules`, `markMessageRead`, `deleteMentorshipGoal`, alias `removeAvailabilityException`, `requireMentor`, `requireMentee` |
| Composants jamais importés | 3 : `admin/_components/AdminPlaceholder.tsx` (114), `dashboard/notifications/NotificationBell.tsx` (80), `_components/Wizard.tsx` (157, client) |
| Classes CSS mortes | 29 sur 110 |
| Clés i18n mortes (estimation) | 83 sur 1 196 |

**First Load JS.** `npm run build:ci` ne s'est pas terminé (échec typecheck sur un artefact `.next/dev`, voir 1.3) et Next 16 avec Turbopack n'imprime plus de tableau par route. Chiffres reconstruits depuis la sortie compilée (`.next/server/app/mentora/**/page_client-reference-manifest.js`, somme gzip des `entryJSFiles` de chaque route) : **approximation**, pas la valeur officielle.

- Socle framework partagé (`rootMainFiles` + polyfills) : environ 170 Ko gzip.
- JS propre aux routes Mentora (entrée de page et layouts), gzip : 118 à 150 Ko sur 28 pages. Extrêmes : `admin/cycles` 150 Ko ; `admin/communications`, `admin` et `dashboard/profile/edit` 133 Ko ; `dashboard/mentorships/[id]` 130 Ko ; les plus légers `mentees/[handle]` 118 Ko, landing `/mentora` 121 Ko, listes dashboard 126 Ko.
- Lecture : l'écart entre routes est faible (32 Ko). Le coût est un plancher d'environ 120 Ko gzip dû au shell client partagé (`AppShell` 780 lignes, `NotificationsBell` 314, bibliothèques communes), pas à des pages isolées. La landing sans interaction coûte 121 Ko.
- Payload de données : voir M11 et M12 (photos en base64, 200 profils chargés pour en afficher 20) ; non mesuré faute d'accès à la base.

Raisons des `use client` : formulaires et wizards (légitimes), éditeurs (disponibilités, exceptions, ressources), modales d'actions (acceptation, annulation, modération), shells et cloche. Réductibles : `Wizard.tsx` (inutilisé), `ScrollToHashSection`, `MessagePane` (15 lignes), `MarkDoneButton`, `JoinCommunityButton`, qui pourraient être des formulaires à action serveur. Les wizards (2 922 lignes cumulées) sont les premiers candidats à la découpe.

Requêtes Prisma : voir M11 ; `[slug]/page.tsx` (charge tous les mentorats puis les avis, deux appels `auth()`) ; `getCurrentRoleProfile` (charge toutes les compétences à chaque rendu de layout, 3 layouts) ; `GET /api/mentora/messages` (jusqu'à 500 messages). Le layout dashboard enchaîne user+2FA, accès produit, profil de rôle avec relations, count et liste de notifications (et 3 comptages si admin) : environ 5 à 8 requêtes par navigation.

## 5. Couverture de tests

Existant (`npm test` ne couvre que `src/lib/**/__tests__`) : 11 fichiers pour `src/lib/mentora`, environ 77 cas : badges, discover-params, home (complétion), legacy-redirects, matching (pur), mentee-access, nav, referent, report-csv, trainings, visio. e2e Playwright : `auth.spec.ts` (4 tests), `smoke.spec.ts` (3), `mentora-discovery.spec.ts` (2).

Non testé et critique :
- `scheduling.ts` (310 lignes, DST, fuseaux, exceptions) : aucun test, c'est la logique la plus fragile.
- Toutes les actions serveur (3 138 lignes) : transitions de demande, mentorat et séance ; autorisations ; capacité ; courses.
- `notify` et les emails (B1 serait détecté par un test de 10 lignes), `expire-requests.ts`, `request-expiry-reminder.ts`, `unread-message-digest.ts`, route cron.
- Parcours complets : aucun e2e pour demande, acceptation, réservation, séance, avis, approbation admin.
- Aucun test de parité fr/en des messages ni de présence des clés utilisées.

## 6. Parcours de bout en bout : où ça casse

| Parcours | Étape | État | Réf. |
|---|---|---|---|
| Mentee | Onboarding | Profil créé par `updateMenteeProfile` (upsert), objectifs ajoutés un par un (N allers-retours) ; rôle jamais posé | `profile.ts:394` |
| Mentee | Découverte | Fonctionne ; filtre `format` ignoré, `minRating` faux, photos lourdes | M11, M12 |
| Mentee | Demande | Fonctionne la première fois ; auto-demande possible ; erreurs brutes | M3, B2 |
| Mentee | Acceptée, mentorat | Création OK ; objectifs en anglais dupliqués ; capacité en course | M1, M4 |
| Mentee | Réservation | Créneau recalculé côté serveur (bien) ; double réservation possible ; heures affichées au fuseau serveur | B9, M10 |
| Mentee | Visio | URL Jitsi déterministe par séance (`visio.ts`) ; pas de contrôle d'accès à la salle ; `meetingUrl` libre | M14 |
| Mentee | Avis | Impossible tant que le mentor n'a pas cliqué terminer ; invitation inexistante ; mauvaise notification | B7, B8 |
| Mentor | Candidature | Wizard atomique (bien) ; passage en PENDING_REVIEW à vérifier ; état invisible | M15, B6 |
| Mentor | Approbation admin | Écrase le rôle ADMIN ; refus : `reviewNote` jamais affiché au candidat (grep : lu seulement dans admin) | B5 |
| Mentor | Disponibilités | Règles correctes ; fuseau du profil non lié aux règles | M10 |
| Mentor | Demandes | Second refus plante (P2002) ; acceptation d'une demande expirée | B4, M2 |
| Mentor | Séances, notes | Notes partagées/privées OK ; pas de no-show ; séances passées restent planifiées | B8 |
| Admin | Matching | `nudge` plafonné à 200, séquentiel, sans 2FA | M6 |
| Admin | Cycles | CRUD sans effet métier | M5 |
| Admin | Modération | Réactivation contourne la validation ; suspension cosmétique | B10 |
| Admin | Rapports | Export CSV avec 2FA (bien) ; chiffres dépendants de statuts jamais écrits | B8 |

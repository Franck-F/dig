# Mentora : architecture cible

Document pour le propriétaire et pour l'agent qui implémentera (voir `03-plan.md`). Il s'appuie sur les constats de `01-audit.md` (références B* et M*). Casser le code existant est autorisé ; casser les données de production ne l'est pas (section 7).

## 1. Principes

1. **Une seule source de vérité par règle.** Une règle métier (peut-on accepter cette demande ? ce créneau est-il libre ?) existe à un seul endroit, pure et testée ; actions serveur et UI l'appellent.
2. **Les états sont des machines, pas des chaînes.** Toute transition passe par une fonction de domaine qui refuse les transitions illégales et liste ses effets de bord.
3. **La base garantit ce que le code ne peut pas garantir** (unicité des demandes en attente, non-chevauchement des séances) : index partiels et contrainte d'exclusion.
4. **Simplicité Entourage Pro** : peu d'écrans, un chemin évident par rôle, aucune fonctionnalité sans effet métier (cycles et réglages décoratifs : trancher, voir 2.1).
5. **Tout texte vient d'i18n, toute date passe par un formateur unique, tout style passe par le design system.**

## 2. Modèle de domaine (Prisma)

### 2.1 Décisions par modèle

| Modèle | Décision | Détail |
|---|---|---|
| `MentorProfile` | Garder, modifier | Supprimer `hourlyRate` (bénévolat, `profile.ts:49`). Remplacer `photoUrl` data-URI par une clé de stockage (le dépôt a déjà `src/lib/storage`), avec migration batch des data-URI existantes. Ajouter `suspendedAt` et `suspendedReason`. Index `(status, deletedAt, isAcceptingMentees)`. |
| `MenteeProfile` | Garder, modifier | Même traitement de `photoUrl`. `goals` et `currentChallenges` bornés à 2 000 caractères (le schéma le commente, le code accepte 50 000). |
| `Skill`, `MentorSkill`, `MenteeGoalSkill` | Garder | Les slugs inconnus à la candidature deviennent une erreur de validation visible (M15). |
| `MentorshipRequest` | Modifier | Supprimer l'unique `(fromMenteeId, toMentorId, status)` (B4), le remplacer par un index unique partiel sur PENDING (SQL brut en migration). Ajouter `mentorshipId` nullable et unique (demande qui a créé le mentorat). Renommer `respondedAt` en `decidedAt`. L'expiration est évaluée à la lecture : une demande avec `expiresAt` passé est traitée comme EXPIRED même avant le cron. |
| `Mentorship` | Modifier | Supprimer l'unique `(mentorProfileId, menteeProfileId)`, le remplacer par un unique partiel sur ACTIVE et PAUSED : un mentorat terminé puis repris crée une nouvelle ligne (historique propre, plus de réactivation qui duplique les objectifs, M4). Ajouter `endedById` et `endReason`. `TERMINATED` devient réellement écrit (B8). `agreedFormat` : supprimer si aucune UI ne le renseigne (**non vérifié**). |
| `MentorshipGoal` | Garder | Ajouter `createdById`. Un thème issu de la demande est stocké sans description et rendu via le nom de la compétence (plus de chaîne anglaise en base). |
| `Session` | Modifier fortement | Voir 2.2 et 2.4. |
| `Review` | Garder, modifier | Supprimer `helpfulnessVotes` après vérification qu'aucune UI ne le lit (**non vérifié**). Ajouter `moderatedAt` (masquage par l'admin). Unicité `(sessionId, authorUserId)` conservée ; avis possible seulement sur séance COMPLETED. |
| `MentorshipMessage` | Garder | `attachmentUrl` : supprimer tant qu'aucune UI d'envoi n'existe, sinon passer par le stockage. Pagination par curseur obligatoire. |
| `Notification` | Modifier | Ajouter `dedupeKey` (unique avec `userId`) pour l'idempotence des rappels, `entityType` et `entityId` pour les liens. Payload validé par un schéma zod par type. La locale n'est pas stockée : le rendu se fait selon la locale du destinataire. |
| `AvailabilityRule` | Modifier | Supprimer la colonne `timezone` (jamais lue, M10). Les règles sont en heure murale du fuseau du profil mentor. |
| `AvailabilityException` | Garder | Valider la date (format et existence). |
| `Cycle`, `MentoraProgrammeSettings` | Trancher avec le propriétaire | Par défaut : retirer de la navigation et geler ; supprimer les champs non appliqués (`matchingDimensions`, `require2faAdmin`). Garder fenêtre de candidature et capacité seulement si elles sont appliquées par le service de demande. |
| `MentoraTrainingCompletion`, `Resource` | Garder | Ajouter la route d'édition de ressource ou retirer le bouton (M16). |
| `User` | Modifier | Ajouter `locale` (absent aujourd'hui) pour les emails. `role` n'est plus la source d'identité Mentora (2.3). |

### 2.2 Machines à états

**MentorshipRequest** : PENDING, ACCEPTED, DECLINED, WITHDRAWN, EXPIRED (les quatre derniers sont terminaux).

| De | Vers | Acteur | Gardes |
|---|---|---|---|
| PENDING | ACCEPTED | mentor destinataire | `expiresAt > now` ; mentor ACTIVE et non supprimé ; places disponibles (comptage et écriture dans la même transaction, verrou sur la ligne du mentor) ; aucun mentorat ACTIVE ou PAUSED pour ce couple |
| PENDING | DECLINED | mentor destinataire | motif de 5 caractères minimum |
| PENDING | WITHDRAWN | mentee émetteur | |
| PENDING | EXPIRED | système | `expiresAt <= now` ; cron idempotent qui ne peut plus échouer pour cause d'unicité |

Effets de l'acceptation : création du mentorat, copie des thèmes en objectifs (sans doublon), notification. À l'envoi : refuser l'auto-demande, le mentor non ACTIVE, la capacité atteinte, un mentorat déjà actif.

**Mentorship** : ACTIVE, PAUSED, COMPLETED, TERMINATED.

| De | Vers | Acteur | Effets |
|---|---|---|---|
| ACTIVE | PAUSED | mentor ou mentee | notifier l'autre ; plus de nouvelle réservation, séances déjà planifiées conservées |
| PAUSED | ACTIVE | mentor ou mentee | notifier l'autre |
| ACTIVE ou PAUSED | COMPLETED | mentor | objectifs atteints, note de clôture ; annule les séances à venir ; invite le mentee à un dernier avis |
| ACTIVE ou PAUSED | TERMINATED | mentor, mentee ou admin | motif obligatoire ; annule les séances à venir ; notifie |

Messagerie en lecture seule après COMPLETED ou TERMINATED (aujourd'hui seul TERMINATED, jamais écrit, la bloque).

**Session** : SCHEDULED, COMPLETED, CANCELLED, NO_SHOW. `IN_PROGRESS` disparaît (jamais écrit) : "en cours" se déduit de `scheduledAt <= now < endsAt`.

| De | Vers | Acteur | Gardes |
|---|---|---|---|
| SCHEDULED | CANCELLED | mentor ou mentee | avant le début ; motif ; notifie |
| SCHEDULED | COMPLETED | mentor (ou confirmation du mentee) | après le début ; déclenche la demande d'avis (nouveau type de notification, B7) |
| SCHEDULED | NO_SHOW | mentor (absence du mentee) ou mentee (absence du mentor) | après le début |
| SCHEDULED | COMPLETED (auto) | système | 48 h après la fin sans action : clôture automatique avec `autoCompleted = true` pour débloquer les avis (décidé, point ouvert 3) |

Colonnes ajoutées : `endsAt`, `mentorProfileId` et `menteeProfileId` dénormalisés (contrainte d'exclusion), `autoCompleted`.

**MentorProfile** : DRAFT, PENDING_REVIEW, ACTIVE, PAUSED, SUSPENDED.

| De | Vers | Acteur | Gardes et effets |
|---|---|---|---|
| DRAFT | PENDING_REVIEW | mentor | profil complet (3 compétences, 1 disponibilité valide) ; le wizard fait cette transition dans la même transaction que la création (M15) |
| PENDING_REVIEW | ACTIVE | admin | `publishedAt`, notification ; ne modifie jamais un rôle supérieur (B5) |
| PENDING_REVIEW | DRAFT | admin | `reviewNote` obligatoire, affichée au candidat (B6) |
| ACTIVE | PAUSED | mentor | masqué de la découverte, mentorats actifs conservés |
| ACTIVE ou PAUSED | SUSPENDED | admin | motif ; annule les demandes PENDING ; mentorats actifs en PAUSED ; messagerie en lecture seule ; notifie |
| SUSPENDED | ACTIVE | admin | seule réactivation autorisée (B10) |

Changements sensibles sur un profil ACTIVE (photo, bio, LinkedIn) : journalisés dans l'audit et signalés à l'admin, sans re-validation bloquante (décision produit à confirmer).

Les tables de transition vivent dans `domain/*.machine.ts` sous forme de données (`allowedTransitions`) et sont testées exhaustivement (chaque couple état/état).

### 2.3 Rôles et capacités

On abandonne la déduction d'identité depuis `User.role` (valeurs STUDENT, MENTOR, PARTNER, ADMIN). Capacités calculées une fois par requête par `getViewer()` :
- `isAdmin` : `role === ADMIN`
- `mentor` : profil mentor avec son statut
- `mentee` : présence d'un profil mentee non supprimé

Un utilisateur peut cumuler les trois. L'approbation d'un mentor n'écrit plus `role` ; s'il faut conserver `UserRole.MENTOR` ailleurs dans l'app, elle ne l'écrit que si le rôle actuel est STUDENT. Le dashboard se dispatche sur ces capacités : un mentor en attente voit son écran de statut (en revue, refusée avec motif, à compléter).

### 2.4 Index et contraintes

- `MentorshipRequest` : unique partiel `(fromMenteeId, toMentorId) WHERE status = PENDING` ; index `(toMentorId, status, expiresAt)`.
- `Mentorship` : unique partiel `(mentorProfileId, menteeProfileId) WHERE status IN (ACTIVE, PAUSED)`.
- `Session` : extension `btree_gist` et contrainte d'exclusion sur `(mentorProfileId, tstzrange(scheduledAt, endsAt))` pour les séances SCHEDULED, idem côté mentee. C'est le vrai garde contre B9 ; le service convertit l'erreur de contrainte en code `slotTaken`. Index `(mentorProfileId, scheduledAt)` et `(menteeProfileId, scheduledAt)`.
- `Notification` : unique `(userId, dedupeKey)` partiel (valeur non nulle).
- `searchTsv` de `MentorProfile` : champ géré par migration brute, à ne pas toucher (**non vérifié** comment il est alimenté).

### 2.5 Suppression douce et RGPD

- Toute lecture passe par des fonctions de requête qui appliquent `deletedAt: null` (règle unique, testée), ce qui corrige M11(c).
- Suppression d'un compte : profils marqués `deletedAt`, mentorats ACTIVE et PAUSED en TERMINATED avec motif système, séances futures annulées, messages anonymisés (corps remplacé, expéditeur conservé pour l'intégrité du fil).
- Rétention : un traitement hebdomadaire, exécuté dans le cron quotidien existant (plan Hobby, point ouvert 6), anonymise les profils mentee inactifs depuis plus de 3 ans, durée promise par l'interface et fixée en code puisque le réglage `menteeRetentionYears` disparaît (point ouvert 1) ; chaque exécution écrit dans l'audit (`lib/audit/log`).
- L'export de données (`src/lib/rgpd/export.ts`) doit couvrir tous les modèles Mentora ; test dédié.

## 3. Frontières de modules

### 3.1 Découpage cible de `src/lib/mentora`

```
src/lib/mentora/
  domain/            pur, sans Prisma ni next : testable avec node --test
    request.machine.ts  mentorship.machine.ts  session.machine.ts  mentor.machine.ts
    scheduling/         (scheduling.ts actuel, découpé : tz.ts, slots.ts)
    matching.ts         (matching.ts actuel)
    completion.ts       (home.ts : formules de complétion, une seule)
    errors.ts           DomainError + catalogue de codes
  policy/
    can.ts              can(actor, action, resource) : unique module d autorisation
  services/             un use-case = une fonction (ctx, input) -> Result ; transaction ici
    requests.ts  mentorships.ts  sessions.ts  reviews.ts  messages.ts  mentors.ts  admin.ts
  events/
    types.ts            événements typés (RequestAccepted, SessionCancelled, ...)
    handlers.ts         événement -> notification in-app + email + audit
  queries/              lectures pour les composants serveur, select minimal, React.cache
  format/               formatDateTime(date, {tz, locale}) : seul formateur autorisé
src/lib/actions/mentora/  fines enveloppes: defineAction(policy, schema, service)
```

Règles de dépendance : `domain` n'importe rien d'extérieur ; `policy` importe `domain` ; `services` importe `domain`, `policy`, `events`, Prisma ; `actions` importe `services` ; l'UI importe `queries`, `actions`, `format`. Une règle ESLint (`no-restricted-imports`) interdit à `domain` d'importer Prisma, `next/*` ou `server-only`.

### 3.2 Contrat d'une action serveur

Aujourd'hui chaque action refait authentification, parsing, gardes, catch, revalidate (3 138 lignes, deux conventions d'erreur, B2, B3). Cible : une fabrique `defineAction({ input: zodSchema, policy, stepUp?: 'admin', handler })` qui fait, dans cet ordre :
1. `getViewer()` (une lecture par requête, mise en cache) et refus des comptes supprimés ou bloqués ;
2. step-up 2FA si `stepUp: 'admin'` (corrige M6 pour toutes les actions admin d'un coup) ;
3. validation zod, erreurs par champ ;
4. `can(viewer, action, resource)` ;
5. exécution du service dans une transaction ;
6. conversion des erreurs : `DomainError` vers `{ ok: false, code, fieldErrors }`, toute autre erreur vers `code: 'unexpected'` + Sentry (fin de B3) ;
7. `revalidateTag` ciblés (par exemple `mentorship:<id>`), plus de `revalidatePath` inopérant (M13).

Le résultat est un type unique `Result<T> = { ok: true; data: T } | { ok: false; code: ErrorCode; fieldErrors? }`. Le client affiche `t('errors.' + code)`. Un test vérifie que chaque `ErrorCode` possède une clé fr et en (fin de B2).

### 3.3 Politique d'autorisation unique

`can(actor, action, resource)` est une fonction pure sur des données déjà chargées (ex. `{ mentorUserId, menteeUserId, status }`). Table d'actions : `request.send`, `request.accept`, `request.decline`, `request.withdraw`, `mentorship.pause`, `mentorship.complete`, `mentorship.terminate`, `session.schedule`, `session.cancel`, `session.complete`, `session.notes.private.read`, `message.send`, `review.post`, `mentor.approve`, `mentor.suspend`, `mentee.profile.read`, etc. Chaque règle contient aussi les gardes d'état (via les machines). Tests en table : acteur (mentor, mentee, tiers, admin sans 2FA, mentor suspendu, compte supprimé) par action.

### 3.4 Pipeline de notifications et d'événements

Aujourd'hui `notify()` écrit la notification puis envoie l'email en ligne, avec des clés i18n qui ne correspondent pas (B1), dans la langue de l'acteur, sans file ni nouvelle tentative.

Cible :
1. Le service émet un événement typé dans la transaction (`SessionCancelled { sessionId, byUserId, reason }`).
2. Le gestionnaire d'événement, dans la même transaction, insère la `Notification` (avec `dedupeKey`) et une ligne dans la file d'emails existante (`src/lib/email/queue`, déjà drainée par le cron). Les emails ne sont donc plus perdus et ne ralentissent plus la requête.
3. Le rendu email est fait à l'envoi, par type, dans la `locale` du destinataire (`User.locale`) et son fuseau, avec des templates versionnés en code. Un test de contrat vérifie, pour chaque type, que les clés existent en fr et en et que toutes les variables sont fournies (fin de B1).
4. Types ajoutés : `SESSION_COMPLETED` (invitation à l'avis), `MENTORSHIP_PAUSED`, `MENTORSHIP_RESUMED`, `MENTORSHIP_ENDED`, `MENTOR_SUSPENDED`, `MENTOR_REINSTATED`. Messages : une notification par fil non lu (regroupement), pas une par message.
5. Les crons (rappels, expiration, digest) deviennent des consommateurs idempotents de la même file, avec `dedupeKey`. Le projet est sur le plan Vercel Hobby (point ouvert 6, décidé) : un passage quotidien, donc rappel à la réservation et à J-1, sans rappel à 1 h.

### 3.5 Cycles et réglages : décision proposée

Le code actuel n'applique ni la capacité programme, ni la fenêtre de candidature, ni la rétention, et les cycles n'ont aucun effet. **Décidé (point ouvert 1) : supprimer**, selon la proposition suivante : supprimer de l'interface `admin/cycles` et la carte de réglages non appliqués, conserver les tables jusqu'à la phase de nettoyage, puis les supprimer. Les valeurs encore utiles (durée de rétention) deviennent des constantes en code.

## 4. Stratégie de planification et fuseaux horaires

1. **Stockage** : instants en UTC (`scheduledAt`, `endsAt`) ; règles de disponibilité en minutes murales dans le fuseau du profil mentor (colonne `timezone` des règles supprimée) ; exceptions par date murale.
2. **Calcul** : conserver `scheduling.ts` (correct, voir M10) sous `domain/scheduling`, ajouter les tests manquants (DST printemps et automne, exceptions EXTRA et BLOCKED, minuit, créneaux adjacents, fenêtre de 56 jours).
3. **Réservation** : le service recalcule le créneau côté serveur (déjà le cas), vérifie aussi la disponibilité du mentee, refuse un mentorat PAUSED, puis insère ; la contrainte d'exclusion tranche les courses et l'erreur devient `slotTaken`.
4. **Affichage** : un seul `formatDateTime(date, { tz, locale })`. Fuseau du viewer : celui de son profil, sinon un cookie `tz` posé par un petit script client à la première visite. Interdiction (règle ESLint) d'appeler `toLocaleString`, `toLocaleDateString` ou `new Intl.DateTimeFormat` hors de `format/`. L'écran de réservation et de détail de séance affiche les deux fuseaux ("14:00 à Paris, 13:00 à Londres").
5. **Changement de fuseau du mentor** : demander explicitement "garder mes horaires locaux" (défaut, les créneaux se décalent en UTC) ou "garder les mêmes heures UTC", puis notifier les séances futures concernées.
6. **Emails et rappels** : heure et fuseau du destinataire, lien d'ajout au calendrier (fichier ICS) pour la visio.
7. **États temporels** : "en cours" et "terminée à confirmer" sont dérivés à la lecture ; clôture automatique 48 h après la fin (2.2).

## 5. Architecture UI

### 5.1 Styles : un seul système

**Décision : tokens CSS et classes `dz-*` du design system, encapsulés dans une petite bibliothèque de composants ; CSS Modules uniquement pour la mise en page propre à une page. Plus aucun `style=` inline.**

Justification :
- Les tokens de `DESIGN.md` (Signika, `#7301FF`, `.dz-card`) existent déjà dans `design-system.css` et servent la vitrine et la communauté ; Mentora doit rester identique visuellement.
- Tailwind 3 est installé (`components.json`, shadcn) mais n'est pas utilisé dans Mentora ; l'introduire ajouterait un troisième vocabulaire à côté de 2 684 lignes de CSS et de 1 530 styles inline.
- Zéro JS de style à l'exécution, compatible composants serveur, aucune dépendance nouvelle.
- Les 91 couleurs en dur se réduisent aux variables du design system ; le rare style dynamique (largeur d'une barre de progression) passe par une variable CSS posée sur l'élément (`--value`), jamais par un objet `style` libre.

Garde-fous : règle ESLint interdisant la prop `style` dans `src/app/mentora/**` et `src/components/mentora/**` (exceptions commentées) ; script CI qui compte les `style=` restants et échoue s'il augmente ; purge des 29 classes `dz-` mortes.

### 5.2 Bibliothèque de composants (`src/components/mentora/ui`)

Composants serveur par défaut, sans état : `Page` et `PageHeader`, `Section`, `Card`, `Stat`, `StatusBadge` (un seul mapping statut vers libellé et couleur, remplace les 4 copies), `Avatar` (remplace les 21 helpers d'initiales), `EmptyState`, `ErrorState`, `Skeleton` pour les `loading.tsx`, `DataList` (ligne de liste responsive, remplace les trois mises en page de listes), `FormField`, `Button`, `LinkButton`, `Tabs` (liens, sans état client), `Dialog` (le seul composant client générique), `DateTime` (appelle `format/`). Une page de démonstration interne protégée (`/mentora/admin/_ui`) sert à la relecture visuelle.

### 5.3 Composants serveur et client

- Par défaut tout est composant serveur. `use client` seulement pour : état d'un formulaire multi-étapes, éditeurs interactifs (disponibilités, exceptions), sélecteur de créneaux, dialogues, cloche, filtres à état d'URL.
- Les boutons d'action simples (terminer une séance, marquer lu, reprendre) deviennent des `<form action={serverAction}>` avec `useActionState` dans un îlot minimal, pas des composants client de 150 à 390 lignes.
- Un îlot client ne reçoit que des données sérialisées minimales (jamais l'objet Prisma complet, jamais `mentorNotesPrivate` côté mentee).
- Les wizards (2 922 lignes aujourd'hui) sont découpés en étapes de moins de 200 lignes, pilotées par un hook de formulaire commun ; ils valident avec le même schéma zod que l'action serveur (un schéma par entité, dans `schemas/`).
- Aucune logique de tri, de formatage de date ou de calcul de statut dans les composants : elle vient de `domain` et `format`.

### 5.4 Chargement, vide, erreur

Chaque route a un `loading.tsx` (skeleton fait des mêmes composants), un état vide explicite avec une action, et un `error.tsx` par section affichant l'identifiant Sentry. Les erreurs d'action sont traduites (3.2). Les états métier (candidature en revue, mentorat en pause, mentor suspendu) sont des écrans à part entière.

### 5.5 Mobile-first

Mise en page conçue à 360 px d'abord : `Stack`, `Cluster`, `Grid` auto-fit, cible tactile de 44 px minimum, navigation inférieure sur mobile et barre latérale dès 1024 px (le shell en fait déjà une partie). Tableaux admin remplacés par `DataList` en cartes sous 640 px. Captures Playwright à 360 et 1280 px sur les écrans principaux.

### 5.6 Un seul shell

Un layout `src/app/mentora/(app)/layout.tsx` construit le shell une fois (viewer, navigation selon capacités, cloche, 2FA si exigé) ; `discover`, profil mentor, `dashboard` et `admin` deviennent ses enfants, l'admin ajoutant seulement son step-up 2FA. Un seul compteur de non-lus, limité aux types Mentora (fin de la divergence `[slug]` et `admin`). `OnboardingShell` fusionne dans `AppShell` avec une variante sans navigation.

## 6. Routage et architecture de l'information

Direction : Entourage Pro, c'est-à-dire un accueil qui dit quoi faire ensuite, peu d'entrées de menu, un seul endroit pour chaque chose. Les redirections de `legacy-redirects.ts` sont conservées.

### 6.1 Carte des routes cible

| Zone | Route | Contenu |
|---|---|---|
| Public | `/mentora` | Landing (statique, sans îlot client inutile) |
| Public | `/mentora/discover` | Annuaire, filtres d'URL, pagination serveur correcte |
| Public | `/mentora/mentors/[slug]` | Profil mentor ; vrai `slug` ajouté sur `MentorProfile` ; `/mentora/[userId]` redirige. Visible sans connexion avec CTA de connexion pour demander (point ouvert n°2) |
| Entrée | `/mentora/onboarding` | Profil mentee, en étapes |
| Entrée | `/mentora/become-a-mentor` | Candidature, finit en PENDING_REVIEW |
| Connecté | `/mentora/dashboard` | Accueil par capacités : prochaine séance, demandes à traiter, état de candidature, recommandations |
| Connecté | `/mentora/dashboard/requests` | Onglets Reçues (mentor) et Envoyées (mentee) |
| Connecté | `/mentora/dashboard/mentorships` et `/[id]` | Liste puis fiche à onglets Messages, Séances, Objectifs ; cycle de vie dans un menu |
| Connecté | `/mentora/dashboard/sessions`, `/new`, `/[id]` | Agenda, réservation, détail avec visio et avis |
| Connecté | `/mentora/dashboard/messages` | Boîte de réception qui ouvre l'onglet messages du mentorat |
| Connecté | `/mentora/dashboard/profile` | Profil et disponibilités (renomme `profile/edit`) |
| Connecté | `/mentora/dashboard/notifications` | Liste |
| Connecté | `/mentora/dashboard/resources` | Ressources et formations (édition ajoutée ou bouton retiré) |
| Admin | `/mentora/admin` | Pilotage : candidatures à valider, demandes en attente de plus de 48 h, mentorats à risque, signalements |
| Admin | `/mentora/admin/mentors` | Validation (approuver ou refuser avec motif) et modération (suspendre, réactiver) fusionnées |
| Admin | `/mentora/admin/mentorships` | Matching et suivi fusionnés : demandes, mentorats, relances, clôture forcée |
| Admin | `/mentora/admin/mentees` | Annuaire mentees |
| Admin | `/mentora/admin/reports` | Indicateurs et export CSV |
| Admin | `/mentora/admin/communications` | Newsletters, conservées telles quelles (hors périmètre de la refonte) |
| Admin | `/mentora/admin/settings` | Seulement les réglages réellement appliqués |
| Supprimé | `admin/cycles`, `admin/matching`, `admin/moderation` | Fusionnés ou retirés (3.5) |

L'admin passe de 9 pages à 6.

### 6.2 Navigation par capacité

Mentee : Accueil, Découvrir, Mes mentorats, Séances, Messages, Ressources. Mentor : Accueil, Demandes, Mes mentorats, Séances, Messages, Ressources. Admin : en plus, "Pilotage". Un mentor en attente n'a que Accueil (statut), Profil et Ressources. La cloche couvre les notifications, le menu avatar couvre Profil et Déconnexion (déjà la direction de `nav.ts`).

### 6.3 Terminologie

Choisir un seul terme pour mentee en français (recommandation : "mentoré·e" partout, "binôme" pour le couple) et l'appliquer via un glossaire dans `messages/` et un test qui échoue si `mentorée` et `mentoré` coexistent. Les 20 occurrences de `mentorée` et 46 de `mentoré` sont alignées par script pendant la phase i18n.

## 7. Tests et budgets de performance

### 7.1 Pyramide de tests

1. **Unitaire (domaine)** : `node --test` comme aujourd'hui, étendu au nouveau dossier `domain`. Obligatoires : chaque machine à états (toutes les transitions autorisées et interdites), `can()` en table, `scheduling` (DST, exceptions, minuit, adjacence), matching, formateur de dates (fuseaux, locales), contrat des notifications (clés fr et en présentes, variables fournies), parité fr/en des messages, absence de clés d'erreur sans traduction.
2. **Intégration (services et actions)** : vrai PostgreSQL de test, jamais la production. Variable dédiée `DATABASE_URL_TEST` ; le setup refuse de s'exécuter si l'URL ne contient pas un marqueur de base de test (garde-fou explicite). Chaque test s'exécute dans une base réinitialisée par migration. Couvre : courses (deux acceptations simultanées, deux réservations simultanées), contraintes d'index, effets de bord de chaque transition (séances annulées, notifications émises avec `dedupeKey`), autorisations par acteur.
3. **E2E Playwright** (base de test seedée, 3 acteurs avec sessions stockées) : (a) mentee : onboarding, découverte, demande ; (b) mentor : candidature, approbation admin, disponibilités ; (c) acceptation, mentorat, réservation d'une séance, annulation ; (d) séance terminée, avis ; (e) refus puis nouvelle demande puis second refus (non-régression B4) ; (f) admin : suspension et réactivation. Captures à 360 et 1280 px.
4. **CI** : lint (avec règles `style` et formatage de dates), `tsc`, `npm test`, intégration, e2e sur preview, rapport de taille de bundle.

### 7.2 Budgets (mesure `gzip` des `entryJSFiles` par route, voir `01-audit.md` section 4)

Valeurs de départ mesurées : 118 à 150 Ko par route Mentora, avec un socle framework d'environ 170 Ko hors budget. Cibles :

| Type de route | Budget JS propre à la route |
|---|---|
| Landing `/mentora` et profil public | 95 Ko |
| Listes et détails (`discover`, `requests`, `mentorships`, `sessions`) | 105 Ko |
| Formulaires, wizards, éditeurs | 125 Ko |
| Admin | 115 Ko, sauf pilotage 125 Ko |

Autres budgets : aucun îlot client isolé au-dessus de 40 Ko gzip ; HTML et RSC d'une page de découverte (12 profils) sous 150 Ko, ce qui impose les photos hors base ; au plus 6 requêtes Prisma par navigation de layout (une lecture de `getViewer()` partagée) ; aucune requête qui charge plus de 3 fois ce qu'elle affiche (fin du cas 200 pour 20).

Mesure reproductible : un script `scripts/mentora-bundle-report.mjs` (celui utilisé pour l'audit, à versionner) lit `.next/server/app/mentora/**` après build et échoue si une route dépasse son budget ou régresse de plus de 5 %. Il est nécessaire car Next 16 avec Turbopack n'imprime plus le tableau par route.

Les scripts de mesure utilisés pour l'audit (tous en lecture seule) sont conservés dans `docs/mentora-rebuild/audit-scripts/` : `bundle-sizes.mjs`, `code-metrics.mjs`, `dead-links.mjs`, `i18n-check.mjs`. À lancer depuis la racine du dépôt.

## 8. Stratégie de migration des données (la production contient de vrais utilisateurs)

### 8.1 Contraintes vérifiées

- `package.json` : le script `build` exécute `prisma generate && prisma migrate deploy && next build`. **Chaque déploiement applique les migrations en attente avant de construire** : une migration cassante part en production avec le déploiement, sans étape manuelle. Conséquence : stratégie expand puis contract, une migration par déploiement quand elle est risquée.
- Prisma ne sait pas exprimer les index uniques partiels ni les contraintes d'exclusion : ils vivent en SQL brut dans des fichiers de migration. Risque de dérive à la prochaine `migrate dev` (Prisma peut proposer de supprimer ces index) : **non vérifié** ; mitigation : documenter chaque index brut dans `prisma/RAW-SQL.md` et ajouter en CI un contrôle `prisma migrate diff` qui fait échouer si une migration générée supprime un index de cette liste.
- Aucun accès à la base n'a été utilisé pour cet audit : les volumes, doublons et chevauchements actuels sont inconnus.

### 8.2 Règles

1. **Jamais de migration destructive et de code dépendant dans le même déploiement.** Expand (colonnes nullables, nouveaux index) puis déploiement du code qui écrit les deux formes, puis backfill, puis contract (suppression) dans un déploiement ultérieur.
2. **Pré-vols en lecture seule.** Avant chaque migration qui ajoute une contrainte, un script SQL `SELECT` compte les lignes qui la violeraient ; le propriétaire l'exécute avec un rôle en lecture seule et colle le résultat dans la PR. Pas de migration sans résultat à zéro ou plan de correction.
3. **Sauvegarde avant contract** : snapshot de la base (point de restauration du fournisseur) avant toute migration de suppression, noté dans le runbook.
4. **Backfills idempotents et reprenables** (scripts versionnés, par lots, avec compteur), jamais dans une migration Prisma.
5. **Environnement de répétition** : toute la séquence est d'abord jouée sur une copie anonymisée ou une base de préproduction. Jamais de `migrate`, `seed` ou serveur dev contre la `DATABASE_URL` de production pendant la refonte.

### 8.3 Séquence

| Étape | Type | Pré-vol (lecture seule) | Migration | Backfill / suite |
|---|---|---|---|---|
| E1 | Expand | Demandes PENDING en double par couple ; couples avec plusieurs mentorats ACTIVE ou PAUSED | Index uniques partiels sur MentorshipRequest et Mentorship (ajoutés en plus des anciens) | Aucun |
| E2 | Expand | Séances SCHEDULED qui se chevauchent par mentor ou mentee | Colonnes `endsAt`, `mentorProfileId`, `menteeProfileId` nullables sur Session ; colonnes nullables ajoutées ailleurs (`dedupeKey`, `decidedAt`, `endedById`, `User.locale`, `MentorProfile.slug`) | Backfill par SQL en lots : `endsAt = scheduledAt + durée`, ids dénormalisés par jointure ; slugs générés |
| E3 | Expand | Résultat E2 sans NULL | Contrainte d'exclusion Session (échoue s'il reste un chevauchement, d'où le pré-vol ; corrections manuelles avec l'admin si besoin), NOT NULL sur les colonnes backfillées | |
| E4 | Code | | Déploiement du code V2 (services, machines, notifications) lisant et écrivant nouvelles et anciennes colonnes | Les anciennes colonnes ne sont plus lues |
| E5 | Données | | Aucune | Photos : script qui téléverse chaque data-URI vers le stockage, renseigne la clé, vérifie la lecture ; garde `photoUrl` jusqu'à validation. `Notification` historiques inchangées. Normalisation `Topic from initial request` en NULL |
| E6 | Contract | Sauvegarde ; vérifier qu'aucun code ne lit les anciennes colonnes | Suppression : anciens uniques `(fromMenteeId, toMentorId, status)` et `(mentorProfileId, menteeProfileId)`, `AvailabilityRule.timezone`, `hourlyRate`, `photoUrl` data-URI, `helpfulnessVotes` (après vérification d'usage) | |
| E7 | Enum | | `SessionStatus.IN_PROGRESS` : laissée dans l'enum (retirer une valeur d'enum Postgres demande de recréer le type) ; marquée dépréciée dans le schéma | Retrait éventuel en fin de chantier |

Statuts de mentor et de mentorat : aucune valeur existante ne change de sens, donc pas de conversion de données. Rôles utilisateur : aucune conversion (on cesse d'écrire, on ne réécrit pas l'historique) ; un script de diagnostic en lecture seule liste les ADMIN et PARTNER qui ont un MentorProfile pour que le propriétaire vérifie les rôles abîmés par B5 avant la phase 0.

### 8.4 Retour arrière

Chaque étape expand est réversible en supprimant l'ajout. E6 est irréversible sans restauration : il est donc placé en dernier, derrière la sauvegarde et une semaine d'observation (erreurs Sentry, comptes de lignes) après E4 et E5.

## 9. Points ouverts pour le propriétaire

Décisions du propriétaire au 2026-11-26 pour les points 1, 3, 5 et 6 ; les points 2, 4 et 7 restent ouverts.

1. Cycles et réglages programme : supprimer (recommandé) ou rendre effectifs (3.5) ? **Décidé : supprimer.** L'interface `admin/cycles` et la carte de réglages non appliqués disparaissent en phase 4d ; les tables `Cycle` et `MentoraProgrammeSettings` et leurs champs sont supprimés en phase 7.
2. Profil mentor public sans connexion (SEO, partage) ou réservé aux connectés comme aujourd'hui (M13) ?
3. Clôture automatique d'une séance 48 h après sa fin (2.2) : acceptée ? Quel délai ? **Décidé : acceptée, 48 h** (constante `AUTO_COMPLETE_AFTER_HOURS`, cron en place depuis la phase 0).
4. Modification d'un profil ACTIVE : journaliser seulement, ou re-valider les champs sensibles (photo, bio) ?
5. Terme français retenu pour mentee (6.3) et traitement de "binôme". **Décidé : « mentoré·e » partout, « binôme » pour le couple mentor et mentoré·e** (`messages/glossary.json`) ; alignement des textes en phase 4, le test de glossaire passe alors de `todo` à bloquant.
6. Cadence des crons : le plan Vercel actuel limite-t-il à un passage quotidien (le code le suppose, **non vérifié**) ? Détermine les rappels à 1 h. **Décidé : plan Hobby, un passage par jour et par cron.** Pas de rappel à 1 h : rappel à la réservation et à J-1 (3.4, point 5), tous les traitements périodiques dans le cron quotidien existant.
7. Newsletters et ressources : conservées telles quelles hors refonte ?

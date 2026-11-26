# Mentora : plan d'implémentation par phases

Pour un agent qui travaille en sessions fraîches : chaque phase est autonome, a un objectif, des fichiers, des critères d'acceptation et des tests. Lire d'abord `01-audit.md` (références B*, M*) et `02-architecture.md`. Tailles : **S** = une session, **M** = 2 à 3 sessions, **L** = 4 sessions ou plus.

Règles valables pour toutes les phases :
- Jamais de `prisma migrate`, `seed` ou serveur dev contre la `DATABASE_URL` de production (`.env`). Utiliser une base locale ou de préproduction.
- Rappel : `npm run build` applique `prisma migrate deploy` à chaque déploiement : toute migration est en production dès que la branche est déployée. Suivre `02-architecture.md` section 8.
- Une phase = une branche = une PR ; `npm test`, `npm run lint` et `tsc` verts avant fusion.
- Ordre par valeur et risque : la production est sécurisée en premier (phase 0), la refonte vient ensuite.

## Phase 0 : corriger les bloquants sur le code actuel (taille M)

**But** : une production sûre pendant la refonte. Correctifs minimaux, localisés, sans changer l'architecture. Toute correction ajoute un test quand la logique est pure.

| Id | Correctif | Fichiers | Critère d'acceptation |
|---|---|---|---|
| 0.1 | Emails : aligner clés et variables (B1). Soit mapper `REQUEST_RECEIVED` vers `requestReceived`, soit renommer les clés ; fournir `recipientName`, `senderName`, heure formatée dans le fuseau du destinataire ; locale du destinataire si `User.locale` absent : défaut fr | `src/lib/mentora/notifications.ts`, `messages/fr.json`, `messages/en.json` | Pour les 7 types, sujet et corps rendus sans clé de repli ni JSON ; test unitaire qui parcourt `EMAIL_ENABLED` et échoue si une clé manque |
| 0.2 | Erreurs traduites (B2, B3) : créer `mentora.errors.<code>` en fr et en pour tous les `MentoratActionError` ; ajouter le code `unexpected` ; `handleError` ne renvoie plus `unauthorized` ; les composants traduisent `res.error` | `_helpers.ts`, `RequestMentorshipModal.tsx`, `RequestActions.tsx`, tous les appelants d'actions, messages | Plus aucune chaîne `mentora.errors.` visible à l'écran ; test de parité des clés d'erreur |
| 0.3 | Demandes (B4) : migration SQL remplaçant l'unique `(fromMenteeId, toMentorId, status)` par un unique partiel sur PENDING (E1 de la section 8 sans suppression de l'ancien index tant que le code n'est pas déployé ; ici, comme il s'agit d'un bug actif, supprimer l'ancien dans la même PR après pré-vol) ; capturer P2002 vers `duplicateRequest` ; `expirePendingRequests` robuste | `prisma/schema.prisma`, nouvelle migration SQL, `requests.ts`, `expire-requests.ts` | Pré-vol collé dans la PR ; scénario manuel demande, refus, nouvelle demande, second refus : OK |
| 0.4 | Rôles (B5) : l'approbation n'écrit `role = MENTOR` que si le rôle actuel est STUDENT ; script de diagnostic en lecture seule des ADMIN et PARTNER avec `MentorProfile` pour que le propriétaire corrige | `profile.ts` (`adminApproveMentor`), `scripts/diag-roles.sql` (lecture seule) | Un admin qui candidate garde ADMIN ; test sur la fonction pure de décision de rôle |
| 0.5 | Candidat en attente (B6, M15) : le dashboard affiche l'état (en revue, refusée avec `reviewNote`, brouillon) ; confirmer que le wizard met bien le profil en PENDING_REVIEW, sinon le faire dans `submitMentorApplication` (transaction) ; valider `end > start` des créneaux | `dashboard/page.tsx`, `getCurrentRoleProfile.ts` (ne plus exiger `role === MENTOR` pour le statut), `MentorApplicationWizard.tsx`, `profile.ts`, messages | Un candidat voit son statut ; la file admin contient les candidats du wizard (vérifié en base de test) |
| 0.6 | Notification de clôture de séance (B7) : nouveau type `SESSION_COMPLETED` (migration `ALTER TYPE ADD VALUE`), libellés fr et en, lien vers l'avis ; retirer `REVIEW_RECEIVED` de `completeSession` | `schema.prisma`, `sessions.ts`, `notifications.ts`, messages, composants de cloche | Le mentee reçoit "Laissez votre avis", pas "Avis reçu" |
| 0.7 | Réservation (B9) : relire disponibilité et conflits dans `$transaction` (niveau Serializable ou verrou sur la ligne du mentor), vérifier les séances du mentee, refuser un mentorat PAUSED | `sessions.ts` | Test d'intégration avec deux réservations simultanées : une seule réussit (la contrainte d'exclusion arrive en phase 2) |
| 0.8 | Modération (B10) : `reactivateMentor` uniquement depuis SUSPENDED ; un mentor SUSPENDED ne peut ni accepter, ni envoyer de messages, ni réserver | `moderation.ts`, `requests.ts`, `messages.ts`, `sessions.ts` | Tests des refus par statut |
| 0.9 | Gardes rapides : refuser l'auto-demande et un mentorat déjà actif (M3) ; `expiresAt` et statut mentor à l'acceptation, capacité dans la transaction (M1, M2) ; URLs http(s) uniquement (M14) ; un helper `requireAdmin` avec step-up 2FA pour toutes les actions admin (M6) | `requests.ts`, `sessions.ts`, `messages.ts`, `profile.ts`, `cycles.ts`, `moderation.ts`, `_helpers.ts` | Tests de refus ; toute action admin échoue sans cookie 2FA frais |
| 0.10 | Heures affichées (M10) : les formateurs de `format.ts` et de `sessions/page.tsx` reçoivent un `timeZone` (profil du viewer) et la locale active ; défaut `Europe/Paris` documenté | `dashboard/_components/format.ts`, `sessions/page.tsx`, `sessions/[id]/page.tsx`, overviews | Test unitaire : un instant UTC d'été s'affiche à l'heure de Paris et de Londres comme attendu |
| 0.11 | Lien mort (M16) : retirer le bouton de modification de ressource ou créer la page | `dashboard/resources/page.tsx:489` | Aucun 404 depuis l'UI |
| 0.12 | Séances jamais clôturées (B8, minimal) : le cron marque COMPLETED les séances SCHEDULED terminées depuis plus de 48 h (point ouvert 3, décidé : 48 h) | `api/cron/sessions-reminder/route.ts` | Les avis deviennent possibles sans action du mentor |

**Tests de la phase** : `src/lib/mentora/__tests__/notifications-contract.test.ts`, `errors-i18n.test.ts`, `format-tz.test.ts`, `role-decision.test.ts`, plus un test de parité fr/en sur le namespace `mentora`. Les cas nécessitant la base sont décrits comme checklist manuelle dans la PR et automatisés en phase 1.

**Sortie** : tableau de suivi B1 à B10 et M1 à M3, M6, M10, M14, M16 coché dans la PR.

## Phase 1 : filet de sécurité, tests et garde-fous (taille M)

**But** : pouvoir refactorer sans casser. Rien de fonctionnel ne change.

- **Créer** : harnais d'intégration (`src/test-setup/db.ts`, base de test, **refus d'exécution si l'URL ne porte pas le marqueur de base de test**), `npm run test:integration`, tests de `scheduling.ts` (DST printemps et automne, exceptions EXTRA et BLOCKED, minuit, adjacence, fenêtre de 56 jours), script `scripts/mentora-bundle-report.mjs` (basé sur `audit-scripts/bundle-sizes.mjs`) avec les budgets de `02-architecture.md` 7.2, tests de parité fr/en et de glossaire, règles ESLint (`react/forbid-dom-props` pour `style` sur `src/app/mentora/**`, interdiction des formateurs de dates hors `format/`, `no-restricted-imports` pour `domain/`).
- **Modifier** : `package.json` (scripts), configuration CI, `eslint.config.mjs` (règles en avertissement avec compteur de référence, pour ne pas bloquer).
- **Documenter** : supprimer `.next/dev` avant build local (README), cause de l'échec de typecheck constaté dans l'audit.
- **Acceptation** : tests d'intégration verts sur une base vide migrée ; le rapport de bundle affiche les 28 routes avec les valeurs de départ (118 à 150 Ko) ; compteurs de référence enregistrés (1 530 `style=`, environ 101 textes en dur, 21 helpers).
- **Tests écrits ici** : scheduling (au moins 15 cas) ; un test d'intégration par agrégat (demande, mentorat, séance) qui encode les bugs connus non encore corrigés, marqués `todo`.

## Phase 2 : domaine, politique, services, événements (taille L)

**But** : une seule implémentation de chaque règle, atomique et testée (`02-architecture.md` sections 2 et 3). Sous-sessions dans cet ordre, une PR chacune.

1. **2a Fondations** (S) : créer `src/lib/mentora/domain/{errors.ts,*.machine.ts}`, `policy/can.ts`, `src/lib/actions/mentora/define-action.ts`, type `Result`, catalogue `ErrorCode` avec test i18n. Tests : toutes les transitions de chaque machine, `can()` en table.
2. **2b Demandes** (M) : `services/requests.ts` (envoi, acceptation transactionnelle avec verrou, refus, retrait, expiration lazy et cron) ; migrations E1 à E3 pour demandes et mentorats (uniques partiels, `mentorshipId`, `decidedAt`) ; suppression des anciennes actions. Tests d'intégration : deux acceptations concurrentes, refus répété, auto-demande.
3. **2c Mentorats et objectifs** (S) : `services/mentorships.ts` (pause, reprise, clôture, terminaison avec effets : annulation des séances futures, notification), nouveau mentorat au lieu de la réactivation, objectifs sans doublon ni chaîne anglaise.
4. **2d Séances** (M) : `services/sessions.ts` avec contrainte d'exclusion (migrations E2 et E3), états dérivés (en cours, à confirmer), NO_SHOW, clôture automatique, avis, fichier ICS ; plus de `IN_PROGRESS` côté code. Tests d'intégration : double réservation, conflit mentee, mentorat en pause, annulation.
5. **2e Notifications et événements** (M) : `events/`, `Notification.dedupeKey`, insertion dans la file d'emails existante, templates par type dans la locale du destinataire (`User.locale`, migration), regroupement des messages, nouveaux types (`02-architecture.md` 3.4), crons réécrits en consommateurs idempotents. Test de contrat des templates.
6. **2f Mentors et admin** (M) : `services/mentors.ts` (candidature atomique qui finit en PENDING_REVIEW, approbation sans toucher au rôle, refus avec motif, suspension avec effets, réactivation depuis SUSPENDED seulement), `requireAdmin` unique avec step-up, journal d'audit systématique ; suppression des actions migrées de `profile.ts`, `moderation.ts`, `cycles.ts`.
7. **2g Messages** (S) : `services/messages.ts` (pagination par curseur, lecture seule hors mentorat actif, marquage lu par action et non par GET), `GET /api/mentora/messages` réécrite sans effet de bord.

**Supprimé en fin de phase** : anciens `src/lib/actions/mentora/{requests,sessions,mentorships,reviews,messages,moderation}.ts`, fichiers de ré-export (`discover.ts`, `mentor-skills.ts`, `current-profile.ts`), `requireMentor`, `requireMentee`, `setAvailabilityRules` si non repris.
**Acceptation** : plus aucun accès `prisma.` dans `src/lib/actions/mentora` ; `domain` sans dépendance interdite ; tous les cas `todo` de la phase 1 passent ; B1 à B10 et M1 à M5, M8, M9 clos.

## Phase 3 : données et schéma, étapes restantes (taille M)

**But** : exécuter E4 à E7 de `02-architecture.md` 8.3.

- **Créer** : script de migration des photos (`scripts/migrate-photos.ts`, idempotent, par lots, `--dry-run` par défaut), `prisma/RAW-SQL.md`, contrôle CI de dérive des index bruts, traitement hebdomadaire de rétention RGPD (3 ans, constante en code) dans le cron quotidien existant, le plan Hobby ne permettant pas un cron de plus.
- **Modifier** : `schema.prisma` (suppression de `hourlyRate`, `AvailabilityRule.timezone`, `helpfulnessVotes` après vérification d'usage ; ajout `slug`), lecture des photos par URL de stockage.
- **Acceptation** : après sauvegarde et une semaine d'observation sans erreur, suppression des anciennes colonnes ; payload HTML de la découverte sous 150 Ko ; export RGPD couvrant tous les modèles Mentora (test).
- **Dépend** de la phase 2 déployée et stable, et d'actions du propriétaire (pré-vols en lecture seule, sauvegarde).

## Phase 4 : fondation UI et écrans par parcours (taille L)

**But** : une interface cohérente et mobile-first (`02-architecture.md` sections 5 et 6).

1. **4a Bibliothèque et shell** (M) : `src/components/mentora/ui/*`, layout unique `(app)`, `getViewer()` partagé, navigation par capacités, `format/` (formateur unique, fuseau du viewer), fusion de `OnboardingShell` dans `AppShell`, glossaire fr appliqué ; suppression des 4 copies de layout et des 21 helpers.
2. **4b Parcours mentee** (L) : onboarding en étapes, découverte, profil mentor (`/mentora/mentors/[slug]`), demande, mentorats, séances, avis. Styles inline remplacés par la bibliothèque ; `loading.tsx` et états vides partout.
3. **4c Parcours mentor** (M) : candidature par étapes, écran de statut, disponibilités, demandes, séances, notes.
4. **4d Admin** (M) : pilotage, mentors (validation et modération), mentorats (matching et suivi), mentees, rapports, réglages ; suppression de `admin/cycles` et de la carte de réglages non appliqués (point ouvert 1, décidé : supprimer), fusion de `admin/matching` et `admin/moderation` dans les écrans mentors et mentorats.

- **Supprimer** : `AdminPlaceholder.tsx`, `Wizard.tsx`, `dashboard/notifications/NotificationBell.tsx`, classes CSS mortes, clés i18n mortes (liste de `i18n-check.mjs`).
- **Acceptation par écran** : zéro `style=` (règle ESLint passée en erreur à la fin de 4d), zéro texte en dur, budgets de bundle respectés, captures 360 et 1280 px relues, composants serveur par défaut.
- **Tests** : tests légers de `StatusBadge`, `DateTime`, `DataList` ; e2e de chaque parcours livré (phase 6).

## Phase 5 : performance et requêtes (taille M)

- **Modifier** : `discovery.ts` devient `queries/discover.ts` : filtres `format` et `minRating` appliqués en base avant pagination, `deletedAt` partout, agrégats d'avis par `groupBy` sur identifiant de mentor, recommandations limitées à 50 candidats préfiltrés en SQL (langue, compétences) au lieu de 200 complets ; profil public en une requête, sans double `auth()` ; `getViewer()` en `React.cache`.
- **Découper** les wizards en étapes de moins de 200 lignes ; remplacer les petits composants client par des formulaires à action serveur.
- **Acceptation** : budgets de `02-architecture.md` 7.2 atteints sur les 23 routes ; au plus 6 requêtes Prisma par navigation de layout ; aucune requête qui charge plus de 3 fois ce qu'elle affiche.
- **Tests** : intégration des filtres de découverte (page complète, total exact) ; rapport de bundle en CI en mode bloquant.

## Phase 6 : parcours e2e, accessibilité, durcissement (taille M)

- **Créer** : `e2e/mentora-mentee.spec.ts`, `e2e/mentora-mentor.spec.ts`, `e2e/mentora-admin.spec.ts` (parcours a à f de `02-architecture.md` 7.1), script de seed de test qui refuse de tourner contre la production, captures mobiles, vérification d'accessibilité (axe) des écrans principaux, test de non-fuite de `mentorNotesPrivate` côté mentee.
- **Acceptation** : parcours complets verts en CI sur preview ; aucune violation axe critique ; revue manuelle d'un parcours sur téléphone réel.

## Phase 7 : nettoyage et documentation (taille S)

- **Supprimer** : tables et champs gelés (cycles, réglages non appliqués ; point ouvert 1 décidé), valeur d'enum `IN_PROGRESS` si faisable, exports orphelins restants (liste de `code-metrics.mjs`).
- **Documenter** : `PROJECT.md`, `ARCHITECTURE.md`, runbook (rappels, file d'emails, migrations), `CHANGELOG.md`.
- **Acceptation** : `code-metrics.mjs` montre zéro export orphelin dans le périmètre, zéro composant non importé, zéro `style=` ; tous les budgets verts.

## Récapitulatif

| Phase | Objet | Taille | Dépend de |
|---|---|---|---|
| 0 | Bloquants sur le code actuel | M | rien |
| 1 | Tests et garde-fous | M | 0 |
| 2 | Domaine, politique, services, événements | L | 1 |
| 3 | Données et schéma, étapes restantes | M | 2 |
| 4 | UI : fondation puis parcours | L | 2 (4a peut démarrer après 1) |
| 5 | Performance et requêtes | M | 2, 4a |
| 6 | E2E, accessibilité, durcissement | M | 4 |
| 7 | Nettoyage et docs | S | tout |

Ordre recommandé si les ressources sont limitées : 0, puis 1, puis 2b et 2d (demandes et séances, là où sont les bugs de données), puis 4a et 4b (ce que l'utilisateur voit), puis le reste.

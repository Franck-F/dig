---
title: "Spec — Phase 0 sécurité (correctifs exploitables)"
date: 2026-06-22
status: validé (design approuvé), à implémenter
source: reports/2026-06-22-audit-multi-agents.md
branch: design/page-positioning
---

# Phase 0 — Correctifs de sécurité exploitables

## Contexte & périmètre

Suite à l'audit multi-agents (`reports/2026-06-22-audit-multi-agents.md`), on traite
les **4 findings sécurité les plus prioritaires** — 2 failles activement exploitables
et 2 quick-wins à fort ratio. Objectif : fermer les vecteurs d'attaque concrets sur
une application qui manipule des PII de jeunes (potentiellement mineures).

**Décisions de design validées par le tech lead (2026-06-21/22) :**
- Rate-limit 2FA → **verrou persisté en base** (robuste, indépendant de Redis).
- IDOR mentee → accès si **`Mentorship` (tout statut)** OU **`MentorshipRequest` PENDING/ACCEPTED** ; ADMIN toujours.

## Non-goals (explicitement hors périmètre de cette phase)

- Toutes les findings **medium/low** de l'audit.
- Les autres findings **high** (race condition capacité mentor, `pickWinnersAndAnnounce`,
  énumération `requestPasswordReset`, `handleError`, dette archi/design).
- Les dimensions **Performance** et **RGPD dédié** (finders en timeout — à relancer).
- Aucun changement de comportement produit hors sécurité.

---

## Correctif 1 — Verrou anti-brute-force sur le 2FA

**Problème.** `verifyTotpChallenge` (`src/lib/actions/two-factor.ts:133-200`) vérifie le
code TOTP / les codes de secours sans aucun rate-limit ni lockout (grep `checkAuthRateLimit`
= 0 match dans ce fichier). Une session authentifiée peut marteler `/account/2fa/challenge`
(10⁶ combinaisons TOTP) pour franchir le 2FA d'un compte ADMIN/modérateur/mentor — la
surface au plus fort privilège. `disableTotp` (`:225`) et `regenerateBackupCodes` (`:290`)
appellent aussi `verifyTotp` sans protection.

**Design.**

1. **Schema Prisma** (`prisma/schema.prisma`, modèle `User`) — ajouter :
   ```prisma
   failedTotpAttempts Int       @default(0)
   totpLockedUntil    DateTime?
   ```
   Migration : `npx prisma migrate dev --name totp_lockout` (génération en dev ;
   l'application en staging/prod via `npm run db:migrate:deploy` est une **action
   utilisateur**, pas automatisée par le correctif).

2. **Constantes** : `MAX_TOTP_ATTEMPTS = 5`, `TOTP_LOCK_MS = 15 * 60 * 1000`.

3. **Helper pur testable** — extraire la logique de décision (sans I/O) :
   ```ts
   // évalue l'état courant + une tentative, renvoie la prochaine action
   evaluateTotpLockout(input: { failedAttempts: number; lockedUntil: Date | null; nowMs: number })
     => { locked: boolean; retryAfterMs?: number }
   nextFailureState(failedAttempts, nowMs)
     => { failedTotpAttempts: number; totpLockedUntil: Date | null }
   ```
   C'est ce helper qui est couvert par les tests unitaires (`node:test`).

4. **Câblage** dans les 3 actions :
   - **Avant** toute vérification : si `totpLockedUntil && totpLockedUntil > now` →
     retourner un nouveau code d'erreur `'locked'`.
   - **Échec** de code (chemins TOTP *et* backup) : `failedTotpAttempts += 1` ;
     si `>= MAX` → `totpLockedUntil = now + TOTP_LOCK_MS` et reset du compteur à 0 ;
     retourner `'invalid_code'` (ou `'locked'` si le seuil vient d'être atteint).
   - **Succès** : `failedTotpAttempts = 0`, `totpLockedUntil = null` (dans le même
     `prisma.user.update` que l'effet existant — ex. consommation du backup code).

5. **Types & UI** :
   - Ajouter `'locked'` aux unions `TotpChallengeState`, `TotpDisableState`,
     `TotpRegenerateBackupState`.
   - Mapper `'locked'` vers un message i18n dans `src/app/account/2fa/challenge/ChallengeForm.tsx`
     (+ les formulaires settings pour disable/regenerate) avec nouvelles clés
     `messages/fr.json` et `messages/en.json` (ex. `account.2fa.errors.locked`).

6. **Audit** : `logAdmin(userId, { action: 'account.2fa_locked', ... })` au moment du lock.

**Edge cases.** Le compteur est partagé entre les 3 flux (challenge / disable / regenerate)
car tous protègent la même clé TOTP. Pas de keying IP (l'utilisateur est déjà authentifié →
keying naturel = `userId`, déjà la PK de la ligne mise à jour).

**Tests.** Unitaires sur `evaluateTotpLockout` / `nextFailureState` (seuil, fenêtre,
reset au succès, expiration du lock). Le câblage action est vérifié par typecheck + revue.

---

## Correctif 2 — IDOR sur le profil mentee

**Problème.** `src/app/mentora/mentees/[handle]/page.tsx:138-150` charge le profil mentee
complet (objectifs, défis, localisation, fuseau, langues, niveau, compétences) **dès que**
le viewer a le rôle MENTOR ou ADMIN, sans vérifier de lien avec la mentee. Le rôle MENTOR
étant auto-attribuable (`actions/welcome.ts`), tout compte peut énumérer les PII de toutes
les mentees via `/mentora/mentees/<userId>`.

**Design.**

1. Après le gate de rôle existant (l.133-135) et le chargement de `menteeProfile`,
   ajouter un **contrôle de relation** :
   - `viewer.role === 'ADMIN'` → autorisé.
   - Sinon (MENTOR) : exiger `viewerMentorProfileId` non nul **et** au moins l'un de :
     - un `Mentorship` `{ mentorProfileId: viewerMentorProfileId, menteeProfileId: menteeProfile.id }` (tout statut), OU
     - un `MentorshipRequest` `{ toMentorId: viewerMentorProfileId, fromMenteeId: menteeProfile.id, status: { in: ['PENDING','ACCEPTED'] } }`.
   - Sinon → `notFound()`.

2. **Implémentation propre** : extraire un helper d'autorisation testable dans
   `src/lib/mentora/` (ex. `canViewerSeeMenteeProfile({ viewerRole, viewerMentorProfileId, menteeProfileId })`
   renvoyant un booléen après requêtes Prisma), appelé par la page. Garde la logique
   d'accès hors du composant de rendu (cf. finding archi « pas de couche d'accès »).

3. La requête `sharedMentorships` existante (l.168-176) reste pour le bloc « Historique
   avec moi » ; le nouveau contrôle s'ajoute **en amont** de l'affichage (peut réutiliser
   un `findFirst` léger plutôt que de recharger).

**Edge cases.**
- MENTOR sans `MentorProfile` (`viewerMentorProfileId` null) → aucune relation possible → `notFound()`.
- Statuts de requête `DECLINED / WITHDRAWN / EXPIRED` → **n'ouvrent pas** l'accès.
- `generateMetadata` (l.88-110) lit aussi le nom de la mentee sans gate : aligner pour ne
  pas fuiter le nom dans le `<title>` à un viewer non autorisé (renvoyer le titre générique
  si l'accès serait refusé) — à confirmer à l'implémentation.

**Tests.** Unitaires sur le helper d'autorisation (matrice : admin / mentor-avec-mentorship /
mentor-avec-requête-pending / mentor-avec-requête-declined / mentor-sans-lien / mentor-sans-profil).
Vérification manuelle de la page (notFound réel).

---

## Correctif 3 — Injection de formule CSV dans l'export admin

**Problème.** `csvCell` (`src/app/api/admin/mentora/reports/export/route.ts:51-57`) échappe
les guillemets/virgules/sauts de ligne (RFC 4180) mais **pas** les cellules commençant par
`= + - @ \t \r`. Des champs user-controlled (noms, `review.comment`, `mentor.headline`,
`mentee.goals`) sont exportés tels quels ; un `=HYPERLINK(...)` saisi en prénom s'exécute à
l'ouverture du CSV (BOM UTF-8 + `text/csv` → Excel) par un admin.

**Design.** Neutraliser dans `csvCell` (couvre les 6 `kind` d'un coup) :
```ts
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;   // anti formula-injection (OWASP)
  if (s.includes('"')) s = s.replace(/"/g, '""');
  if (/[",\n\r]/.test(s)) s = `"${s}"`;
  return s;
}
```
Le préfixe apostrophe est ajouté **avant** le quoting RFC 4180.

**Tests.** Unitaires purs : `=cmd`, `+1`, `-1`, `@x`, `\tx`, texte normal, texte avec
virgule/guillemet/retour ligne, `Date`, `null`. Candidat TDD idéal.

---

## Correctif 4 — Gate cookie 2FA sur l'export admin

**Problème.** Le handler `GET` (`route.ts:288-300`) vérifie `session` + `role === 'ADMIN'`
mais pas `hasFreshAdmin2faCookie`. La page `/mentora/admin/reports` est derrière le layout
2FA, mais l'URL d'API `/api/admin/mentora/reports/export` ne l'est pas : une session ADMIN
au cookie 2FA expiré peut `GET …/export?kind=mentees` et exfiltrer les PII, court-circuitant
la step-up 2FA.

**Design.** Après le check de rôle (l.298-300), ajouter :
```ts
import { hasFreshAdmin2faCookie } from '@/lib/auth/admin-2fa-cookie';
// …
if (!(await hasFreshAdmin2faCookie(userId))) {
  return NextResponse.json({ error: 'forbidden_2fa' }, { status: 403 });
}
```

**Tests.** Logique triviale ; vérification par revue + manuel (cookie absent → 403).
Optionnel : généraliser le garde à tout `/api/admin/*` (hors périmètre, à noter pour plus tard).

---

## Stratégie de tests & vérification

- `npm run typecheck` (zéro erreur) et `npm run lint`.
- `npm test` (les 76 tests existants restent verts + nouveaux tests des helpers purs :
  lockout 2FA, autorisation mentee, `csvCell`).
- Vérification manuelle/raisonnée pour les surfaces non unit-testables (page IDOR, route export).

## Rollout / déploiement

1. La migration `totp_lockout` doit être **appliquée à la base** (`db:migrate:deploy`) —
   **action utilisateur** ; le code des correctifs ne lance aucune migration en prod.
2. Aucun feature flag nécessaire ; tous les changements sont des durcissements
   sans impact sur le parcours nominal.
3. Suggestion de commit : un commit par correctif (atomiques, faciles à reviewer/revert),
   sur une branche dédiée — **à committer uniquement sur demande explicite**
   (WIP non commité déjà présent sur `design/page-positioning`).

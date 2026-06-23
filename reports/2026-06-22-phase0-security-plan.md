# Phase 0 Sécurité — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, choisi par le tech lead) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fermer les 4 findings sécurité exploitables/prioritaires de digizelle-webapp-public (injection CSV, gate 2FA export, brute-force 2FA, IDOR profil mentee).

**Architecture:** Extraire la logique de décision (échappement CSV, lockout 2FA, autorisation mentee) dans des helpers purs sous `src/lib/**` (testables par `node:test`), et brancher ces helpers dans les server actions / route handlers / server components existants. Durcissements uniquement — aucun changement du parcours nominal.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, TypeScript 5, Prisma 6 (`@prisma/client`), next-auth v5 (beta), zod, bcryptjs ; tests `node:test` avec `--experimental-strip-types`.

## Global Constraints

- Tests UNIQUEMENT sous `src/lib/{mentora,community,auth,email,images,storage}/__tests__/*.test.ts` (sinon `npm test` ne les exécute pas). Importer les modules frères avec l'extension `.ts` explicite (ex. `from '../report-csv.ts'`).
- `npx prisma generate` est SANS DB (régénère les types client) → autorisé. `prisma migrate dev/deploy` touche une vraie base → **action utilisateur**, jamais lancé automatiquement.
- Ne jamais `git add` le WIP design (`src/app/page.tsx`, `src/styles/design-system.css`) — il reste hors des commits sécurité.
- Suivre le style existant : `ChallengeForm` utilise des chaînes FR en dur (pas de next-intl).
- Un commit par correctif, sur la branche `security/phase0-exploitable` (base `main`). Commit + PR autorisés par le tech lead.
- Vérif finale obligatoire : `npm run typecheck` + `npm run lint` + `npm test` tous verts.

---

## Task 0: Préparer la branche (setup)

**Files:** aucun (git only).

- [ ] **Step 1 — Confirmer l'état + isoler le WIP design**

⚠️ Confirmation utilisateur requise avant de toucher au WIP non commité.
```bash
git -C /c/Users/Franck/Documents/digizelle-webapp-public status --short
# Stash CIBLÉ des 2 fichiers WIP design uniquement :
git -C /c/Users/Franck/Documents/digizelle-webapp-public stash push -m "WIP design page-positioning (phase0 sécu)" -- src/app/page.tsx src/styles/design-system.css
```

- [ ] **Step 2 — Créer la branche sécurité depuis main**
```bash
git -C /c/Users/Franck/Documents/digizelle-webapp-public checkout main
git -C /c/Users/Franck/Documents/digizelle-webapp-public checkout -b security/phase0-exploitable
```
Note restauration (après PR) : `git checkout design/page-positioning && git stash pop`.

---

## Task 1: Injection de formule CSV (fix #3)

**Files:**
- Create: `src/lib/mentora/report-csv.ts`
- Test: `src/lib/mentora/__tests__/report-csv.test.ts`
- Modify: `src/app/api/admin/mentora/reports/export/route.ts` (importer `csvCell`/`toCsv`, retirer les copies locales l.50-64)

**Interfaces:**
- Produces: `csvCell(v: unknown): string`, `toCsv(headers: string[], rows: unknown[][]): string`

- [ ] **Step 1: Écrire le test qui échoue**
```ts
// src/lib/mentora/__tests__/report-csv.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, toCsv } from '../report-csv.ts';

test('csvCell: préfixe les caractères de formule par une apostrophe', () => {
  assert.equal(csvCell('=1+1'), "'=1+1");
  assert.equal(csvCell('+33'), "'+33");
  assert.equal(csvCell('-2'), "'-2");
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(csvCell('\tx'), "'\tx");
});

test('csvCell: formule + guillemets + virgule échappés ensemble', () => {
  assert.equal(csvCell('=A,"B"'), `"'=A,""B"""`);
});

test('csvCell: texte sûr inchangé', () => {
  assert.equal(csvCell('Marie Curie'), 'Marie Curie');
  assert.equal(csvCell(42), '42');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(undefined), '');
});

test('csvCell: wrap RFC 4180 conservé', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.equal(csvCell('a\nb'), '"a\nb"');
});

test('toCsv: BOM + en-têtes + lignes en CRLF', () => {
  const out = toCsv(['x', 'y'], [['=1', 'ok']]);
  assert.equal(out, "﻿x,y\r\n'=1,ok\r\n");
});
```

- [ ] **Step 2: Lancer le test (doit échouer)**

Run: `node --import ./src/test-setup/register-loader.mjs --test --experimental-strip-types src/lib/mentora/__tests__/report-csv.test.ts`
Expected: FAIL (`Cannot find module '../report-csv.ts'`).

- [ ] **Step 3: Implémenter le module**
```ts
// src/lib/mentora/report-csv.ts
/** RFC 4180 + neutralisation des injections de formule (Excel/Sheets). */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = v instanceof Date ? v.toISOString() : String(v);
  // Préfixe les cellules débutant par un déclencheur de formule.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (s.includes('"')) s = s.replace(/"/g, '""');
  if (/[",\n\r]/.test(s)) s = `"${s}"`;
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  // BOM pour qu'Excel ouvre l'UTF-8 correctement.
  const lines: string[] = ['﻿' + headers.map(csvCell).join(',')];
  for (const r of rows) lines.push(r.map(csvCell).join(','));
  return lines.join('\r\n') + '\r\n';
}
```

- [ ] **Step 4: Lancer le test (doit passer)**

Run: `node --import ./src/test-setup/register-loader.mjs --test --experimental-strip-types src/lib/mentora/__tests__/report-csv.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Câbler le route handler**

Dans `src/app/api/admin/mentora/reports/export/route.ts` : supprimer les fonctions locales `csvCell` (l.50-57) et `toCsv` (l.59-64), et ajouter en tête :
```ts
import { csvCell, toCsv } from '@/lib/mentora/report-csv';
```
(`csvCell` reste utilisé par `userName`? non — `userName` n'utilise pas `csvCell`. Vérifier qu'aucune autre référence locale ne casse.)

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: 0 erreur.

- [ ] **Step 7: Commit**
```bash
git add src/lib/mentora/report-csv.ts src/lib/mentora/__tests__/report-csv.test.ts src/app/api/admin/mentora/reports/export/route.ts
git commit -m "fix(security): neutralize CSV formula injection in admin export"
```

---

## Task 2: Gate cookie 2FA sur l'export (fix #4)

**Files:**
- Modify: `src/app/api/admin/mentora/reports/export/route.ts` (handler `GET`, après le check de rôle l.298-300)

**Interfaces:**
- Consumes: `hasFreshAdmin2faCookie(uid: string): Promise<boolean>` (de `@/lib/auth/admin-2fa-cookie`)

- [ ] **Step 1: Ajouter l'import**
```ts
import { hasFreshAdmin2faCookie } from '@/lib/auth/admin-2fa-cookie';
```

- [ ] **Step 2: Ajouter le gate après le check ADMIN**

Juste après le bloc `if (me?.role !== 'ADMIN') { return ... 403 }` :
```ts
  if (!(await hasFreshAdmin2faCookie(userId))) {
    return NextResponse.json({ error: 'forbidden_2fa' }, { status: 403 });
  }
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: 0 erreur.

- [ ] **Step 4: Vérification manuelle (pas de test unitaire — route handler lié session/cookie)**

Raisonnement à confirmer : session ADMIN sans cookie 2FA frais → `GET …/export?kind=mentees` renvoie 403 `forbidden_2fa` au lieu du CSV. Le parcours normal (page reports derrière le layout 2FA) reste inchangé car le cookie est frais.

- [ ] **Step 5: Commit**
```bash
git add src/app/api/admin/mentora/reports/export/route.ts
git commit -m "fix(security): require fresh admin 2FA cookie on report CSV export"
```

---

## Task 3: Helper pur de lockout 2FA (fix #1, partie A)

**Files:**
- Create: `src/lib/auth/totp-lockout.ts`
- Test: `src/lib/auth/__tests__/totp-lockout.test.ts`

**Interfaces:**
- Produces:
  - `MAX_TOTP_ATTEMPTS: number` (= 5), `TOTP_LOCK_MS: number` (= 900000)
  - `isTotpLocked(lockedUntil: Date | null, nowMs: number): boolean`
  - `nextTotpFailureState(failedAttempts: number, nowMs: number): { failedTotpAttempts: number; totpLockedUntil: Date | null }`
  - `TOTP_SUCCESS_STATE: { failedTotpAttempts: 0; totpLockedUntil: null }`

- [ ] **Step 1: Écrire le test qui échoue**
```ts
// src/lib/auth/__tests__/totp-lockout.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isTotpLocked,
  nextTotpFailureState,
  MAX_TOTP_ATTEMPTS,
  TOTP_LOCK_MS,
} from '../totp-lockout.ts';

test('isTotpLocked: faux sans verrou', () => {
  assert.equal(isTotpLocked(null, 1000), false);
});
test('isTotpLocked: vrai tant que le verrou est futur', () => {
  assert.equal(isTotpLocked(new Date(2000), 1000), true);
});
test('isTotpLocked: faux une fois le verrou expiré', () => {
  assert.equal(isTotpLocked(new Date(1000), 2000), false);
});
test('nextTotpFailureState: incrémente sous le seuil', () => {
  assert.deepEqual(nextTotpFailureState(0, 1000), { failedTotpAttempts: 1, totpLockedUntil: null });
  assert.deepEqual(nextTotpFailureState(3, 1000), { failedTotpAttempts: 4, totpLockedUntil: null });
});
test('nextTotpFailureState: verrouille au seuil et remet le compteur à 0', () => {
  const r = nextTotpFailureState(MAX_TOTP_ATTEMPTS - 1, 1000);
  assert.equal(r.failedTotpAttempts, 0);
  assert.equal(r.totpLockedUntil?.getTime(), 1000 + TOTP_LOCK_MS);
});
```

- [ ] **Step 2: Lancer le test (doit échouer)**

Run: `node --import ./src/test-setup/register-loader.mjs --test --experimental-strip-types src/lib/auth/__tests__/totp-lockout.test.ts`
Expected: FAIL (`Cannot find module '../totp-lockout.ts'`).

- [ ] **Step 3: Implémenter le helper**
```ts
// src/lib/auth/totp-lockout.ts
export const MAX_TOTP_ATTEMPTS = 5;
export const TOTP_LOCK_MS = 15 * 60 * 1000;

export function isTotpLocked(lockedUntil: Date | null, nowMs: number): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > nowMs;
}

/** État persisté à écrire après un échec de vérification. */
export function nextTotpFailureState(
  failedAttempts: number,
  nowMs: number,
): { failedTotpAttempts: number; totpLockedUntil: Date | null } {
  const attempts = failedAttempts + 1;
  if (attempts >= MAX_TOTP_ATTEMPTS) {
    return { failedTotpAttempts: 0, totpLockedUntil: new Date(nowMs + TOTP_LOCK_MS) };
  }
  return { failedTotpAttempts: attempts, totpLockedUntil: null };
}

/** État à écrire après une vérification réussie. */
export const TOTP_SUCCESS_STATE = {
  failedTotpAttempts: 0,
  totpLockedUntil: null,
} as const;
```

- [ ] **Step 4: Lancer le test (doit passer)**

Run: `node --import ./src/test-setup/register-loader.mjs --test --experimental-strip-types src/lib/auth/__tests__/totp-lockout.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**
```bash
git add src/lib/auth/totp-lockout.ts src/lib/auth/__tests__/totp-lockout.test.ts
git commit -m "feat(security): add pure TOTP lockout helpers (tested)"
```

---

## Task 4: Schema + migration + câblage lockout (fix #1, partie B)

**Files:**
- Modify: `prisma/schema.prisma` (modèle `User`)
- Create: `prisma/migrations/<timestamp>_totp_lockout/migration.sql`
- Modify: `src/lib/actions/two-factor.ts` (`verifyTotpChallenge`, `disableTotp`, `regenerateBackupCodes`, + unions de types)
- Modify: `src/app/account/2fa/challenge/ChallengeForm.tsx` (message `locked`)

**Interfaces:**
- Consumes: `isTotpLocked`, `nextTotpFailureState`, `TOTP_SUCCESS_STATE` (Task 3)

- [ ] **Step 1: Ajouter les colonnes au modèle User**

Dans `prisma/schema.prisma`, modèle `User`, ajouter :
```prisma
  failedTotpAttempts Int       @default(0)
  totpLockedUntil    DateTime?
```

- [ ] **Step 2: Régénérer le client Prisma (sans DB)**

Run: `npx prisma generate`
Expected: « Generated Prisma Client ». (Aucune connexion DB requise.)

- [ ] **Step 3: Créer le fichier de migration SQL**

Créer `prisma/migrations/20260622000000_totp_lockout/migration.sql` :
```sql
-- Anti-brute-force 2FA : compteur d'échecs + verrou temporel
ALTER TABLE "User" ADD COLUMN "failedTotpAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "totpLockedUntil" TIMESTAMP(3);
```
⚠️ Application à une vraie base = **action utilisateur** (`npm run db:migrate:deploy` en staging/prod, ou `npm run db:migrate` en dev). Vérifier le nom exact de la table (`"User"`) contre les migrations existantes.

- [ ] **Step 4: Câbler `verifyTotpChallenge`**

Ajouter l'import en tête de `two-factor.ts` :
```ts
import { isTotpLocked, nextTotpFailureState, TOTP_SUCCESS_STATE } from '@/lib/auth/totp-lockout';
```
Étendre le `select` (l.146-153) avec `failedTotpAttempts: true, totpLockedUntil: true`.
Après le bloc `not_enabled` (l.154-156), ajouter le garde de verrou :
```ts
  const nowMs = Date.now();
  if (isTotpLocked(user.totpLockedUntil, nowMs)) {
    return { status: 'error', error: 'locked' };
  }
```
Chemin backup — échec (remplacer `return { status: 'error', error: 'invalid_code' }` l.170-172) :
```ts
    if (!matchedHash) {
      const fail = nextTotpFailureState(user.failedTotpAttempts, nowMs);
      await prisma.user.update({ where: { id: me.userId }, data: fail });
      return { status: 'error', error: fail.totpLockedUntil ? 'locked' : 'invalid_code' };
    }
```
Chemin backup — succès (l.173-178) : ajouter le reset dans le `data` du `update` existant :
```ts
      data: {
        totpBackupCodeHashes: user.totpBackupCodeHashes.filter((h) => h !== matchedHash),
        ...TOTP_SUCCESS_STATE,
      },
```
Chemin TOTP — échec (l.189-191) :
```ts
  if (!verifyTotp(user.totpSecret, code)) {
    const fail = nextTotpFailureState(user.failedTotpAttempts, nowMs);
    await prisma.user.update({ where: { id: me.userId }, data: fail });
    return { status: 'error', error: fail.totpLockedUntil ? 'locked' : 'invalid_code' };
  }
```
Chemin TOTP — succès (avant `setAdmin2faCookie` l.193) : reset conditionnel pour éviter une écriture inutile à chaque login :
```ts
  if (user.failedTotpAttempts > 0 || user.totpLockedUntil) {
    await prisma.user.update({ where: { id: me.userId }, data: TOTP_SUCCESS_STATE });
  }
```

- [ ] **Step 5: Ajouter `'locked'` aux unions de types**

Dans `two-factor.ts` : ajouter `| 'locked'` aux `error` de `TotpChallengeState` (l.121), `TotpDisableState` (l.205), `TotpRegenerateBackupState` (l.215).

- [ ] **Step 6: Appliquer le même garde à `disableTotp` et `regenerateBackupCodes`**

Pour chacune : étendre le `select` avec `failedTotpAttempts: true, totpLockedUntil: true` ; après le check `not_enabled`, ajouter le garde `isTotpLocked` (return `'locked'`) ; sur échec `verifyTotp`, écrire `nextTotpFailureState` et retourner `locked`/`invalid_code` ; sur succès, fusionner `...TOTP_SUCCESS_STATE` dans le `data` du `update` existant.

- [ ] **Step 7: Message UI `locked` dans ChallengeForm**

Dans `src/app/account/2fa/challenge/ChallengeForm.tsx`, le ternaire l.73-77, ajouter une branche (chaîne FR en dur, comme l'existant) :
```tsx
            {errKey === 'invalid_code'
              ? 'Code incorrect. Vérifie l\'horloge ou utilise un code de secours.'
              : errKey === 'locked'
                ? 'Trop de tentatives. Réessaie dans quelques minutes.'
                : errKey === 'not_enabled'
                  ? '2FA non configurée. Termine d\'abord la configuration.'
                  : 'Une erreur est survenue. Réessaie.'}
```
Puis grep les autres consommateurs des états disable/regenerate et ajouter une branche `locked` équivalente :
Run: `rg -n "TotpDisableState|TotpRegenerateBackupState|regenerateBackupCodes|disableTotp" src/app`

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: 0 erreur (le client régénéré à l'étape 2 expose les nouveaux champs).

- [ ] **Step 9: Commit**
```bash
git add prisma/schema.prisma prisma/migrations/20260622000000_totp_lockout/migration.sql src/lib/actions/two-factor.ts src/app/account/2fa/challenge/ChallengeForm.tsx
git commit -m "feat(security): persistent brute-force lockout on 2FA verification"
```

---

## Task 5: Helper pur d'autorisation mentee (fix #2, partie A)

**Files:**
- Create: `src/lib/mentora/mentee-access.ts`
- Test: `src/lib/mentora/__tests__/mentee-access.test.ts`

**Interfaces:**
- Produces: `canViewerSeeMenteeProfile(input: { viewerRole: string; hasMentorship: boolean; hasActiveRequest: boolean }): boolean`

- [ ] **Step 1: Écrire le test qui échoue**
```ts
// src/lib/mentora/__tests__/mentee-access.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canViewerSeeMenteeProfile } from '../mentee-access.ts';

test('ADMIN voit toujours', () => {
  assert.equal(canViewerSeeMenteeProfile({ viewerRole: 'ADMIN', hasMentorship: false, hasActiveRequest: false }), true);
});
test('MENTOR avec mentorship voit', () => {
  assert.equal(canViewerSeeMenteeProfile({ viewerRole: 'MENTOR', hasMentorship: true, hasActiveRequest: false }), true);
});
test('MENTOR avec requête active voit', () => {
  assert.equal(canViewerSeeMenteeProfile({ viewerRole: 'MENTOR', hasMentorship: false, hasActiveRequest: true }), true);
});
test('MENTOR sans lien ne voit pas', () => {
  assert.equal(canViewerSeeMenteeProfile({ viewerRole: 'MENTOR', hasMentorship: false, hasActiveRequest: false }), false);
});
test('rôle autre (ni ADMIN ni MENTOR) ne voit pas', () => {
  assert.equal(canViewerSeeMenteeProfile({ viewerRole: 'MENTEE', hasMentorship: true, hasActiveRequest: true }), false);
});
```

- [ ] **Step 2: Lancer le test (doit échouer)**

Run: `node --import ./src/test-setup/register-loader.mjs --test --experimental-strip-types src/lib/mentora/__tests__/mentee-access.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter le helper**
```ts
// src/lib/mentora/mentee-access.ts
export type MenteeAccessInput = {
  viewerRole: string;
  hasMentorship: boolean;
  hasActiveRequest: boolean;
};

/** Un MENTOR ne voit le profil que s'il a un lien (mentorship ou requête active). ADMIN toujours. */
export function canViewerSeeMenteeProfile(i: MenteeAccessInput): boolean {
  if (i.viewerRole === 'ADMIN') return true;
  if (i.viewerRole !== 'MENTOR') return false;
  return i.hasMentorship || i.hasActiveRequest;
}
```

- [ ] **Step 4: Lancer le test (doit passer)**

Run: `node --import ./src/test-setup/register-loader.mjs --test --experimental-strip-types src/lib/mentora/__tests__/mentee-access.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**
```bash
git add src/lib/mentora/mentee-access.ts src/lib/mentora/__tests__/mentee-access.test.ts
git commit -m "feat(security): add pure mentee-profile access helper (tested)"
```

---

## Task 6: Brancher le contrôle d'accès IDOR (fix #2, partie B)

**Files:**
- Modify: `src/app/mentora/mentees/[handle]/page.tsx` (après l.154 ; et `generateMetadata` l.88-110)

**Interfaces:**
- Consumes: `canViewerSeeMenteeProfile` (Task 5)

- [ ] **Step 1: Ajouter l'import**
```ts
import { canViewerSeeMenteeProfile } from '@/lib/mentora/mentee-access';
```

- [ ] **Step 2: Contrôle d'accès après le chargement de `menteeProfile`**

Juste après `const menteeProfile = targetUser.menteeProfile;` (l.154) :
```ts
  const viewerMentorProfileId = viewer.mentorProfile?.id ?? null;
  let accessAllowed = viewer.role === 'ADMIN';
  if (!accessAllowed && viewer.role === 'MENTOR' && viewerMentorProfileId) {
    const [linkMentorship, activeRequest] = await Promise.all([
      prisma.mentorship.findFirst({
        where: { mentorProfileId: viewerMentorProfileId, menteeProfileId: menteeProfile.id },
        select: { id: true },
      }),
      prisma.mentorshipRequest.findFirst({
        where: {
          toMentorId: viewerMentorProfileId,
          fromMenteeId: menteeProfile.id,
          status: { in: ['PENDING', 'ACCEPTED'] },
        },
        select: { id: true },
      }),
    ]);
    accessAllowed = canViewerSeeMenteeProfile({
      viewerRole: viewer.role,
      hasMentorship: Boolean(linkMentorship),
      hasActiveRequest: Boolean(activeRequest),
    });
  }
  if (!accessAllowed) notFound();
```
Note : la déclaration existante de `viewerMentorProfileId` (l.159) devient redondante — la supprimer pour éviter la double déclaration (la nouvelle est plus haut).

- [ ] **Step 3: Colmater la fuite de nom dans `generateMetadata`**

Remplacer le corps de `generateMetadata` (l.88-110) par un titre générique (pas de requête, pas de fuite du nom à un viewer non autorisé) :
```ts
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Profil mentee — Digizelle',
    description: 'Profil mentee accessible aux mentors liés.',
  };
}
```
(Retirer le paramètre `params` désormais inutilisé.)

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: 0 erreur.

- [ ] **Step 5: Vérification manuelle (server component)**

Raisonnement : MENTOR sans mentorship ni requête PENDING/ACCEPTED sur `/mentora/mentees/<userId>` → `notFound()`. MENTOR lié, et ADMIN → profil visible. Requête DECLINED/WITHDRAWN/EXPIRED → `notFound()`.

- [ ] **Step 6: Commit**
```bash
git add src/app/mentora/mentees/[handle]/page.tsx
git commit -m "fix(security): enforce relationship check on mentee profile (IDOR)"
```

---

## Task 7: Vérification finale + revue + PR

**Files:** aucun (vérif + git/gh).

- [ ] **Step 1: Suite complète**

Run: `npm run typecheck && npm run lint && npm test`
Expected: typecheck 0 erreur, lint OK, tous les tests verts (76 existants + ~15 nouveaux).

- [ ] **Step 2: Revue indépendante (usage « agence »)**

Dispatcher un agent `Code Reviewer` sur le diff `git diff main...security/phase0-exploitable` — focus correction & sécurité. Traiter tout finding réel avant le PR.

- [ ] **Step 3: Push + PR**
```bash
git push -u origin security/phase0-exploitable
gh pr create --title "Sécurité Phase 0 — failles exploitables (2FA, IDOR, export CSV)" --body "<résumé des 4 correctifs + lien rapport d'audit + note migration totp_lockout à appliquer>"
```
Le corps doit rappeler : **migration `totp_lockout` à appliquer** (`db:migrate:deploy`) avant/au déploiement.

---

## Self-review (couverture du spec)

- Fix #3 (injection CSV) → Task 1 ✅
- Fix #4 (gate 2FA export) → Task 2 ✅
- Fix #1 (lockout 2FA) → Tasks 3 (helper) + 4 (schema/migration/câblage/UI) ✅
- Fix #2 (IDOR) → Tasks 5 (helper) + 6 (câblage page + metadata) ✅
- Migration = action utilisateur (Global Constraints + Task 4 Step 3 + Task 7 PR body) ✅
- Branche dédiée + WIP préservé → Task 0 ✅
- Vérif typecheck/lint/test + revue → Task 7 ✅

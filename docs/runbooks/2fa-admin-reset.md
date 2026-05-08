---
titre: Runbook — Réinitialisation 2FA d'un admin/mod
type: Runbook opérationnel
sévérité: P2
durée_typique: 10 min
dernière_revue: 2026-05-07
prochaine_revue: 2027-05-07
---

# Runbook — Reset 2FA d'un admin ou modérateur

> **Quand exécuter** — un⋅e admin ou modérateur⋅trice :
> - a perdu / cassé / vendu son téléphone et n'a pas de codes de secours,
> - ou a tous ses codes de secours épuisés,
> - et ne peut donc plus passer le challenge 2FA pour entrer dans
>   `/community/admin/*` ou `/mentora/admin/*`.

## Pré-requis

- Toi : compte ADMIN role + 2FA active + accès au dashboard admin.
- Le compte cible : email vérifiable (idéalement par téléphone ou en
  personne — pas juste par email puisque l'email est le facteur de
  premier niveau).

## Procédure

### 1. Vérification d'identité (obligatoire)

**Ne réinitialise jamais sans avoir confirmé l'identité par un canal
hors-bande.** L'email seul ne suffit pas : si l'email est
compromis, on annule le bénéfice du 2FA en réinitialisant.

Canaux acceptés :
- Vidéo (Discord/Meet) avec partage d'écran d'une pièce d'identité.
- Rencontre physique au bureau de l'association.
- Confirmation par 2 autres admin/modos qui connaissent la personne
  (les 2 doivent envoyer un message daté à contact@digizelle.fr).

Documenter le canal utilisé : il sera repris dans le motif de
l'audit log.

### 2. Reset via l'UI

1. Aller sur `/community/admin/users/<handle>` du compte cible.
2. Le panneau **« Réinitialiser la 2FA · ADMIN »** apparaît si :
   - tu es ADMIN role,
   - le compte cible a la 2FA active,
   - le compte cible n'est pas le tien (pas de self-target).
3. Cliquer **Réinitialiser la 2FA**.
4. Saisir le motif (5-500 caractères). Format recommandé :

   ```
   <Date> · <Canal de vérification> · <Justificatif vu>.
   Ex. 2026-05-08 · Vidéo Discord 18 min · CNI vérifiée.
   ```

5. Cliquer **Confirmer le reset**.

### 3. Communication à la personne concernée

L'utilisateur⋅rice est automatiquement déclenché⋅e vers
`/account/2fa/setup?required=1` à la prochaine entrée dans
`/community/admin/*`. Mais **prévenir par message hors-bande** que :

- la 2FA a été réinitialisée à sa demande à HH:MM,
- elle⋅il devra reconfigurer une appli authenticator au prochain
  login (Google Authenticator / 1Password / Authy / etc.),
- les anciens codes de secours sont définitivement invalidés.

### 4. Vérifier dans l'audit log

`/community/admin/audit-log?action=account.2fa_admin_reset` doit
montrer une nouvelle entrée avec :
- ton email comme `actor`,
- l'email de la cible dans `payload.targetEmail`,
- ton motif dans `payload.reason`.

Conserver cette entrée — c'est la preuve que le reset a été tracé.

## Plan B — si quelque chose casse

| Symptôme                                 | Action                                |
| ---------------------------------------- | ------------------------------------- |
| Bouton « Réinitialiser » non visible     | Vérifier que tu es bien ADMIN role et que la cible a la 2FA active |
| Message « Action réservée aux admins »   | Te logguer avec un compte ADMIN       |
| Message « Impossible de cibler son compte » | Tu cibles ton propre compte → utiliser `/account/2fa` (avec un code TOTP frais) |
| Le compte cible reste bloqué après reset | Vider son cookie `dz-admin-2fa` côté navigateur (DevTools → Application → Cookies) — il était simplement encore en cache |

## Fréquence attendue

Cas légitime : 0-2 fois / an pour une asso de cette taille.
Si plus, enquête (les utilisateurs n'enregistrent peut-être pas leurs
codes de secours, on peut renforcer le copy d'onboarding 2FA).

## Historique

| Date       | Auteur | Motif                          |
| ---------- | ------ | ------------------------------ |
| 2026-05-07 | Franck | Création initiale du runbook.  |

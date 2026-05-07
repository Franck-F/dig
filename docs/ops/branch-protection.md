---
titre: Branch protection — main
type: Configuration GitHub à appliquer manuellement
dernière_revue: 2026-05-07
prochaine_revue: 2027-05-07
---

# Branch protection rules — `main`

> **Pourquoi** — `main` est l'unique branche que Vercel déploie en
> production. Sans règle, n'importe qui (ou un commit non revu) peut
> pousser directement et atterrir en prod en quelques secondes. Les
> règles ci-dessous coupent cette voie et exigent passage par PR + CI
> verte avant tout merge.

## Pré-requis

- Repo : https://github.com/Franck-F/dig
- Compte avec rôle Admin sur le repo.
- Le workflow CI (`.github/workflows/ci.yml`) a déjà tourné au moins une
  fois pour que les noms de jobs (« Lint, typecheck, test », « Build ») soient
  reconnus par l'API « required status checks ».

## Règles à appliquer

GitHub → Repository → Settings → Branches → **Add branch ruleset**
(ou Branch Rules legacy si la ruleset UI n'est pas dispo).

Nom : **`Protect main`**
Target : **Branch name pattern** = `main`
Enforcement status : **Active** (pas Evaluate, qui ne bloque pas).
Bypass list : **vide** (pas même les admins ; voir « Plan B » plus bas
pour les cas d'urgence).

### 1. Pull request reviews

- Require a pull request before merging : **on**
- Required approvals : **1** (ou 2 si l'équipe atteint 4 personnes)
- Dismiss stale pull request approvals when new commits are pushed : **on**
- Require review from Code Owners : **off** (CODEOWNERS pas encore défini ;
  passer à on dès qu'il existe)
- Require approval of the most recent reviewable push : **on**
- Require conversation resolution before merging : **on**

### 2. Required status checks

- Require status checks to pass : **on**
- Require branches to be up to date before merging : **on**

Status checks à exiger (auto-completion après le premier run CI) :
  - `Lint, typecheck, test`
  - `Build (Next.js)`

### 3. Restrictions

- Require linear history : **on** (force squash/rebase, pas de merge commit
  spaghetti)
- Require signed commits : **off pour l'instant** (on devra d'abord configurer
  GPG / Sigstore pour Franck + Corto ; ré-évaluer en Phase 2)
- Block force pushes : **on**
- Restrict deletions : **on**

### 4. Push rules complémentaires

- Restrict who can push to matching refs : **uniquement le rôle Admin**
  (les contributeurs passent par PR depuis un fork ou une branche feature).
- Allow force pushes from specific people/teams : **vide**.

### 5. Pour les autres branches (optionnel)

Ruleset `Protect feature branches` ciblant `feature/**`, `fix/**`, `chore/**`
avec :
- Block force pushes : **on**
- Restrict deletions : **off** (on doit pouvoir supprimer après merge)

## Plan B — bypass d'urgence

En cas d'incident où il faut pousser sur `main` immédiatement (regression
critique en prod, AUTH_SECRET fuité, etc.) :

1. Désactiver temporairement la ruleset (Settings → Rules → … → Disable).
2. Pousser le hotfix avec mention dans le commit message :
   `[bypass] reason: <motif>` + référence vers un ticket d'incident.
3. Réactiver la ruleset **immédiatement après le push**.
4. Documenter le bypass dans `docs/rgpd/registre-violations.md` ou
   `docs/runbooks/post-mortems/` avec date, motif, durée du bypass, nom
   de la personne qui a bypassé.

## Vérification

```bash
# Doit échouer avec "Protected branch update failed"
git push origin main --force

# Doit fonctionner depuis une PR mergée par bouton GitHub seulement
# une fois les 2 checks verts.
```

## Historique

| Date       | Auteur | Motif                                       |
| ---------- | ------ | ------------------------------------------- |
| 2026-05-07 | Franck | Documentation initiale, à appliquer T+0.    |

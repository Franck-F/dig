# Runbooks opérationnels

Procédures écrites pour tout ce qui doit pouvoir s'exécuter sous pression
sans réfléchir : rotation de secrets, incidents de sécurité, restauration
DB, etc.

## Sommaire

| Fichier                                 | Sévérité | Quand              |
| --------------------------------------- | -------- | ------------------ |
| [`auth-secret-rotation.md`](./auth-secret-rotation.md) | P1       | Annuel + sur fuite |
| [`rgpd-incident.md`](./rgpd-incident.md)               | P0       | À chaque violation |

## À ajouter au fil de l'eau

- `db-restore.md` — restauration depuis snapshot Supabase.
- `mass-account-deletion.md` — suppression de masse (ex. test de charge contaminé).
- `email-deliverability-incident.md` — chute du score Resend, IP flagged.
- `dependency-compromise.md` — réponse à un advisory critique.
- `2fa-admin-reset.md` — réinitialisation 2FA d'un admin ayant perdu son téléphone.

## Convention

Chaque runbook contient :
- frontmatter (titre, sévérité, durée typique, dernière revue)
- déclencheur clair en haut
- séquence numérotée d'actions
- plan B (« si quelque chose casse »)
- annexe contacts
- historique des révisions

Tous les runbooks sont relus annuellement par le DPO. Une revue produit
soit une mise à jour de version + ligne d'historique, soit une
confirmation explicite de validité.

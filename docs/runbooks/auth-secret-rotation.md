---
titre: Runbook — Rotation d'AUTH_SECRET
type: Runbook opérationnel
sévérité: P1 (sécurité)
durée_typique: 30 min, fenêtre choisie
dernière_revue: 2026-05-07
prochaine_revue: 2027-05-07
---

# Runbook — Rotation d'AUTH_SECRET

> **Quand exécuter** — soupçon de fuite de la valeur (push accidentel, exfiltration
> via dépendance compromise, départ d'un membre de l'équipe ayant eu accès), ou
> rotation préventive **annuelle**.

## Surface impactée

`AUTH_SECRET` est la clé HMAC utilisée pour :

1. **NextAuth JWT** — signature des sessions JWT (`@auth/core`).
2. **Tokens de désinscription** (`src/lib/email/unsubscribe-token.ts`) —
   liens 1-clic dans chaque email marketing.
3. **Cookie 2FA admin** (`src/lib/auth/admin-2fa-cookie.ts`) —
   preuve qu'un admin a passé le challenge TOTP récemment.
4. *(à venir)* Tout futur token signé devant survivre à un redémarrage.

Conséquences d'une rotation :

| Surface | Effet | Atténuation |
| --- | --- | --- |
| Sessions actives | invalidées immédiatement, tous les utilisateurs reconnectés | annoncer ; tolérable |
| Liens unsub déjà envoyés (durée 1 an) | invalidés ; les destinataires reçoivent une 404 polie | accepter — la liste reste à jour côté serveur |
| Cookies 2FA admin | invalidés ; les admins doivent redonner un code TOTP | tolérable (8h max sinon) |

## Pré-requis

- Accès propriétaire au projet **Vercel** (Production + Preview).
- Accès admin **Supabase** (lecture du DB pour vérification post-rotation).
- 1 admin disponible pour valider le sign-in après bascule (test golden path).
- Aucun déploiement en cours sur `main`.

## Procédure

### 1. Générer la nouvelle valeur (1 min)

Localement, en bash :

```bash
openssl rand -hex 64
```

Ou en Node :

```bash
node -e "console.log(require('node:crypto').randomBytes(64).toString('hex'))"
```

Conserver dans 1Password / Bitwarden / Vaultwarden avec :
- nom : `AUTH_SECRET — production — YYYY-MM-DD`
- portée : « Digizelle webapp »
- partagé avec : Tech Lead + DPO uniquement

### 2. Mettre à jour Vercel (5 min)

```bash
# CLI
vercel env rm AUTH_SECRET production
vercel env add AUTH_SECRET production
# coller la nouvelle valeur

# CLI — preview
vercel env rm AUTH_SECRET preview
vercel env add AUTH_SECRET preview
```

Ou via le dashboard Vercel → Project → Settings → Environment Variables.
Définir sur **Production** ET **Preview**. Laisser **Development** vide
(valeur locale dans `.env.local`).

### 3. Forcer un redéploiement (10 min)

Vercel ne propage pas automatiquement les env vars sur le build courant.

```bash
vercel --prod --force
```

Ou Dashboard → Deployments → … → Redeploy avec « Use existing Build Cache »
décoché.

### 4. Vérifier (5 min)

- [ ] Charger `https://digizelle.fr` — pas d'erreur 500.
- [ ] Se déconnecter. Se reconnecter avec un compte admin → la 2FA est
      challengée (c'est normal, le cookie 2FA a été invalidé).
- [ ] Cliquer un ancien lien d'unsubscribe (depuis un email d'il y a >1h) →
      doit retourner « lien expiré ou invalide » sans crash.
- [ ] Tester un nouvel envoi de newsletter dry-run → le nouveau lien
      d'unsubscribe doit être accepté.

### 5. Communication (5 min)

- Annoncer dans #general (Slack/Discord interne) :
  > « Rotation d'AUTH_SECRET effectuée à HH:MM. Tous les utilisateurs ont été
  > déconnectés ; il faut se reconnecter. Les anciens liens d'unsubscribe
  > présents dans les emails antérieurs à cette heure sont invalides — un
  > destinataire concerné peut s'auto-désinscrire en se loguant et en
  > décochant l'option dans les paramètres. »

### 6. Marquer dans le journal d'audit (2 min)

Insérer une entrée manuelle dans `AuditLog` (script Prisma Studio ou SQL) :

```sql
INSERT INTO "AuditLog" (id, "actorUserId", action, "targetType", "targetId", payload, "createdAt")
VALUES (gen_random_uuid(), '<your-user-id>', 'security.auth_secret_rotation',
        'System', NULL, '{"reason": "<scheduled|incident|...>", "rotated_at": "YYYY-MM-DDTHH:MM:SSZ"}'::jsonb, now());
```

## Plan B — si quelque chose casse

| Symptôme | Action |
| --- | --- |
| Build error « AUTH_SECRET is not set » | Vérifier que la valeur est bien sur Production *et* Preview |
| Tous les sign-ins échouent en boucle | Restaurer l'ancienne valeur dans Vercel + Redeploy |
| Webhook Resend retourne 401 | RIEN à voir — Resend utilise `RESEND_WEBHOOK_SECRET`, distinct |
| Les CSP-reports tombent | RIEN à voir — Sentry utilise sa propre clé via `NEXT_PUBLIC_SENTRY_DSN` |

## Contacts

- Tech Lead : Franck — contact@digizelle.fr
- DPO : contact@digizelle.fr
- Astreinte Vercel : escalation interne via Tech Lead
- Sécurité Resend : security@resend.com (en cas de fuite supposée côté email)

## Historique

| Date       | Auteur | Motif                         |
| ---------- | ------ | ----------------------------- |
| 2026-05-07 | Franck | Création initiale du runbook. |

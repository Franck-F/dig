---
titre: Runbook — Notification d'une violation de données (RGPD Art. 33-34)
type: Runbook opérationnel
sévérité: P0 (RGPD)
durée_typique: 0–72 h selon découverte
dernière_revue: 2026-05-07
prochaine_revue: 2027-05-07
---

# Runbook — Violation de données (Art. 33-34 RGPD)

> **Définition** — toute violation de la sécurité entraînant, de manière
> accidentelle ou illicite, la destruction, la perte, l'altération, la
> divulgation non autorisée ou l'accès à des données à caractère personnel
> traitées par Digizelle (ex. fuite de DB, accès admin compromis, push d'un
> secret sur GitHub, vol de matériel, ransomware, mauvaise configuration
> Supabase RLS).

## Délais réglementaires

- **CNIL** : notification sous **72 heures** après prise de connaissance
  (art. 33). Si ce délai n'est pas tenu, le responsable doit motiver
  les raisons du retard.
- **Personnes concernées** : information **dans les meilleurs délais**
  lorsqu'il existe un **risque élevé** pour leurs droits et libertés
  (art. 34). Dans la pratique : sous 7 jours.

## Phase 1 — Détection (T+0)

**Qui** : toute personne (équipe, utilisateur, chercheur sécurité, alerte
Sentry, monitoring).

**Quoi faire dans les 15 premières minutes** :

1. Déclarer l'incident dans Slack #incident ou par email à dpo@calebasse.com.
2. Donner les éléments connus : qui, quoi, quand, comment découvert, scope.
3. Désigner un **incident commander** (par défaut : DPO ; sinon Tech Lead).
4. Ne **rien** détruire (logs, audit trails, sauvegardes) — preuves.

## Phase 2 — Confinement (T+15 min → T+1 h)

**Incident commander** mène :

1. Mesurer le rayon de souffle (combien de comptes, quels champs).
   Source : `AuditLog`, logs Vercel, Sentry.
2. Couper les vecteurs d'accès actifs :
   - Si compromis admin → forcer logout (rotation `AUTH_SECRET` — voir
     `auth-secret-rotation.md`).
   - Si compromis API → révoquer la clé Supabase / Resend / Sentry.
   - Si compromis dépendance npm → `npm audit` + bump.
3. Geler les déploiements (lock `main` en GitHub branch protection).
4. Snapshot Supabase : exporter un dump pour les forensics
   (`pg_dump --no-owner --no-acl > forensics-YYYY-MM-DD.sql`).

## Phase 3 — Évaluation du risque (T+1 h → T+6 h)

DPO + Tech Lead remplissent le **registre des violations** (à créer au
premier incident, dans `docs/rgpd/registre-violations.md`) avec :

- Catégories de données concernées.
- Volume estimé (nombre de personnes, nombre d'enregistrements).
- Conséquences probables : usurpation d'identité, atteinte à la
  réputation, perte financière, etc.
- Mesures déjà prises et envisagées.

Décision « risque élevé pour les droits et libertés » → oui/non.

## Phase 4 — Notification CNIL (avant T+72 h)

**Téléservice CNIL** : https://notifications.cnil.fr.

Champs requis (qu'il faut donc préparer) :
- Identité du responsable de traitement (Laboratoire Calebasse)
- Description de la violation
- Catégories et nombre de personnes concernées
- Conséquences probables
- Mesures prises et envisagées
- Coordonnées du DPO

Conserver l'accusé de réception. Mettre à jour la déclaration dès qu'on
connaît plus d'infos (déclaration complémentaire CNIL).

## Phase 5 — Notification des personnes concernées (si risque élevé)

Email transactionnel ad hoc, formulé clairement. Modèle :

```
Objet : Information concernant un incident de sécurité Digizelle

Bonjour,

Le YYYY-MM-DD, nous avons identifié un incident de sécurité ayant
potentiellement exposé certaines de tes données personnelles : <liste>.

Ce que nous avons fait : <mesures>.
Ce que tu peux faire : changer ton mot de passe, activer la 2FA, vérifier
que ton email n'apparaît pas dans Have I Been Pwned, rester vigilant·e
face à tout email se réclamant de Digizelle.

Pour toute question : dpo@calebasse.com.

Toutes nos excuses.

— L'équipe Digizelle
```

Diffuser via le `EmailQueueItem` outbox pour que la délivrabilité soit
suivie. Ne PAS minimiser, ne PAS attribuer la faute à un tiers sans
certitude.

## Phase 6 — Post-mortem (T+7 jours)

- Document `docs/rgpd/post-mortems/YYYY-MM-DD-<slug>.md`
- Sections : timeline, root cause, lessons learned, action items
- Action items convertis en issues GitHub et trackés à 30 jours

## Annexe — Numéros utiles

- CNIL — Service des plaintes : 01 53 73 22 22
- ANSSI — CERT-FR : cert-fr.cossi.gouv.fr
- Avocat partenaire (à désigner) : ___

## Historique

| Date       | Auteur | Motif                         |
| ---------- | ------ | ----------------------------- |
| 2026-05-07 | Franck | Création initiale du runbook. |

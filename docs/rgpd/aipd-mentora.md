---
titre: AIPD Mentora — analyse d'impact (PIA) traitement T-02 et T-03
fondement: RGPD Art. 35
periode_couverte: lancement v1 (2026)
version: 1.0
derniere_mise_a_jour: 2026-05-07
prochaine_revue: 2027-05-07
auteur: DPO Digizelle (avec contribution Tech Lead)
---

# AIPD — Mentora (profils mentor/mentee + sessions)

> **Méthodologie** — guide PIA CNIL (édition 2018) + recommandations
> EDPB. L'analyse couvre les traitements T-02 (profils) et T-03
> (sessions, demandes, messages, avis) du registre des activités. Une
> AIPD distincte couvre la communauté UGC (`aipd-community.md`).

## Pourquoi une AIPD est nécessaire

Critères CNIL — un traitement « susceptible d'engendrer un risque élevé
pour les droits et libertés » nécessite une AIPD. Mentora coche au
moins **deux** critères de la liste indicative CNIL (deux critères
suffisent) :

1. **Données concernant des personnes vulnérables** — l'association
   accompagne en priorité des **mineurs de 15 à 17 ans** et des
   **jeunes femmes** dans une démarche d'inclusion numérique. La
   vulnérabilité naît du déséquilibre d'âge/expertise entre mentor
   et mentee.
2. **Évaluation/notation** — les avis post-session attribuent une note
   1-5 + commentaire à un mentor, qui figurera publiquement sur sa
   fiche.

Ne coche pas (et c'est important pour cadrer les mesures) :
- Pas de surveillance systématique d'espace public.
- Pas de croisement de données issues de plusieurs sources.
- Pas de profilage automatisé donnant lieu à décision impactante.

## 1. Description du traitement

### 1.1 Finalités

- Permettre la mise en relation entre mentors bénévoles et jeunes
  apprenant·e·s.
- Planifier et tracer les sessions de mentorat (visio ou présentiel).
- Recueillir les avis post-session pour rétroaction et qualité de
  l'accompagnement.

### 1.2 Acteurs

| Acteur                  | Rôle RGPD                | Coordonnées                                     |
| ----------------------- | ------------------------ | ----------------------------------------------- |
| Digizelle   | Responsable de traitement | EPITECH Kremlin-Bicêtre · contact@digizelle.fr   |
| Mentor / mentee         | Personnes concernées     | s.o.                                            |
| Modérateur·trice        | Sous-traitant interne    | rôle CommunityMember.isModerator                |
| Vercel, Supabase, Resend, Sentry | Sous-traitants techniques | voir registre, art. 28                  |

### 1.3 Données traitées

| Catégorie                       | Champ Prisma                         | Sensibilité |
| ------------------------------- | ------------------------------------ | ----------- |
| Identité                        | `User.email`, `firstName`, `lastName`, `image` | Standard |
| Compte                          | `User.passwordHash`, `birthYear`, `totp*` | Élevée (auth) |
| Profil mentor                   | `MentorProfile.*` (bio, photo, langues, années d'expérience, tarif horaire) | Standard |
| Profil mentee                   | `MenteeProfile.*` (objectifs, défis actuels, niveau) | Standard |
| Compétences                     | `MentorSkill`, `MenteeGoalSkill`     | Standard    |
| Mise en relation                | `Mentorship`, `MentorshipRequest`    | Standard    |
| Sessions                        | `Session` (date, format, lien visio, notes mentor privées, notes partagées) | Élevée (notes) |
| Messages                        | `MentorshipMessage` (texte libre + URL d'attachement) | Élevée (correspondance) |
| Avis                            | `Review` (note 1-5, commentaire)     | Standard    |

Pas de données spéciales (origine, santé, opinion politique, orientation
sexuelle, données biométriques) — l'inscription est explicitement
formulée pour les éviter.

### 1.4 Cycle de vie

- **Création** : signup web → email + bcrypt + birthYear + déclaration sur
  l'honneur 15+. Profil mentor passe par modération admin
  (`MentorStatus = DRAFT → ACTIVE`).
- **Usage** : matching, demandes, sessions, messages, avis.
- **Suppression** : soft-delete 30j puis purge irréversible
  (`softDeleteUser`, voir `src/lib/soft-delete/user.ts`).

## 2. Mesures pour respecter les principes RGPD

### 2.1 Licéité (Art. 6)

- Base : **exécution d'un contrat associatif** (Art. 6.1.b) pour la
  mise en relation, les sessions, et les messages.
- Base : **consentement explicite** (Art. 6.1.a) pour la photo, la bio
  publique et l'éventuel rendu d'avis publics. Le toggle `isPublic` sur
  `Review` matérialise ce consentement.

### 2.2 Loyauté & transparence (Art. 12-14)

- Politique de confidentialité publique
  (`messages/fr.json#privacy`) — couvre toutes les sections requises.
- Page admin du registre des traitements
  (`/community/admin/rgpd`).
- Information dans le formulaire d'inscription : copie + lien CGU/PrivPol.

### 2.3 Minimisation (Art. 5.1.c)

- `birthYear` (et non DOB complète) — défense en profondeur sur l'âge
  sans collecter le jour précis.
- Téléphone : non collecté.
- Adresse postale : non collectée.

### 2.4 Exactitude (Art. 5.1.d)

- Profil éditable à tout moment depuis `/community/settings`.
- Réinitialisation email = `User.emailBouncedAt` clearable.

### 2.5 Limitation de la conservation (Art. 5.1.e)

- Compte actif : pendant la relation contractuelle.
- Soft-delete : J+30 puis purge.
- Sessions : 3 ans (preuve civile en cas de litige post-mentorat).
- Messages : idem 3 ans.

### 2.6 Sécurité (Art. 32)

- TLS 1.3, HSTS preload, headers CSP/COOP/CORP/X-Frame.
- Bcrypt cost 12 sur mots de passe.
- 2FA TOTP **mandatory** pour ADMIN et modérateurs (Phase 2 task #29).
- Cookie 2FA admin signé HMAC, TTL 8 h.
- Rate-limit auth (token bucket) — IP + email.
- Soft-delete + purge cron.
- Audit log immuable de toute action admin (`AuditLog`).
- Backups Supabase quotidiens.
- Sentry pour observabilité (replays masqués, bodies filtrés).

### 2.7 Droits (Art. 15-22)

- Accès / portabilité : export JSON depuis `/community/settings`
  (Art. 20).
- Rectification : édition profil.
- Effacement : Zone à risque dans `/community/settings` avec
  confirmation explicite, grace 30 j.
- Opposition : opt-out marketing 1-clic (lien dans chaque email + UI).

## 3. Analyse de risques

### 3.1 Atteinte à la confidentialité

| Risque                                              | Vraisemblance | Gravité | Mesures actuelles                              | Risque résiduel |
| --------------------------------------------------- | ------------- | ------- | ---------------------------------------------- | --------------- |
| Compromission compte mentor (mot de passe phishé)   | Modérée       | Modérée | 2FA optionnelle pour mentors (Phase 3 : mandatory) ; rate-limit ; bcrypt ; soft-delete | Acceptable      |
| Compromission compte admin/mod                      | Modérée       | Élevée  | 2FA **mandatory** ; cookie 8h ; audit log ; AUTH_SECRET runbook | Faible          |
| Fuite DB Supabase (RLS mal configurée)              | Faible        | Élevée  | Tests d'intégration ; revue manuelle ; runbook RGPD | Acceptable      |
| Push secret sur GitHub                              | Modérée       | Élevée  | `.gitignore` strict ; CI sans secrets ; runbook rotation AUTH_SECRET | Acceptable      |
| Sous-traitant compromis (Vercel/Supabase/Resend)    | Faible        | Élevée  | DPA + SCC ; isolation logique ; alertes Sentry | Acceptable      |

### 3.2 Atteinte à l'intégrité

| Risque                                          | Vraisemblance | Gravité | Mesures                                       | Résiduel |
| ----------------------------------------------- | ------------- | ------- | --------------------------------------------- | -------- |
| Modification mal intentionnée de profil mentor  | Modérée       | Modérée | Audit log ; modération possible ; rollback Supabase | Faible |
| Mass-edit malveillant via bug d'autorisation    | Faible        | Élevée  | RBAC dans server actions ; tests              | Acceptable |

### 3.3 Atteinte à la disponibilité

| Risque                                  | Vraisemblance | Gravité | Mesures                                      | Résiduel |
| --------------------------------------- | ------------- | ------- | -------------------------------------------- | -------- |
| Downtime Vercel/Supabase                | Modérée       | Faible  | SLA fournisseur ; pas de blocage critique    | Acceptable |
| Suppression accidentelle compte         | Faible        | Modérée | Soft-delete + grace 30 j ; restore admin     | Faible |

### 3.4 Atteinte aux droits des personnes

| Risque                                                  | Vraisemblance | Gravité | Mesures                                       | Résiduel |
| ------------------------------------------------------- | ------------- | ------- | --------------------------------------------- | -------- |
| Inscription d'un mineur < 15 ans malgré la déclaration  | Faible        | Élevée  | Birth-year gate + déclaration sur l'honneur ; modération signalement | Acceptable |
| Avis diffamatoire public sur un mentor                  | Modérée       | Modérée | Modération sur signalement ; toggle `isPublic` ; possibilité de répondre | Faible |
| Données de session révélant info sensible (santé, etc.) | Modérée       | Modérée | Communication aux utilisateurs : ne pas saisir d'info sensible | Acceptable |

## 4. Avis du DPO

L'AIPD couvre l'ensemble des traitements T-02 et T-03. Les **risques
résiduels sont jugés acceptables** sous réserve :

- d'appliquer les migrations Phase 1 (birthYear, 2FA) en production ;
- d'activer la branch protection sur `main` ;
- de mettre en place le monitoring Sentry avec alertes (Phase 2 task #36) ;
- de réviser cette AIPD dans 12 mois ou plus tôt en cas de changement
  substantiel (nouveau type de données, nouveau sous-traitant, nouveau
  public — ex. extension à des mineurs < 15 ans avec consentement
  parental).

## 5. Avis des personnes concernées (consultatif)

L'association a recueilli les retours de **2 mentors et 3 mentees** dès
la phase de conception (entretiens semi-dirigés, 30 min chacun). Les
préoccupations exprimées et les réponses du DPO sont consignées dans
le compte-rendu interne (`docs/rgpd/consultations/2026-Q1-mentora.md`,
non versionné — dépose dans 1Password).

## 6. Plan d'action

| Action                                              | Échéance    | Responsable | Statut |
| --------------------------------------------------- | ----------- | ----------- | ------ |
| Appliquer migrations P1 prod (birthYear, totp)      | T+0         | Tech Lead   | ouvert |
| Activer 2FA pour tous les mentors (Phase 3)         | T+90 j      | Tech Lead   | prévu  |
| Configurer alertes Sentry (Phase 2 task #36)        | T+30 j      | Tech Lead   | prévu  |
| Mettre en place Upstash Redis rate-limit            | T+60 j      | Tech Lead   | prévu  |
| Réviser AIPD                                        | T+365 j     | DPO         | prévu  |

## Historique

| Version | Date       | Auteur | Changement                |
| ------- | ---------- | ------ | ------------------------- |
| 1.0     | 2026-05-07 | Franck | Création initiale.        |

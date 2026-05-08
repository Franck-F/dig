---
titre: Registre des activités de traitement
responsable: Digizelle (association loi 1901)
adresse: EPITECH Campus du Kremlin-Bicêtre, 14-16 rue Voltaire, 94270 Le Kremlin-Bicêtre
contact_dpo: contact@digizelle.fr
version: 1.0
derniere_mise_a_jour: 2026-05-07
prochaine_revue: 2027-05-07
fondement: RGPD Art. 30 (Règlement UE 2016/679)
---

# Registre des activités de traitement

Ce registre formalise les traitements de données à caractère personnel mis en œuvre
par **Digizelle** (association loi 1901). Il est tenu en
application de **l'article 30 du RGPD** et révisé au minimum **annuellement**.

> **Mise à disposition** — sur demande de la CNIL ou des personnes concernées,
> ce document est communiqué au DPO (contact@digizelle.fr) qui répond sous 30 jours.

---

## 1. Responsable du traitement

| Élément              | Valeur                                                                         |
| -------------------- | ------------------------------------------------------------------------------ |
| Dénomination         | Digizelle                                                                       |
| Forme juridique      | Association loi 1901, à but non lucratif                                       |
| Siège                | EPITECH Campus du Kremlin-Bicêtre, 14-16 rue Voltaire, 94270 Le Kremlin-Bicêtre |
| RNA                  | À compléter une fois publié au JO                                              |
| Contact général      | contact@digizelle.fr                                                            |
| Contact DPO          | contact@digizelle.fr                                                            |
| Représentant légal   | Franck — Team Leader / Tech                                                    |

## 2. Délégué à la protection des données (DPO)

Désignation : **interne**, mutualisé avec la fonction Tech Lead jusqu'à
recrutement d'un DPO externalisé.

- **Contact** : contact@digizelle.fr
- **Mission** : conseil sur la conformité, point de contact CNIL, réponse aux
  demandes des personnes concernées (Art. 12 à 22), suivi des incidents et
  notifications (Art. 33-34), tenue du présent registre.

---

## 3. Traitements

### T-01 — Gestion des comptes utilisateurs (authentification)

| Champ                       | Valeur                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| Finalité                    | Permettre à l'utilisateur de créer un compte, se connecter, accéder à ses espaces personnels.           |
| Base légale (Art. 6)        | Exécution d'un contrat (CGU) — Art. 6.1.b                                                              |
| Catégories de données       | Email, hash bcrypt du mot de passe, prénom, nom, image, rôle (USER/MODERATOR/ADMIN), date d'inscription. |
| Données sensibles           | Aucune.                                                                                                 |
| Personnes concernées        | Utilisateurs inscrits (mineurs ≥ 15 ans avec consentement, majeurs).                                    |
| Source                      | Saisie directe par l'utilisateur (formulaire d'inscription) ou OAuth (Google/GitHub/Discord).           |
| Destinataires internes      | Équipe technique (Franck), équipe modération.                                                           |
| Destinataires externes      | Sous-traitants : Supabase (hébergement DB), Vercel (hébergement app), Auth.js providers OAuth.          |
| Transferts hors UE          | Aucun. Supabase région EU (eu-west-3), Vercel région EU.                                                |
| Durée de conservation       | Compte actif : pendant la durée de la relation. Inactif > 3 ans : suppression. Soft-delete : 30 jours puis purge irréversible. |
| Mesures de sécurité         | Mots de passe bcrypt (10 rounds), HTTPS/TLS 1.3, HSTS preload, headers CSP, rate-limit auth (token bucket). |
| Droits des personnes        | Accès, rectification, effacement, portabilité, opposition.                                              |
| Modèle technique            | `User`, `Account`, `VerificationToken`, `VerificationCode`.                                             |

### T-02 — Profils mentor et mentee

| Champ                       | Valeur                                                                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Finalité                    | Mise en relation pédagogique entre mentors bénévoles et jeunes mentees. Affichage public des fiches mentor (annuaire de la plateforme).      |
| Base légale (Art. 6)        | Exécution d'un contrat — Art. 6.1.b. Pour la photo et les détails personnels publics : consentement explicite — Art. 6.1.a.                |
| Catégories de données       | Bio, parcours, langues, fuseau horaire, préférences format, fréquence souhaitée, disponibilités, compétences, niveau, image de profil.      |
| Données sensibles           | Aucune (les utilisateurs sont incités à ne pas saisir de données sensibles dans la bio).                                                     |
| Personnes concernées        | Mentors validés et mentees actifs.                                                                                                           |
| Destinataires internes      | Équipe d'admission mentor (rôle ADMIN), équipe modération.                                                                                   |
| Destinataires externes      | Aucun ; les profils mentor sont visibles publiquement sur le site, les profils mentee uniquement par les mentors avec lesquels une mise en relation est active. |
| Transferts hors UE          | Aucun.                                                                                                                                       |
| Durée de conservation       | Pendant la durée du compte. À la suppression du compte : anonymisation immédiate puis purge à J+30.                                          |
| Mesures de sécurité         | Idem T-01.                                                                                                                                   |
| Modèle technique            | `MentorProfile`, `MenteeProfile`, `MentorSkill`, `MenteeGoalSkill`.                                                                           |

### T-03 — Mentorat (sessions, demandes, messages, avis)

| Champ                       | Valeur                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Finalité                    | Planifier et tracer les sessions de mentorat (1:1 ou groupe), gérer les échanges entre mentor et mentee, recueillir les avis post-session.            |
| Base légale (Art. 6)        | Exécution d'un contrat — Art. 6.1.b.                                                                                                                    |
| Catégories de données       | Sujets de session, format (visio/présentiel), date/heure, statut, lien visio, notes privées mentor, messages texte, avis (note + commentaire).         |
| Personnes concernées        | Mentors et mentees liés par une `Mentorship`.                                                                                                           |
| Destinataires internes      | Modération sur signalement uniquement (pas d'accès systématique au contenu des messages privés).                                                        |
| Destinataires externes      | Aucun. Les liens visio externes (Google Meet, etc.) sont gérés par les utilisateurs eux-mêmes.                                                          |
| Durée de conservation       | Sessions, messages : 3 ans après la fin du mentorat (preuve civile). Avis : conservés tant que le profil mentor existe (anonymisation à la suppression du compte mentee). |
| Modèle technique            | `Mentorship`, `MentorshipRequest`, `Session`, `MentorshipMessage`, `Review`, `MentorshipGoal`.                                                          |

### T-04 — Communauté (posts, commentaires, réactions, hashtags)

| Champ                       | Valeur                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Finalité                    | Permettre aux membres de publier, commenter, réagir et partager au sein des channels de la communauté.                              |
| Base légale (Art. 6)        | Exécution d'un contrat — Art. 6.1.b. Pour le contenu librement publié : consentement implicite à l'affichage public.                |
| Catégories de données       | Texte libre, images attachées, hashtags, mentions, réactions.                                                                         |
| Personnes concernées        | `CommunityMember` (utilisateurs ayant rejoint un channel).                                                                            |
| Destinataires internes      | Modération sur signalement.                                                                                                           |
| Destinataires externes      | Visibilité publique selon la configuration du channel (public/privé). Aucun partage à des tiers.                                      |
| Durée de conservation       | Tant que l'utilisateur ne supprime pas son post. À la suppression du compte : anonymisation immédiate (auteur remplacé par "Compte supprimé") puis purge à J+30. |
| Modèle technique            | `Post`, `Comment`, `Reaction`, `Bookmark`, `Mention`, `PostHashtag`, `PostTag`.                                                       |

### T-05 — Modération (signalements, sanctions, badges)

| Champ                       | Valeur                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Finalité                    | Garantir la sécurité de la communauté, traiter les signalements, appliquer des sanctions graduées, attribuer des badges. |
| Base légale (Art. 6)        | Intérêt légitime — Art. 6.1.f (sécurité de la communauté, respect du règlement intérieur).                          |
| Catégories de données       | Motif de signalement, contexte, action de modération (avertissement, mute, suspend, ban), motif, durée, badges attribués. |
| Personnes concernées        | Auteurs de signalements et utilisateurs signalés.                                                                     |
| Destinataires internes      | Équipe de modération, équipe ADMIN.                                                                                    |
| Destinataires externes      | Aucun.                                                                                                                |
| Durée de conservation       | 3 ans après la dernière action de modération (preuve en cas de récidive).                                            |
| Modèle technique            | `Report`, `ModerationAction`, `Badge`, `MemberBadge`, `Challenge`, `ChallengeSubmission`, `ChallengeVote`.            |

### T-06 — Newsletter et campagnes email

| Champ                       | Valeur                                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Finalité                    | Envoi de communications éditoriales périodiques (annonces association, événements, défis, mentorats à pourvoir).                  |
| Base légale (Art. 6)        | Consentement explicite — Art. 6.1.a (case à cocher non pré-cochée). Désinscription en 1 clic conforme RFC 8058 et Gmail bulk sender. |
| Catégories de données       | Email, prénom (optionnel), date d'inscription, dernière ouverture (à venir), bounces/plaintes (via webhook Resend).                |
| Personnes concernées        | `NewsletterSubscriber` (volontaires), `User` ayant `marketingEmailsEnabled=true`.                                                  |
| Destinataires internes      | Équipe communication.                                                                                                                |
| Destinataires externes      | Resend (envoi transactionnel et marketing) — Resend Inc., serveurs UE.                                                              |
| Transferts hors UE          | Aucun. Resend permet le routage région EU.                                                                                          |
| Durée de conservation       | Tant que l'utilisateur ne se désinscrit pas. Désinscrit : email conservé sous statut UNSUBSCRIBED 3 ans (preuve d'opposition).      |
| Mesures de sécurité         | Tokens HMAC-SHA256 1-clic signés, rotation possible de la clé, webhook Resend signé Svix.                                          |
| Modèle technique            | `NewsletterSubscriber`, `EmailQueueItem`, `User.marketingEmailsEnabled`, `User.emailBouncedAt`.                                     |

### T-07 — Contact (formulaire public)

| Champ                       | Valeur                                                                            |
| --------------------------- | --------------------------------------------------------------------------------- |
| Finalité                    | Recevoir et traiter les demandes envoyées via le formulaire de contact public.   |
| Base légale (Art. 6)        | Intérêt légitime — Art. 6.1.f (réponse à une sollicitation).                     |
| Catégories de données       | Nom, email, sujet (parmi 5 catégories), message libre.                           |
| Personnes concernées        | Visiteurs du site.                                                                |
| Destinataires internes      | Équipe communication, équipe technique.                                           |
| Destinataires externes      | Aucun (Resend uniquement pour la notification interne).                          |
| Durée de conservation       | 1 an après la fermeture de la demande.                                            |
| Modèle technique            | `ContactMessage`.                                                                  |

### T-08 — Notifications applicatives

| Champ                       | Valeur                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Finalité                    | Informer l'utilisateur d'événements le concernant : nouvelle session, message, mention, badge, modération. |
| Base légale (Art. 6)        | Exécution du contrat — Art. 6.1.b.                                                                           |
| Catégories de données       | Type, payload (référence ressource), statut lu/non-lu.                                                       |
| Durée de conservation       | 90 jours après lecture. Non lues : 1 an.                                                                     |
| Modèle technique            | `Notification`.                                                                                              |

### T-09 — Journal d'audit administrateur

| Champ                       | Valeur                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Finalité                    | Tracer les actions effectuées par les administrateurs et modérateurs (approbation mentor, sanctions, modifications de challenges, etc.). |
| Base légale (Art. 6)        | Intérêt légitime — Art. 6.1.f (responsabilité, sécurité, audit interne et externe).                                                    |
| Catégories de données       | Identifiant administrateur, action, cible, payload résumé, IP, user-agent, horodatage.                                                  |
| Destinataires internes      | Équipe ADMIN uniquement.                                                                                                                |
| Destinataires externes      | Aucun (sauf demande judiciaire, autorité de contrôle).                                                                                  |
| Durée de conservation       | 5 ans (preuve en cas de litige).                                                                                                        |
| Modèle technique            | `AuditLog`.                                                                                                                              |

### T-10 — Logs techniques et observabilité

| Champ                       | Valeur                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Finalité                    | Observabilité, détection d'incidents, performance.                                                                |
| Base légale (Art. 6)        | Intérêt légitime — Art. 6.1.f (sécurité du SI).                                                                  |
| Catégories de données       | Logs Vercel (HTTP requests, status), Sentry (erreurs serveur/client, traces, replay masqué).                     |
| Destinataires externes      | Sentry (Functional Software Inc., serveurs EU sentry.de.io), Vercel (Vercel Inc., région EU).                    |
| Mesures spécifiques         | `maskAllText`, `blockAllMedia` activés sur les replays Sentry. `beforeSend` filtre les bodies de requête.       |
| Durée de conservation       | 30 jours côté Sentry/Vercel (rétention par défaut plan Hobby/Team).                                              |

---

## 4. Sous-traitants (Art. 28)

| Sous-traitant      | Rôle                          | Localisation données | DPA signé    |
| ------------------ | ----------------------------- | -------------------- | ------------ |
| Vercel Inc.        | Hébergement Next.js, CDN      | EU (Vercel EU)       | Standard DPA |
| Supabase Inc.      | Base PostgreSQL + Auth + Storage | EU (eu-west-3 Paris) | Standard DPA |
| Resend Inc.        | Envoi email transactionnel + marketing | EU                   | Standard DPA |
| Functional Software Inc. (Sentry) | Observabilité erreurs       | EU (sentry.de.io)    | Standard DPA |
| Google LLC         | OAuth (sign-in optionnel)     | Mondial              | Standard Contractual Clauses (SCC) |
| GitHub Inc.        | OAuth (sign-in optionnel)     | Mondial              | SCC          |
| Discord Inc.       | OAuth (sign-in optionnel)     | Mondial              | SCC          |

> Les DPA des sous-traitants sont conservés dans `docs/rgpd/dpa/` (v1.0 à mettre
> en place lors du déploiement production).

---

## 5. Droits des personnes concernées (Art. 15-22)

Les utilisateurs disposent des droits suivants, exerçables auprès du DPO
(contact@digizelle.fr) ou directement depuis leurs paramètres de compte :

- **Accès** (Art. 15) : récapitulatif des données détenues, fourni dans
  l'export JSON depuis `/community/settings`.
- **Rectification** (Art. 16) : modifiable directement depuis le profil.
- **Effacement** (Art. 17) : bouton "Supprimer mon compte" dans
  `/community/settings` → délai de grâce 30 jours puis purge irréversible.
- **Portabilité** (Art. 20) : export JSON téléchargeable depuis
  `/community/settings`, format machine-readable.
- **Opposition** (Art. 21) : opt-out marketing par email 1-clic ou depuis
  `/community/settings`.
- **Limitation** (Art. 18) : sur demande au DPO, gel des traitements en
  attente de résolution d'un litige.

Délai de réponse : **30 jours** (extensible à 90 jours en cas de complexité,
sur notification).

---

## 6. Mineurs (Art. 8)

L'âge minimum pour créer un compte est **15 ans** (limite française).
- Vérification : déclaration sur l'honneur (case à cocher) au moment de
  l'inscription, plus déclaration de date de naissance à venir (T+30j).
- Mineur < 15 ans : inscription refusée. En cas de découverte ultérieure,
  suppression immédiate du compte avec notification au tuteur si email
  parental connu.
- Mineur de 15-17 ans : aucun traitement de profilage publicitaire.

---

## 7. Notification des violations (Art. 33-34)

En cas de violation de données :
- **CNIL** : notification dans les 72 heures via le téléservice cnil.fr.
- **Personnes concernées** : information directe si risque élevé pour les
  droits et libertés (Art. 34), email + bandeau dans l'application.
- **Procédure interne** : runbook `docs/rgpd/runbook-incident.md` (à venir).

---

## 8. Analyse d'impact (PIA)

Une **AIPD (Analyse d'Impact relative à la Protection des Données)** est
prévue pour :
- T-02 (profils publics, mineurs) — priorité haute.
- T-04 (communauté + mineurs + UGC) — priorité haute.

Document à produire : `docs/rgpd/aipd-mentora.md` et
`docs/rgpd/aipd-community.md`.

---

## Historique des révisions

| Version | Date       | Auteur | Changements                                  |
| ------- | ---------- | ------ | -------------------------------------------- |
| 1.0     | 2026-05-07 | Franck | Création initiale couvrant T-01 à T-10.      |

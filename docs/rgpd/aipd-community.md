---
titre: AIPD Community — analyse d'impact (PIA) traitement T-04 et T-05
fondement: RGPD Art. 35
periode_couverte: lancement v1 (2026)
version: 1.0
derniere_mise_a_jour: 2026-05-07
prochaine_revue: 2027-05-07
auteur: DPO Digizelle (avec contribution Tech Lead)
---

# AIPD — Communauté (UGC + modération)

> Couvre les traitements T-04 (posts, commentaires, réactions, hashtags,
> bookmarks, mentions) et T-05 (signalements, sanctions, badges, défis)
> du registre des activités. Une AIPD distincte couvre Mentora.

## Pourquoi une AIPD est nécessaire

- **Personnes vulnérables** : mineurs 15-17 ans dans la cible.
- **UGC publié** : contenu librement saisi par des mineurs et partagé
  publiquement. Risque d'auto-divulgation, de cyber-harcèlement entre
  pairs, d'exposition à des contenus inappropriés.
- **Modération discrétionnaire** : les modérateurs peuvent supprimer du
  contenu, suspendre un compte ; ces décisions ont un impact significatif
  sur la liberté d'expression de la personne.

## 1. Description du traitement

### 1.1 Finalités

- Permettre aux membres de publier, commenter, réagir et partager au
  sein des channels de la communauté.
- Modérer la communauté : signalements, sanctions, badges.
- Animer la communauté : défis trimestriels avec votes.

### 1.2 Données traitées

| Catégorie                       | Champ Prisma                                    | Sensibilité |
| ------------------------------- | ----------------------------------------------- | ----------- |
| Membre community                | `CommunityMember.*` (handle, displayName, bio, avatarUrl, status, statusReason) | Standard |
| Contenu publié                  | `Post`, `Comment`, `Reaction`, `Bookmark`, `Mention`, `PostHashtag`, `PostTag` | Élevée (UGC public) |
| Sanctions                       | `Report`, `ModerationAction`                    | Élevée (incidence sur vie sociale) |
| Défis                           | `Challenge`, `ChallengeSubmission`, `ChallengeVote` | Standard |
| Récompenses                     | `Badge`, `MemberBadge`                          | Standard |

### 1.3 Cycle de vie

- Création membre : `/community/onboarding` (handle unique, 3-30 chars
  lowercase).
- Publication : `Post` → modération sur signalement.
- Modération : `Report` → `ModerationAction` (mute / suspend / ban) →
  audit log immuable.
- Suppression compte : auteur remplacé par « Compte supprimé » sur
  posts/commentaires (preuve historique du fil), purge à J+30.

## 2. Mesures pour respecter les principes RGPD

### 2.1 Licéité

- **Exécution du contrat** (Art. 6.1.b) pour la participation et la
  modération.
- **Intérêt légitime** (Art. 6.1.f) pour la sécurité et le respect du
  règlement intérieur — base juridique des `Report`/`ModerationAction`,
  conservés 3 ans pour preuve de récidive.

### 2.2 Loyauté

- Charte de la communauté affichée à l'onboarding (à compléter,
  référence dans CGU).
- Politique de modération publique (à venir, Phase 3).
- Délai de 24 h pour répondre à un signalement.

### 2.3 Minimisation

- Pas de collecte de localisation précise.
- Pas de tracking comportemental cross-channel.
- Pas de profilage publicitaire (interdit pour les mineurs).

### 2.4 Sécurité spécifique au UGC

- **Sanitizer markdown → HTML** (`src/lib/community/sanitizer.ts`) :
  marked + DOMPurify, allowlist stricte (p, br, strong, em, code, pre,
  blockquote, ul, ol, li, a[href|title]). Strip `<script>`, `<iframe>`,
  `onerror`, `javascript:`.
- **Rate-limit posts** côté server action.
- **Mentions** : matchent une regex stricte `[a-z0-9_]{3,30}`.
- **Hashtags** : idem `[a-z0-9_]{1,32}`.
- **Channels privés** : `ChannelType.PRIVATE` filtre l'accès aux
  membres + invitations explicites.

### 2.5 Modération graduée

- `MUTED` : silence temporaire, ne peut plus poster.
- `SUSPENDED` : compte gelé, peut consulter mais pas interagir.
- `BANNED` : compte révoqué.
- Décisions consignées dans `ModerationAction` avec acteur, motif,
  durée, lien vers l'audit log.

### 2.6 Droits des personnes

- **Suppression de contenu** : l'auteur peut supprimer ses propres posts.
- **Export** : posts + commentaires + réactions inclus dans l'export
  Art. 20.
- **Droit à l'oubli** : à la suppression du compte, contenus
  anonymisés (auteur = « Compte supprimé »), purge à J+30.
- **Recours contre une sanction** : email à dpo@calebasse.com — la
  procédure de recours est documentée dans la charte (à finaliser).

## 3. Analyse de risques

### 3.1 Cyber-harcèlement entre mineurs

| Aspect                  | Mesure                                                     |
| ----------------------- | ---------------------------------------------------------- |
| Détection               | Signalement par la communauté (`Report`) + cron de patterns à venir |
| Réaction                | Modération sous 24 h en heures ouvrées                    |
| Sanction                | MUTED → SUSPENDED → BANNED                                |
| Aide à la victime       | DM modérateur·trice ; lien vers ressources externes (3018, e-Enfance) à intégrer |

**Risque résiduel** : Modéré. Améliorations Phase 3 : detection de
patterns automatisée + arbre de conversation pour suivre les fils
hostiles.

### 3.2 Contenus illicites (DSA, LCEN)

| Cas                     | Mesure                                                     |
| ----------------------- | ---------------------------------------------------------- |
| Apologie / négationnisme/ pédopornographie | Signalement → suppression sous 24 h ; signalement Pharos |
| Diffamation             | Suppression sur demande motivée ; éventuel droit de réponse |

### 3.3 Atteinte à la confidentialité

| Risque                                           | Mesure                                  | Résiduel |
| ------------------------------------------------ | --------------------------------------- | -------- |
| Auto-divulgation d'info sensible par le membre   | Sensibilisation + suppression a posteriori | Faible (reste à la charge de l'utilisateur) |
| Doxxing par un autre membre                      | Modération + sanction immédiate         | Faible   |
| Compromission compte modérateur                  | 2FA mandatory (Phase 2 task #29)        | Faible   |

### 3.4 Atteinte à la liberté d'expression

| Risque                                          | Mesure                                | Résiduel |
| ----------------------------------------------- | ------------------------------------- | -------- |
| Sanction abusive par un modérateur              | Audit log + recours par email DPO     | Faible   |
| Modération biaisée (auto-modération)            | 2 modérateurs distincts requis pour BAN (Phase 3) | À implémenter |

## 4. Avis du DPO

Risques résiduels acceptables sous réserve :

- d'écrire la charte de la communauté avant ouverture publique ;
- d'intégrer un lien direct vers le 3018 / e-Enfance dans le fil
  d'aide en cas de signalement par un mineur ;
- de mettre en place une revue trimestrielle des décisions de
  modération par un comité externe (pair de l'association) ;
- de conserver les `ModerationAction` 3 ans, puis purger.

## 5. Plan d'action

| Action                                              | Échéance    | Responsable | Statut |
| --------------------------------------------------- | ----------- | ----------- | ------ |
| Charte de la communauté publique                    | T+30 j      | Comm + DPO  | ouvert |
| Lien 3018 / e-Enfance dans le formulaire signalement | T+30 j      | Tech        | ouvert |
| Comité de revue modération (pair externe)           | T+90 j      | DPO         | prévu  |
| Détection automatique patterns cyber-harcèlement    | T+180 j (Phase 3) | Tech  | prévu  |
| Réviser AIPD                                        | T+365 j     | DPO         | prévu  |

## Historique

| Version | Date       | Auteur | Changement                |
| ------- | ---------- | ------ | ------------------------- |
| 1.0     | 2026-05-07 | Franck | Création initiale.        |

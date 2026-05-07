---
titre: Registre des violations de données personnelles
responsable: DPO Digizelle
fondement: RGPD Art. 33 §5 (registre interne)
version: 1.0
derniere_mise_a_jour: 2026-05-07
prochaine_revue: continu (mise à jour à chaque incident)
---

# Registre des violations de données personnelles

> **Pourquoi** — l'article 33 §5 du RGPD impose au responsable de traitement
> de tenir un **registre interne** de toutes les violations de données,
> qu'elles aient ou non donné lieu à notification à la CNIL ou aux personnes
> concernées. Ce registre doit permettre à l'autorité de contrôle de vérifier
> la conformité.

## Cadre

Une **violation de données** au sens du RGPD est tout incident (accidentel
ou illicite) entraînant la **destruction, la perte, l'altération, la
divulgation non autorisée, ou l'accès** à des données personnelles. Inclut
notamment :

- Fuite de base de données.
- Push d'un secret sensible sur un dépôt public.
- Perte ou vol d'un terminal contenant des données.
- Compromission d'un compte admin.
- Mauvaise configuration (RLS Supabase ouvert, S3 public, etc.).
- Phishing ayant abouti à un accès non autorisé.
- Email envoyé au mauvais destinataire (CC fautif).
- Suppression accidentelle non récupérable.

Procédure complète : voir [`../runbooks/rgpd-incident.md`](../runbooks/rgpd-incident.md).

## Format d'entrée

Chaque incident est consigné dans une nouvelle section ci-dessous, en
chronologie inverse (le plus récent en haut). Champs obligatoires :

```yaml
id: VIOL-YYYYMMDD-NN
date_decouverte: YYYY-MM-DD HH:MM (UTC)
date_survenue: YYYY-MM-DD ou "inconnue"
decouvert_par: nom + rôle
description_courte: 1 phrase
nature: confidentialite | integrite | disponibilite (combinaison possible)
categories_donnees: ex. email, mots de passe hachés, contenu de session
volume_personnes_estime: nombre + base d'estimation
volume_enregistrements_estime: nombre
consequences_probables: description libre
mesures_immediates: actions de confinement
mesures_correctives: actions long terme
notif_cnil: oui | non + justification
date_notif_cnil: YYYY-MM-DD HH:MM ou n/a
ref_cnil: numéro de dossier CNIL ou n/a
notif_personnes: oui | non + justification
date_notif_personnes: YYYY-MM-DD ou n/a
mode_notif_personnes: email | bandeau | n/a
post_mortem: lien vers `../runbooks/post-mortems/<slug>.md`
statut: ouvert | en_cours | clos
cloture: YYYY-MM-DD ou n/a
```

## Entrées

> **Aucune violation enregistrée à ce jour.** Cette section sera complétée à
> chaque incident. Le format ci-dessus est obligatoire pour chaque entrée
> nouvelle.

<!--

Modèle d'entrée (à dupliquer) :

### VIOL-YYYYMMDD-NN — Titre court

```yaml
id: VIOL-YYYYMMDD-NN
date_decouverte: YYYY-MM-DD HH:MM
date_survenue: YYYY-MM-DD
decouvert_par: ...
description_courte: ...
nature: confidentialite
categories_donnees: ...
volume_personnes_estime: ...
volume_enregistrements_estime: ...
consequences_probables: ...
mesures_immediates: ...
mesures_correctives: ...
notif_cnil: oui
date_notif_cnil: YYYY-MM-DD HH:MM
ref_cnil: ...
notif_personnes: oui
date_notif_personnes: YYYY-MM-DD
mode_notif_personnes: email
post_mortem: ../runbooks/post-mortems/YYYY-MM-DD-...md
statut: clos
cloture: YYYY-MM-DD
```

#### Chronologie

- T+0 : ...
- T+15 min : ...
- T+1 h : ...

#### Analyse

...

#### Action items
- [x] ...
- [ ] ...

-->

## Cadence de revue

- À **chaque incident** : entrée immédiate, mise à jour pendant la phase
  de gestion.
- **Mensuelle** : DPO passe en revue toutes les entrées ouvertes.
- **Annuelle** : revue d'ensemble, statistiques, leçons apprises.

## Conservation

Conformément à la doctrine CNIL : 5 ans après la clôture de chaque
violation, à compter de la dernière action de gestion. Au-delà, les
entrées peuvent être pseudonymisées (suppression du nom des personnes
concernées) tout en gardant les leçons techniques.

## Historique

| Version | Date       | Auteur | Changement                          |
| ------- | ---------- | ------ | ----------------------------------- |
| 1.0     | 2026-05-07 | Franck | Création (registre vide).           |

---
titre: Comité de revue modération
type: Process / gouvernance
fondement: AIPD Community §4 — action item DPO
cadence: trimestrielle
dernière_revue: 2026-05-07
prochaine_revue: 2027-05-07
---

# Comité de revue modération

> **Pourquoi** — l'AIPD community §4 demande une **revue trimestrielle
> des décisions de modération par un comité indépendant des opérations
> quotidiennes**. Les modérateurs⋅trices appliquent les règles ;
> ce comité vérifie que les règles sont appliquées de façon cohérente,
> proportionnée et non discriminatoire.

## Composition

- **DPO Digizelle** (président) — neutralité, garant de la procédure.
- **1 admin Digizelle non-modérateur** — perspective interne sans
  être juge et partie.
- **1 pair externe** (rotation par trimestre) — typiquement un⋅e
  bénévole d'une asso d'inclusion numérique partenaire (LDH, MozFr,
  CodeSisters, Duchess France, etc.). Engagement écrit de
  confidentialité avant la séance.

Quorum : 2/3. En cas de désaccord, la décision penche du côté du
membre sanctionné (présomption d'innocence pour la rétro-action).

## Rythme

- **1 séance par trimestre**, ~90 min, en visio.
- Date fixe : 2e jeudi du dernier mois du trimestre (mars, juin,
  septembre, décembre).
- Préparation des dossiers : 7 jours avant la séance, par le DPO.

## Périmètre

Le comité passe en revue :

1. **Toutes les décisions BAN_USER** prononcées sur le trimestre
   (fenêtre 90 j).
2. **Échantillon de SUSPEND_USER et MUTE_USER** : 10 % des décisions,
   ou minimum 5 dossiers.
3. **Toutes les décisions visant un⋅e mineur⋅e** (peu importe le type).
4. **Décisions contestées** : recours reçus à contact@digizelle.fr depuis
   la dernière séance.

## Données fournies au comité

Pour chaque dossier, le DPO prépare une note :
- Décision + acteur⋅trices (proposeur + confirmateur pour les BAN).
- Motif consigné dans `ModerationAction.reason`.
- Historique du membre (signalements, sanctions antérieures).
- Contenu signalé ou contexte (extraits — pas de doxxing du
  rapporteur).
- Délai entre signalement → sanction.
- Recours éventuel et réponse.

Source des données : table `ModerationAction` (jointe à
`Report` et `CommunityMember`). Export possible via une requête SQL
prête (voir annexe).

## Critères de revue

Le comité évalue chaque dossier sur cinq axes :

| Axe                        | Question                                                                  |
| -------------------------- | ------------------------------------------------------------------------- |
| Proportionnalité           | La sanction est-elle alignée sur la gravité du comportement ?            |
| Cohérence                  | Des cas similaires ont-ils reçu un traitement similaire dans l'année ?   |
| Non-discrimination         | La distribution démographique des sanctions est-elle représentative ?    |
| Procédure                  | La règle des 2 modérateurs distincts a-t-elle été respectée pour les BAN ? |
| Réactivité                 | Le délai signalement → décision est-il acceptable (< 24 h en jour ouvré) ? |

## Sortie

À l'issue de chaque séance, le DPO rédige un compte-rendu (interne)
contenant :

- Décisions du comité (validation, recommandation de revoyure,
  recommandation d'annulation/restoration).
- Actions correctives sur la procédure ou la charte si nécessaire.
- Statistiques agrégées (anonymisées) pour le rapport annuel public.

Le compte-rendu est versionné dans
`docs/rgpd/comite-revue/YYYY-Q#-revue.md` et conservé 5 ans.

## Annulations

Si le comité recommande l'annulation d'une décision, le DPO :

1. Informe par email le membre concerné dans les 7 jours.
2. Demande à un admin (différent du modérateur initial) d'exécuter
   `unbanUser` / autre via l'admin shell.
3. Audit-log spécifique : action `member.committee_overturn`.
4. Compteur de sanctions du modérateur initial : ne pas l'augmenter
   pour cette décision (la décision n'est pas tenue contre l'auteur,
   mais on apprend collectivement).

## Indicateurs de performance (KPI)

Suivi annuel :

- Délai moyen signalement → sanction.
- Taux d'annulations en revue (objectif : < 5 % sur 12 mois ; > 10 %
  signale un problème de procédure ou de formation).
- Taux de récidive après sanction (mute → mute, ou suspend → ban).
- Couverture du comité : % de décisions BAN passées en revue (objectif :
  100 %).

## Rapport annuel

Un rapport public anonymisé est publié sur le site Digizelle au plus
tard le 31 mars de chaque année, couvrant l'année civile précédente :

- Volumes (signalements, sanctions par type).
- Délais (médiane, p95).
- Taux d'annulation, taux de recours.
- Évolutions de la charte au cours de l'année.

## Annexe — requête SQL d'export

```sql
-- Décisions de modération du trimestre courant, jointes au membre
-- cible et à l'acteur. Anonymise au format compte-rendu.
SELECT
  ma.id                                AS action_id,
  ma.type                              AS action_type,
  ma.reason                            AS reason,
  ma."createdAt"                       AS decided_at,
  actor.handle                         AS actor_handle,
  target.handle                        AS target_handle,
  target."isCoreTeam"                  AS target_is_core,
  target."joinedAt"                    AS target_joined_at,
  -- Pour les BAN, lier à la BAN_PROPOSAL préalable (≤ 24 h avant)
  (
    SELECT json_build_object(
      'proposed_by', proposer.handle,
      'proposed_at', prop."createdAt"
    )
    FROM "ModerationAction" prop
    JOIN "CommunityMember" proposer ON proposer.id = prop."actorId"
    WHERE prop.type = 'BAN_PROPOSAL'
      AND prop."targetMemberId" = ma."targetMemberId"
      AND prop."createdAt" >= ma."createdAt" - INTERVAL '24 hours'
      AND prop."createdAt" <= ma."createdAt"
    ORDER BY prop."createdAt" DESC
    LIMIT 1
  )                                    AS proposal_context
FROM "ModerationAction" ma
LEFT JOIN "CommunityMember" actor ON actor.id = ma."actorId"
LEFT JOIN "CommunityMember" target ON target.id = ma."targetMemberId"
WHERE ma."createdAt" >= date_trunc('quarter', NOW()) - INTERVAL '3 months'
  AND ma."createdAt" < date_trunc('quarter', NOW())
  AND ma.type IN ('BAN_USER', 'SUSPEND_USER', 'MUTE_USER')
ORDER BY ma."createdAt" DESC;
```

## Historique

| Date       | Auteur | Motif                          |
| ---------- | ------ | ------------------------------ |
| 2026-05-07 | Franck | Création initiale du process.  |

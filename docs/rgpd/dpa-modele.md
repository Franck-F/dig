---
titre: Accord de traitement des données (DPA) — modèle Digizelle
type: Modèle contractuel — RGPD Art. 28
version: 1.0
derniere_mise_a_jour: 2026-05-07
fondement: Règlement UE 2016/679 (RGPD), Art. 28 §3
---

# Accord de traitement de données (DPA)

> **Objet** — Modèle d'accord à conclure entre Digizelle (**responsable de
> traitement**, ci-après « le Responsable ») et chaque prestataire qui traite
> des données pour son compte (**sous-traitant**, ci-après « le Sous-traitant »).
> Ce modèle s'aligne sur les exigences de l'article 28 du RGPD, sur la
> recommandation CNIL relative aux DPA et sur les Standard Contractual Clauses
> 2021/914 lorsque des transferts hors UE sont envisagés.

---

## ENTRE LES SOUSSIGNÉS

**Le Responsable de traitement**

- **Dénomination** : Laboratoire Calebasse — Digizelle
- **Forme** : association loi 1901
- **Siège** : EPITECH Campus du Kremlin-Bicêtre, 14-16 rue Voltaire, 94270 Le Kremlin-Bicêtre
- **Représenté par** : ____________________ en qualité de ____________________
- **Contact RGPD** : dpo@calebasse.com

**Le Sous-traitant**

- **Dénomination** : ____________________
- **Forme juridique** : ____________________
- **Siège** : ____________________
- **Représenté par** : ____________________ en qualité de ____________________
- **Contact RGPD** : ____________________

Ci-après ensemble désignés « **les Parties** ».

---

## 1. Objet

Le présent DPA encadre les modalités selon lesquelles le Sous-traitant traite
des données à caractère personnel pour le compte du Responsable, dans le cadre
du contrat principal de prestation conclu entre les Parties, et complète ce
contrat conformément à l'article 28 du RGPD.

## 2. Description du traitement (Annexe 1)

| Élément                          | Valeur                                                  |
| -------------------------------- | ------------------------------------------------------- |
| Nature du traitement             | (ex. hébergement, envoi d'email, observabilité, OAuth) |
| Finalité du traitement           | (rendre le service opérationnel pour le Responsable)   |
| Durée du traitement              | Durée du contrat principal + 30 jours (purge)           |
| Catégories de données            | (ex. email, identifiant, contenu de message, logs)     |
| Catégories de personnes          | Utilisateurs de la plateforme Digizelle                 |
| Données sensibles                | Aucune                                                  |
| Localisation                     | (ex. UE — eu-west-3)                                   |

## 3. Obligations du Sous-traitant (Art. 28 §3)

Le Sous-traitant s'engage à :

1. **Traiter les données uniquement sur instructions documentées** du
   Responsable, y compris en matière de transferts internationaux. Toute
   instruction informelle (email du DPO) est confirmée par avenant ou ticket.
2. **Garantir la confidentialité** : seules les personnes habilitées,
   formées et soumises à une obligation de confidentialité légale ou
   contractuelle accèdent aux données.
3. **Mettre en œuvre les mesures techniques et organisationnelles**
   décrites en Annexe 2 (chiffrement, journalisation, RBAC, etc.) et les
   actualiser au fil de l'état de l'art.
4. **Recourir à un sous-traitant ultérieur** uniquement avec
   l'autorisation préalable du Responsable et sous les mêmes obligations
   contractuelles.
5. **Coopérer aux demandes des personnes concernées** (Art. 12-22)
   et fournir au Responsable les informations nécessaires sous **5 jours
   ouvrés**.
6. **Coopérer aux mesures de sécurité** : analyses d'impact, audits,
   réponse à un incident.
7. **Notifier toute violation de données personnelles** au Responsable
   **sous 24 heures** après en avoir pris connaissance, par email à
   dpo@calebasse.com avec copie à l'équipe technique.
8. **Restituer ou supprimer les données** à la fin du contrat, au choix du
   Responsable, avec preuve d'effacement (certificat de destruction).
9. **Tenir un registre** des activités de traitement effectuées pour le
   compte du Responsable (Art. 30 §2).

## 4. Sous-traitance ultérieure (Art. 28 §2 et §4)

Le Sous-traitant publie en ligne ou communique au Responsable la liste à
jour de ses propres sous-traitants. Toute modification est notifiée
**au moins 30 jours** avant prise d'effet ; le Responsable peut s'y
opposer pour motif légitime, ce qui ouvre une renégociation ou la
résiliation du contrat sans pénalité.

## 5. Transferts hors Union européenne

Sauf mention contraire en Annexe 1, les données sont traitées dans
l'Espace Économique Européen.

Si un transfert hors UE est nécessaire :
- il est encadré par les **Clauses Contractuelles Types** 2021/914
  (modules pertinents annexés) et/ou par une décision d'adéquation de la
  Commission européenne ;
- le Sous-traitant met en place des **mesures supplémentaires** (chiffrement
  client, pseudonymisation, contrôle juridique) lorsque l'analyse Schrems II
  l'exige ;
- une notice spécifique est publiée dans la politique de confidentialité du
  Responsable.

## 6. Sécurité (Annexe 2)

Le Sous-traitant garantit, à minima, les mesures suivantes :

- **Confidentialité** : chiffrement TLS 1.2+ en transit, chiffrement AES-256
  ou équivalent au repos, séparation des environnements production / non-production.
- **Intégrité** : contrôle de version, hashing des jetons, vérification d'intégrité
  des sauvegardes.
- **Disponibilité** : sauvegardes au minimum quotidiennes, RPO ≤ 24 h, RTO
  documenté.
- **Authentification** : MFA obligatoire pour les administrateurs,
  rotation des clés API, gestion centralisée des accès.
- **Journalisation** : conservation des logs d'accès aux données pendant
  au moins 12 mois, mise à disposition sur demande.
- **Pentest** : test d'intrusion externe annuel ; rapport synthétique
  remis au Responsable sur demande raisonnable.

## 7. Audit (Art. 28 §3 h)

Le Responsable peut, à ses frais et avec un préavis de **30 jours**, mener
un audit de conformité sur site ou à distance, ou mandater un auditeur tiers
indépendant. Le Sous-traitant peut substituer cet audit par la fourniture des
rapports SOC 2 Type II, ISO 27001 ou équivalents les plus récents (datant de
moins de 12 mois) lorsque ceux-ci couvrent le périmètre concerné.

## 8. Notification de violation (Art. 33 et 34)

Le Sous-traitant notifie au Responsable toute violation de données dans un
**délai maximum de 24 heures** après en avoir pris connaissance, en
fournissant :

- nature de la violation, catégories et nombre approximatif de personnes et
  d'enregistrements concernés ;
- conséquences probables ;
- mesures prises ou envisagées pour remédier à la violation et limiter
  ses effets ;
- coordonnées du DPO du Sous-traitant.

## 9. Restitution des données (Art. 28 §3 g)

À la fin de la prestation, à la demande du Responsable, le Sous-traitant :
- restitue les données dans un format ouvert et machine-readable ;
- ou détruit les données existantes ;
- et fournit, dans les 30 jours, un certificat d'effacement signé.

## 10. Responsabilité

Le Sous-traitant est responsable du respect des présentes obligations et,
le cas échéant, indemnise le Responsable des amendes administratives ou
condamnations civiles nées d'un manquement à ses obligations propres. Le
plafond de responsabilité est défini au contrat principal.

## 11. Durée — Résiliation

Le DPA est conclu pour la durée du contrat principal. Il peut être résilié
par le Responsable à effet immédiat en cas de manquement grave et non
remédié dans un délai de 15 jours après mise en demeure.

## 12. Dispositions diverses

- **Droit applicable** : droit français.
- **Juridiction compétente** : tribunaux compétents du ressort de Paris.
- **Hiérarchie des normes** : en cas de contradiction, le présent DPA
  prévaut sur le contrat principal pour ce qui concerne le traitement
  des données personnelles.
- **Avenant** : toute modification fait l'objet d'un avenant écrit signé
  par les Parties.

---

## ANNEXE 1 — Description détaillée du traitement

À renseigner par le Sous-traitant à la signature.

## ANNEXE 2 — Mesures techniques et organisationnelles (TOMs)

À renseigner par le Sous-traitant. Référence acceptée : ISO 27001:2022,
SOC 2 Type II, OWASP ASVS Level 2.

## ANNEXE 3 — Liste des sous-traitants ultérieurs

À tenir à jour. Lien public ou pdf joint à l'avenant.

---

**Fait à __________, le __________, en deux exemplaires originaux.**

| Pour le Responsable                  | Pour le Sous-traitant                |
| ------------------------------------ | ------------------------------------ |
| Nom : ______________________________ | Nom : ______________________________ |
| Fonction : __________________________ | Fonction : __________________________ |
| Signature :                          | Signature :                          |

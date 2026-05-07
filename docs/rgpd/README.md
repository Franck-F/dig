# Documentation RGPD — Digizelle

Centre de gravité de la conformité Digizelle. Toute évolution d'un traitement
ou de la liste des sous-traitants doit déclencher une révision des
documents ci-dessous.

## Sommaire

- [`registre-traitements.md`](./registre-traitements.md) — Registre des
  activités de traitement (RGPD Art. 30). Source de vérité, rendu côté admin
  via `/community/admin/rgpd`.
- [`dpa-modele.md`](./dpa-modele.md) — Modèle d'accord de traitement (Art. 28),
  à instancier pour chaque sous-traitant.
- `dpa/` — Dossier des DPA signés (à créer au premier signature). **Non
  versionné** : conservé hors-Git pour respecter la confidentialité (cf.
  `.gitignore`).
- [`registre-violations.md`](./registre-violations.md) — registre interne
  des violations de données (Art. 33 §5).
- [`aipd-mentora.md`](./aipd-mentora.md) — analyse d'impact (PIA) du
  traitement T-02 (profils mentors/mentees + mineurs).
- [`aipd-community.md`](./aipd-community.md) — analyse d'impact du
  traitement T-04 (communauté UGC + mineurs + modération).
- [`comite-revue-moderation.md`](./comite-revue-moderation.md) — process
  de comité de revue trimestrielle des décisions de modération
  (composition, périmètre, KPI, requête SQL d'export).
- Le runbook d'incident Art. 33-34 vit dans
  [`../runbooks/rgpd-incident.md`](../runbooks/rgpd-incident.md).

## Cadence de revue

| Document                  | Fréquence    | Responsable |
| ------------------------- | ------------ | ----------- |
| Registre des traitements  | Annuelle     | DPO         |
| Modèle DPA                | Sur évolution réglementaire | DPO |
| AIPD (lorsque applicables) | Annuelle     | DPO + Tech  |
| Liste des sous-traitants  | À chaque ajout/changement | DPO |

## Contact

- DPO : dpo@calebasse.com
- Communication : communication@calebasse.com

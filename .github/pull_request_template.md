## Résumé

<!-- 1-3 phrases. Le « pourquoi » plutôt que le « quoi » — la diff parle
d'elle-même. -->

## Changements

<!-- Liste des modifications notables. Mentionner les migrations,
nouvelles env vars, nouveaux endpoints, breaking changes. -->

- [ ] …

## Impact

<!-- Cocher ce qui s'applique. -->

- [ ] Ajoute ou modifie un traitement de données personnelles
      (mettre à jour `docs/rgpd/registre-traitements.md`)
- [ ] Ajoute un sous-traitant
      (mettre à jour le registre + signer un DPA — `docs/rgpd/dpa-modele.md`)
- [ ] Migration Prisma à appliquer en prod (`npx prisma migrate deploy`)
- [ ] Nouvelle variable d'environnement (mettre à jour `.env.example`)
- [ ] Modifie un workflow GitHub Actions ou la CI
- [ ] Modifie la politique CSP ou un header de sécurité
- [ ] Touche au flow d'auth ou aux permissions
- [ ] Aucun des éléments ci-dessus

## Plan de test

<!-- Bulleted checklist. Inclure : étapes manuelles golden-path, edge
cases, et la commande `npm test` quand pertinent. -->

- [ ] `npm run typecheck` passe localement
- [ ] `npm run lint` passe localement
- [ ] `npm test` passe localement
- [ ] Test manuel : …

## Captures / preview

<!-- Pour les PR UI, joindre un screenshot ou un lien preview Vercel. -->

## Notes pour le reviewer

<!-- Choix non-évidents, alternatives écartées, suite prévue. -->

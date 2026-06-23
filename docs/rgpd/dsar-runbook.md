# Runbook DSAR — traitement des demandes des personnes (RGPD)

> Procédure opérationnelle pour répondre à une demande d'exercice de droits
> (DSAR — Data Subject Access Request). Audit RGPD finding 3.4 : tant qu'une
> console DSAR intégrée n'existe pas (voir « Pistes d'outillage » en bas), ce
> runbook est la procédure de référence. Les mécanismes techniques (export,
> effacement) existent déjà ; il s'agit de les orchestrer et de tracer le délai.

## Délai légal

- **30 jours** à compter de la réception de la demande (registre des
  traitements §11), **extensible à 90 jours** si la demande est complexe — dans
  ce cas, informer la personne du report et du motif **avant** la fin des 30 jours.
- Vérifier l'**identité** du demandeur avant toute action (a fortiori pour une
  suppression). Pour un compte, exiger que la demande vienne de l'email du compte.

## Droit d'accès / portabilité (Art. 15 & 20)

**Cas standard — la personne a accès à son compte (self-service) :**
1. L'orienter vers **Paramètres du compte → « Exporter mes données »**
   (route `/api/account/export`, renvoie un JSON complet versionné).
2. L'export couvre toutes ses données personnelles (profil, mentorats, messages,
   contenus communautaires, notifications, etc.). Exclus volontairement : secrets
   (hash mdp, tokens OAuth), et les signalements/journaux d'audit *la concernant*
   (intérêt légitime de modération — fournis seulement sur demande Art. 15
   explicite, voir ci-dessous).

**Cas « la personne n'a plus accès au compte » :**
1. Vérifier l'identité hors-bande.
2. Générer l'export côté serveur : `buildUserDataExport(userId)`
   (`src/lib/rgpd/export.ts`) via un script de maintenance, transmettre le JSON
   par un canal sécurisé.
3. Si la demande Art. 15 vise aussi les signalements/sanctions *la concernant* :
   les extraire manuellement (`Report` / `ModerationAction` par `targetMemberId`),
   en occultant les données des tiers (auteurs des signalements).

## Droit d'effacement (Art. 17)

**Cas standard (self-service) :**
1. L'orienter vers **Paramètres communauté → Zone danger → Supprimer mon compte**.
2. Effet immédiat : anonymisation du PII (email, nom, image, handle/avatar →
   « Compte supprimé ») ; **purge irréversible à J+30** (cron quotidien). Fenêtre
   de restauration de 30 jours en cas d'erreur.

**Cas admin (la personne ne peut pas self-servir) :**
1. Vérifier l'identité.
2. `softDeleteUser(userId, adminUserId, 'dsar:erasure')`
   (`src/lib/soft-delete/user.ts`) — journalisé dans `AuditLog`.
3. La purge J+30 et le nettoyage du Storage suivent automatiquement.

## Opposition / limitation

- **Marketing** : opt-out via `marketingEmailsEnabled` (lien de désinscription
  1-clic dans chaque email, ou Paramètres). Les mineurs déclarés sont déjà
  exclus des audiences (voir rétention).
- **Limitation** : pas d'automatisation ; geler le compte (suspension) en
  attendant l'arbitrage, sans supprimer.

## Traçabilité

- Toute suppression/restauration et action admin sensible est écrite dans
  `AuditLog` (acteur, cible, horodatage). Conserver aussi la trace de la demande
  et de la réponse (date de réception, date de réponse, canal) hors-application
  (registre des demandes) pour prouver le respect du délai.

## Pistes d'outillage (si on veut une console intégrée — hors scope actuel)

Étendre `/community/admin/rgpd` (aujourd'hui en lecture seule du registre) avec :
recherche d'un utilisateur, bouton « Exporter » (déclenche `buildUserDataExport`
et propose le téléchargement), bouton « Effacer » (`softDeleteUser`), file de
demandes avec **suivi du délai 30 j**, le tout journalisé dans `AuditLog`.
Effort estimé : M–L (UI admin + actions serveur + modèle de suivi des demandes).

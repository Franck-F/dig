# Plan d'implémentation — Refonte du rendu du root layout (perf)

> **Pour la session dédiée :** ce plan est à exécuter dans une session à part, avec les garde-fous **`npm run build` + `npm run lighthouse` + `npm run test:e2e`** à chaque étape. Plusieurs **décisions produit** sont à trancher AVANT de coder (section 4). Ne pas démarrer le code avant la mesure baseline (section 5).

**Goal :** réduire le coût de rendu des pages publiques (vitrine) aujourd'hui toutes rendues dynamiquement, sans régression visuelle, fonctionnelle ni SEO.

**Architecture actuelle (vérifiée le 2026-06-23) :** un seul `app/layout.tsx` enveloppe toute l'app et lit, à chaque requête, des **Dynamic APIs** → tout l'arbre est dynamique, rien n'est servi par le CDN.

**Tech stack :** Next.js 16 (App Router), next-intl 4 (i18n **par cookie**, pas de segment `[locale]`), next-auth v5 (session JWT), Prisma 6, Vercel.

## Global Constraints
- **Aucun changement de comportement visible** sans décision produit explicite (URLs, état de session du Header).
- Tout changement validé par **build + Lighthouse + e2e Playwright** (pas seulement typecheck).
- FR = locale par défaut ; EN = overlay partiel mergé sur FR (`src/i18n/request.ts`).
- Ne pas casser le SEO (canonical, JSON-LD, sitemap) ni l'i18n.

## 1. Comportement actuel (preuves)

`src/app/layout.tsx` (RootLayout, l.76-120) appelle à chaque requête :
- `getLocale()` → `src/i18n/request.ts:resolveLocale()` lit **`cookies()` + `headers()`** (Dynamic API).
- `getMessages()` → charge tout `fr.json` (~220 KB) + overlay, **sérialisé au client** via `NextIntlClientProvider`.
- `auth()` → décode le cookie de session (Dynamic API). S'exécute **aussi pour les visiteurs anonymes**.
- `prisma.user.findUnique(...)` → **uniquement si connecté** (`if (userId)`, l.91) pour alimenter le `Header`. Les anonymes ne touchent donc PAS la DB.

Conséquence : chaque route fille (y compris la vitrine 100 % publique) est en SSR par requête → zéro page CDN.

## 2. Les 3 contraintes qui rendent ce n'est PAS un simple refactor

1. **i18n par cookie ⇒ incompatible avec le statique.** Résoudre la locale lit le cookie `NEXT_LOCALE` / `Accept-Language` → Dynamic API. Tant que la locale est résolue par requête, la page ne peut pas être statique. La voie next-intl « static-friendly » est le **routing par chemin `[locale]`** (`/fr/...`, `/en/...`) + `generateStaticParams` + `setRequestLocale`.
2. **Session résolue serveur PAR CHOIX.** `SessionContextProvider` (commentaire l.6-13) résout la session serveur **exprès pour éviter le polling `/api/auth/session`** de `next-auth/react` « qu'on ne veut pas pour un site marketing ». Un seul consommateur : `Header.tsx` (`useClientSession`). Rendre la vitrine statique impose de **revenir sur ce choix** (session côté client → fetch + bref flash d'état déconnecté), ou d'accepter un Header dynamique.
3. **Pas de segment `[locale]` aujourd'hui** (routes en `app/mentora/...`, pas `app/[locale]/mentora/...`). Le passer en `[locale]` **change toutes les URLs** → redirections 301 + mise à jour de tous les `<Link>` + middleware de détection/redirection + sitemap/canonical.

## 3. Recadrage du « plus gros levier »

L'audit présentait le root layout comme le plus gros levier perf. C'est vrai *en théorie* (CDN), mais le coût réel est élevé : **migration d'URL + reversal d'un choix de design délibéré**. Avant de payer ce coût, il faut **mesurer** : si le TTFB dynamique est correct et que le vrai problème LCP est le hero `framer-motion` / le footer `gsap` / le payload i18n, on obtient l'essentiel du gain **sans** la migration `[locale]`.

## 4. Décisions produit à trancher AVANT de coder

| # | Décision | Impact si « oui » |
|---|----------|-------------------|
| D1 | Accepte-t-on des **URLs préfixées par la locale** (`/fr/...`, `/en/...`) ? | Active le statique i18n, mais 301 + maj liens + SEO. |
| D2 | Accepte-t-on une **session Header côté client** (fetch + flash bref) sur la vitrine ? | Lève la contrainte n°2 ; léger flash logged-out→logged-in. |
| D3 | Périmètre « vitrine » à rendre statique (liste exacte des routes publiques sans données per-user). | Définit le blast radius. |

**Recommandation :** ne PAS s'engager sur la migration `[locale]` (Option A) tant que la mesure (section 5) n'a pas prouvé que le rendu dynamique est le goulot. Commencer par l'**Option B** (gains sûrs, sans changement d'URL).

### Option A — Migration `[locale]` complète (statique/ISR vitrine)
Le « maximum ». Requiert D1 + D2. Effort **L+**, risque SEO. Détaillée en section 7 (conditionnelle).

### Option B — Réduire le coût du dynamique sans changer d'URL (recommandé en premier)
Effort **M**, risque faible, zéro changement d'URL. Détaillée en section 6.

## 5. Pré-requis OBLIGATOIRE — mesure baseline (gate)

- [ ] **Étape 0.1** : `npm run build` puis `npm run lighthouse` sur l'accueil + 2 pages vitrine. Noter LCP, TTFB, TBT, poids JS, et la part i18n du bundle (`ANALYZE=1 npm run build` → `build:analyze`).
- [ ] **Étape 0.2** : Lancer `npm run test:e2e` pour avoir la **baseline verte** de référence (toute régression future se compare à ça).
- [ ] **Étape 0.3** : Décider, chiffres en main, si l'Option A est justifiée. Documenter la décision dans ce fichier.

> **Critère de décision** : si TTFB vitrine < ~200 ms et LCP dominé par le JS (hero/footer), faire l'Option B + les quick-wins bundle, **mesurer à nouveau**, et ne lancer l'Option A que si le delta restant le justifie.

## 6. Option B — tâches (recommandé, sans changement d'URL)

### Tâche B1 — Réduire le payload i18n sérialisé au client
**Files :** `src/app/layout.tsx` (l.78, 151) ; éventuellement providers par section.
- [ ] Mesurer la part de `messages` envoyée au client (baseline 0.1).
- [ ] Remplacer l'envoi de **tout** `fr.json` par un sous-ensemble par namespace (`pick`/`NextIntlClientProvider` avec messages filtrés), ou des providers locaux aux sections qui en ont besoin.
- [ ] Vérif : build + Lighthouse (poids JS en baisse) + e2e (i18n intact) + rendu FR/EN manuel.

### Tâche B2 — Sortir la requête Prisma du chemin commun
**Files :** `src/app/layout.tsx` (l.91-120).
- [ ] Constat : déjà skip pour les anonymes. Pour les connectés, évaluer si le `Header` peut se contenter du JWT (`session.user`) pour `name`/`role` — **attention** : le rôle est lu en DB par sécurité (ne pas faire confiance au JWT pour les gates). Conserver la lecture DB **uniquement** pour les surfaces où le rôle pilote un gate ; pour le `Header` (affichage), un rôle JWT best-effort peut suffire.
- [ ] Décision à acter : garder DB (sécurité) vs JWT (perf) pour l'affichage Header. Si conservé, ne rien changer ici.

### Tâche B3 — Nettoyer `force-dynamic` / `revalidate` contradictoires
**Files :** `src/app/community/page.tsx:9-10` (+ ~6 routes — voir audit §5.3).
- [ ] Retirer les `revalidate` morts là où `force-dynamic` est présent (cohérence ; pas de gain mais déblaie le terrain).
- [ ] Vérif : build (pas de warning) + e2e.

### Tâche B4 — Quick-wins LCP/bundle de la vitrine (issus de l'audit §5.2)
**Files :** `HeroParallax.tsx`, `page.tsx` (hero) ; `Frame.tsx`/`motion-footer.tsx` (gsap footer) ; `LoginCharacters` (login).
- [ ] `next/dynamic(ssr:false)` les îles décoratives hors viewport initial + footer gsap derrière `!hideFooter`.
- [ ] Hero : rendre le mascot LCP en SSR direct, dynamiser le wrapper parallax.
- [ ] Vérif : **Lighthouse avant/après** (LCP, TBT) + visuel + e2e.

## 7. Option A — Migration `[locale]` (CONDITIONNELLE — seulement si 5/D1/D2 le justifient)

> Outline (à détailler en plan complet si retenue). Effort L+, SEO-sensible.

1. Créer `src/app/[locale]/` et y **déplacer** toutes les routes actuelles ; `app/layout.tsx` devient minimal (html/body/fonts) sans Dynamic API.
2. `src/middleware.ts` : détection de locale (cookie/Accept-Language) + **redirection 301** vers `/<locale>/...` ; conserver `/` → locale par défaut.
3. `generateStaticParams()` (locales) + `setRequestLocale(locale)` dans le layout `[locale]`.
4. Passer next-intl en mode `routing` par chemin (`src/i18n/routing.ts` + `request.ts`).
5. `Header` : session **côté client** (D2) — `next-auth/react` `SessionProvider` ou fetch léger ; accepter le flash ou un skeleton.
6. Marquer les routes vitrine `export const dynamic = 'force-static'` / `revalidate` (ISR) ; garder les routes per-user dynamiques.
7. **SEO** : redirections des anciennes URLs, `alternates.languages`, sitemap multi-locale, canonical par locale, JSON-LD inchangé.
8. Mettre à jour **tous** les `<Link href>` internes et les `redirect()` serveur pour préfixer la locale (ou via le helper de navigation next-intl).

## 8. Gates de vérification (à CHAQUE étape)
- `npm run typecheck` · `npm run lint`
- `npm run build` (0 erreur ; vérifier dans la sortie quelles routes passent ○ Static / ƒ Dynamic).
- `npm run test:e2e` (comparer à la baseline 0.2).
- `npm run lighthouse` (comparer à la baseline 0.1 ; LCP/TTFB/TBT).
- Vérification **visuelle** FR + EN, connecté + anonyme.

## 9. Rollback
- Option B : changements localisés, revert par commit.
- Option A : feature-branch longue ; garder un commit « avant migration » taggé ; la redirection middleware est le point de non-retour SEO → valider sur preview Vercel avant prod. En cas de souci, revert du middleware rétablit les URLs.

## 10. Risques
- **SEO (Option A)** : URLs changées → perte de ranking si redirections mal faites. Mitiger : 301 exhaustifs + sitemap + monitoring Search Console.
- **Flash de session (Option A/D2)** : Header logged-out→logged-in visible. Mitiger : skeleton/cookie de hint non-sensible.
- **i18n régression** : le merge FR/EN partiel doit survivre au passage path-based. Couvrir en e2e.
- **Sur-ingénierie** : si la baseline montre un TTFB déjà bon, l'Option A n'en vaut pas le coût → s'arrêter à l'Option B.

## 11. Résultat de la mesure baseline (2026-06-23) — DÉCISION : ne pas refactorer

Lighthouse (preset desktop, `next start` sur le build prod), page d'accueil, 2 runs :

| Métrique | Valeur |
|----------|--------|
| Performance | **0.98 – 0.99** |
| TTFB (server-response-time) | **~35-40 ms** |
| LCP | ~990-1042 ms |
| FCP | ~340-360 ms |
| TBT | **0 ms** |
| Speed Index | ~880-910 ms |
| a11y / best-practices / SEO | 0.96 / 1.0 / 0.92 |
| JS total / inutilisé | 842 KB / 55 KB |

**Conclusion :** le rendu dynamique n'est **pas** un goulot (TTFB 40 ms, perf 0.98-0.99, TBT 0). Le « plus gros levier » de l'audit était théorique (absence de CDN) ; en pratique passer la vitrine en statique ne déplacerait rien de perceptible pour un coût élevé (migration d'URL + session client). **Décision : ni Option A ni Option B.** Le seul résidu est le poids JS (842 KB, 55 KB inutilisé) — ROI faible avec TBT=0 ; à reconsidérer seulement si une cible mobile bas de gamme l'exige.

> Décisions produit du 2026-06-23 : D1 = non (pas de changement d'URL), D2 = non (session serveur conservée). Combinées à la mesure → root-layout laissé tel quel. Les gains perf utiles ont été livrés en amont (PR #43 : index DB + N+1).

> Note d'exécution : `npm run lighthouse` crashe au teardown sur Windows (`EPERM` de chrome-launcher sur le temp Chrome) — les LHR sont quand même écrits dans `.lighthouseci/` ; extraire les scores depuis les `lhr-*.json`.

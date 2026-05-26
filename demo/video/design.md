# Design system — Vidéos pub Digizelle Mentorat

Identité visuelle des deux spots publicitaires (onboarding mentorée /
onboarding mentor). Valeurs extraites de l'app Digizelle réelle.

## Mood

Premium, moderne, énergique et chaleureux. Tech grand public, inclusif,
optimiste. Une pub d'application mobile : rythmée, lumineuse, soignée.
Fond sombre violet profond pour faire ressortir l'écran du téléphone.

## Palette

Fond (dégradé sombre — repris de la page /welcome de l'app) :

| Rôle | Hex |
|------|-----|
| Fond profond | `#0f0728` |
| Fond médian | `#1a103e` |
| Fond haut | `#2a1660` |

Accents de marque :

| Rôle | Hex |
|------|-----|
| Violet primaire | `#7301FF` |
| Violet clair | `#A34BF5` |
| Rose | `#F46FB1` |
| Bleu | `#3B7BFF` |
| Vert (validation) | `#23c55e` |
| Ambre | `#FFB823` |

Texte :

| Rôle | Hex |
|------|-----|
| Texte principal | `#FFFFFF` |
| Texte secondaire | `#C4B8E8` |
| Texte tertiaire / légendes | `#8E82B8` |

Dégradés signature :
- Violet→Rose : `linear-gradient(135deg, #7301FF, #F46FB1)` — accent mentorée
- Violet→Navy : `linear-gradient(135deg, #A34BF5, #24325F)` — accent mentor
- Glow radial : `radial-gradient(circle, rgba(115,1,255,0.35), transparent 70%)`

## Accent par vidéo

- **Vidéo mentorée** — accent `#7301FF`, dégradé violet→rose `#F46FB1`.
- **Vidéo mentor** — accent `#A34BF5`, dégradé violet clair→navy `#24325F`.

## Typographie

- Police unique : **Signika** (la police de l'app, Google Fonts).
- Poids : 700/800 pour les titres, 600 pour les sous-titres, 400/500 pour le corps.
- Titres serrés : `letter-spacing: -0.02em`.
- Eyebrows / kickers : MAJUSCULES, `letter-spacing: 0.12em`, 700.

## Coins & profondeur

- Coins arrondis généreux : 16–28px sur les cartes, 999px sur les puces.
- Mockup téléphone : rayon ~44px.
- Profondeur par **glows** colorés (pas d'ombres dures) — halos violets/roses
  diffus derrière les éléments clés. Glassmorphism léger sur les cartes.

## Mouvement

- Entrées fluides et toniques : `power3.out`, `expo.out`, `back.out(1.5)`.
- Rythme pub : entrées rapides (0.4–0.7s), staggers serrés (80–120ms).
- Le téléphone « respire » légèrement (float doux).
- Transitions de scène : fondus + glissés, jamais de coupe sèche.

## À éviter

- Pas de fond blanc plein écran (réservé à l'écran du téléphone).
- Pas de dégradés linéaires plein cadre sur fond sombre (banding H.264) —
  préférer radial ou aplat + glow localisé.
- Pas de couleurs hors palette.
- Pas de coupe sèche entre scènes.
- Pas d'ombres portées dures — uniquement des glows.

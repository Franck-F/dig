# 🎥 Demo — Vidéos publicitaires d'onboarding

Production de **spots publicitaires** présentant les parcours
d'inscription Digizelle Mentorat — en **9:16** (mobile : Reels, TikTok,
Stories) et **16:9** (desktop : YouTube, site, présentation).

| Parcours | 9:16 mobile | 16:9 desktop |
|----------|-------------|--------------|
| Onboarding **mentorée** | `video/mentee/renders/mentee.mp4` | `video/mentee-wide/renders/mentee-16x9.mp4` |
| Onboarding **mentor** | `video/mentor/renders/mentor.mp4` | `video/mentor-wide/renders/mentor-16x9.mp4` |

La production se fait en **deux couches** :

### 1. Capture du parcours réel — Playwright

Des scripts Playwright jouent le parcours d'onboarding sur le site de
production (`dig-black.vercel.app`) et enregistrent un screencast 9:16.

```bash
npm run demo:record      # (depuis la racine du dépôt)
```

→ réinitialise les comptes de démo puis enregistre
`demo/recordings/{mentee,mentor}-onboarding.webm`.

| Fichier | Rôle |
|---------|------|
| `playwright.config.ts` | Config (cible prod, viewport 720×1280, vidéo) |
| `global-setup.ts` / `global-teardown.ts` | Réinitialise les comptes / range les vidéos |
| `_helpers.ts` | Connexion, cookies, saisie tapée |
| `mentee-onboarding.spec.ts` / `mentor-onboarding.spec.ts` | Les walkthroughs |
| `recordings/` | Screencasts bruts (non versionné) |

Comptes de démo (créés dans la base par `prisma/seed-demo-accounts.ts`) :

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Mentorée | `lea.moreau@gmail.com` | `DemoMentee2026!` |
| Mentor | `thomas.mercier@gmail.com` | `DemoMentor2026!` |

> Nettoyer ces comptes après les tournages :
> `npx tsx prisma/seed-demo-accounts.ts clean`

### 2. Montage publicitaire — HyperFrames

Le dossier [`video/`](./video/) assemble la capture dans une vraie vidéo
pub : mockup téléphone, intro/outro de marque, voix off IA, sous-titres,
puces d'étape, dégradés Digizelle. Rendu en MP4.

➡️ **Voir [`video/README.md`](./video/README.md)** pour tout le détail
(re-rendre, régénérer la voix off, réglages).

---

## 🔧 Prérequis

- `@playwright/test` + Chromium (`npx playwright install chromium`) — couche 1.
- FFmpeg + FFprobe sur le PATH, et `npm install` dans `video/` — couche 2.
- Python + `edge-tts` + `mutagen` — pour (re)générer la voix off.

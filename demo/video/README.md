# 🎬 Vidéos publicitaires — Digizelle Mentorat

Spots publicitaires, qualité pub, produits avec **HyperFrames**
(HTML + GSAP → MP4) — chacun en **deux formats** :

| Vidéo | 9:16 mobile (1080×1920) | 16:9 desktop (1920×1080) |
|-------|-------------------------|---------------------------|
| Onboarding **mentorée** | `mentee/renders/mentee.mp4` | `mentee-wide/renders/mentee-16x9.mp4` |
| Onboarding **mentor** | `mentor/renders/mentor.mp4` | `mentor-wide/renders/mentor-16x9.mp4` |

Durée ≈ 1 min 24 (mentorée) / 1 min 29 (mentor). Le **9:16** remplit
l'écran (Reels, TikTok, Stories) ; le **16:9** place le téléphone à
gauche et l'habillage de marque à droite (YouTube, site, présentation).

Chaque spot : intro de marque animée → démo de l'app dans un **mockup
téléphone** (capture d'écran réelle) → habillage (puces d'étape,
sous-titres synchronisés, barre de progression) → outro avec appel à
l'action. **Voix off IA** intégrée (voix neuronales françaises).

---

## 🗂️ Structure

```
demo/video/
  design.md            Système de design (couleurs, police, mouvement)
  build-voiceover.py   Génère la voix off (edge-tts) + voiceover.json
  assets/              Sources : voix off d'origine, mascotte, voiceover.json
  fonts/               Police Signika (source)
  mentee/              Projet HyperFrames — mentorée 9:16
    index.html         La composition
    assets/  fonts/    Assets locaux (autonomes)
    renders/           Sortie MP4
  mentor/              Projet HyperFrames — mentor 9:16
  mentee-wide/         Projet HyperFrames — mentorée 16:9
  mentor-wide/         Projet HyperFrames — mentor 16:9
```

Chaque sous-dossier est un **projet HyperFrames autonome** : il contient
son `index.html`, ses `assets/` et `fonts/`. Les versions `-wide`
réutilisent les mêmes assets et la même timeline — seule la mise en page
CSS (`<style>`) et `data-width`/`data-height` changent.

---

## 🔧 Prérequis

- **FFmpeg + FFprobe** sur le PATH (encodage vidéo). Vérifier : `npx hyperframes doctor`.
- `npm install` dans `demo/video/` (installe `hyperframes`).
- Pour régénérer la voix off : Python + `pip install edge-tts mutagen`.

---

## ▶️ Re-rendre une vidéo

Depuis `demo/video/` :

```bash
# 9:16 mobile
cd mentee      && npx hyperframes render --quality standard --fps 30 -o renders/mentee.mp4
cd mentor      && npx hyperframes render --quality standard --fps 30 -o renders/mentor.mp4
# 16:9 desktop
cd mentee-wide && npx hyperframes render --quality standard --fps 30 -o renders/mentee-16x9.mp4
cd mentor-wide && npx hyperframes render --quality standard --fps 30 -o renders/mentor-16x9.mp4
```

`--quality` : `draft` (rapide, aperçu) · `standard` · `high` (livraison).

Vérifier la composition sans rendu complet :

```bash
cd mentee && npx hyperframes lint        # règles HyperFrames
cd mentee && npx hyperframes snapshot --at 2,10,26,47,63,80   # PNG témoins
```

---

## 🎙️ Régénérer la voix off

Le texte de narration vit dans `build-voiceover.py` (segments `me*` / `mo*`).
Après modification :

```bash
py demo/video/build-voiceover.py
py -c "import json,os; from mutagen.mp3 import MP3; \
  d=json.load(open('demo/video/assets/audio/voiceover.json',encoding='utf-8')); \
  [s.__setitem__('duration',round(MP3(os.path.join('demo/video',s['file'])).info.length,3)) for s in d['segments']]; \
  json.dump(d,open('demo/video/assets/audio/voiceover.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)"
```

Puis recopier les MP3 dans `mentee/assets/audio/` et `mentor/assets/audio/`,
et ajuster les `data-start` / `data-duration` des `<audio>` dans les
`index.html` si les durées ont changé.

---

## 🎞️ Pipeline complet (de zéro)

1. **Captures** — `npm run demo:record` à la racine du dépôt → screencasts
   9:16 dans `demo/recordings/`.
2. **Ré-encodage** — les webm Playwright ont des keyframes éparses ; on les
   ré-encode en MP4 *all-intra* (lecture fluide dans HyperFrames) :
   ```bash
   ffmpeg -i screencast-mentee.webm -c:v libx264 -pix_fmt yuv420p -g 1 -crf 19 -an screencast-mentee.mp4
   ```
3. **Voix off** — `py build-voiceover.py`.
4. **Rendu** — `npx hyperframes render` dans `mentee/` et `mentor/`.

---

## ✏️ Réglages utiles

| Pour changer… | Où |
|---------------|-----|
| Couleurs / dégradés | bloc `<style>` de chaque `index.html` + `design.md` |
| Textes (intro, sous-titres, outro) | le HTML de chaque `index.html` |
| Voix / texte de narration | `build-voiceover.py` |
| Timing des scènes | constantes `chipIn` / `capIn` / `data-start` dans `index.html` |
| Police | `fonts/` + `@font-face` |

---

## 🎵 Musique

Les vidéos sont livrées **sans musique** (pas de piste sous licence
fournie). Pour en ajouter : déposer un `music.mp3` dans `mentee/assets/`,
ajouter `<audio id="music" src="assets/music.mp3" data-start="0"
data-duration="84" data-track-index="2" data-volume="0.12"></audio>` dans
`index.html`, puis re-rendre. Garder le volume bas (~12 %) sous la voix off.

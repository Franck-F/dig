"""
Génère la voix off des deux vidéos pub Digizelle via edge-tts (voix
neuronales françaises) et un manifeste de timings de mots pour les
sous-titres synchronisés.

Sortie -> demo/video/assets/audio/
  meN.mp3 / moN.mp3   : un fichier audio par segment de narration
  voiceover.json      : { segments: [ {id, file, duration, text, words[]} ] }

Usage :  py demo/video/build-voiceover.py
"""
import asyncio
import json
import os
import edge_tts

OUT = os.path.join(os.path.dirname(__file__), "assets", "audio")
os.makedirs(OUT, exist_ok=True)

# Voix : Denise (femme, chaleureuse) pour la mentorée, Henri (homme) pour
# le mentor — chaque vidéo a sa propre identité vocale.
MENTEE_VOICE = "fr-FR-DeniseNeural"
MENTOR_VOICE = "fr-FR-HenriNeural"
RATE = "+6%"  # léger tonus, ton publicitaire

SEGMENTS = [
    # --- MENTORÉE -----------------------------------------------------
    ("me0", MENTEE_VOICE,
     "Trouver un mentor qui te comprend, ça change tout. "
     "Et c'est plus simple que tu ne crois."),
    ("me1", MENTEE_VOICE,
     "Voici Mentorat, le programme de mentorat de Digizelle. "
     "Connecte-toi, et crée ton profil en trois étapes."),
    ("me2", MENTEE_VOICE,
     "D'abord, tes objectifs. Décrocher ton premier job, te reconvertir, "
     "ou lancer ton projet. Choisis les domaines qui te passionnent."),
    ("me3", MENTEE_VOICE,
     "Ensuite, ton parcours. Ton niveau, le format que tu préfères, "
     "et les défis sur lesquels tu veux avancer."),
    ("me4", MENTEE_VOICE,
     "Enfin, tes disponibilités. Et pendant que tu remplis, notre "
     "algorithme pré-sélectionne déjà les mentors faits pour toi."),
    ("me5", MENTEE_VOICE,
     "Et voilà : ton tableau de bord t'attend. "
     "Rejoins Mentorat, et avance bien accompagnée."),
    # --- MENTOR -------------------------------------------------------
    ("mo0", MENTOR_VOICE,
     "Tu as une expérience, un métier, un parcours. "
     "Et si tu le transmettais ?"),
    ("mo1", MENTOR_VOICE,
     "Deviens mentor sur Digizelle. Connecte-toi, et dépose ta "
     "candidature en quatre étapes guidées."),
    ("mo2", MENTOR_VOICE,
     "D'abord, ton profil. Ton titre, ta bio, ton expérience — "
     "ce que verront tes futures mentorées."),
    ("mo3", MENTOR_VOICE,
     "Ensuite, ton expertise. Les compétences que tu maîtrises, "
     "et les profils que tu veux accompagner."),
    ("mo4", MENTOR_VOICE,
     "Puis ta disponibilité. Tu fixes ton rythme, ta capacité, "
     "tes créneaux — tu gardes le contrôle."),
    ("mo5", MENTOR_VOICE,
     "Enfin, la charte du mentor. Cinq engagements simples qui "
     "garantissent un mentorat de qualité."),
    ("mo6", MENTOR_VOICE,
     "Ta candidature est envoyée. Bienvenue chez les mentors Digizelle."),
]


async def synth(seg_id, voice, text):
    """Synthétise un segment, renvoie (duration, words[])."""
    comm = edge_tts.Communicate(text, voice, rate=RATE)
    mp3_path = os.path.join(OUT, seg_id + ".mp3")
    words = []
    with open(mp3_path, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append({
                    "text": chunk["text"],
                    "start": round(chunk["offset"] / 1e7, 3),
                    "end": round((chunk["offset"] + chunk["duration"]) / 1e7, 3),
                })
    duration = round(words[-1]["end"] + 0.25, 3) if words else 0.0
    return duration, words


async def main():
    manifest = []
    for seg_id, voice, text in SEGMENTS:
        duration, words = await synth(seg_id, voice, text)
        manifest.append({
            "id": seg_id,
            "file": "assets/audio/" + seg_id + ".mp3",
            "duration": duration,
            "text": text,
            "words": words,
        })
        print(f"  {seg_id}  {duration:6.2f}s  {text[:48]}…")
    with open(os.path.join(OUT, "voiceover.json"), "w", encoding="utf-8") as f:
        json.dump({"segments": manifest}, f, ensure_ascii=False, indent=1)
    print(f"\n-> {len(manifest)} segments + voiceover.json")


asyncio.run(main())

# What Are We Watching — product

**What it is:** a personal movie chooser. One press picks a random film from a
hand-curated library of 1,138 titles (1970s–2020s: classics, cult, documentary,
fringe, space), optionally narrowed by genre and decade, or finds an actor's
first film in the list. Each pick shows the poster, year, director, a one-line
take, genres, cast, and a JustWatch "where to watch" link.

**Who uses it:** the owner and whoever is on the couch with him, on a phone or a
desktop, deciding what to put on tonight.

**Surface mode:** Operate — the task is "pick something, fast". The look may be
theatrical, but the pick, the filters and the facts must stay one glance away.

**Brand commitments (owner, 2026-09-27):**
- A 90s video-rental-store night: the chooser is a tube TV on the counter; the
  name WHAT ARE WE WATCHING lives inside the TV.
- The TV is modelled on the owner's reference: a silver 70s portable, screen
  left, VHF/UHF dials, grid strip and pull-on volume top right, woodgrain speaker.
- Between picks: about half a second of snow with a green CH 03 and a static
  "shh", sometimes torn colour bars instead — then the next film, instantly.
- Pre-Frutiger-Aero or earlier: chunky plastic keys, VFD glow, stickers. No
  glass, no glossy bubbles.
- Built with Blender (the set, the store) and three.js (the live scene).
- Evoke the era, never a real store's name or marks.

**Data rules:**
- The film library is data: a restyle never changes a byte of it
  (`tests/check.mjs` hashes it).
- Streaming availability is shown only for entries a live check verified; the
  STREAMING table stays empty until then. Nothing from memory.

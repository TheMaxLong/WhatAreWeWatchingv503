---
name: What Are We Watching
description: A random-film chooser staged as a tube TV on a 90s video-rental counter at night.
colors:
  night: "#07080d"
  rental-blue: "#1537b8"
  rental-blue-deep: "#0b1d6b"
  counter-blue: "#0f2f8f"
  counter-blue-mid: "#0d2982"
  counter-blue-ground: "#0b2372"
  board-ink: "#eef2ff"
  sticker-yellow: "#ffd21f"
  sticker-yellow-hi: "#ffe36a"
  sticker-yellow-lo: "#e6ad00"
  rewind-red-hi: "#ff4a52"
  rewind-red: "#d8232f"
  rewind-red-lo: "#a4121c"
  vfd-cyan: "#5ff5d9"
  vcr-blue: "#1631c9"
  osd-white: "#f4f6ff"
  osd-yellow: "#ffe14d"
  ch-green: "#6dff7a"
  neon-pink: "#ff2a8a"
  neon-cyan: "#2ad4ff"
  clamshell: "#0d0e12"
  sleeve-line: "#2a2c36"
  key-plastic: "#2c2d31"
  key-plastic-top: "#34363d"
  aluminium-hi: "#e2e4e7"
  aluminium: "#a9adb3"
  aluminium-lo: "#6d7178"
  bezel-silver: "#aeb1b5"
  cream: "#f3ecd6"
  label-edge: "#c9bf9f"
  insert-ground: "#1b1d27"
  poster-ground: "#1a1b22"
  sticker-white: "#ffffff"
  paper: "#f6f0de"
  paper-2: "#d9d3c3"
  paper-3: "#b9b3a5"
  ink: "#121216"
typography:
  scale:
    micro: "10.5px"
    tag: "11px"
    tagline: "12px"
    board-compact: "12.5px"
    label: "13px"
    label-lg: "14px"
    body: "16px"
    body-wide: "17px"
    osd-phone: "19px"
    display-phone: "20px"
    osd: "21px"
    display: "22px"
    display-wide: "25px"
    headline-desktop-min: "30px"
    headline-min: "32px"
    headline-phone: "34px"
    headline-desktop-max: "46px"
    headline-max: "50px"
  display:
    fontFamily: "Archivo, Arial Narrow, Helvetica Neue, sans-serif"
    fontSize: "22px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0.02em"
    fontVariation: "'wdth' 115"
  headline:
    fontFamily: "Archivo, Arial Narrow, Helvetica Neue, sans-serif"
    fontSize: "clamp(32px, 2.9vw, 50px)"
    fontWeight: 900
    lineHeight: 0.94
    letterSpacing: "-0.005em"
    fontVariation: "'wdth' 68"
  title:
    fontFamily: "Archivo, Arial Narrow, Helvetica Neue, sans-serif"
    fontSize: "13px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.14em"
    fontVariation: "'wdth' 75"
  body:
    fontFamily: "Archivo, Arial Narrow, Helvetica Neue, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
    fontVariation: "'wdth' 92"
  print-label:
    fontFamily: "Archivo, Arial Narrow, Helvetica Neue, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.06em"
    fontVariation: "'wdth' 75"
  label:
    fontFamily: "Archivo, Arial Narrow, Helvetica Neue, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 80"
  osd:
    fontFamily: "VT323, Courier New, ui-monospace, monospace"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "normal"
rounded:
  hairline: "2px"
  print: "3px"
  board: "4px"
  field: "8px"
  key: "10px"
  case: "12px"
  main-key: "14px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "18px"
  xl: "30px"
components:
  button-primary:
    backgroundColor: "{colors.sticker-yellow}"
    textColor: "{colors.rental-blue-deep}"
    typography: "{typography.display}"
    rounded: "{rounded.main-key}"
    padding: "0 26px"
    height: "64px"
  key:
    backgroundColor: "{colors.key-plastic-top}"
    textColor: "{colors.paper}"
    rounded: "{rounded.key}"
    padding: "0 14px"
    height: "44px"
  key-hover:
    textColor: "{colors.sticker-yellow}"
  chip:
    backgroundColor: "{colors.rental-blue}"
    textColor: "{colors.board-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.print}"
    padding: "6px 10px"
    height: "32px"
  chip-active:
    backgroundColor: "{colors.sticker-yellow}"
    textColor: "{colors.rental-blue-deep}"
  board-key:
    backgroundColor: "{colors.rental-blue}"
    textColor: "{colors.board-ink}"
    rounded: "{rounded.print}"
    padding: "0 14px"
    height: "44px"
  board-key-active:
    backgroundColor: "{colors.sticker-yellow}"
    textColor: "{colors.rental-blue-deep}"
  vfd:
    backgroundColor: "{colors.night}"
    textColor: "{colors.vfd-cyan}"
    typography: "{typography.osd}"
    rounded: "{rounded.key}"
    padding: "6px 14px"
  input-field:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.ink}"
    rounded: "{rounded.print}"
    padding: "10px 12px"
    height: "44px"
  sign-board:
    backgroundColor: "{colors.counter-blue-mid}"
    textColor: "{colors.board-ink}"
    rounded: "{rounded.board}"
    padding: "18px 18px 20px"
  sleeve-case:
    backgroundColor: "{colors.clamshell}"
    textColor: "{colors.paper}"
    rounded: "{rounded.case}"
    padding: "18px 18px 18px 30px"
  button-watch:
    backgroundColor: "{colors.sticker-yellow}"
    textColor: "{colors.rental-blue-deep}"
    rounded: "{rounded.field}"
    padding: "0 16px"
    height: "44px"
  tag:
    backgroundColor: "transparent"
    textColor: "{colors.paper}"
    rounded: "{rounded.print}"
    padding: "3px 8px 2px"
  rewind-sticker:
    backgroundColor: "{colors.rewind-red}"
    textColor: "{colors.sticker-white}"
    size: "66px"
---

# Design System: What Are We Watching

## Overview

**Creative North Star: "The Counter at Closing Time"**

The page is a place, not a panel. A Blender-built silver 70s portable TV sits on a 90s VCR on a rental-store counter, lit in three.js in front of an out-of-focus Cycles plate of the store: face-out tapes on white shelving, blue section headers, a pink VIDEO and cyan OPEN LATE neon. The tube is the product's voice. The name WHAT ARE WE WATCHING lives on its VCR-blue idle screen, a pick is a channel change (half a second of snow or torn colour bars, one detent of the VHF dial, a static "shh"), and the film then plays on the tube like a tape.

Everything the hand touches sits in front of that scene and is made of the counter's own stuff: a sign board printed flat in counter blue with yellow plaques and flat blue buttons, a play bar of chunky moulded plastic keys with a VFD count window glowing cyan, and the back of a rental case (pebbled black clamshell over a printed insert under clear vinyl) that carries the film's words. Two worlds are composed and never blended: the lit 3D world behind, and the retail world of print and plastic in front. The owner rejected an earlier moulded, candy-coloured filter board as too "kid" (2026-09-27); the board is now printed flat like the sleeve, and moulded plastic is kept for the few keys that are actual hardware. The period line is pre-Frutiger-Aero: plastic, print and phosphor, never frosted glass or glossy bubbles.

Density is operational. The pick, the filters and the facts stay one glance away; the theatre happens on the tube, not by hiding controls.

**Key Characteristics:**
- A lit 3D set (TV, VCR, counter, returned tapes) in front of a baked, bokeh'd store plate; one camera frames every layout.
- Rental blue and sticker yellow carry the whole UI; VFD cyan and neon pink/cyan are light sources, not fills.
- Archivo in two voices (wide black on the two yellow keys only, condensed caps everywhere else); VT323 only on the tube and the VCR.
- Two surface grammars: play-bar and sleeve keys are moulded plastic that travels when pressed; the sign board is flat print with hairlines, blue buttons that turn yellow when chosen.
- Every raster is procedural Blender output that carries its own provenance.

## Colors

Store-at-night: a deep near-black room lit by rental blue signage, sticker yellow, phosphor cyan and neon, with warm paper for the printed words.

### Primary
- **Rental Blue** (rental-blue): the store's brand paint. The flat fill of every sign-board button (genres, decades, FIRST FILM, clear), the Blender section headers, the insert's spine strip. Its deep step is the ink on every yellow surface.
- **Counter Blue ramp** (counter-blue, counter-blue-mid, counter-blue-ground): the counter's painted front. counter-blue is the modelled front in Blender; counter-blue-mid is the sign board's flat ground; the stacked layout paints the page as the counter front, #102f93 at the top through counter-blue-mid to counter-blue-ground, which is also the page colour behind it.
- **Board Ink** (board-ink): the cool white lettering of the sign board and its buttons.
- **Sticker Yellow** (sticker-yellow, with hi and lo steps): the one action colour. The SURPRISE ME key, WHERE TO WATCH, the chosen state of a board button (flat fill and border), the plaques and their rules, the billing lead, the focus ring, text selection, the shelf tags in the plate.

### Secondary
- **Rewind Red** (rewind-red-hi, rewind-red, rewind-red-lo): the BE KIND PLEASE REWIND seal, a domed radial from the hi step through the base to the lo step, lettered in Sticker White. The base is also the rental stripe on tape labels. Never a UI fill beyond those.
- **Sticker White** (sticker-white): the rewind seal's lettering and, as the highlight overlay scale (see Elevation & Depth), the board's hairlines and every lit edge of the moulded plastic.

### Tertiary (emissive only)
- **VFD Cyan** (vfd-cyan): the VCR count window, in the page and on the modelled VCR. The only UI glow.
- **VCR Blue** (vcr-blue): the tube's idle screen. Deliberately distinct from Rental Blue: one is paint in a store, the other is a video signal.
- **OSD White / OSD Yellow / CH Green**: the on-screen display's character generator (title text, notes, CH 03).
- **Neon Pink / Neon Cyan**: the store's neon tubes and the three.js point lights that spill them onto the silver cabinet.

### Neutral
- **Night** (night): the room, the theme colour, the stage behind the canvas, the VFD glass.
- **Clamshell** (clamshell) and **Sleeve Line** (sleeve-line): the rental case and the rules printed on its insert.
- **Key Plastic** (key-plastic-top, key-plastic): the moulded sound key in the play bar, a vertical gradient from the top step down to #212328; key-plastic is also the modelled VCR buttons.
- **Aluminium** (aluminium-hi, aluminium, aluminium-lo, bezel-silver): the counter's T-moulding edge strip under the stacked TV (a three-step brushed gradient) and the brushed bezel material three.js lays on the set.
- **Shade** (no palette token, on purpose): black exists only as the shade overlay scale (see Elevation & Depth): lips, drops, recesses and the sleeve's hinge groove. It is never opaque; the darkest ground is Night. Keeping black out of the palette keeps the design check able to catch an opaque black; the one overlay the check cannot see as a shadow (the hinge groove's .7 gradient) is a recorded exception in .impeccable/config.json.
- **Insert Ground** (insert-ground) and **Poster Ground** (poster-ground): what shows before the insert raster or a poster loads.
- **Paper / Paper 2 / Paper 3**: printed insert text in three weights of emphasis (title, description, cast).
- **Cream** (cream) with **Ink** (ink) and **Label Edge** (label-edge): the one writable field, a paper label you write on, with a darker cut edge.

### Named Rules
**The Light Source Rule.** Only things that emit light glow: the tube, the VFD, the neon. Glow (text-shadow, bloom) never lands on a panel, key or type that is paint or print.

**The Yellow Means Press Rule.** Among the controls, a Sticker Yellow surface means "this is the thing to press" or "this is chosen". Elsewhere yellow is signage and print: plaques and their rules, pinstripes, labels, the year and billing lines; never body copy.

**The Two Blues Rule.** Rental Blue is the store; VCR Blue is the tube. Do not swap them.

## Typography

**Display Font:** Archivo variable (wdth 62-125, wght 400-900, italic), with Arial Narrow / Helvetica Neue fallback
**Body Font:** Archivo (same family, condensed widths)
**Label/Mono Font:** VT323, with Courier New fallback, tube and VCR only

**Character:** one grotesque stretched into two voices. Wide black Archivo (italic on SURPRISE ME) is 90s retail sign lettering, kept to the two yellow keys; condensed caps Archivo is print: the sign board, the sleeve, every other label. VT323 is a character generator and a vacuum-fluorescent display, and appears nowhere else.

### Hierarchy
The frontmatter `typography.scale` enumerates every size the build sets; each role below names which steps it takes at which breakpoint (stacked is the default, desktop is ≥1080px at 5:4, wide is ≥1600px at 5:4, phone is ≤620px).

- **Display** (900 italic, wdth 115, 22px; 25px at wide, 20px on phones; uppercase): the SURPRISE ME key only. WHERE TO WATCH carries the same wide black voice upright (900, wdth 105, 14px, 0.06em).
- **Headline** (900, wdth 68, lh 0.94, uppercase, balanced wrap): the film title on the sleeve. clamp(32px, 2.9vw, 50px) stacked; clamp(30px, 2.5vw, 46px) on desktop where the sleeve column is narrower; a fixed 34px on phones.
- **Title** (800, wdth 75, 13px, 0.14em, uppercase, yellow): sign-board plaques (Genres, Decade, First film), each trailed by a 1px yellow rule at .4.
- **Body** (400, wdth 92, 16px, 17px at wide, lh 1.6, max 62ch, paper-2): the film's one-line take. The actor field is 16px at 600.
- **Print label** (700, wdth 75, 16px, 0.06em, uppercase, yellow): year and director; cast in the same voice at 600 / wdth 70 / 14px in paper-3.
- **Sign tagline** (800, wdth 80, 12px, 0.12em, yellow): the board's inventory line.
- **Label** (700, condensed caps, 13px): board buttons at wdth 80 / 0.08em, with decades keeping their printed lowercase "s" (1970s); the play bar's key label at wdth 90 / 0.06em. Board buttons step to 12.5px on desktop (so 42 genres fit one screen), back to 13px at wide, and 14px on phones along with the GENRES toggle. Tags and streaming chips are 11px at 800 / 0.08-0.1em. The rewind seal is the smallest step, 10.5px at 900 / wdth 75.
- **OSD** (VT323, 21px, 19px on phones, lh 1.05, uppercase, cyan with phosphor bloom): the VFD count line. On the tube VT323 runs 38-168px with a hard dark outline.

### Named Rules
**The Tube Font Rule.** VT323 lives only on the tube (the OSD and idle screen canvases) and the VCR window. Anything printed or signed is Archivo.

**The Two Voices Rule.** Wide black is for the two yellow keys you press from across the room; condensed caps is print, read up close, and that includes the whole sign board. Reading text (the take, the actor field) is plain sentence-case Archivo. Do not invent a third display voice.

## Layout

One fixed stage (the WebGL canvas, or the flat fallback) fills the viewport behind a `.counter` layer holding every control. An invisible TV slot in the counter's layout tells the three.js camera where the set must land. Each layout sets its own fill (`--fit`), so the TV is framed by store and never cropped, and its own `--neon-gap`: the store plate is raised or lowered per layout until the top of the neon sits that many pixels under the canvas top, so no blurred strip of wall shows above it (owner, 2026-09-27).

- **Desktop** (min-width 1080px and min-aspect-ratio 5/4): --fit 0.972, --neon-gap 30px. A fixed, non-scrolling three-column grid: sign board left (clamp 300-400px), TV slot centre with the play bar under it, sleeve right (clamp 330-460px). Gaps 22px / 30px, padding 28px 32px 30px. The board compacts its buttons (29px, 5px apart) so 42 genres fit one screen at 900px tall; board and sleeve scroll internally with thin scrollbars.
- **Wide desktop** (min-width 1600px, same aspect): --fit 0.864; play bar 640px, main key 72px, padding 40px 48px.
- **Stacked** (everything else, including tablets and tall screens): --fit 0.9, --neon-gap 18px. The stage is pinned across the top at --tvh (clamp(280px, min(96vw, 50svh), 580px)) above a 9px aluminium T-moulding; the page below is the counter's blue front (a Counter Blue gradient). Controls stack in one column, max 720px, 16px gap, safe-area padding.
- **Phone** (max-width 620px): the play bar wraps with the VFD on its own full-width row; genres collapse behind a GENRES toggle into a scrollable well; board buttons grow to 44px touch height; the sleeve tightens.

Spacing rhythm is small and physical: 6px between board buttons, 10px between play-bar keys, 16-18px inside panels and between groups.

## Elevation & Depth

Depth is literal: a real lit 3D set in front of a baked, defocused plate, with bloom on emissive surfaces only (strength 0.28, threshold 0.93). In front of it the DOM layer has two grammars. The play bar and the sleeve's key are moulded plastic hardware: a gradient body with an inset top highlight, an inset bottom lip and a soft drop toward the counter; pressing removes the lip and shortens the drop. The sign board is print: one flat fill, a 1px white hairline, a single soft drop where it rests on the counter, and flat buttons with no lip, no drop and no travel.

Every highlight, hairline and shade comes from one overlay scale, never a new colour:
- **Highlight overlay** (Sticker White at .06, .07, .1, .12, .14, .2, .5, .6, .65, .75): .06 the VFD's lower lip light; .07 the vinyl sheen band; .1 the poster's edge; .12 the board's hairline, the case's top edge and the hinge groove; .14 the sound key's top edge; .2 the board buttons' hairline, the phone genres well and the sleeve scrollbar; .5-.65 the top edge of the yellow keys; .75 the rewind seal's die-cut edge.
- **Shade overlay** (black at .35, .4, .55, .6, .65, .7, .8, .85, .9): .35 the bottom lips; .4-.6 short contact shadows and the stacked TV's edge shadow; .65-.7 the case's inner edge and the hinge groove; .8-.9 the long drops of the board, the case and the keys onto the counter, and the VFD recess.

### Shadow Vocabulary
- **Main key** (`inset 0 2px 0 rgba(255,255,255,.65), inset 0 -5px 0 rgba(140,90,0,.35), 0 10px 22px -8px rgba(0,0,0,.85), 0 2px 4px rgba(0,0,0,.4)`): the big yellow key.
- **Key** (`inset 0 1px 0 rgba(255,255,255,.14), inset 0 -3px 0 rgba(0,0,0,.35), 0 6px 14px -6px rgba(0,0,0,.8)`): the sound key.
- **Watch key** (`inset 0 1px 0 rgba(255,255,255,.6), inset 0 -3px 0 rgba(140,90,0,.3), 0 8px 16px -8px rgba(0,0,0,.8)`): the sleeve's yellow key.
- **Panel** (`0 24px 48px -18px` to `0 30px 60px -22px`, black .85-.9): sign board and sleeve resting on the counter. The board has only this.
- **Recess** (`inset 0 2px 8px rgba(0,0,0,.9)`): the VFD window.

### Named Rules
**The Moulded Plastic Rule.** Moulded plastic is for hardware keys only: the play bar (SURPRISE ME, sound) and the sleeve's WHERE TO WATCH. Each has a crisp inset top highlight, a crisp inset bottom lip and a soft blurred drop, and travels 2-3px down on press. Outer drop shadows are always blurred.

**The Flat Board Rule.** The sign board is printed flat like the sleeve (owner, 2026-09-27: the bubbly keys and fluorescent stickers read too "kid"). One flat Counter Blue ground, 1px hairlines, flat Rental Blue buttons that turn flat Sticker Yellow when chosen. No gradients, bevels, lips, press travel or candy colours on the board.

**The No Glass Rule.** No backdrop blur, no frosted or translucent panels. The only transparency is the clear vinyl sheen over the sleeve insert, a single faint diagonal band.

## Shapes

Radii follow the object. Print is nearly square: 3px for board buttons, the actor field, tags and the poster; 4px for the sign board and the insert; 2px for the hinge groove. Moulded keys are softened plastic (8-14px, scaling with key size; the phone genres well is 10px), the case is 12px, and the rewind seal is a circle, slapped on at 9deg. The sleeve is asymmetric on purpose: a wider hinge side (30px) with an embossed hinge line, and the insert clears a printed 7.5% spine strip.

## Components

### Buttons
- **Main key (SURPRISE ME):** a big yellow moulded key (radius 14px, min-height 64px), yellow hi-to-lo vertical gradient, Rental Blue Deep ink, display voice, SVG play triangle. Hover: brightness 1.06. Active: 3px down with a shortened lip.
- **Sound key:** dark moulded plastic (key-plastic-top to #212328, radius 10px, 44px), icon-only SVG with aria-pressed, dimming to paper-3 when off. Hover turns it yellow; active travels 2px.
- **Where to watch:** a smaller yellow moulded key (radius 8px, 44px) with an SVG arrow, living on the sleeve.
- **Board button (FIRST FILM, clear):** the board's flat button (Rental Blue, 1px white .2 hairline, radius 3px, 44px, Board Ink). Hover turns the label yellow; press turns it flat yellow with no travel.

### Chips
- **Board button (genre and decade):** one flat button for both. Rental Blue fill, 1px white .2 hairline, radius 3px, 32px, Board Ink condensed caps (label voice). Hover: yellow border. Chosen: flat Sticker Yellow fill and border, Rental Blue Deep ink. No lip, no drop, no press travel; colour changes in 120ms. Decades are written as printed ("1970s").

### Cards / Containers
- **Sign board:** flat Counter Blue Mid, radius 4px, 1px white .12 hairline, the panel drop only. Yellow condensed plaques with 1px trailing rules, a solid 1px yellow rule at .4 above the store inventory tagline.
- **Sleeve (rental case back):** the Blender clamshell raster under a radius 12px case, the Blender insert raster as the printed body (radius 4px) with a clear vinyl sheen overlay. Poster (2:3, radius 3px), title, yellow year/director line, take, outline tags, cast with yellow billing lead, streaming chips, where-to-watch key.

### Inputs / Fields
- **Actor field:** a flat cream paper label (radius 3px, 44px, 1px label-edge border, no inner shadow), ink text 600 16px, Rental Blue caret. Focus: the global 3px yellow ring.

### Navigation
None. The page is one counter; the sign board is the only filter surface.

### VFD count window
A recessed black window (radius 10px, #050807 to #0b1210) with VT323 uppercase in VFD Cyan and a two-layer phosphor glow, aria-live. The same readout is painted on the modelled VCR.

### The Tube
The TV screen is a CRT shader over two canvases (content and OSD): pillow raster, RGB fringing, scanlines and aperture grille that fade before aliasing, a slow hum bar, VHS head-switching wobble while a tape plays, snow with CH 03, torn colour bars, a tracking tear when a poster lands after the cut, and a warm-up on first light. Idle is WHAT ARE WE WATCHING on VCR Blue with a STOP/12:00 OSD. Icons on the tube are drawn as paths, never glyphs.

### Motion
- **Channel change:** 500ms of static (160ms under reduced motion), capped at 1000ms if a poster is slow; 30% of changes show torn bars instead of snow. One VHF detent (30deg) with slight overshoot, a clunk and a shh.
- **Sleeve settle:** on each pick the insert fades out and reappears (opacity 340ms, 8px lift over 460ms on cubic-bezier(0.16, 1, 0.3, 1), 2px blur), force-revealed by 1400ms.
- **Keys:** 90ms press travel on moulded keys; 120-150ms colour changes; board buttons change colour only.
- **Stage:** 900ms fade-in once the set is ready; a slow idle camera sway.
- **Reduced motion:** no transitions, no camera sway, no drift or hum, no tracking tear, no blur on the sleeve, the dial jumps to its detent, the tube renders only when something changes, the OSD stops blinking. The channel change still reads as a short static frame.

### Fallback path
Without WebGL (or from file://) the page shows one Cycles frame of the whole scene (`assets/fallback.jpg`), positioned so its TV lands in the same slot, with the live 2D screen laid over its tube per `assets/fallback.json`. A slow device drops bloom and pixel ratio before it stutters.

### Asset pipeline
The set (`blender/tv.py`), the store plate and fallback frame (`blender/store.py`), and the clamshell and insert (`blender/sleeve.py`) are procedural Blender 5.1 Cycles renders, never photographs or image-model output. They ship as files in `assets/` beside `index.html`, cache-busted by a content hash the build stamps; printed parts of the set (dials, grid strip, woodgrain, labels, VFD) are painted at runtime by material name. Every shipping raster embeds a provenance comment naming its script, renderer, size and re-render command. Colour constants shared with Blender are written in sRGB hex in both places.

## Do's and Don'ts

### Do:
- **Do** keep the TV the first thing seen: centre on desktop, pinned across the top when stacked, with the yellow key directly under it.
- **Do** make play-bar and sleeve keys moulded plastic (top highlight, bottom lip, soft drop, 2-3px travel), and keep the sign board flat: Rental Blue buttons with a white hairline, flat Sticker Yellow when chosen.
- **Do** keep VT323 on the tube and the VCR only; wide black Archivo on the two yellow keys only, condensed caps for everything else.
- **Do** put glow only on things that emit light: the tube, the VFD, the neon.
- **Do** draw icons as SVG paths in the page and as canvas paths on the tube.
- **Do** build new rasters in Blender, ship them beside index.html under the content hash, and embed their provenance.
- **Do** evoke the era only: no real store's name, logo or marks.

### Don't:
- **Don't** use frosted glass, backdrop blur, glossy bubbles or any Frutiger-Aero finish.
- **Don't** put a dark app card on a flat page; controls sit in the store world, on the counter.
- **Don't** use hard, unblurred outer drop shadows; depth comes from the lit set and the moulded keys' inset lip and soft drop.
- **Don't** set UI, signage or printed text in VT323.
- **Don't** give a non-pressable control or panel a Sticker Yellow surface.
- **Don't** bevel, mould or candy-colour the sign board: no gradients, lips, press travel or fluorescent fills on the board or its buttons.
- **Don't** use text glyphs or emoji as icons.

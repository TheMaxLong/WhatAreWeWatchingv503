// What the tube shows, painted on 2D canvases the CRT shader then scans out.
//
//   content  1024×768  the picture: the VCR-blue idle screen, a film's "recording",
//                      NO TAPE FOUND, an empty shelf
//   osd      1024×768  transparent: CH 03, PLAY, the tape counter, filter messages
//   vfd      512×128   the VCR's display window
//
// Icons (play, stop) are drawn as paths, never as text glyphs.
export const FONT_DISPLAY = '"Archivo", "Arial Narrow", "Helvetica Neue", sans-serif';
export const FONT_OSD = '"VT323", "Courier New", ui-monospace, monospace';

const W = 1024, H = 768;
const VCR_BLUE = "#1631c9";
const OSD_WHITE = "#f4f6ff";
const CH_GREEN = "#6dff7a";

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

function playIcon(ctx, x, y, s) {
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s * 0.86, y + s / 2); ctx.lineTo(x, y + s); ctx.closePath(); ctx.fill();
}
function stopIcon(ctx, x, y, s) { ctx.fillRect(x, y, s, s); }

// OSD text: bitmap-ish font, hard dark outline like a real character generator
function osdText(ctx, text, x, y, size, color, align = "left") {
  ctx.font = `${size}px ${FONT_OSD}`;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(4, size * 0.11);
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function fitLines(ctx, text, maxW, maxLines, sizes, fontFor) {
  for (const size of sizes) {
    ctx.font = fontFor(size);
    const words = text.split(/\s+/);
    const lines = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? cur + " " + w : w;
      if (ctx.measureText(next).width <= maxW) cur = next;
      else { if (cur) lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    const widest = Math.max(...lines.map(l => ctx.measureText(l).width));
    if (lines.length <= maxLines && widest <= maxW) return { size, lines };
  }
  const size = sizes[sizes.length - 1];
  ctx.font = fontFor(size);
  return { size, lines: [text] };
}

export function createScreen(filmCount) {
  const content = makeCanvas(W, H);
  const osd = makeCanvas(W, H);
  const vfd = makeCanvas(512, 128);
  const cx = content.getContext("2d");
  const ox = osd.getContext("2d");
  const vx = vfd.getContext("2d");

  const s = {
    mode: "idle",           // idle | film | nosignal | empty
    film: null, note: null, query: "",
    poster: null,           // HTMLImageElement once loaded
    playingSince: 0,        // performance.now() at the cut
    tuning: false,          // between channels: CH 03 up
    message: "", messageUntil: 0,
    count: filmCount,
  };

  // ── content ──────────────────────────────────────────────────────────────
  function blueScreen() {
    cx.fillStyle = VCR_BLUE;
    cx.fillRect(0, 0, W, H);
    // a real blue screen is never flat: a faint vertical falloff from the gun
    const g = cx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(255,255,255,0.05)");
    g.addColorStop(1, "rgba(0,0,40,0.18)");
    cx.fillStyle = g;
    cx.fillRect(0, 0, W, H);
  }

  function paintIdle() {
    blueScreen();
    cx.save();
    cx.textAlign = "center";
    cx.textBaseline = "alphabetic";
    // the name, set like the character generator would: big, blocky, outlined
    const lines = ["WHAT ARE WE", "WATCHING"];
    lines.forEach((l, i) => {
      cx.font = `168px ${FONT_OSD}`;
      cx.lineWidth = 12; cx.lineJoin = "round";
      cx.strokeStyle = "rgba(0,0,30,0.55)";
      cx.strokeText(l, W / 2 + 6, 330 + i * 150 + 6);
      cx.fillStyle = OSD_WHITE;
      cx.fillText(l, W / 2, 330 + i * 150);
    });
    cx.font = `50px ${FONT_OSD}`;
    cx.fillStyle = "#ffe14d";
    cx.fillText(`${s.count.toLocaleString("en-US")} TAPES ON THE SHELF`, W / 2, 610);
    cx.restore();
  }

  function paintFilm() {
    const f = s.film;
    cx.fillStyle = "#06070b";
    cx.fillRect(0, 0, W, H);
    const rg = cx.createRadialGradient(W * 0.55, H * 0.45, 40, W * 0.55, H * 0.45, W * 0.7);
    rg.addColorStop(0, "rgba(40,48,90,0.55)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    cx.fillStyle = rg;
    cx.fillRect(0, 0, W, H);

    // the cover, left
    const px = 92, py = 118, ph = 540, pw = Math.round(ph * 2 / 3);
    cx.save();
    cx.shadowColor = "rgba(0,0,0,0.8)"; cx.shadowBlur = 30; cx.shadowOffsetY = 10;
    if (s.poster) {
      cx.drawImage(s.poster, px, py, pw, ph);
    } else {
      // no cover art: a plain rental case with a printed spine label
      cx.fillStyle = "#101216"; cx.fillRect(px, py, pw, ph);
      cx.shadowColor = "transparent";
      cx.fillStyle = "#f1ead6"; cx.fillRect(px + 40, py + ph / 2 - 80, pw - 80, 160);
      cx.fillStyle = "#1a1a1a";
      const t = fitLines(cx, f.t.toUpperCase(), pw - 110, 3, [44, 38, 32, 26, 22], sz => `800 ${sz}px ${FONT_DISPLAY}`);
      cx.textAlign = "center"; cx.textBaseline = "middle";
      t.lines.forEach((l, i) => cx.fillText(l, px + pw / 2, py + ph / 2 + (i - (t.lines.length - 1) / 2) * t.size * 1.05));
    }
    cx.restore();
    cx.strokeStyle = "rgba(255,255,255,0.18)"; cx.lineWidth = 2;
    cx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);

    // the words, right
    const tx = px + pw + 56, maxW = W - tx - 84;
    cx.textAlign = "left"; cx.textBaseline = "alphabetic";
    if ("fontStretch" in cx) cx.fontStretch = "condensed";
    const t = fitLines(cx, f.t.toUpperCase(), maxW, 4, [104, 92, 80, 70, 62, 54, 48],
      sz => `900 ${sz}px ${FONT_DISPLAY}`);
    let y = 196;
    cx.fillStyle = "#fbf7ea";
    cx.shadowColor = "rgba(0,0,0,0.6)"; cx.shadowBlur = 8;
    t.lines.forEach(l => { cx.fillText(l, tx, y + t.size * 0.78); y += t.size * 0.98; });
    cx.shadowColor = "transparent";
    if ("fontStretch" in cx) cx.fontStretch = "normal";
    y += 26;
    cx.font = `46px ${FONT_OSD}`;
    cx.fillStyle = "#ffd21f";
    cx.fillText(f.d ? `${f.y}  ·  ${f.d.toUpperCase()}` : String(f.y), tx, y + 34, maxW);
    y += 62;
    cx.font = `38px ${FONT_OSD}`;
    cx.fillStyle = "#9db4ff";
    cx.fillText(f.g.join(" / ").toUpperCase(), tx, y + 30, maxW);
    y += 56;
    if (f.cast && f.cast.length) {
      cx.font = `600 30px ${FONT_DISPLAY}`;
      cx.fillStyle = "rgba(240,236,224,0.82)";
      const names = f.cast.slice(0, 3).join(", ");
      const c = fitLines(cx, "WITH " + names.toUpperCase(), maxW, 2, [30, 26, 22], sz => `600 ${sz}px ${FONT_DISPLAY}`);
      c.lines.forEach(l => { cx.fillText(l, tx, y + c.size); y += c.size * 1.25; });
    }
  }

  function paintNoSignal() {
    blueScreen();
    cx.textAlign = "center"; cx.textBaseline = "alphabetic";
    cx.font = `136px ${FONT_OSD}`;
    cx.fillStyle = OSD_WHITE;
    cx.fillText("NO TAPE FOUND", W / 2, 360);
    cx.font = `50px ${FONT_OSD}`;
    cx.fillStyle = "#ffe14d";
    const q = s.query.length > 28 ? s.query.slice(0, 27) + "…" : s.query;
    cx.fillText(`"${q.toUpperCase()}" IS NOT ON THE SHELF`, W / 2, 450);
  }

  function paintEmpty() {
    blueScreen();
    cx.textAlign = "center"; cx.textBaseline = "alphabetic";
    cx.font = `120px ${FONT_OSD}`;
    cx.fillStyle = OSD_WHITE;
    cx.fillText("EMPTY SHELF", W / 2, 350);
    cx.font = `50px ${FONT_OSD}`;
    cx.fillStyle = "#ffe14d";
    cx.fillText("NO TAPES MATCH — LOOSEN A FILTER", W / 2, 440);
  }

  function paintContent() {
    if (s.mode === "film" && s.film) paintFilm();
    else if (s.mode === "nosignal") paintNoSignal();
    else if (s.mode === "empty") paintEmpty();
    else paintIdle();
  }

  // ── osd: repainted every frame it is visible (blinking, the tape counter) ─
  function paintOsd(now, reduced) {
    ox.clearRect(0, 0, W, H);
    const blinkOn = reduced || Math.floor(now / 600) % 2 === 0;   // < 1 blink/s
    if (s.tuning) {
      osdText(ox, "CH 03", W - 86, 58, 104, CH_GREEN, "right");
    } else if (s.mode === "idle" || s.mode === "nosignal" || s.mode === "empty") {
      ox.fillStyle = OSD_WHITE;
      ox.strokeStyle = "rgba(0,0,0,0.85)"; ox.lineWidth = 5;
      ox.strokeRect(92, 72, 34, 34); stopIcon(ox, 92, 72, 34);
      osdText(ox, "STOP", 144, 62, 64, OSD_WHITE);
      if (blinkOn) osdText(ox, "12:00", W - 90, 62, 64, OSD_WHITE, "right");
    } else if (s.mode === "film") {
      const t = (now - s.playingSince) / 1000;
      if (t < 3.2) {
        ox.fillStyle = OSD_WHITE;
        ox.beginPath(); ox.moveTo(92, 72); ox.lineTo(92 + 34, 89); ox.lineTo(92, 106); ox.closePath();
        ox.strokeStyle = "rgba(0,0,0,0.85)"; ox.lineWidth = 6; ox.stroke(); ox.fill();
        osdText(ox, "PLAY", 144, 62, 64, OSD_WHITE);
      }
      const secs = Math.max(0, Math.floor(t));
      const hh = Math.floor(secs / 3600), mm = Math.floor(secs / 60) % 60, ss = secs % 60;
      osdText(ox, `SP  ${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`, W - 90, H - 118, 50, OSD_WHITE, "right");
      if (s.note && t < 6) osdText(ox, s.note.toUpperCase(), 92, H - 118, 40, "#ffe14d");
    }
    if (s.message && now < s.messageUntil && !s.tuning) {
      osdText(ox, s.message, W / 2, H - 196, 46, OSD_WHITE, "center");
    }
  }

  // ── the VCR window ────────────────────────────────────────────────────────
  function paintVfd(now) {
    vx.fillStyle = "#030605";
    vx.fillRect(0, 0, 512, 128);
    const glow = "#5ff5d9";
    vx.shadowColor = glow; vx.shadowBlur = 14;
    vx.fillStyle = glow;
    vx.textBaseline = "middle";
    vx.font = `70px ${FONT_OSD}`;
    vx.textAlign = "left";
    if (s.mode === "film" && !s.tuning) {
      playIcon(vx, 24, 44, 40);
      const secs = Math.max(0, Math.floor((now - s.playingSince) / 1000));
      vx.fillText(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`, 88, 66);
    } else {
      stopIcon(vx, 26, 46, 36);
      if (Math.floor(now / 600) % 2 === 0) vx.fillText("12:00", 88, 66);
    }
    vx.textAlign = "right";
    vx.font = `48px ${FONT_OSD}`;
    vx.fillText(s.tuning ? "CH03" : String(s.count).padStart(4, " "), 492, 66);
    vx.shadowBlur = 0;
  }

  return {
    content, osd, vfd, state: s,
    paintContent, paintOsd, paintVfd,
    size: { W, H },
  };
}

// ── printed parts of the set: dials, the grid strip, woodgrain, labels ─────
export function propCanvases(titles) {
  const out = {};

  function dial(numbers, small) {
    const c = makeCanvas(512, 512), x = c.getContext("2d");
    x.fillStyle = "#0e0e10"; x.fillRect(0, 0, 512, 512);
    x.translate(256, 256);
    x.fillStyle = "#e8e8e2";
    x.textAlign = "center"; x.textBaseline = "middle";
    x.font = `${small ? 30 : 44}px ${FONT_DISPLAY}`;
    numbers.forEach((n, i) => {
      const a = -Math.PI / 2 + (i / numbers.length) * Math.PI * 2;
      const r = small ? 198 : 190;
      x.fillText(String(n), Math.cos(a) * r, Math.sin(a) * r);
    });
    x.strokeStyle = "rgba(232,232,226,0.5)"; x.lineWidth = 3;
    for (let i = 0; i < numbers.length * 2; i++) {
      const a = -Math.PI / 2 + (i / (numbers.length * 2)) * Math.PI * 2;
      x.beginPath(); x.moveTo(Math.cos(a) * 226, Math.sin(a) * 226); x.lineTo(Math.cos(a) * 244, Math.sin(a) * 244); x.stroke();
    }
    return c;
  }
  out.M_DialVHF = dial([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], false);
  out.M_DialUHF = dial([14, 20, 26, 32, 38, 44, 50, 56, 62, 68, 74, 80], true);

  { // fine grid strip, as on the reference set
    const c = makeCanvas(128, 512), x = c.getContext("2d");
    x.fillStyle = "#ecebe4"; x.fillRect(0, 0, 128, 512);
    x.strokeStyle = "rgba(60,60,60,0.55)"; x.lineWidth = 2;
    for (let i = 0; i <= 512; i += 16) { x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); }
    for (let i = 0; i <= 128; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke(); }
    out.M_Grid = c;
  }
  { // walnut veneer: the slats map about 4% of this tall, so the grain is fine and dense
    const c = makeCanvas(1024, 1024), x = c.getContext("2d");
    x.fillStyle = "#5a371d"; x.fillRect(0, 0, 1024, 1024);
    // broad figure: lighter and darker flitches along the length
    for (let i = 0; i < 14; i++) {
      const g = x.createLinearGradient(0, 0, 1024, 0);
      const a = 0.08 + Math.random() * 0.12;
      g.addColorStop(0, `rgba(150,98,56,0)`); g.addColorStop(Math.random(), `rgba(150,98,56,${a})`); g.addColorStop(1, `rgba(150,98,56,0)`);
      x.fillStyle = g; x.fillRect(0, Math.random() * 1024, 1024, 20 + Math.random() * 80);
    }
    // grain lines every few pixels, gently wavy
    for (let y = 0; y < 1024; y += 2 + Math.random() * 3) {
      const dark = Math.random() < 0.55;
      x.strokeStyle = dark ? `rgba(30,14,4,${0.25 + Math.random() * 0.35})` : `rgba(176,122,74,${0.12 + Math.random() * 0.2})`;
      x.lineWidth = 0.6 + Math.random() * 1.4;
      const ph = Math.random() * 6, amp = 0.6 + Math.random() * 2;
      x.beginPath(); x.moveTo(0, y);
      for (let px = 0; px <= 1024; px += 16) x.lineTo(px, y + Math.sin(px * 0.009 + ph) * amp);
      x.stroke();
    }
    // pores
    for (let i = 0; i < 5000; i++) {
      x.fillStyle = `rgba(20,8,2,${0.2 + Math.random() * 0.3})`;
      x.fillRect(Math.random() * 1024, Math.random() * 1024, 1 + Math.random() * 3, 1);
    }
    out.M_Wood = c;
  }
  { // badge: brushed plate, generic words only
    const c = makeCanvas(512, 104), x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, 104);
    g.addColorStop(0, "#e2e3e4"); g.addColorStop(1, "#a9abad");
    x.fillStyle = g; x.fillRect(0, 0, 512, 104);
    x.fillStyle = "#111";
    x.font = `italic 800 44px ${FONT_DISPLAY}`;
    x.textBaseline = "middle"; x.textAlign = "center";
    x.fillText("SOLID STATE", 256, 54);
    out.M_Badge = c;
  }
  { // counter laminate: 90s fleck
    const c = makeCanvas(512, 512), x = c.getContext("2d");
    x.fillStyle = "#3a4865"; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) {
      const r = Math.random();
      x.fillStyle = r < 0.45 ? "rgba(210,215,230,0.35)" : r < 0.8 ? "rgba(10,12,22,0.45)" : "rgba(120,150,210,0.4)";
      x.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    out.M_Laminate = c;
  }
  // returned rental cases: the spines face the camera through a box projection,
  // so the art is bands, not words — any slice of it still reads as a VHS case
  const caseColors = ["#15309a", "#101014", "#8d1520"];
  for (let i = 0; i < 3; i++) {
    const c = makeCanvas(256, 256), x = c.getContext("2d");
    x.fillStyle = caseColors[i]; x.fillRect(0, 0, 256, 256);
    x.fillStyle = "rgba(255,255,255,0.07)"; x.fillRect(0, 0, 256, 128);
    x.fillStyle = "#f3ecd6"; x.fillRect(58, 0, 140, 256);            // the store's white label
    x.fillStyle = i === 2 ? "#ffd21f" : "#d8232f"; x.fillRect(58, 0, 12, 256);  // colour-coded rental stripe
    x.fillStyle = "rgba(20,20,20,0.55)";
    for (let k = 0; k < 256; k += 18) x.fillRect(84, k + 6, 90 - (k * 7) % 40, 4);   // scribbled title lines
    out["M_Sleeve" + i] = c;
  }
  { // the loose cassette's top: reel windows, tape pack, a hand-written rental label
    const c = makeCanvas(512, 272), x = c.getContext("2d");
    x.fillStyle = "#121214"; x.fillRect(0, 0, 512, 272);
    x.fillStyle = "rgba(255,255,255,0.05)"; x.fillRect(0, 0, 512, 6);
    const rr = (x0, y0, w, h, r) => { x.beginPath(); x.roundRect(x0, y0, w, h, r); };
    rr(78, 34, 356, 118, 16); x.fillStyle = "#26262a"; x.fill();         // smoked window
    for (const [cx, pack] of [[168, 50], [344, 30]]) {
      x.beginPath(); x.arc(cx, 93, pack, 0, Math.PI * 2); x.fillStyle = "#3a2618"; x.fill();   // tape pack
      x.beginPath(); x.arc(cx, 93, 17, 0, Math.PI * 2); x.fillStyle = "#e9e6de"; x.fill();     // hub
      x.fillStyle = "#26262a";
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; x.fillRect(cx + Math.cos(a) * 11 - 2, 93 + Math.sin(a) * 11 - 2, 4, 4); }
    }
    rr(36, 172, 440, 78, 6); x.fillStyle = "#f1ead6"; x.fill();          // label
    x.fillStyle = "#d8232f"; x.fillRect(36, 172, 440, 10);
    x.fillStyle = "#1c2a8f";
    x.font = `italic 700 34px ${FONT_DISPLAY}`;
    x.textAlign = "center"; x.textBaseline = "middle";
    const t = (titles[0] || "").toUpperCase();
    x.fillText(t.length > 24 ? t.slice(0, 23) + "\u2026" : t, 256, 218, 410);
    out.M_CassetteTop = c;
  }
  { // brushed-metal roughness streaks for the bezel
    const c = makeCanvas(256, 256), x = c.getContext("2d");
    x.fillStyle = "#6e6e6e"; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      const v = 90 + Math.random() * 90 | 0;
      x.fillStyle = `rgba(${v},${v},${v},0.35)`;
      x.fillRect(Math.random() * 256, Math.random() * 256, 30 + Math.random() * 120, 1);
    }
    out.brushed = c;
  }
  return out;
}

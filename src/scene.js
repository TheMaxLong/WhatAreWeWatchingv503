// The counter at night: the Blender set (TV, VCR, counter, returned tapes) lit
// in three.js in front of the Blender store plate, with the CRT playing.
// Exposes window.TV for the chooser: play(film, note) → Promise at the cut,
// noSignal(query), empty(), idle(), osd(text), count(n).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// The Blender set and plates ship as files beside index.html (assets/), not
// inlined: base64 in the page is heavy, never caches, and its random letters trip
// the repo's identity guard. build.mjs stamps a content hash so a new bake is never
// served stale. Opened from file:// they cannot load, and the flat TV takes over.
/* global __ASSET_V__ */
const ASSET_V = typeof __ASSET_V__ !== "undefined" ? __ASSET_V__ : "dev";
const asset = name => `assets/${name}?v=${ASSET_V}`;
const storeUrl = asset("store.jpg");
/* global __FALLBACK__ */
// where the TV and its tube sit in assets/fallback.jpg (pixels), from store.py --fallback
const FALLBACK = typeof __FALLBACK__ !== "undefined" ? __FALLBACK__ : null;
import { createScreen, propCanvases, FONT_OSD, FONT_DISPLAY } from "./screen.js";
import { createCrtMaterial } from "./crt.js";

// ── constants shared with blender/store.py and blender/tv.py ────────────────
// Blender (x, y, z) → three (x, z, -y)
const CAM = new THREE.Vector3(-0.075, 0.26, 1.45);   // store.py CAM
const PLATE_HALF_TAN = 18 / 20;                       // 36 mm sensor / 2 over a 20 mm lens
const PLATE_DIST = 4.8;                               // camera → back wall
const TV_FRONT_Z = 0.16;                              // cabinet front face
const TV_BOX = { x0: -0.32, x1: 0.32, y0: -0.095, y1: 0.49 };   // TV on VCR (+ the tapes on top), metres
const STATIC_MS = 500;                                // the owner's half second
const MAX_WAIT_MS = 1000;                             // snow never outlasts a slow poster by more

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");
const canvas = document.getElementById("stage");
const slot = document.getElementById("tvSlot");
const soundBtn = document.getElementById("soundBtn");

const screen = createScreen(typeof FILMS !== "undefined" ? FILMS.length : 0);
const S = screen.state;

// ── sound: the "shh" of snow and the clunk of the channel dial ─────────────
let actx = null;
let soundOn = true;
try { soundOn = localStorage.getItem("waww-sound") !== "off"; } catch (e) { /* storage blocked: default on */ }
function setSound(on) {
  soundOn = on;
  soundBtn.setAttribute("aria-pressed", String(on));
  soundBtn.querySelector(".label").textContent = on ? "SOUND ON" : "SOUND OFF";
  try { localStorage.setItem("waww-sound", on ? "on" : "off"); } catch (e) { /* not remembered, still works */ }
}
setSound(soundOn);
soundBtn.addEventListener("click", () => setSound(!soundOn));

function audio() {
  if (!soundOn) return null;
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
    return actx;
  } catch (e) { return null; }
}
function playSnow(ms) {
  const a = audio(); if (!a) return;
  const dur = ms / 1000 + 0.08;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource(); src.buffer = buf;
  const hp = a.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 500;
  const pk = a.createBiquadFilter(); pk.type = "peaking"; pk.frequency.value = 4200; pk.gain.value = 5; pk.Q.value = 0.7;
  const g = a.createGain();
  const t0 = a.currentTime;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.16, t0 + 0.012);
  g.gain.setValueAtTime(0.16, t0 + dur - 0.07);
  g.gain.linearRampToValueAtTime(0, t0 + dur);
  src.connect(hp).connect(pk).connect(g).connect(a.destination);
  src.start(t0); src.stop(t0 + dur + 0.02);
}
function playClunk() {
  const a = audio(); if (!a) return;
  const t0 = a.currentTime;
  const o = a.createOscillator(); o.type = "sine";
  o.frequency.setValueAtTime(140, t0); o.frequency.exponentialRampToValueAtTime(55, t0 + 0.06);
  const g = a.createGain();
  g.gain.setValueAtTime(0.22, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);
  o.connect(g).connect(a.destination);
  o.start(t0); o.stop(t0 + 0.1);
}

// ── fonts first: the canvases paint with them ──────────────────────────────
const fontsReady = (document.fonts && document.fonts.load)
  ? Promise.all([
      document.fonts.load(`64px ${FONT_OSD}`),
      document.fonts.load(`900 64px ${FONT_DISPLAY}`),
      document.fonts.load(`600 30px ${FONT_DISPLAY}`),
    ]).catch(() => null)
  : Promise.resolve();

// ── the TV API, shared by the WebGL and the flat fallback ───────────────────
let renderer3d = null;      // set when WebGL works
const fx = { noise: 0, bars: 0, glitch: 0, knobTarget: 0, knob: 0, wake: 0 };
let cutTimer = 0;
let playToken = 0;

function repaint() {
  screen.paintContent();
  if (renderer3d) renderer3d.contentChanged();
  else flat.contentChanged();
}

function beginChange() {
  S.tuning = true;
  fx.bars = Math.random() < 0.3 ? 1 : 0;       // mostly snow, sometimes the torn bars
  fx.noise = 1;
  fx.knobTarget -= Math.PI / 6;                 // one detent on the VHF dial
  playClunk();
  playSnow(STATIC_MS);
  wake();
}
function endChange() {
  S.tuning = false;
  fx.noise = 0;
  wake();
}

function loadPoster(film) {
  if (!film.p) return Promise.resolve(null);
  return new Promise(res => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = "https://image.tmdb.org/t/p/w342" + film.p;
  });
}

const TV = {
  play(film, note) {
    const token = ++playToken;
    clearTimeout(cutTimer);
    beginChange();
    const reduced = REDUCED.matches;
    const minMs = reduced ? 160 : STATIC_MS;
    const started = performance.now();
    let poster = null, posterDone = false;
    const posterP = loadPoster(film).then(p => { poster = p; posterDone = true; return p; });
    return new Promise(resolve => {
      const cut = () => {
        if (token !== playToken) return resolve();
        S.mode = "film"; S.film = film; S.note = note || null;
        S.poster = poster;
        S.playingSince = performance.now();
        repaint();
        endChange();
        resolve();
        if (!posterDone) {
          // poster came in after the cut: a quick tracking tear as it lands
          posterP.then(p => {
            if (token !== playToken || !p) return;
            S.poster = p; repaint();
            fx.glitch = reduced ? 0 : 1; wake();
          });
        }
      };
      const tryCut = () => {
        const waited = performance.now() - started;
        if (posterDone || waited >= MAX_WAIT_MS) cut();
        else cutTimer = setTimeout(tryCut, 60);
      };
      cutTimer = setTimeout(tryCut, minMs);
    });
  },
  noSignal(query) {
    playToken++; clearTimeout(cutTimer);
    S.mode = "nosignal"; S.query = query || ""; S.film = null;
    beginChange();
    cutTimer = setTimeout(() => { repaint(); endChange(); }, REDUCED.matches ? 160 : 300);
  },
  empty() {
    playToken++; clearTimeout(cutTimer);
    S.mode = "empty"; S.film = null;
    beginChange();
    cutTimer = setTimeout(() => { repaint(); endChange(); }, REDUCED.matches ? 160 : 300);
  },
  idle() {
    playToken++; clearTimeout(cutTimer);
    S.mode = "idle"; S.film = null; S.tuning = false; fx.noise = 0;
    repaint(); wake();
  },
  osd(text) {
    S.message = text; S.messageUntil = performance.now() + 2600; wake();
  },
  count(n) {
    S.count = n; wake();
    if (S.mode === "idle") repaint();
  },
  // review captures only: freeze the channel change so a screenshot can see it
  hold(kind) {
    playToken++; clearTimeout(cutTimer);
    beginChange();
    fx.bars = kind === "bars" ? 1 : 0;
  },
};
window.TV = TV;

// ── render loop control: always on while things move, on demand otherwise ──
let wakeUntil = 0;
function wake(ms = 400) { wakeUntil = Math.max(wakeUntil, performance.now() + ms); }

// ═════════════════════════════════════════════════════════════════════════════
// WebGL
// ═════════════════════════════════════════════════════════════════════════════
function startWebGL() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  // the phone canvas is only the top strip, so full density is affordable there too
  let dprCap = 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;   // the plate is already graded in Blender
  RectAreaLightUniformsLib.init();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#05060a");
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.32;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 30);
  camera.position.copy(CAM);

  // the store, out of focus
  const texLoader = new THREE.TextureLoader();
  const plateTex = texLoader.load(storeUrl, () => wake());
  plateTex.colorSpace = THREE.SRGBColorSpace;
  plateTex.anisotropy = 4;
  const plateSize = 2 * PLATE_DIST * PLATE_HALF_TAN;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(plateSize, plateSize),
    new THREE.MeshBasicMaterial({ map: plateTex, depthWrite: false, toneMapped: false }));
  plate.position.set(CAM.x, CAM.y, CAM.z - PLATE_DIST);
  plate.renderOrder = -1;
  scene.add(plate);

  // light: the troffer over the counter, the room, the neon behind, the tube itself
  const troffer = new THREE.RectAreaLight("#eaf2ff", 1.3, 1.3, 0.34);
  troffer.position.set(0.0, 1.6, 1.25);
  troffer.lookAt(0, 0.1, 0.1);
  scene.add(troffer);
  scene.add(new THREE.HemisphereLight("#a9bcff", "#2b2030", 0.55));
  const neonPink = new THREE.PointLight("#ff2a8a", 2.2, 5, 1.6);
  neonPink.position.set(1.3, 0.95, -1.4);
  scene.add(neonPink);
  const neonCyan = new THREE.PointLight("#2ad4ff", 1.4, 5, 1.6);
  neonCyan.position.set(-1.6, 0.8, -1.2);
  scene.add(neonCyan);
  // the tube's light on the counter and the tapes. It must sit in front of the
  // bezel: a rect light inside the silver surround floods it white.
  const spill = new THREE.RectAreaLight("#8899ff", 1.4, 0.36, 0.27);
  spill.position.set(-0.075, 0.2375, 0.3);
  spill.lookAt(-0.075, 0.2375, 2);
  scene.add(spill);

  // screen textures
  const contentTex = new THREE.CanvasTexture(screen.content);
  contentTex.colorSpace = THREE.SRGBColorSpace;
  contentTex.flipY = false;
  contentTex.generateMipmaps = true;
  contentTex.minFilter = THREE.LinearMipmapLinearFilter;
  contentTex.anisotropy = 8;
  const osdTex = new THREE.CanvasTexture(screen.osd);
  osdTex.colorSpace = THREE.SRGBColorSpace;
  osdTex.flipY = false;
  const vfdTex = new THREE.CanvasTexture(screen.vfd);
  vfdTex.colorSpace = THREE.SRGBColorSpace;
  vfdTex.flipY = false;
  const crt = createCrtMaterial(contentTex, osdTex);

  const aoTex = texLoader.load(asset("set-ao.jpg"), () => wake());
  aoTex.flipY = false;
  aoTex.channel = 1;

  let knobVHF = null;
  const titles = (typeof FILMS !== "undefined")
    ? [FILMS[Math.floor(Math.random() * FILMS.length)].t, FILMS[Math.floor(Math.random() * FILMS.length)].t, FILMS[Math.floor(Math.random() * FILMS.length)].t]
    : ["", "", ""];

  function canvasTex(c, srgb = true, repeat = 1) {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = false;
    t.anisotropy = 8;
    if (repeat !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
    return t;
  }

  const loaded = new GLTFLoader().loadAsync(asset("set.glb"));

  loaded.then(gltf => fontsReady.then(() => {
    const props = propCanvases(titles);
    const brushed = canvasTex(props.brushed, false);
    brushed.wrapS = brushed.wrapT = THREE.RepeatWrapping;
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      const m = o.material;
      const name = m.name;
      if (name === "M_Screen") { o.material = crt; return; }
      if (name === "M_VFD") {
        o.material = new THREE.MeshBasicMaterial({ map: vfdTex, toneMapped: false });
        return;
      }
      // everything else: keep the Blender PBR values, add the baked AO
      let mat = m;
      if (name === "M_Bezel") {
        // satin painted silver, as on the reference set — a mirror finish here
        // catches the overhead troffer in the sloped lip and blooms white
        mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color("#aeb1b5"), metalness: 0.55, roughness: 0.62, roughnessMap: brushed,
          envMapIntensity: 0.7,
        });
        mat.name = name;
      }
      if (props[name]) {
        mat.map = canvasTex(props[name], true, name === "M_Laminate" ? 6 : 1);
        mat.color.set("#ffffff");
      }
      if (name === "M_Silver") { mat.roughness = 0.42; mat.metalness = 0.72; }
      if (name === "M_Chrome") { mat.roughness = 0.1; mat.envMapIntensity = 1.6; }
      if (name === "M_GlossBlack") { mat.roughness = 0.16; mat.envMapIntensity = 1.2; }
      mat.aoMap = aoTex;
      mat.aoMapIntensity = 1.0;
      mat.side = THREE.FrontSide;
      if (name.startsWith("M_Counter") || name === "M_Laminate" || name === "M_Edge") mat.side = THREE.DoubleSide;
      o.material = mat;
    });
    knobVHF = gltf.scene.getObjectByName("Knob_VHF");
    scene.add(gltf.scene);
    repaint();
    wake(1500);
    document.documentElement.classList.add("tv-ready");
  })).catch(err => {
    // no set, no screen: hand over to the flat TV rather than show an empty counter
    console.error("TV set failed to load, using the flat TV", err);
    renderer.setAnimationLoop(null);
    renderer3d = null;
    canvas.style.display = "none";
    flat.start();
  });

  // bloom: the tube, the VFD, the neon in the plate glow a little into the dark
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.28, 0.5, 0.93);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ── fit the TV into the layout's slot ─────────────────────────────────────
  const view = { w: 1, h: 1, fit: 0.92, slot: { x: 0, y: 0, w: 1, h: 1 } };
  function measure() {
    const cr = canvas.getBoundingClientRect();
    const sr = slot.getBoundingClientRect();
    view.w = Math.max(1, cr.width); view.h = Math.max(1, cr.height);
    view.slot = { x: sr.left - cr.left, y: sr.top - cr.top, w: Math.max(1, sr.width), h: Math.max(1, sr.height) };
    // how much of its slot the set fills: set per layout in CSS (--fit), so a phone keeps some store around the TV
    view.fit = parseFloat(getComputedStyle(slot).getPropertyValue("--fit")) || 0.92;
    renderer.setSize(view.w, view.h, false);
    composer.setSize(view.w, view.h);
    bloom.resolution.set(view.w / 2, view.h / 2);
    wake();
  }
  new ResizeObserver(measure).observe(canvas);
  new ResizeObserver(measure).observe(slot);
  window.addEventListener("resize", measure);
  measure();

  function frameCamera() {
    const d = camera.position.z - TV_FRONT_Z;
    const tvW = TV_BOX.x1 - TV_BOX.x0, tvH = TV_BOX.y1 - TV_BOX.y0;
    const s = view.slot;
    const fpx = Math.min(s.w * view.fit * d / tvW, s.h * view.fit * d / tvH);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(view.h / 2 / fpx));
    camera.aspect = view.w / view.h;
    const cxTV = (TV_BOX.x0 + TV_BOX.x1) / 2, cyTV = (TV_BOX.y0 + TV_BOX.y1) / 2;
    const sx = view.w / 2 + fpx * (cxTV - camera.position.x) / d;
    const sy = view.h / 2 - fpx * (cyTV - camera.position.y) / d;
    const tx = s.x + s.w / 2, ty = s.y + s.h / 2;
    camera.setViewOffset(view.w, view.h, sx - tx, sy - ty, view.w, view.h);
  }

  // ── parallax: the TV holds still in its slot, the store drifts behind it ─
  const sway = new THREE.Vector2(), swayTarget = new THREE.Vector2();
  window.addEventListener("pointermove", e => {
    if (e.pointerType === "touch") return;
    swayTarget.set((e.clientX / window.innerWidth - 0.5) * 2, (e.clientY / window.innerHeight - 0.5) * 2);
    wake(800);
  }, { passive: true });

  renderer3d = {
    contentChanged() { contentTex.needsUpdate = true; wake(); },
  };

  // screen colour → spill light, sampled small and not every frame
  const probe = document.createElement("canvas"); probe.width = 4; probe.height = 3;
  const pc = probe.getContext("2d", { willReadFrequently: true });
  let lastProbe = 0;
  const spillColour = new THREE.Color();
  function probeScreen(now) {
    if (now - lastProbe < 180) return;
    lastProbe = now;
    pc.drawImage(screen.content, 0, 0, 4, 3);
    const px = pc.getImageData(0, 0, 4, 3).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
    const n = px.length / 4;
    spillColour.setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
  }

  // adaptive quality: a slow device drops bloom and pixel ratio rather than stutter
  let frames = 0, slowTime = 0, degraded = false, last = performance.now();
  const t0 = performance.now();

  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const reduced = REDUCED.matches;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    // CRT noise wants frames; reduced motion renders only when something changed
    const alive = !reduced || now < wakeUntil;
    if (!alive) return;

    // quality ladder: after 45 frames, a device averaging under ~25 fps loses
    // bloom and pixel ratio; if it is still under ~15 fps 45 frames later, the
    // flat TV takes over so the page never stutters.
    frames++;
    if (frames > 15) slowTime += dt;
    if (frames === 60) {
      if (slowTime / 45 > 1 / 25) {
        degraded = true;
        bloom.enabled = false;
        renderer.setPixelRatio(1);
        measure();
      }
      slowTime = 0;
    }
    if (degraded && frames === 105 && slowTime / 45 > 1 / 15) {
      renderer.setAnimationLoop(null);
      renderer3d = null;
      canvas.style.display = "none";
      flat.start();
      return;
    }

    const t = (now - t0) / 1000;
    const k = 1 - Math.exp(-dt * 6);
    if (!reduced) {
      const idle = new THREE.Vector2(Math.sin(t * 0.21) * 0.25, Math.sin(t * 0.17) * 0.15);
      sway.lerp(swayTarget.clone().add(idle), k * 0.5);
      camera.position.set(CAM.x + sway.x * 0.03, CAM.y - sway.y * 0.015, CAM.z);
    } else {
      camera.position.copy(CAM);
    }
    frameCamera();
    camera.updateProjectionMatrix();

    // the dial turns a detent with a little overshoot; instantly when motion is reduced
    if (knobVHF) {
      if (reduced) fx.knob = fx.knobTarget;
      else fx.knob += (fx.knobTarget - fx.knob) * (1 - Math.exp(-dt * 22));
      knobVHF.rotation.z = fx.knob;
    }
    fx.glitch = Math.max(0, fx.glitch - dt * 3.5);

    fx.wake = Math.min(1, fx.wake + dt / (reduced ? 0.001 : 0.9));
    crt.uniforms.uPower.value = reduced ? 1 : 1 - Math.pow(1 - fx.wake, 3);
    crt.uniforms.uTime.value = reduced ? 1.0 : t;
    crt.uniforms.uMotion.value = reduced ? 0 : 1;
    crt.uniforms.uNoise.value = fx.noise;
    crt.uniforms.uBars.value = fx.bars;
    crt.uniforms.uTape.value = (S.mode === "film" && !S.tuning) ? 1 : 0;
    crt.uniforms.uGlitch.value = fx.glitch;

    screen.paintOsd(now, reduced);
    osdTex.needsUpdate = true;
    screen.paintVfd(now);
    vfdTex.needsUpdate = true;

    probeScreen(now);
    if (fx.noise > 0.5) spill.color.setRGB(0.55, 0.57, 0.62);
    else spill.color.copy(spillColour);
    spill.intensity = 1.4 + (reduced ? 0 : Math.sin(t * 60) * 0.05);

    composer.render();
  });

  REDUCED.addEventListener?.("change", () => wake(600));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(600); });
}

// ═════════════════════════════════════════════════════════════════════════════
// No WebGL: the same screen in a CSS cabinet, snow painted in 2D
// ═════════════════════════════════════════════════════════════════════════════
const flat = {
  el: null, ctx: null, snow: null,
  contentChanged() { this.draw(); },
  draw() {
    if (!this.ctx) return;
    const c = this.ctx, { W, H } = screen.size;
    if (S.tuning) {
      const img = this.snow;
      const d = img.data;
      const bars = fx.bars > 0.5;
      const cols = [[158, 219, 242], [112, 242, 90], [237, 97, 219], [242, 214, 92], [102, 107, 199], [128, 61, 56]];
      for (let y = 0; y < img.height; y++) {
        const tear = bars ? Math.round((Math.random() - 0.5) * 8) : 0;
        for (let x = 0; x < img.width; x++) {
          const i = (y * img.width + x) * 4;
          if (bars) {
            const col = cols[Math.min(5, Math.max(0, Math.floor(((x + tear) / img.width) * 6)))];
            const v = 0.8 + Math.random() * 0.3;
            d[i] = col[0] * v; d[i + 1] = col[1] * v; d[i + 2] = col[2] * v;
          } else {
            const v = Math.random() * 255;
            d[i] = d[i + 1] = d[i + 2] = v;
          }
          d[i + 3] = 255;
        }
      }
      const tmp = this.tmp;
      tmp.getContext("2d").putImageData(img, 0, 0);
      c.imageSmoothingEnabled = false;
      c.drawImage(tmp, 0, 0, W, H);
    } else {
      c.drawImage(screen.content, 0, 0);
    }
    screen.paintOsd(performance.now(), REDUCED.matches);
    c.drawImage(screen.osd, 0, 0);
  },
  start() {
    document.documentElement.classList.add("no-webgl", "tv-ready");
    this.el = document.getElementById("flatScreen");
    this.el.width = screen.size.W; this.el.height = screen.size.H;
    this.ctx = this.el.getContext("2d");
    this.tmp = document.createElement("canvas");
    this.tmp.width = 200; this.tmp.height = 150;
    this.snow = this.tmp.getContext("2d").createImageData(200, 150);
    const plate = document.getElementById("flatPlate");
    const wrap = document.querySelector(".stage-wrap");
    plate.style.backgroundImage = `url(${asset(FALLBACK ? "fallback.jpg" : "store.jpg")})`;
    const place = () => {
      const r = slot.getBoundingClientRect(), c = wrap.getBoundingClientRect();
      const fit = parseFloat(getComputedStyle(slot).getPropertyValue("--fit")) || 0.9;
      if (!FALLBACK) { plate.style.backgroundSize = "cover"; plate.style.backgroundPosition = "center"; return; }
      const { w: W, h: H, tv, screen: tube } = FALLBACK;
      // scale the frame so its TV fills the slot like the 3D set would, centred in it,
      // but never smaller than the stage it has to cover
      let k = Math.min(r.width * fit / tv.w, r.height * fit / tv.h);
      k = Math.max(k, c.width / W, c.height / H);
      const left = (r.left - c.left + r.width / 2) - (tv.x + tv.w / 2) * k;
      const top = (r.top - c.top + r.height / 2) - (tv.y + tv.h / 2) * k;
      plate.style.backgroundSize = `${W * k}px ${H * k}px`;
      plate.style.backgroundPosition = `${left}px ${top}px`;
      Object.assign(this.el.style, {
        left: left + tube.x * k + "px", top: top + tube.y * k + "px",
        width: tube.w * k + "px", height: tube.h * k + "px",
      });
    };
    new ResizeObserver(place).observe(slot);
    window.addEventListener("resize", place);
    place();
    fontsReady.then(() => repaint());
    const loop = () => {
      if (S.tuning || S.mode !== "film" || performance.now() < S.messageUntil || !REDUCED.matches) this.draw();
      setTimeout(() => requestAnimationFrame(loop), 1000 / 24);
    };
    loop();
  },
};

// A real GPU gets the 3D set. No WebGL2, or a software rasteriser (which would
// spend seconds per frame and freeze the page), gets the flat TV instead.
function gpuRenderer() {
  try {
    if (!window.WebGL2RenderingContext) return null;
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name) ? null : name || "webgl2";
  } catch (e) { return null; }
}

fontsReady.then(() => screen.paintContent());
const forceFlat = /[?&]flat\b/.test(location.search);
if (!forceFlat && gpuRenderer()) {
  // let the controls paint first; the set fades in when it is ready
  requestAnimationFrame(() => setTimeout(() => {
    try { startWebGL(); }
    catch (e) { console.error("WebGL start failed, using the flat TV", e); renderer3d = null; flat.start(); }
  }, 0));
} else {
  flat.start();
}

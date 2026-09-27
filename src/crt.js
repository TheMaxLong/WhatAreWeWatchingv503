// The tube. Scans the content + OSD canvases out through a convex CRT face:
// pillow-shaped raster, RGB fringing, scanlines and an aperture grille that fade
// out before they can alias, phosphor glow, a slow hum bar, the VHS
// head-switching wobble along the bottom while a tape plays — and the two
// channel-change pictures the owner asked for: snow (with CH 03) and torn
// colour bars.
import * as THREE from "three";

const vertexShader = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  uniform sampler2D uContent;
  uniform sampler2D uOsd;
  uniform float uTime;
  uniform float uNoise;     // 0 = picture, 1 = full channel-change picture
  uniform float uBars;      // 0 = snow, 1 = torn colour bars
  uniform float uTape;      // 1 while a tape plays: head-switching band
  uniform float uMotion;    // 0 under prefers-reduced-motion: nothing drifts
  uniform float uPower;     // tube warm-up 0..1
  uniform float uGlitch;    // brief tracking tear when a poster lands late
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(float x) {
    float i = floor(x), f = fract(x);
    return mix(hash(vec2(i, 1.7)), hash(vec2(i + 1.0, 1.7)), f * f * (3.0 - 2.0 * f));
  }
  vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }

  // the bars in the owner's photo, left to right, then the short blocks below
  vec3 barColour(float x, float y) {
    vec3 c;
    float i = floor(clamp(x, 0.0, 0.9999) * 6.0);
    if (i < 0.5) c = vec3(0.62, 0.86, 0.95);
    else if (i < 1.5) c = vec3(0.44, 0.95, 0.35);
    else if (i < 2.5) c = vec3(0.93, 0.38, 0.86);
    else if (i < 3.5) c = vec3(0.95, 0.84, 0.36);
    else if (i < 4.5) c = vec3(0.40, 0.42, 0.78);
    else c = vec3(0.50, 0.24, 0.22);
    if (y > 0.84) {
      float j = floor(clamp(x, 0.0, 0.9999) * 7.0);
      c = vec3(0.04);
      if (j < 0.5) c = vec3(0.93, 0.30, 0.55);
      else if (j > 1.5 && j < 2.5) c = vec3(0.70, 0.95, 0.98);
      else if (j > 4.5 && j < 5.5) c = vec3(0.30, 0.34, 0.98);
      else if (j > 5.5) c = vec3(0.95, 0.35, 0.45);
    }
    return c;
  }

  void main() {
    // glTF UVs run top-down; p is -1..1 with y up
    vec2 p = vec2(vUv.x, 1.0 - vUv.y) * 2.0 - 1.0;
    // the raster sits a little inside the glass and bows with the tube
    vec2 q = p * vec2(1.0, 1.01);
    float r2 = dot(q, q);
    q *= 1.0 + 0.055 * r2;
    vec2 uv = vec2(q.x * 0.5 + 0.5, 0.5 - q.y * 0.5);   // canvas space, y down

    float lineN = 262.0;                               // a field's worth of lines
    float line = floor(uv.y * lineN);
    float t = uTime * uMotion;
    float frame = floor(uTime * 30.0);

    // VHS: the head-switching band wobbles the last lines of the picture
    float band = smoothstep(0.935, 0.975, uv.y) * uTape;
    float wob = band * (vnoise(line * 0.9 + t * 30.0) - 0.5) * 0.05;
    // a tracking tear when asked
    wob += uGlitch * (vnoise(line * 0.25 + t * 55.0) - 0.5) * 0.08 * step(0.35, fract(uv.y * 3.0 + t));
    vec2 puv = uv + vec2(wob, 0.0);

    // picture with a touch of convergence error
    float ca = 0.0016 + 0.002 * r2;
    vec3 pic;
    pic.r = texture2D(uContent, puv + vec2(ca, 0.0)).r;
    pic.g = texture2D(uContent, puv).g;
    pic.b = texture2D(uContent, puv - vec2(ca, 0.0)).b;
    vec3 bloom = texture2D(uContent, puv, 3.5).rgb;
    pic += bloom * 0.22;
    pic += band * (hash(vec2(floor(uv.x * 180.0), line + frame)) - 0.5) * 0.25;

    // snow: grains a little wider than tall, re-rolled every frame
    vec2 cell = floor(uv * vec2(300.0, 220.0));
    float n = hash(cell + vec2(frame * 7.13, frame * 3.71));
    float streak = hash(vec2(line, frame)) * 0.35;
    float snow = clamp(pow(n, 1.35) * 1.15 + streak - 0.12, 0.0, 1.0);
    vec3 snowC = toLinear(vec3(snow) * vec3(0.93, 0.95, 1.0));

    // torn bars: every line slides by its own amount
    float tear = (vnoise(line * 0.31 + frame * 1.7) - 0.5) * 0.07
               + (hash(vec2(line, frame)) - 0.5) * 0.018;
    float bx = uv.x + tear;
    vec3 barsC = toLinear(barColour(bx, uv.y));
    barsC *= 0.78 + 0.32 * hash(vec2(floor(bx * 420.0), line + frame));
    barsC += (hash(vec2(floor(uv.x * 90.0), line * 3.0 + frame)) > 0.985 ? 0.25 : 0.0);

    vec3 noiseC = mix(snowC, barsC, uBars);
    vec3 col = mix(pic, noiseC, uNoise);

    // on-screen display on top of whatever is up
    vec4 o = texture2D(uOsd, uv + vec2(wob * 0.5, 0.0));
    col = mix(col, o.rgb, o.a);

    // scanlines and grille, faded out where they would alias
    float fw = fwidth(uv.y * lineN);
    float sl = 0.5 + 0.5 * cos(uv.y * lineN * 6.28318);
    col *= 1.0 - 0.32 * (1.0 - smoothstep(0.28, 0.65, fw)) * (1.0 - sl);
    float gx = uv.x * lineN * 1.3333;
    float fwx = fwidth(gx);
    float stripe = fract(gx);
    vec3 grille = vec3(
      smoothstep(0.0, 0.2, stripe) * smoothstep(0.45, 0.25, stripe),
      smoothstep(0.25, 0.45, stripe) * smoothstep(0.75, 0.55, stripe),
      smoothstep(0.55, 0.75, stripe) * smoothstep(1.0, 0.8, stripe));
    col *= mix(vec3(1.0), 0.72 + 0.6 * grille, 0.55 * (1.0 - smoothstep(0.18, 0.4, fwx)));

    // hum bar and a whisper of flicker (kept far below anything that flashes)
    col *= 1.0 + 0.03 * sin((uv.y + t * 0.09) * 6.28318) * uMotion;
    col *= 1.0 + 0.012 * (vnoise(t * 14.0) - 0.5) * uMotion;

    // raster edge: soft, pillow-shaped; the tube face beyond it
    vec2 e = smoothstep(vec2(0.0), vec2(0.01, 0.014), uv) * smoothstep(vec2(0.0), vec2(0.01, 0.014), 1.0 - uv);
    float raster = e.x * e.y;
    col *= 1.0 - 0.18 * r2 * r2;                        // corners fall off
    col *= raster * uPower;

    // the glass itself: dark grey-green, with the store's tubes in it
    vec3 glass = vec3(0.012, 0.015, 0.014);
    float refl = smoothstep(0.16, 0.0, abs(p.y * 0.85 + p.x * 0.32 - 0.66)) * 0.035
               + smoothstep(0.5, 0.0, length(p - vec2(-0.62, 0.72))) * 0.02;
    col = glass + col + refl;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createCrtMaterial(contentTex, osdTex) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uContent: { value: contentTex },
      uOsd: { value: osdTex },
      uTime: { value: 0 },
      uNoise: { value: 0 },
      uBars: { value: 0 },
      uTape: { value: 0 },
      uMotion: { value: 1 },
      uPower: { value: 1 },
      uGlitch: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    toneMapped: false,
  });
}

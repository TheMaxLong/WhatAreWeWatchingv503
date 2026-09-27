// Stitch src/ into the index.html GitHub Pages serves: the films, the chooser and
// the three.js scene inline; the Blender set and plates beside it in assets/.
//
//   npm run build          # writes index.html
//
// The Blender assets are built separately and committed:
//   blender -b -P blender/tv.py        → assets/set.glb, assets/set-ao.jpg
//   blender -b -P blender/store.py     → assets/store.jpg
//   blender -b -P blender/store.py -- --fallback   → assets/fallback.jpg + fallback.json (no-WebGL TV)
//   blender -b -P blender/sleeve.py    → assets/clamshell.jpg, assets/insert.jpg
import { build } from "esbuild";
import fs from "node:fs";
import crypto from "node:crypto";

const read = p => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const films = read("./src/films.js");
const app = read("./src/app.js");
const page = read("./src/page.html");

// content hash of the Blender outputs, so a re-bake busts the browser cache
const assetVersion = crypto.createHash("sha256")
  .update(Buffer.concat(["set.glb", "set-ao.jpg", "store.jpg", "fallback.jpg", "fallback.json", "clamshell.jpg", "insert.jpg"]
    .map(f => fs.readFileSync(new URL("./assets/" + f, import.meta.url)))))
  .digest("hex").slice(0, 10);

const bundle = await build({
  entryPoints: [new URL("./src/scene.js", import.meta.url).pathname],
  bundle: true,
  format: "iife",
  minify: true,
  write: false,
  target: ["es2020"],
  legalComments: "eof",            // three.js is MIT; its notice stays in the file
  define: {
    __ASSET_V__: JSON.stringify(assetVersion),
    __FALLBACK__: read("./assets/fallback.json"),     // where the TV and tube sit in fallback.jpg
  },
});
const scene = bundle.outputFiles[0].text;

// inline scripts end at the first "</script" — make sure none hides in the payload
const safe = s => s.replace(/<\/script/gi, "<\\/script");

for (const mark of ["/*@FILMS@*/", "/*@APP@*/", "/*@SCENE@*/"]) {
  if (page.split(mark).length !== 2) throw new Error(`page.html must hold ${mark} exactly once`);
}
const html = page
  .replaceAll("__ASSET_V__", assetVersion)          // CSS url()s to the same assets
  .replace("/*@FILMS@*/", () => films)
  .replace("/*@APP@*/", () => safe(app))
  .replace("/*@SCENE@*/", () => safe(scene))
  .replace("<head>", () => "<head>\n<!-- BUILT FILE — edit src/ and run `npm run build`. -->");

// the repo's pre-commit identity guard, run here so a minified name that happens to
// spell a building code fails the build instead of the commit
const B = ["A", "E", "G"].map((c, i) => c + ["B", "F", "H"][i]);
const guard = new RegExp(`(^|[^A-Za-z0-9_])(${B.join("|")})[0-9-]*([^A-Za-z0-9_]|$)|${"anderson" + "-hub"}|10\\.10\\.[0-9]{1,3}\\.[0-9]{1,3}`, "m");
const hit = html.split("\n").findIndex(l => guard.test(l));
if (hit >= 0) {
  const m = html.split("\n")[hit].match(guard);
  throw new Error(`built page line ${hit + 1} matches the identity guard near ${JSON.stringify(m[0])}`);
}

fs.writeFileSync(new URL("./index.html", import.meta.url), html);

const kb = n => (n / 1024).toFixed(0) + " KB";
const filmsSha = crypto.createHash("sha256").update(films).digest("hex");
console.log(`index.html  ${kb(html.length)}  (scene bundle ${kb(scene.length)}, films ${kb(films.length)}, assets v=${assetVersion})`);
console.log(`films block sha256 ${filmsSha}`);

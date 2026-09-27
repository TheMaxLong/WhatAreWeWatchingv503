
// ── the chooser ─────────────────────────────────────────────────────────────
// Same behaviour as before the CRT makeover: one random film from the pool the
// filters allow, or an actor's first film in the list. What changed is where it
// shows: the TV plays the pick (window.TV, from the 3D bundle) and the sleeve
// back (#card) carries the words. Every TV call is guarded, so the chooser
// still works if the 3D bundle never loads.

const ALL_GENRES = [...new Set(FILMS.flatMap(f => f.g))].sort();
const DECADES = ["1970s","1980s","1990s","2000s","2010s","2020s"];

let activeGenres = new Set();
let activeDecades = new Set();
let currentActorFilter = null;
let actorFirstFilm = null;

const tv = (fn, ...args) => { try { if (window.TV && window.TV[fn]) return window.TV[fn](...args); } catch (e) { console.error(e); } };

document.getElementById("total").textContent = FILMS.length;

// Build genre chips
const genreEl = document.getElementById("genres");
ALL_GENRES.forEach(g => {
  const c = document.createElement("button");
  c.type = "button";
  c.className = "chip"; c.textContent = g;
  c.setAttribute("aria-pressed", "false");
  c.onclick = () => {
    if (activeGenres.has(g)) activeGenres.delete(g); else activeGenres.add(g);
    c.classList.toggle("active");
    c.setAttribute("aria-pressed", String(activeGenres.has(g)));
    updateCount(true); updateGenreToggle();
  };
  genreEl.appendChild(c);
});

// Genre row collapses on phones — the card, not the filters, is what you came for
function toggleGenres() {
  const open = document.getElementById("genres").classList.toggle("open");
  document.getElementById("genreToggle").setAttribute("aria-expanded", open ? "true" : "false");
  updateGenreToggle();
}

function updateGenreToggle() {
  const btn = document.getElementById("genreToggle");
  const open = document.getElementById("genres").classList.contains("open");
  const n = activeGenres.size;
  btn.querySelector(".label").textContent = "GENRES" + (n ? " · " + n : "");
  btn.classList.toggle("on", n > 0);
  btn.classList.toggle("is-open", open);
}
updateGenreToggle();

// Full placeholder overflows a narrow input (phones, the desktop sign board) — say the same thing shorter
function fitPlaceholder() {
  const input = document.getElementById("actorInput");
  input.placeholder = input.clientWidth < 330 ? "actor name → first film" : "actor name → their first film in the list";
}
fitPlaceholder();
window.addEventListener("resize", fitPlaceholder);

// Build decade chips — same flat buttons as the genres
const decadeEl = document.getElementById("decades");
DECADES.forEach(d => {
  const c = document.createElement("button");
  c.type = "button";
  c.className = "chip decade";
  c.textContent = d;
  c.setAttribute("aria-pressed", "false");
  c.onclick = () => {
    if (activeDecades.has(d)) activeDecades.delete(d); else activeDecades.add(d);
    c.classList.toggle("active");
    c.setAttribute("aria-pressed", String(activeDecades.has(d)));
    updateCount(true);
  };
  decadeEl.appendChild(c);
});

function decadeOf(y) {
  if (y < 1980) return "1970s";
  if (y < 1990) return "1980s";
  if (y < 2000) return "1990s";
  if (y < 2010) return "2000s";
  if (y < 2020) return "2010s";
  return "2020s";
}

function getPool() {
  return FILMS.filter(f => {
    if (activeGenres.size > 0 && !f.g.some(g => activeGenres.has(g))) return false;
    if (activeDecades.size > 0 && !activeDecades.has(decadeOf(f.y))) return false;
    return true;
  });
}

function filterLabel() {
  const parts = [...activeGenres, ...activeDecades];
  if (!parts.length) return "WHOLE STORE";
  return parts.length > 3 ? parts.slice(0, 3).join(" · ") + " +" + (parts.length - 3) : parts.join(" · ");
}

function updateCount(announce) {
  const n = getPool().length;
  document.getElementById("countLine").textContent = n + " films match your filters";
  tv("count", n);
  if (announce) tv("osd", filterLabel().toUpperCase() + "  " + n + (n === 1 ? " TAPE" : " TAPES"));
}

function renderStreaming(platforms) {
  // Logos are drawn only for platforms a live check confirmed (STREAMING stays empty until then)
  const streamingEl = document.getElementById("cardStreaming");
  streamingEl.innerHTML = "";
  if (!platforms || platforms.length === 0) return;
  platforms.forEach(p => {
    const div = document.createElement("div");
    div.className = "streaming-logo";
    div.textContent = p.toUpperCase();
    div.title = "Available on " + p.toUpperCase() + " (as of " + STREAMING_AS_OF + ")";
    streamingEl.appendChild(div);
  });
}

let revealTimer = 0;
function showFilm(film, note) {
  document.getElementById("actorNote").style.display = note ? "block" : "none";
  document.getElementById("actorNote").textContent = note || "";
  document.getElementById("cardYear").textContent = film.d ? film.y + "  ·  dir. " + film.d : String(film.y);
  document.getElementById("cardTitle").textContent = film.t;
  document.getElementById("cardDesc").textContent = film.desc;
  const tagsEl = document.getElementById("cardTags");
  tagsEl.innerHTML = "";
  film.g.forEach(g => { const t = document.createElement("div"); t.className = "tag"; t.textContent = g; tagsEl.appendChild(t); });
  const castEl = document.getElementById("cardCast");
  castEl.innerHTML = "";
  const lead = document.createElement("span"); lead.className = "billing-lead"; lead.textContent = "Starring ";
  const names = document.createElement("span"); names.textContent = film.cast.join(" · ");
  castEl.append(lead, names);
  const streamingKey = film.t + "|" + film.y;
  renderStreaming(STREAMING[streamingKey] || null);
  const poster = document.getElementById("cardPoster");
  if (film.p) {
    poster.onerror = function () { poster.classList.add("hidden"); };
    poster.src = "https://image.tmdb.org/t/p/w342" + film.p;
    poster.alt = film.t + " poster";
    poster.classList.remove("hidden");
  } else {
    poster.removeAttribute("src");
    poster.classList.add("hidden");
  }
  document.getElementById("watchLink").href = "https://www.justwatch.com/us/search?q=" + encodeURIComponent(film.t + " " + film.y);
  document.getElementById("cardWatch").style.display = "block";

  // The sleeve turns over while the TV is between channels, and settles when the picture lands
  const card = document.getElementById("card");
  card.classList.add("show", "tuning");
  clearTimeout(revealTimer);
  const settle = () => card.classList.remove("tuning");
  const cut = tv("play", film, note);
  if (cut && cut.then) cut.then(settle, settle);
  revealTimer = setTimeout(settle, 1400);   // never leave the words hidden
}

function pick() {
  currentActorFilter = null;
  actorFirstFilm = null;
  const pool = getPool();
  if (!pool.length) {
    // no browser modal: the TV and the count line both say it
    document.getElementById("countLine").textContent = "No films match those filters — loosen one";
    tv("empty");
    return;
  }
  const film = pool[Math.floor(Math.random() * pool.length)];
  showFilm(film, null);
  updateCount(false);
}

function actorSearch() {
  const name = document.getElementById("actorInput").value.trim().toLowerCase();
  if (!name) return;
  const matches = FILMS.filter(f => f.cast.some(c => c.toLowerCase().includes(name)));
  if (!matches.length) {
    const typed = document.getElementById("actorInput").value.trim();
    const card = document.getElementById("card");
    card.classList.add("show");
    card.classList.remove("tuning");
    document.getElementById("actorNote").style.display = "block";
    document.getElementById("actorNote").textContent = "No films found for \"" + typed + "\" in the list.";
    document.getElementById("cardYear").textContent = "";
    document.getElementById("cardTitle").textContent = "";
    document.getElementById("cardDesc").textContent = "";
    document.getElementById("cardTags").innerHTML = "";
    document.getElementById("cardCast").innerHTML = "";
    document.getElementById("cardStreaming").innerHTML = "";
    document.getElementById("cardPoster").removeAttribute("src");
    document.getElementById("cardPoster").classList.add("hidden");
    document.getElementById("cardWatch").style.display = "none";
    tv("noSignal", typed);
    return;
  }
  matches.sort((a, b) => a.y - b.y);
  const first = matches[0];
  const actor = first.cast.find(c => c.toLowerCase().includes(name));
  showFilm(first, "First film for " + actor + " in this list (" + matches.length + " total)");
  document.getElementById("countLine").textContent = matches.length + " films feature " + actor;
}

function clearActor() {
  document.getElementById("actorInput").value = "";
  document.getElementById("card").classList.remove("show", "tuning");
  document.getElementById("countLine").textContent = "";
  tv("idle");
  updateCount(false);
}

document.getElementById("surpriseBtn").addEventListener("click", pick);
document.getElementById("genreToggle").addEventListener("click", toggleGenres);
document.getElementById("actorInput").addEventListener("keydown", e => { if (e.key === "Enter") actorSearch(); });
document.getElementById("actorBtn").addEventListener("click", actorSearch);
document.getElementById("clearBtn").addEventListener("click", clearActor);
updateCount(false);

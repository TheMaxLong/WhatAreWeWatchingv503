# Filling in the streaming logos — 3 steps

The movie app has a spot for streaming-platform logos on every film card, but the
data behind it is empty on purpose: we only show availability we actually verified.
This script fills it with real data from TMDB (The Movie Database) — a free movie
site with an API (a way for scripts to ask it questions).

## Step 1 — Make a free TMDB account and get a key (one time, ~5 minutes)

1. Go to https://www.themoviedb.org/signup and create a free account.
2. Verify your email.
3. Go to https://www.themoviedb.org/settings/api and click to request an API key.
   Choose **Developer**, accept the terms. For the form fields (app name, URL,
   description), plain honest answers are fine — e.g. "personal movie list app,
   not public". It's approved instantly.
4. Copy the long code labeled **API Key**. That's your key. Treat it like a
   password — don't paste it into any file in this repo.

## Step 2 — Test the script first (no key needed)

In Terminal, from the WhatAreWeWatchingv503 folder:

    node scripts/streaming-backfill.mjs --dry-run

This reads the film list out of index.html and runs a practice round on fake,
clearly-labeled mock data. It writes nothing and contacts nobody. You should see
the film count and "Dry run complete."

## Step 3 — Run it for real

    TMDB_API_KEY=paste-your-key-here node scripts/streaming-backfill.mjs

The `TMDB_API_KEY=...` part hands the key to the script for this one command
only (an "environment variable" — it isn't saved anywhere). ~1,100 films at a
polite request rate takes roughly **12–15 minutes**. Safe to Ctrl+C anytime —
running the same command again continues where it stopped.

## What you get

- `scripts/streaming-output.js` — a ready-to-paste `STREAMING_AS_OF` +
  `STREAMING` block. Paste it over the matching block in index.html (or hand it
  to Claude to paste). Every entry is stamped with the date it was verified.
- `scripts/streaming-report.md` — the honest leftovers: films TMDB couldn't
  match exactly, and provider names the script refused to guess a logo for.
  Nothing in that report was written into the output.

The script never edits index.html, never guesses a match, and only counts
subscription/free/ad-supported streaming (not rentals or purchases).

## Rules the script follows (so the data stays honest)

- Exact title + exact year matches only. "Close enough" goes in the report.
- Unknown provider names go in the report, never into a platform key.
- US region only. Catalogs rotate constantly — worth a fresh run
  (`--fresh` to redo everything) every month or so.

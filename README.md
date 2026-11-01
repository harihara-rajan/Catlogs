# Tamil OTT Catalogs — Stremio addon

Adds 14 rows to Stremio: Tamil **movies** and **series** currently available in **India** on

Prime Video · aha · Netflix · SonyLIV · Sun NXT · JioHotstar · ZEE5

Each row has a filter for **Popular / Newest / Top rated** and scrolls endlessly.

This is a **catalog-only** addon: it lists titles and gives Stremio their IMDb IDs, so posters,
details and episode lists come from Stremio's built-in metadata, and whatever stream addons you
already have installed handle playback. It doesn't touch the services themselves; the
"what's on where" data comes from TMDB (which gets it from JustWatch), so new arrivals can take a
day or two to show up.

---

## 1. Get a free TMDB API key (5 min)

1. Make an account at <https://www.themoviedb.org/signup>.
2. Go to **Settings → API** (<https://www.themoviedb.org/settings/api>) and request a key
   (choose "Developer", personal use is fine).
3. Copy either the **API Key** (short hex string) or the **API Read Access Token** (long, starts
   with `eyJ`). Either works.

## 2. Try it on your computer (optional)

Needs Node.js 18 or newer.

```bash
npm install
npm start
```

Open <http://127.0.0.1:7000/configure>, paste the key, click **Install**. Stremio Desktop on the
same computer will add it. (Stremio only accepts plain `http://` addons from `127.0.0.1`, so the
TV needs the hosted version below.)

## 3. Host it so the Google TV can use it (free, ~10 min)

Stremio on a TV needs an `https://` address. Render's free tier is the easiest:

1. Put this folder in a GitHub repository (private is fine).
2. On <https://render.com> → **New → Web Service** → pick the repo.
3. Settings: **Runtime** Node · **Build command** `npm install` · **Start command** `npm start` ·
   **Instance type** Free.
4. Optional but handy: under **Environment**, add `TMDB_API_KEY` = your key. Then the addon works
   without the configure step and your key never appears in the install link.
5. Deploy. You'll get an address like `https://tamil-ott-catalogs.onrender.com`.

Install on the TV:

- If you set `TMDB_API_KEY`: in Stremio on the TV, open **Addons**, paste
  `https://<your-app>.onrender.com/manifest.json` into the addon search box and install.
- If not: open `https://<your-app>.onrender.com/configure` on your phone or laptop, paste the key,
  and click **Install** with Stremio open on that device, logged into the same account as the TV —
  addons sync across devices. (Or long-press/right-click Install to copy the manifest link and
  paste it into Stremio on the TV.)

Then go to **Board** or **Discover** and pick e.g. "Netflix Tamil".

Render's free tier sleeps after ~15 minutes of no use, so the first load after a break can take
30–60 seconds. Everything after that is cached and quick.

## Changing things

- **Services**: edit the `SERVICES` list at the top of `addon.js`. Service names are matched
  against TMDB's India provider list automatically (so "Netflix basic with Ads" counts as
  Netflix); the numeric `fallback` IDs are only used if that list can't be loaded.
- **Language**: change `with_original_language: 'ta'` in `addon.js` (`te` Telugu, `ml` Malayalam,
  `kn` Kannada, `hi` Hindi).
- **Country**: change `watch_region: 'IN'` in `addon.js` and `tmdb.js` (`DK` gives you what's on the
  Danish versions of these services).

## Files

- `addon.js` — manifest, the 14 catalogs, and the catalog/meta handlers
- `tmdb.js` — TMDB requests with in-memory caching
- `server.js` — starts the HTTP server (port `PORT`, default 7000)

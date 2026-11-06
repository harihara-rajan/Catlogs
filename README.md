# Tamil OTT Catalogs — Stremio addon

Adds 14 rows to Stremio: Tamil **movies** and **series** currently available in **India** on

Prime Video · aha · Netflix · SonyLIV · Sun NXT · JioHotstar · ZEE5

Rows show the **newest releases first**. The dropdown on each row switches to **Popular**,
**Top rated**, or a single **year** (1980 onwards). Rows scroll endlessly.

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

Render's free tier normally sleeps after ~15 minutes of no use (waking takes ~50 seconds). On
Render the addon visits itself every 10 minutes so it stays awake (set `KEEP_AWAKE=0` to stop
that), loads every row when it starts and again every 2 hours, and answers from its saved copy
while refreshing in the background — so rows should open straight away.

## New arrivals before TMDB catches up (`pins.json`)

TMDB/JustWatch usually take 1–3 days to notice a new film on a service. To show it now, add it
to `pins.json` under its service and commit (you can edit the file on github.com from your phone;
Render redeploys by itself in about a minute):

```json
"sonyliv": [
  { "title": "Meesaya Murukku 2", "year": 2026, "type": "movie", "added": "2026-11-06" }
]
```

- Give a `title` + `year`, or an IMDb id instead: `{ "imdb": "tt1234567", "type": "movie", "added": "…" }`
  (the IMDb id is in the address of the film's IMDb page). Use the IMDb id if a title search picks
  the wrong film.
- `type` is `movie` or `series`.
- Pins sit at the top of the row's Newest and Popular views and vanish by themselves 14 days after
  `added`, by which time TMDB has normally caught up. Leave out `added` to keep one pinned for good.

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
- `tmdb.js` — TMDB requests with in-memory caching and a limit on parallel requests
- `server.js` — starts the HTTP server (port `PORT`, default 7000), warm-up and keep-awake
- `pins.json` — hand-added new arrivals

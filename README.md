# OTT Catalogs — Stremio addon (Tamil · Malayalam · Hindi · English)

Adds rows to Stremio for **movies** and **series** currently available in **India**, per
language and service. You pick the languages on the install page (`/configure`):

| Tick box        | Country | Services |
|-----------------|---------|----------|
| Tamil           | India   | Prime Video · aha · Netflix · SonyLIV · Sun NXT · JioHotstar · ZEE5 |
| Malayalam       | India   | Prime Video · Netflix · SonyLIV · JioHotstar · ZEE5 · ManoramaMAX (movies only) |
| Hindi           | India   | Prime Video · Netflix · SonyLIV · JioHotstar · ZEE5 |
| English (India) | India   | Netflix · Prime Video · JioHotstar · Apple TV · SonyLIV · Lionsgate Play |
| English (US)    | US      | Netflix · Prime Video · Disney+ · HBO Max · Hulu · Apple TV · Paramount+ · Peacock |

Rows show the **newest releases first**. The dropdown on each row switches to **Popular**,
**Top rated**, or a year range. Stremio rejects addon manifests over 8 KB, so the dropdown adapts
to the number of rows: every year back to 1980 when it fits, then recent years plus decades and
"Older" (before 2000), then decades only, then just the sort orders; with four or five boxes ticked
there's no dropdown and rows are simply newest first. Rows scroll endlessly.

The plain `/manifest.json` link installs Tamil only (what earlier versions had). Other choices
put the settings in the link, e.g. `/{"languages":"ta,en-us"}/manifest.json` — the install page
builds it for you. Stremio's **Configure** button on the installed addon reopens that page.

This is a **catalog-only** addon: it lists titles and gives Stremio their IMDb IDs, so posters,
details and episode lists come from Stremio's built-in metadata, and whatever stream addons you
already have installed handle playback. It doesn't touch the services themselves.

**Where the "what's on where" data comes from:** the full list comes from TMDB, which copies it
from JustWatch roughly daily. To catch new arrivals sooner, the addon also reads JustWatch's own
"new on <service>" lists for the last 7 days and slots any Tamil title TMDB hasn't picked up yet
into its release-date position. So a film appears once **JustWatch** lists it on the service —
usually within hours to a day of it going live. (JustWatch's API is unofficial; if it ever
fails, the addon carries on with TMDB alone.)

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

**Updates:** after a change is pushed to GitHub, Render needs to redeploy. If it doesn't do so by
itself, open the service on Render and tap **Manual Deploy → Deploy latest commit**.

## Changing things

- **Services and tick boxes**: `SERVICES` at the top of `addon.js` lists each service's TMDB
  provider IDs and JustWatch package names per country (TMDB and JustWatch use the same IDs;
  JustWatch's `packages(country: XX, platform: WEB)` query lists them). `EDITIONS` defines the tick
  boxes: language, country, movies/series, and which services get rows. Watch the 8 KB manifest
  limit when adding rows.

## Files

- `addon.js` — languages, services, per-install manifests, and the catalog/meta handlers
- `tmdb.js` — TMDB requests with in-memory caching and a limit on parallel requests
- `server.js` — HTTP server (port `PORT`, default 7000): manifests, install page, warm-up, keep-awake
- `configure.js` — the install page
- `justwatch.js` — recent arrivals from JustWatch
- `cache.js` — in-memory cache and request limiter

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
| Tamil dubbed (Malayalam & Hindi) | India | One movies row: Malayalam and Hindi films with a Tamil audio track on Prime Video · JioHotstar · SonyLIV · ZEE5 · aha |

Tamil, Malayalam and Hindi also get **New This Week** rows at the top: titles in that language that
arrived on any of its services in the last 7 days, most recent first, with where and when in the
description. JustWatch sometimes catches up on a service in one go (e.g. ~600 ZEE5 titles in a
day), giving old titles today's date: on such days (>40 additions for that service) only titles
released in the previous 3 months count as new; on normal days, those from the last 2 years. Check with `/debug/week/ta-new-movie`.

The **Tamil dubbed** row uses the audio languages JustWatch records for each streaming offer. The
GitHub job re-scans those services' movie catalogues about once a day (`scripts/fetch-dubs.js`,
published as `dubs.json` on the `data` branch). Netflix and Sun NXT don't share audio languages
with JustWatch, so their dubs can't be included; ZEE5 shares them for only some titles. Check what
the server has with `/debug/dubs/ta-dub-movie`.

Rows show the **newest releases first** (English rows: **most popular first**). The dropdown on each row switches to **Popular**,
**Top rated**, or a year range. Stremio rejects addon manifests over 8 KB, so the dropdown adapts
to the number of rows: every year back to 1980 when it fits, then recent years plus decades and
"Older" (before 2000), then decades only, then just the sort orders; with four or five boxes ticked
there's no dropdown and rows are simply newest first. Rows scroll endlessly.

On the install page each ticked language shows its services (and New This Week) with Movies /
Series switches, so you can pick e.g. Tamil Netflix movies and JioHotstar series only; the choice
is saved in the link as `"ta":"new,netflix:m,jiohotstar:s"` (`:m` movies only, `:s` series only,
no suffix both; no entry = all rows).

The plain `/manifest.json` link installs Tamil only (what earlier versions had). Other choices
put the settings in the link, e.g. `/{"languages":"ta,en-us"}/manifest.json` — the install page
builds it for you. Stremio's **Configure** button on the installed addon reopens that page.

This is a **catalog-only** addon: it lists titles and gives Stremio their IMDb IDs, so posters,
details and episode lists come from Stremio's built-in metadata, and whatever stream addons you
already have installed handle playback. It doesn't touch the services themselves.

**Where the "what's on where" data comes from:** the full list comes from TMDB, which copies it
from JustWatch roughly daily. To catch new arrivals sooner, a GitHub Actions job
(`.github/workflows/arrivals.yml`, every 30 minutes) collects JustWatch's "new on <service>" lists
for the last 7 days and publishes them as `arrivals.json` on the repo's `data` branch; the addon
reads that file and slots any title TMDB hasn't picked up yet into its release-date position.
(The job runs on GitHub because JustWatch rate-limits Render's shared addresses. GitHub pauses
scheduled jobs in repos with no activity for 60 days; if new arrivals stop, re-enable it under
**Actions → new-arrivals**.) JustWatch's API is unofficial; if it fails, the addon carries on with
TMDB alone.

---

## Look

- Original icon and background (`assets.js`, drawn at start-up: `/logo.png`, `/background.jpg`).
- Row names lead with the language: "Tamil · Prime Video", "New This Week · Tamil",
  "🎙️ Tamil Dubbed · Malayalam & Hindi".
- **New This Week** rows use posters with the service tag and a "NEW · 2d" ribbon. (Wide "hero"
  banners are available in `banner.js` but switched off.)
- In the service rows, titles that arrived on that service in the last 7 days get a
  "NEW · 2d" ribbon on the poster.

## Ratings on posters

Each poster gets a small strip with its **IMDb** rating, plus the **Rotten Tomatoes** critics score
(🍅 fresh at 60%+, green splat below) on the English rows only — Rotten Tomatoes rarely reviews
Indian films, so Indian-language rows show IMDb alone. The same line goes at the top of the
description.

- **IMDb**: from IMDb's free daily ratings file (`title.ratings.tsv.gz`, personal/non-commercial
  use), downloaded at start-up and daily. No key needed.
- **Rotten Tomatoes**: from [MDBList](https://mdblist.com). Sign in there (Trakt or email), copy
  your key from **Preferences → API Access**, and add it on Render as the environment variable
  `MDBLIST_API_KEY`. The free plan allows 1,000 requests a day and each covers 10 titles; the addon
  stays under 900 a day, looks titles up in the background, and keeps scores for a week. New rows
  fill in within minutes. Without the key you get IMDb only.
- Badges are drawn by the server (text from the bundled Inter font, `assets/`) and cached; the
  ratings are part of the poster address, so a poster is re-made only when a score changes.
- Check what the server knows about a title: `/debug/ratings/movie/tt1234567`.

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

**Updates:** code changes pushed to `main` deploy automatically: `.github/workflows/deploy.yml`
calls the service's Render deploy hook, stored as the repository secret `RENDER_DEPLOY_HOOK`
(Render → service → **Settings → Deploy Hook**; GitHub → repo → **Settings → Secrets and
variables → Actions**). Without the secret, use **Manual Deploy → Deploy latest commit** on Render.

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
- `imdb-ratings.js`, `mdblist.js` — IMDb and Rotten Tomatoes ratings
- `poster.js` — posters with rating badges, service tags and NEW ribbons
- `banner.js` — wide banners for the New This Week rows
- `assets.js` — the addon's icon and background
- `justwatch.js` — reads the new-arrivals file
- `services.js` — services per country and the tick boxes
- `scripts/fetch-arrivals.js`, `scripts/fetch-dubs.js` — the GitHub job that collects new arrivals and dubbed audio tracks from JustWatch
- `dubs.js` — reads the dubbed-audio file
- `cache.js` — in-memory cache and request limiter

## To do

- **Netflix in the Tamil dubbed row.** Netflix doesn't share audio languages with JustWatch, so
  Netflix dubs (e.g. Jawan, Animal) are missing. Possible source: the uNoGS API on RapidAPI
  (Netflix catalogues per country with audio/subtitle languages; free "Basic" plan, limits to be
  confirmed). Would need a RapidAPI key on Render as `UNOGS_API_KEY`, a daily search for Netflix
  India films with Tamil audio, and merging those into `ta-dub-movie`. Don't scrape netflix.com.

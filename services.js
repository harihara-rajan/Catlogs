// Which streaming services and which tick boxes (language + country) the addon offers.
// Shared by the addon and the GitHub jobs that collect data from JustWatch (scripts/).

// Streaming services, per country: TMDB provider IDs (TMDB and JustWatch share these) and
// JustWatch package short names (for recent arrivals). Some services have several plans.
const SERVICES = {
  prime:       { name: 'Prime Video',    IN: { ids: [119], jw: ['prv'] },  US: { ids: [9], jw: ['amp'] } },
  aha:         { name: 'aha',            IN: { ids: [532], jw: ['aha'] } },
  netflix:     { name: 'Netflix',        IN: { ids: [8], jw: ['nfx'] },    US: { ids: [8, 1796], jw: ['nfx', 'nfa'] } },
  sonyliv:     { name: 'SonyLIV',        IN: { ids: [237], jw: ['snl'] } },
  sunnxt:      { name: 'Sun NXT',        IN: { ids: [309], jw: ['snx'] } },
  jiohotstar:  { name: 'JioHotstar',     IN: { ids: [2336], jw: ['jhs'] } },
  zee5:        { name: 'ZEE5',           IN: { ids: [232], jw: ['zee'] } },
  manoramamax: { name: 'ManoramaMAX',    IN: { ids: [482], jw: ['mrx'] } },
  appletv:     { name: 'Apple TV',       IN: { ids: [350], jw: ['atp'] },  US: { ids: [350], jw: ['atp'] } },
  lionsgate:   { name: 'Lionsgate Play', IN: { ids: [561], jw: ['lgp'] } },
  disney:      { name: 'Disney+',        US: { ids: [337], jw: ['dnp'] } },
  hbomax:      { name: 'HBO Max',        US: { ids: [1899], jw: ['mxx'] } },
  hulu:        { name: 'Hulu',           US: { ids: [15], jw: ['hlu'] } },
  paramount:   { name: 'Paramount+',     US: { ids: [2303, 2616], jw: ['ppp', 'ppe'] } },
  peacock:     { name: 'Peacock',        US: { ids: [386, 387], jw: ['pct', 'pcp'] } },
};

// The tick boxes on the install page, in the order their rows appear. `lang` = TMDB original
// language, `region` = country whose streaming catalogues are used, `defaultSort` = how rows are
// ordered when nothing is picked in the dropdown (Newest if not set), `newThisWeek` = also add
// "New This Week" rows (titles that arrived on any of the services in the last 7 days).
const EDITIONS = [
  { code: 'ta', name: 'Tamil', lang: 'ta', region: 'IN', types: ['movie', 'series'], newThisWeek: true,
    services: ['prime', 'aha', 'netflix', 'sonyliv', 'sunnxt', 'jiohotstar', 'zee5'] },
  { code: 'ml', name: 'Malayalam', lang: 'ml', region: 'IN', types: ['movie'], newThisWeek: true,
    services: ['prime', 'netflix', 'sonyliv', 'jiohotstar', 'zee5', 'manoramamax'] },
  { code: 'hi', name: 'Hindi', lang: 'hi', region: 'IN', types: ['movie', 'series'], newThisWeek: true,
    services: ['prime', 'netflix', 'sonyliv', 'jiohotstar', 'zee5'] },
  { code: 'en-in', name: 'English (India)', rowLabel: 'English (IN)', lang: 'en', region: 'IN', types: ['movie', 'series'], defaultSort: 'Popular',
    services: ['netflix', 'prime', 'jiohotstar', 'appletv', 'sonyliv', 'lionsgate'] },
  { code: 'en-us', name: 'English (US)', rowLabel: 'English (US)', lang: 'en', region: 'US', types: ['movie', 'series'], defaultSort: 'Popular',
    services: ['netflix', 'prime', 'disney', 'hbomax', 'hulu', 'appletv', 'paramount', 'peacock'] },
];

// Extra tick boxes for films dubbed into a language: one movies row of films originally in
// `originalLangs` that have an `audio` track on any of `services`. Which films have which audio
// tracks comes from JustWatch (scripts/fetch-dubs.js); Netflix and Sun NXT don't share that, so
// they can't be included.
const DUB_EDITIONS = [
  { code: 'ta-dub', name: 'Tamil dubbed (Malayalam & Hindi)', shortName: 'Tamil dubbed', rowName: 'Tamil Dubbed (Malayalam & Hindi)',
    audio: 'ta', originalLangs: ['ml', 'hi'], region: 'IN',
    services: ['prime', 'jiohotstar', 'sonyliv', 'zee5', 'aha'] },
];

module.exports = { SERVICES, EDITIONS, DUB_EDITIONS };

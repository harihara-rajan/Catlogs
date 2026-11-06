const JW = 'https://apis.justwatch.com/graphql';
const gql = async (query, variables) => (await (await fetch(JW, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' }, body: JSON.stringify({ query, variables }) })).json());
(async () => {
  const r = await gql(`query { packages(country: US, platform: WEB) { packageId clearName technicalName shortName monetizationTypes } }`);
  const want = /netflix|amazon prime|prime video|disney|max|hbo|hulu|apple|paramount|peacock/i;
  for (const p of r.data.packages) if (want.test(p.clearName) && /FLATRATE|ADS|FREE/.test(p.monetizationTypes)) console.log(p.packageId, p.shortName, `"${p.clearName}"`, p.monetizationTypes);
  // check a day of US Netflix additions works
  const d = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const n = await gql(`query($d: Date!) { newTitles(country: US, date: $d, first: 1, filter: { packages: ["nfx"] }, pageType: NEW, priceDrops: false) { totalCount } }`, { d });
  console.log('US netflix new yesterday:', JSON.stringify(n.data || n.errors));
})();

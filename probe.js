(async () => {
  const h = { 'user-agent': 'Mozilla/5.0', 'accept-language': 'en' };
  const page = await (await fetch('https://www.youtube.com/@ottreleasess/videos', { headers: h })).text();
  const id = (/"channelId":"(UC[\w-]{22})"/.exec(page) || /"externalId":"(UC[\w-]{22})"/.exec(page) || [])[1];
  console.log('CHANNEL', id, 'page bytes', page.length);
  if (!id) return;
  const rss = await (await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, { headers: h })).text();
  const entries = [...rss.matchAll(/<entry>[\s\S]*?<title>([^<]*)<\/title>[\s\S]*?<published>([^<]*)<\/published>[\s\S]*?<media:description>([^<]*)<\/media:description>/g)];
  for (const [, t, p, d] of entries) console.log(`VID ${p.slice(0, 10)} | ${t} || ${d.replace(/\s+/g, ' ').slice(0, 160)}`);
})();

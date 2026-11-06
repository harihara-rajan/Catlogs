const urls = [
  'https://tamil-ott-catalogs.onrender.com/poster/tt38097205/63-n/sonyliv/m58tEBZ2IKAfSeBdnZhTDmE0Nx9.jpg?v=6&n=0',
  'https://tamil-ott-catalogs.onrender.com/poster/tt33029123/78-n/zee5/9Vgmpa0tcCzkbXf9AY0zXrai1oi.jpg?v=6&n=0',
  'https://image.tmdb.org/t/p/w500/m58tEBZ2IKAfSeBdnZhTDmE0Nx9.jpg',
];
(async () => {
  let i = 0;
  for (const u of urls) {
    const b = Buffer.from(await (await fetch(u)).arrayBuffer());
    const s = b.toString('base64');
    for (let j = 0; j < s.length; j += 8000) console.log(`IMG${i} ${s.slice(j, j + 8000)}`);
    i++;
  }
})();

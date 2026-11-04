/**
 * Downloads one real product photo per catalog item into client/public/products
 * and writes server/productImages.json (product name -> /products/<file>).
 *
 * Usage (from the server folder):
 *   node scripts/fetchProductImages.js            # skip files that already exist
 *   node scripts/fetchProductImages.js --force    # re-download everything
 *
 * Sources are listed in scripts/productImageSources.json. Entries with a `page`
 * are scraped for the page's schema.org Product image; entries with `image`
 * use that URL directly.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'client', 'public', 'products');
const SOURCES = path.join(__dirname, 'productImageSources.json');
const MAP_FILE = path.resolve(__dirname, '..', 'productImages.json');
const FORCE = process.argv.includes('--force');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.text();
}

function productImageFromHtml(html) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, body] of blocks) {
    let data;
    try { data = JSON.parse(body.trim()); } catch { continue; }
    const list = Array.isArray(data) ? data : [data];
    for (const item of list) {
      if (item && item['@type'] === 'Product' && item.image) {
        return Array.isArray(item.image) ? item.image[0] : item.image;
      }
    }
  }
  return null;
}

function sizedImage(url) {
  // Rentomojo serves the same asset at several sizes; grab the 1000px version.
  return url.replace(/-(\d+)x(\d+)\.webp$/i, '-1000x1000.webp');
}

function extFromUrl(url, fallback = 'webp') {
  const m = url.split('?')[0].match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : fallback;
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://www.rentomojo.com/' } });
  if (!res.ok) throw new Error('image HTTP ' + res.status);
  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('image/')) throw new Error('not an image (' + type + ')');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) throw new Error('image too small (' + buf.length + ' bytes)');
  fs.writeFileSync(dest, buf);
  return buf.length;
}

(async () => {
  const sources = JSON.parse(fs.readFileSync(SOURCES, 'utf8'));
  const names = Object.keys(sources).filter(k => !k.startsWith('_'));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const map = {};
  const failed = [];

  for (const name of names) {
    const src = sources[name];
    const base = slug(name);
    try {
      let imageUrl = src.image;
      if (!imageUrl && src.page) {
        const html = await fetchText(src.page);
        imageUrl = productImageFromHtml(html);
        if (!imageUrl) throw new Error('no schema.org Product image on page');
        imageUrl = sizedImage(imageUrl);
        await sleep(150);
      }
      if (!imageUrl) throw new Error('no image source');

      const ext = src.ext || extFromUrl(imageUrl);
      const file = base + '.' + ext;
      const dest = path.join(OUT_DIR, file);
      const rel = '/products/' + file;

      if (!FORCE && fs.existsSync(dest) && fs.statSync(dest).size > 1024) {
        map[name] = rel;
        console.log('skip  ' + file + ' (exists)');
        continue;
      }

      const size = await download(imageUrl, dest);
      map[name] = rel;
      console.log('ok    ' + file + '  ' + Math.round(size / 1024) + ' KB');
    } catch (e) {
      failed.push(name + ' -> ' + e.message);
      console.log('FAIL  ' + name + ': ' + e.message);
    }
  }

  fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 2) + '\n');
  console.log('\nWrote ' + Object.keys(map).length + '/' + names.length + ' entries to ' + path.relative(ROOT, MAP_FILE));
  if (failed.length) {
    console.log('\nFailed:');
    failed.forEach(f => console.log('  ' + f));
    process.exitCode = 1;
  }
})();

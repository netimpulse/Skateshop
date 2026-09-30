// Step "images": renders all demo images (SVG → PNG via Playwright Chromium) into .out/images/.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCTS } from './data/catalog.mjs';
import { productImages, sectionImages } from './lib/scenes.mjs';

export const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '.out', 'images');

/** Every image the seed needs: { file, width, height, svg, alt, kind }. */
export function allImages() {
  const list = [];
  for (const p of PRODUCTS) {
    const alts = new Map(p.images.map((img) => [img.file, img.alt]));
    if (p.layer) alts.set(p.layer.file, p.layer.alt);
    for (const img of productImages(p)) list.push({ ...img, alt: alts.get(img.file), kind: img.transparent ? 'layer' : 'product', handle: p.handle });
  }
  for (const img of sectionImages()) list.push({ ...img, kind: 'section' });
  return list;
}

export const imagePath = (file) => join(OUT_DIR, file);

function loadChromium() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  const require = createRequire('/opt/node22/lib/node_modules/');
  return require('playwright').chromium;
}

export async function run({ dryRun = false, flags = {} } = {}) {
  const filter = flags.filter || null;
  const images = allImages().filter((img) => !filter || img.file.includes(filter));
  console.log(`[images] ${images.length} images → ${OUT_DIR}`);
  if (dryRun) {
    for (const img of images) console.log(`  would render ${img.file} (${img.width}×${img.height}${img.transparent ? ', transparent' : ''})`);
    return { rendered: 0 };
  }
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await loadChromium().launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    for (const img of images) {
      await page.setViewportSize({ width: img.width, height: img.height });
      await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}svg{display:block}</style></head><body>${img.svg}</body></html>`);
      await page.screenshot({ path: imagePath(img.file), omitBackground: Boolean(img.transparent), clip: { x: 0, y: 0, width: img.width, height: img.height } });
    }
  } finally {
    await browser.close();
  }
  console.log(`[images] rendered ${images.length}`);
  return { rendered: images.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { parseArgs } = await import('./lib/admin.mjs');
  await run(parseArgs());
}

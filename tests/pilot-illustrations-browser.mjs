import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '.local/pilot-media-20261105');
fs.mkdirSync(output, { recursive: true });
const report = { cases: [], errors: [], scope: 'Isolated media components with live app CSS, no learner storage or preview5184.' };
const server = await createServer({ configFile: path.join(root, 'vite.pages.config.ts'), cacheDir: path.join(output, 'vite-cache'), server: { host: '127.0.0.1', port: 0, hmr: false, forwardConsole: false }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  const base = 'http://127.0.0.1:' + server.httpServer.address().port;
  const { chromium } = process.env.PLAYWRIGHT_PACKAGE
    ? await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE, 'index.mjs')))
    : createRequire(import.meta.url)('playwright');
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const fixture = path.join(root, 'tests/fixtures/pilot-illustrations.tsx').replaceAll('\\', '/');
  const html = await server.transformIndexHtml('/__pilot-media.html', `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@fs/${fixture}"></script></body></html>`);
  const page = await browser.newPage({ viewport: { width: 320, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  page.on('pageerror', (error) => { if (!report.errors.includes(error.stack)) report.errors.push(error.stack); });
  await page.route('**/__pilot-media.html*', (route) => route.fulfill({ contentType: 'text/html', body: html }));
  for (const width of [320, 560]) for (const mode of ['free', 'authored']) {
    await page.setViewportSize({ width, height: 900 });
    for (const id of ['word-pilot-lamp-v1', 'word-pilot-grain-v1', 'scene-pilot-catfish-v1', 'scene-pilot-sled-v1', 'scene-pilot-bag-v1']) {
      await page.goto(`${base}/__pilot-media.html?id=${id}&mode=${mode}`);
      const word = id.startsWith('word-');
      const variants = word ? ['main', 'alternate', 'context'] : ['main'];
      const sources = new Set();
      for (const [index, variant] of variants.entries()) {
        if (index) {
          if (mode === 'free') await page.getByRole('button', { name: 'Посмотреть другую картинку' }).click();
          else await page.getByRole('button', { name: index === 1 ? 'Другой пример' : 'В жизни', exact: true }).click();
        }
        await page.waitForFunction(() => { const image = document.querySelector('img'); return image?.complete && image.naturalWidth > 0; });
        const geometry = await page.locator('img').evaluate((image) => {
          const rect = image.getBoundingClientRect();
          return { left: rect.left, right: rect.right, width: rect.width, height: rect.height, src: image.getAttribute('src'), currentSrc: image.currentSrc, alt: image.alt, naturalWidth: image.naturalWidth, scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth };
        });
        assert(geometry.width >= 200 && geometry.height >= 100, JSON.stringify(geometry));
        assert(geometry.left >= 0 && geometry.right <= width + 1, JSON.stringify(geometry));
        assert(geometry.scrollWidth <= width, JSON.stringify(geometry));
        assert(!sources.has(geometry.src), 'A different variant must change the source');
        sources.add(geometry.src);
        if (!word) assert.equal(await page.getByRole('button').count(), 0, 'One scene has no fake variants');
        if (mode === 'free') await page.locator('img').screenshot({ path: path.join(output, `${id}-${variant}-${width}.png`) });
        report.cases.push({ width, mode, id, variant, geometry });
      }
    }
  }
  assert.equal(report.cases.length, 36);
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.errors.push(error.stack ?? String(error));
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server.close();
  fs.writeFileSync(path.join(output, 'media-browser.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ cases: report.cases.length, errors: report.errors, report: path.join(output, 'media-browser.json') }, null, 2));
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const cache = new Map();
function load(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file);
  const result = { exports: {} };
  cache.set(file, result.exports);
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  // eslint-disable-next-line typescript/no-implied-eval -- Compile trusted local TS fixtures only.
  new Function('module', 'exports', 'require', compiled)(result, result.exports, (spec) => {
    if (!spec.startsWith('.') && !spec.startsWith('@/')) return require(spec);
    const base = spec.startsWith('@/') ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(file), spec);
    const target = [base, base.replace(/\.js$/, '') + '.ts', base.replace(/\.js$/, '') + '.tsx'].find(fs.existsSync);
    assert(target, spec);
    return load(target);
  });
  return result.exports;
}
const { illustrations, wordIllustrations, textIllustrations } = load('content/illustrations.ts');
const { pilotIllustrations, pilotStoryFrames } = load('content/illustrations-pilot.ts');
const { illustrationSources } = load('content/illustration-sources.ts');
const { illustrationMatch } = load('features/curriculum/illustration-match.ts');
const { pilotTexts } = load('content/pilot-texts.ts');
const { default: Gallery } = load('components/illustration-gallery.tsx');
const { CurriculumIllustration } = load('features/curriculum/CurriculumIllustration.tsx');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/PILOT-ILLUSTRATIONS-IMPORT.json'), 'utf8'));
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
assert.equal(manifest.sources.length, 9);
assert.equal(manifest.images.length, 21);
for (const image of manifest.images) {
  assert.equal(hash('public/' + image.src), image.sha256);
  assert.equal(fs.statSync(path.join(root, 'public', image.src)).size, image.bytes);
  assert.equal(fs.readFileSync(path.join(root, 'public', image.src)).toString('ascii', 8, 12), 'WEBP');
}
for (const source of manifest.sources) {
  // The app only requires WebP; verify local masters when they are available.
  if (fs.existsSync(path.join(root, source.path))) assert.equal(hash(source.path), source.sha256);
}
assert(manifest.sources.some((s) => s.path.endsWith('/story-sled-v2.png')));
assert(!manifest.sources.some((s) => s.path.endsWith('/story-sled.png')));
assert.equal(Object.keys(pilotIllustrations).length, 5);
for (const [id, asset] of Object.entries(pilotIllustrations)) {
  assert.deepEqual(illustrations[id], asset);
  for (const frame of Object.values(asset.variants)) {
    assert(frame.alt.length > 15);
    const entries = illustrationSources[frame.src].split(', ').map((item) => item.split(' '));
    assert.deepEqual(entries.map((item) => Number(item[1].replace('w', ''))), id.startsWith('scene-') ? [320, 560, 1120] : [320, 640]);
    for (const [src, width] of entries) {
      assert(!src.startsWith('/'), 'Subpath-safe assets');
      assert(manifest.images.some((img) => img.src === src && img.width === Number(width.replace('w', ''))));
    }
  }
}
const policy = 'text_first_optional_illustration';
for (const [word, id] of Object.entries({ МАМА: 'word-01', МУХА: 'word-03', ЛУНА: 'picture-03', СУМКА: 'word-50', ЛАМПА: 'word-pilot-lamp-v1', КРУПА: 'word-pilot-grain-v1' })) {
  assert.equal(wordIllustrations[word], id);
  assert.deepEqual(illustrationMatch({ learnerText: word, mediaPolicy: policy }), { kind: 'word', id });
  assert.equal(illustrationMatch({ learnerText: word }), null, 'No policy: no answer hint');
  assert.equal(illustrationMatch({ learnerText: word, meaningKey: 'ДРУГОЕ', mediaPolicy: policy }), null);
  const html = renderToStaticMarkup(createElement(Gallery, { assetId: id }));
  assert.match(html, /Посмотреть другую картинку/);
  assert.match(html, /Картинка 1 из 3/);
  assert.equal(new Set(Object.values(illustrations[id].variants).map((frame) => frame.src)).size, 3);
}
assert.equal(illustrationMatch({ learnerText: 'КРУПУ', mediaPolicy: policy }), null);
for (const text of pilotTexts) {
  const id = textIllustrations[text.id];
  assert(id && pilotStoryFrames[id]);
  assert.deepEqual(illustrationMatch({ learnerText: text.lines.join(' '), mediaPolicy: policy }), { kind: 'story', id });
  assert.equal(illustrationMatch({ learnerText: text.lines[0], mediaPolicy: policy }), null);
  assert.equal(illustrationMatch({ learnerText: text.lines.join(' ') + ' Ещё строка.', mediaPolicy: policy }), null);
  assert.equal(illustrationMatch({ learnerText: text.lines.join(' ') }), null);
  const html = renderToStaticMarkup(createElement(Gallery, { assetId: id }));
  assert.equal((html.match(/<img /g) ?? []).length, 1);
  assert(!html.includes('Посмотреть другую картинку'));
  assert(!html.includes('из 3'));
  for (const variant of ['main', 'alternate', 'context']) {
    const authored = renderToStaticMarkup(createElement(CurriculumIllustration, { asset: { kind: 'story', id, variant }, busy: false, onVariant() {} }));
    assert.equal((authored.match(/<img /g) ?? []).length, 1);
    assert(authored.includes(pilotStoryFrames[id][0].src));
    assert(!authored.includes('<button'));
  }
}
console.log('PASS pilot media: 9 source hashes, 21 WebP hashes/srcSets, 6 exact words, 3 exact full stories, policy guard, single-scene galleries and authored rendering.');

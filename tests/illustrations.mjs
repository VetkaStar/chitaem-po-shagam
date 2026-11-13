import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import path from 'node:path';
function load(relative) {
  const exports = {};
  const code = ts.transpile(fs.readFileSync(relative, 'utf8'), {
    module: ts.ModuleKind.CommonJS,
  });
  // eslint-disable-next-line typescript/no-implied-eval -- Compile trusted repository fixtures only.
  new Function('exports', 'require', code)(exports, (name) =>
    load(path.join(path.dirname(relative), name + '.ts')),
  );
  return exports;
}
const data = {};
Object.assign(data, load('content/illustrations.ts'));
const { illustrations, wordIllustrations, textIllustrations } = data;
const audit = JSON.parse(
  fs.readFileSync('docs/ILLUSTRATION-IMPORT.json', 'utf8'),
);
const newAudit = JSON.parse(
  fs.readFileSync('docs/NEW-ILLUSTRATIONS-IMPORT.json', 'utf8'),
);
const nextAudit = JSON.parse(
  fs.readFileSync('docs/NEXT-ILLUSTRATIONS-IMPORT.json', 'utf8'),
);
const pilotAudit = JSON.parse(fs.readFileSync('docs/PILOT-ILLUSTRATIONS-IMPORT.json', 'utf8'));
const { pilotIllustrations } = load('content/illustrations-pilot.ts');
assert.equal(Object.keys(pilotIllustrations).length, 5);
assert.equal(pilotAudit.sources.length, 9);
assert.equal(pilotAudit.images.length, 21);
for (const image of pilotAudit.images) {
  const bytes = fs.readFileSync('public/' + image.src);
  assert.equal(bytes.length, image.bytes);
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), image.sha256);
}
for (const source of pilotAudit.sources) {
  if (fs.existsSync(source.path))
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(source.path)).digest('hex'), source.sha256);
}
assert.equal(Object.keys(illustrations).length, 122);
assert.equal(Object.keys(illustrations).filter(id => !Object.hasOwn(pilotIllustrations, id)).length, 117);
for (const [id, item] of Object.entries(illustrations)) {
  const hashes = new Set();
  for (const variant of ['main', 'alternate', 'context']) {
    const image = item.variants[variant];
    assert(!image.src.startsWith('/'), 'must work under GitHub Pages subpath');
    const bytes = fs.readFileSync('public/' + image.src);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    hashes.add(hash);
    assert.equal(
      hash,
      audit.images.find((x) => x.id === id + '-' + variant)?.webpSha256 ??
        newAudit.images.find((x) => x.src === image.src)?.sha256 ??
        nextAudit.images.find((x) => x.src === image.src)?.sha256 ??
        pilotAudit.images.find((x) => x.src === image.src)?.sha256,
    );
  }
  const singleScene = ['scene-pilot-catfish-v1', 'scene-pilot-sled-v1', 'scene-pilot-bag-v1'].includes(id);
  assert.equal(hashes.size, singleScene ? 1 : 3, 'Only the three approved pilot scenes have a single variant');
}
for (const word of [
  'ДОМ',
  'КОТ',
  'ЛУНА',
  'РЫБА',
  'СЫР',
  'ЛИСА',
  'ЛИМОН',
  'БАНАН',
  'ЯБЛОКО',
  'МАШИНА',
  'ДЕРЕВО',
  'СОБАКА',
])
  assert(illustrations[wordIllustrations[word]], word);
for (const [textId, id] of Object.entries(textIllustrations))
  assert(illustrations[id] && (id.startsWith('scene-') || (textId === 'topic-story-echo' && id === 'word-01')));
assert.equal(Object.keys(textIllustrations).length, 10);
assert(wordIllustrations['МАМА'] && wordIllustrations['ПАПА']);
console.log(
  'PASS catalog: 117 original + 5 pilot groups, unchanged original checksums, 21 pilot WebP, 10 text mappings and exact variant counts',
);

assert.equal(newAudit.images.length, 174);
for (const image of newAudit.images) {
  const bytes = fs.readFileSync('public/' + image.src);
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  assert.equal(
    crypto.createHash('sha256').update(bytes).digest('hex'),
    image.sha256,
  );
}
const library = {};
// eslint-disable-next-line typescript/no-implied-eval -- Compile trusted repository fixtures only.
new Function(
  'exports',
  ts.transpile(fs.readFileSync('content/reading-library.ts', 'utf8'), {
    module: ts.ModuleKind.CommonJS,
  }),
)(library);
const sources = load('content/illustration-sources.ts');
for (const id of ['story-seed', 'story-cat', 'story-boat']) {
  const story = library.readingTexts.find((t) => t.id === id);
  assert.equal(story.lineIllustrations.length, story.lines.length);
  story.lineIllustrations.forEach((frame, i) => {
    assert(frame.src.endsWith(`${id}-${String(i + 1).padStart(2, '0')}.webp`));
    assert(fs.existsSync('public/' + frame.src));
    assert(sources.illustrationSources[frame.src].includes('1120w'));
  });
}
for (let i = 23; i <= 46; i++)
  for (const variant of ['main', 'alternate', 'context']) {
    const pic = illustrations[`word-${i}`].variants[variant];
    assert(sources.illustrationSources[pic.src].includes('640w'));
    assert(Object.values(wordIllustrations).includes(`word-${i}`));
  }
console.log(
  'PASS new package: 72 word variants, 10 ordered story frames, 174 verified adaptive assets',
);
assert.equal(nextAudit.images.length, 408);
for (const image of nextAudit.images) {
  const bytes = fs.readFileSync('public/' + image.src);
  assert.equal(bytes.length, image.bytes);
  assert.equal(
    crypto.createHash('sha256').update(bytes).digest('hex'),
    image.sha256,
  );
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
}
const next = load('content/next-illustrations.ts');
assert.equal(Object.values(next.nextStoryFrames).flat().length, 30);
for (const frames of Object.values(next.nextStoryFrames))
  for (const frame of frames) {
    assert(sources.illustrationSources[frame.src].includes('1120w'));
    assert(!/не рисовать|без букв|никаких|не добавлять/i.test(frame.alt));
  }
assert.equal(wordIllustrations['ЛИСТ'], 'word-31');
assert.equal(wordIllustrations['ЛИСТ БУМАГИ'], 'word-67');
console.log(
  'PASS next package: 159 word variants, 30 story frames, 408 verified adaptive assets',
);

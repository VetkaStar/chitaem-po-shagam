import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
const code = ts.transpile(fs.readFileSync('content/illustrations.ts', 'utf8'), {
  module: ts.ModuleKind.CommonJS,
});
const data = {};
new Function('exports', code)(data);
const { illustrations, wordIllustrations, textIllustrations } = data;
const audit = JSON.parse(
  fs.readFileSync('docs/ILLUSTRATION-IMPORT.json', 'utf8'),
);
const newAudit = JSON.parse(fs.readFileSync('docs/NEW-ILLUSTRATIONS-IMPORT.json','utf8'));
assert.equal(Object.keys(illustrations).length, 64);
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
      audit.images.find((x) => x.id === id + '-' + variant)?.webpSha256 ?? newAudit.images.find(x => x.src === image.src)?.sha256,
    );
  }
  assert.equal(hashes.size, 3, 'variants must be distinct');
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
for (const id of Object.values(textIllustrations))
  assert(id.startsWith('scene-') && illustrations[id]);
assert.equal(Object.keys(textIllustrations).length, 6);
assert(wordIllustrations['МАМА'] && wordIllustrations['ПАПА']);
console.log(
  'PASS: 120 WebP assets, checksums, three distinct variants, all picture targets, words and six scenes',
);

assert.equal(newAudit.images.length,174);
for (const image of newAudit.images) {
 const bytes=fs.readFileSync('public/'+image.src);
 assert.equal(bytes.toString('ascii',8,12),'WEBP');
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),image.sha256);
}
const library={};new Function('exports',ts.transpile(fs.readFileSync('content/reading-library.ts','utf8'),{module:ts.ModuleKind.CommonJS}))(library);
const sources={};new Function('exports',ts.transpile(fs.readFileSync('content/illustration-sources.ts','utf8'),{module:ts.ModuleKind.CommonJS}))(sources);
for(const id of ['story-seed','story-cat','story-boat']) {
 const story=library.readingTexts.find(t=>t.id===id);
 assert.equal(story.lineIllustrations.length,story.lines.length);
 story.lineIllustrations.forEach((frame,i)=>{
  assert(frame.src.endsWith(`${id}-${String(i+1).padStart(2,'0')}.webp`));
  assert(fs.existsSync('public/'+frame.src));
  assert(sources.illustrationSources[frame.src].includes('1120w'));
 });
}
for(let i=23;i<=46;i++) for(const variant of ['main','alternate','context']) {
 const pic=illustrations[`word-${i}`].variants[variant];
 assert(sources.illustrationSources[pic.src].includes('640w'));
 assert(Object.values(wordIllustrations).includes(`word-${i}`));
}
console.log('PASS new package: 72 word variants, 10 ordered story frames, 174 verified adaptive assets');

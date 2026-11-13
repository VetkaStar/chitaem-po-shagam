/** Independent pilot content checks. No app state or curriculum supply is mutated. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
export const familySpec = [
  {id:'mama',word:'МАМА',parts:['МА','МА'],unit:0},
  {id:'mukha',word:'МУХА',parts:['МУ','ХА'],unit:2},
  {id:'luna',word:'ЛУНА',parts:['ЛУ','НА'],unit:6},
  {id:'sumka',word:'СУМКА',parts:['СУМ','КА'],unit:8},
  {id:'lampa',word:'ЛАМПА',parts:['ЛАМ','ПА'],unit:11},
  {id:'krupa',word:'КРУПА',parts:['КРУ','ПА'],unit:11},
];
export const textSpec = [
  {id:'pilot-story-bag-v1',lines:['У мамы сумка.','Там крупа.'],unit:11,question:'Что в сумке?',options:['Крупа','Лампа'],answer:'Крупа'},
  {id:'pilot-story-catfish-v1',lines:['У нас сом.','У сома усы.'],unit:5,question:'У кого усы?',options:['У сома','У осы'],answer:'У сома'},
  {id:'pilot-story-sled-v1',lines:['У Иры сани.','Ира катит сани.'],unit:10,question:'Что катит Ира?',options:['Сани','Сумку'],answer:'Сани'},
];
const normalize=s=>s.toUpperCase().replace(/Ё/g,'Е').replace(/\s+/g,' ').trim();
export async function auditContent(server) {
  const load=file=>server.ssrLoadModule(path.resolve(import.meta.dirname,'..',file).replaceAll('\\','/'));
  const {levels}=await load('lib/learning.ts');
  const {availableBridges}=await load('content/word-bridges.ts');
  const {wordFamilies,availableFamilies,familyForTopic}=await load('content/word-families.ts');
  const {textsForTopic}=await load('lib/topic-texts.ts');
  assert.equal(levels.length,13,'existing topic indexes must remain unchanged');
  assert.equal(levels[12].letters.length,33,'old unit 12 remains alphabet overview');
  assert.deepEqual(wordFamilies.map(f=>f.id).sort(),familySpec.map(f=>f.id).sort());
  const families=familySpec.map(expected=>{
    const matches=availableBridges(levels[expected.unit].letters).filter(x=>x.word===expected.word);
    assert.equal(matches.length,1,`exactly one ${expected.word} bridge at unit ${expected.unit}`);
    assert.deepEqual(matches[0].parts,expected.parts);
    assert.equal(familyForTopic(expected.id,expected.unit)?.word,expected.word);
    for(let unit=0;unit<13;unit++)assert.equal(availableFamilies(unit).some(f=>f.id===expected.id),unit>=expected.unit);
    for(const target of expected.parts)assert(availableBridges(levels[expected.unit].letters,target,expected.id).every(f=>f.parts.includes(target)));
    assert.equal(matches[0].parts.join(''),matches[0].word);
    if(expected.unit)assert(!availableBridges(levels[expected.unit-1].letters).some(x=>x.word===expected.word),`${expected.word} unlocked too early`);
    return {...expected,actual:matches[0]};
  });
  const texts=textSpec.map(expected=>{
    const all=textsForTopic('stories',expected.unit);
    const matches=all.filter(x=>normalize(x.lines.join(' '))===normalize(expected.lines.join(' ')));
    assert.equal(matches.length,1,`one story: ${expected.lines.join(' ')}`);
    const item=matches[0];
    assert(item.options.includes(item.answer),`${item.id}: answer present in options`);
    assert.equal(new Set(item.options.map(normalize)).size,item.options.length,`${item.id}: distinct options`);
    assert.equal(item.id,expected.id);assert.equal(item.question,expected.question);assert.deepEqual(item.options,expected.options);
    assert.equal(normalize(item.answer),normalize(expected.answer),`${item.id}: intended literal answer`);
    assert.equal(item.questionDelivery,'adult-or-audio');assert.equal(item.keepForReview,true);
    const preparation=new Set(item.preparation.words.map(w=>w.word));
    for(const value of [...item.lines,...item.options])for(const word of value.toUpperCase().match(/[А-ЯЁ]+/g)||[])assert(preparation.has(word),`${item.id}: missing preparation ${word}`);
    for(const word of item.preparation.words)assert.equal(word.parts.join(''),word.word,`${item.id}: exact preparation assembly`);
    for(const value of [...item.lines,...item.options])for(const letter of value.toUpperCase().match(/[А-ЯЁ]/g)||[])
      assert(levels[expected.unit].letters.includes(letter),`${item.id}: unknown letter ${letter}`);
    for(let unit=expected.unit;unit<levels.length;unit++)assert(textsForTopic('stories',unit).some(x=>x.id===item.id),`${item.id}: missing from later topic ${unit}`);
    for(let unit=0;unit<expected.unit;unit++)assert(!textsForTopic('stories',unit).some(x=>x.id===item.id),`${item.id}: unlocked too early ${unit}`);
    return {...expected,item};
  });
  assert.equal(availableBridges(levels[12].letters,'ЩЁ').length,0,'no unrelated fallback');
  for(const part of ['СУМ','ЛАМ','КРУ'])assert(levels.some(l=>l.syllables.includes(part)),`${part}: available as a practiced syllable`);
  return {families,texts};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  if(process.argv.includes('--list'))console.log(JSON.stringify({familySpec,textSpec,note:'Checked against owner contracts; no browser started.'},null,2));
  else {const root=path.resolve(import.meta.dirname,'..');const server=await createServer({configFile:path.join(root,'vite.pages.config.ts'),server:{hmr:false},logLevel:'error'});
    try {console.log(JSON.stringify(await auditContent(server),null,2));}finally{await server.close();}}
}

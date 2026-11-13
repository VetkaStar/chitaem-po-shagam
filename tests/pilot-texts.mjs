import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = process.cwd();
const cache = new Map();
function load(relative) {
  let file = path.resolve(root, relative);
  if (!fs.existsSync(file)) file += '.ts';
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpile(fs.readFileSync(file, 'utf8'), {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  });
  vm.runInThisContext('(function(require,module,exports){' + code + '\n})', { filename: file })(
    id => load(path.resolve(path.dirname(file), id)), module, module.exports,
  );
  return module.exports;
}
const { pilotTexts } = load('content/pilot-texts.ts');
const { levels } = load('lib/learning.ts');
const { fitsTopic } = load('lib/topic-material.ts');
const { textsForTopic } = load('lib/topic-texts.ts');
const oldTexts = [...load('content/topic-texts.ts').topicTexts, ...load('content/reading-library.ts').readingTexts];
const wordTokens = text => text.toUpperCase().match(/[А-ЯЁ]+/g) || [];
assert.deepEqual(pilotTexts.map(t => [t.id,t.minimumUnit,t.lines]), [
  ['pilot-story-catfish-v1',5,['У нас сом.','У сома усы.']],
  ['pilot-story-sled-v1',10,['У Иры сани.','Ира катит сани.']],
  ['pilot-story-bag-v1',11,['У мамы сумка.','Там крупа.']],
]);
assert.equal(new Set([...oldTexts,...pilotTexts].map(t=>t.id)).size, oldTexts.length+3);
for (const t of pilotTexts) {
  assert.equal(t.kind,'stories');
  assert.equal(t.options.length,2);
  assert.equal(new Set(t.options).size,2);
  assert(t.options.includes(t.answer));
  assert.equal(t.questionDelivery,'adult-or-audio');
  assert.equal(t.keepForReview,true);
  for (const s of [t.title,...t.lines,...t.options]) assert(fitsTopic(s,t.minimumUnit),t.id+': '+s);
  const prepared = new Set(t.preparation.words.map(w=>w.word));
  for (const w of wordTokens([...t.lines,...t.options].join(' '))) assert(prepared.has(w),t.id+': unprepared '+w);
  for (const w of t.preparation.words) {
    assert.deepEqual(w.parts.join(''),w.word);
    assert(w.parts.every(p=>p.length>0 && fitsTopic(p,t.minimumUnit)));
  }
  for (let unit=0;unit<levels.length;unit++) {
    assert.equal(textsForTopic('stories',unit).some(x=>x.id===t.id),unit>=t.minimumUnit, t.id+' at '+unit);
  }
}
for (let unit=0;unit<levels.length;unit++) for (const kind of ['stories','sentences','poems']) {
  const eligible=oldTexts.filter(t=>t.kind===kind && [...t.lines,...t.options].every(s=>fitsTopic(s,unit)));
  const unlocked=t=>levels.findIndex((_,u)=>[...t.lines,...t.options].every(s=>fitsTopic(s,u)));
  const latest=Math.max(0,...eligible.map(unlocked));
  const expected=eligible.filter(t=>unlocked(t)>=Math.max(0,latest-2)).map(t=>t.id);
  assert.deepEqual(textsForTopic(kind,unit).filter(t=>!t.keepForReview).map(t=>t.id),expected,'old selection '+kind+' '+unit);
}
console.log('PASS 3 exact pilot texts; alphabet/preparation/answers; 39 topic-kind selections; repeat through unit 12; old IDs/selections preserved');

// Reuse the existing component-flow harness, not its scenarios. Speech and layout
// are simulated here; the root's browser acceptance remains a separate check.
const flowSource=fs.readFileSync(path.join(root,'tests/text-practice-flow.mjs'),'utf8');
const start=flowSource.indexOf('const root =');
const end=flowSource.indexOf("const hook = load('features/library/use-text-microphone.ts')");
assert(start>0 && end>start,'component-flow harness boundary');
let harness=flowSource.slice(start,end);
const exposureStub="if (p.includes('use-free-exposure')) return { useFreeExposure: () => ({ready: true, blocker: null}) };";
assert(harness.includes(exposureStub),'exposure harness boundary');
harness=harness.replace(exposureStub,"if (p.includes('use-free-exposure')) return { useFreeExposure: input => __exposure(input) };");
let preparationPending=false;
const recorded=[];
vm.runInNewContext(harness+`
const Exercise=load('features/library/TextExercise.tsx').default;
function nodes(n) { return !n ? [] : Array.isArray(n) ? n.flatMap(nodes) : typeof n !== 'object' ? [] : [n,...nodes(n.props?.children)]; }
function text(n) { return n == null ? '' : Array.isArray(n) ? n.map(text).join('') : typeof n !== 'object' ? String(n) : text(n.props?.children); }
function click(label) {
  const button=nodes(result).find(n=>n.type==='button' && text(n).trim()===label);
  assert(button,'button '+label); button.props.onClick(); flush();
}
for(const item of __pilotTexts) {
  storage.clear();
  const awards=[]; let stops=0;
  const model={stop(){stops++;},update(){},setPaused(){},awardReadingText(...a){awards.push(a);},
    settings:{motion:false,sound:false,micConsent:true,micDevice:'',unit:item.minimumUnit,textFlow:'manual',autoAdvance:false}};
  mount(()=>Exercise({item,model,onBack(){}}));
  assert(!text(result).includes(item.preparation.note),'closed preparation hides teaching material');
  click('Начать чтение с микрофоном'); assert(uiMic[2]);
  __pending(true);
  let menu=nodes(result).find(n=>n.props?.['data-text-preparation']===item.id);
  menu.props.onToggle({currentTarget:{open:true}}); flush();
  assert(stops>0); assert.equal(uiMic[2],false,'opening preparation stops microphone');
  menu=nodes(result).find(n=>n.props?.['data-text-preparation']===item.id);
  assert(!text(menu).includes(item.preparation.note),'pending preparation not displayed');
  assert(text(menu).includes('Запись подготовки'));
  assert(__recorded().some(x=>x.promptedTexts?.includes(item.preparation.note)),'record before showing');
  const visibleExposure=__recorded().find(x=>x.promptedTexts?.includes(item.preparation.note));
  for (const {word,parts} of item.preparation.words) {
    for (const target of [word,...parts]) {
      assert(visibleExposure.texts?.includes(target),'visible preparation must consume novelty: '+target);
    }
  }
  uiMic[4](); flush();
  assert(!nodes(result).some(n=>n.type==='button'&&text(n)==='Следующая строка →'),'late result blocked');
  __pending(false); flush();
  menu=nodes(result).find(n=>n.props?.['data-text-preparation']===item.id);
  assert(text(menu).includes(item.preparation.note));
  assert.equal(awards.length,0,'preparation gives no completion');
  assert(nodes(result).find(n=>n.props?.className==='text-task-controls').props.inert);
  menu.props.onToggle({currentTarget:{open:false}}); flush();
  assert.equal(uiMic[2],false,'closing preparation does not silently restart microphone');
  click('Начать чтение с микрофоном'); uiMic[4](); flush();
  click('Следующая строка →'); uiMic[4](); flush(); click('Завершить →');
  assert.equal(awards.at(-1)[0],item.id+':read');
  click('Отвечаю');
  assert(text(result).includes('Взрослый/диктор: '+item.question));
  click(item.options.find(x=>x!==item.answer)); assert.equal(awards.length,1);
  click(item.answer); assert.equal(awards.at(-1)[0],item.id+':questions');
  click('Пишу');
  for(let i=0;i<item.lines.length;i++) {
    const input=nodes(result).find(n=>n.type==='textarea'); assert(input);
    input.props.onChange({target:{value:item.lines[i]}}); flush();
    click('Проверить · Enter');
    click(i+1<item.lines.length?'Следующая строка →':'Завершить →');
  }
  assert.equal(awards.at(-1)[0],item.id+':write'); assert.equal(awards.length,3);
}
console.log('PASS all 3 texts in reading/questions/writing; preparation save barrier; no preparation reward; microphone and late-result gate; adult question label with sound off');
const Library=load('features/library/TextLibrary.tsx').default;
let stops=0;
const model={settings:{unit:11,motion:false},stars:0,stop(){stops++;},update(k,v){this.settings[k]=v;}};
mount(()=>Library({kind:'stories',model}));
const session=()=>nodes(result).find(n=>n.type?.name==='TopicTextSession').props.micSession;
const topic=()=>nodes(result).find(n=>n.props?.onSelect&&n.props?.nextLabel).props;
session().current=true; const same=session(); flush(); assert.equal(session(),same);
topic().onSelect(5); flush(); assert.equal(session().current,false); assert.notEqual(session(),same);
session().current=true; topic().onNext(); flush(); assert.equal(session().current,false);
session().current=true; topic().onPrevious(); flush(); assert.equal(session().current,false);
session().current=true; model.stop(); model.update('unit',0); flush(); assert.equal(session().current,false);
assert.equal(stops,4);
console.log('PASS actual TopicBar select/next/previous handlers and external topic change reset microphone intent; same-topic continuation preserved');
`,{require,ts,assert,fs,path,vm,console,__pilotTexts:pilotTexts,
  __pending:v=>{preparationPending=v;},__recorded:()=>recorded,
  __exposure:input=>{
    recorded.push(input);
    const preparation=input.promptedTexts?.some(s=>pilotTexts.some(t=>t.preparation.note===s));
    return {ready:!(preparation&&preparationPending),blocker:'Запись подготовки'};
  },
});

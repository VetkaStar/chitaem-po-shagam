import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../public/games/lemonade-live.html',import.meta.url),'utf8');
const context={window:{}};vm.runInNewContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1],context);const F=context.window.LiveFactory;
for(let d=0;d<3;d++){const s=F.create(d);F.reference(s);const initial=s.coins;for(let i=0;i<5000&&s.order<3;i++)F.step(s);assert.equal(s.order,3,`Difficulty ${d} completes all contracts`);assert(s.coins>initial);assert(s.tokens.length<=96);assert(s.board.every(p=>!p||Object.values(p.store).every(n=>n>=0&&n<=6)));const restored=F.restore(JSON.parse(JSON.stringify(s)));assert(restored);assert.equal(restored.sold,s.sold);assert.equal(restored.coins,s.coins);assert.equal(restored.tokens.length,0);assert(restored.paused);}
const s=F.create();const original=s.coins;assert(!F.put(s,12,'belt'));assert(!F.put(s,-1,'belt'));assert(F.put(s,13,'juicer'));assert.equal(s.coins,original-12);assert(F.upgrade(s,13));assert(F.upgrade(s,13));assert(!F.upgrade(s,13));assert(F.put(s,13,null));assert.equal(s.coins,original,'Demolition refunds purchase and upgrades');
assert(F.put(s,1,'belt'));const spent=s.coins;assert(F.put(s,1,'belt',2));assert.equal(s.coins,spent,'Rotation is free');s.paused=true;const tick=s.tick;F.step(s);assert.equal(s.tick,tick);
const blocked=F.create();for(let i=0;i<200;i++)F.step(blocked);assert.equal(blocked.tokens.length,2,'Blocked supplies cannot overflow the world');
const poor=F.create();poor.coins=0;assert(!F.put(poor,5,'bottler'));assert.equal(poor.board[5],null);
assert.equal(F.restore({version:1}),null);const bad=JSON.parse(JSON.stringify(s));bad.board[1].kind='unknown';assert.equal(F.restore(bad),null);
console.log('Live factory: all 3 difficulties, recipes, orders, backpressure, costs, upgrades, refunds, pause and restore passed.');

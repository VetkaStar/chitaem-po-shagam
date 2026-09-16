import assert from 'node:assert/strict';
import fs from 'node:fs';
import {factoryLevel,factoryState,factoryStep,railLevel,railState,railStep,robotLevel,robotState,robotStep} from '../public/games/trio/models.js';
for(let id=0;id<6;id++){
 const f=factoryLevel(id);let s=factoryState(f);for(let i=0;i<100&&s.status==='running';i++)s=factoryStep(f,f.solution,s);assert.equal(s.status,'won',`Factory ${id}: ${s.message}`);assert.equal(s.delivered,3);
 let empty=factoryStep(f,Array(35).fill(null),factoryState(f));assert.equal(empty.status,'failed');const wrong=structuredClone(f.solution);const paint=wrong.findIndex(p=>p?.kind===f.target.color);wrong[paint].kind=f.target.color==='red'?'blue':'red';s=factoryState(f);for(let i=0;i<100&&s.status==='running';i++)s=factoryStep(f,wrong,s);assert.equal(s.status,'failed');
 const r=robotLevel(id);let bot=robotState(r);for(let i=0;i<240&&bot.status==='running';i++)bot=robotStep(r,r.solution,true,bot);assert.equal(bot.status,'won',`Robot ${id}: ${bot.message}`);assert.equal(bot.delivered,r.needed);assert.equal(robotStep(r,[],false,robotState(r)).status,'failed');assert.equal(robotStep(r,[{op:'N',n:6}],false,{...robotState(r),cell:0}).status,'failed');
 const train=railLevel(id);let rail=railState(train),switches=[false,false];for(let tick=0;tick<12000&&rail.status==='running';tick++){
  for(const node of [1,4]){const approaching=rail.trains.filter(t=>t.to===node).sort((a,b)=>b.p-a.p)[0];if(approaching)switches[node===1?0:1]=node===1?approaching.cargo===0:approaching.cargo===2;}
  rail=railStep(train,rail,switches,.02);
 }assert.equal(rail.status,'won',`Rail ${id}`);assert.equal(rail.delivered,train.total);assert.equal(rail.lives,train.lives);
 let failed=railState(train);for(let tick=0;tick<12000&&failed.status==='running';tick++)failed=railStep(train,failed,[false,false],.02);assert.equal(failed.status,'failed');
}
const f=factoryLevel(4),noCut=structuredClone(f.solution);noCut[f.path[1]].kind='belt';let s=factoryState(f);for(let n=0;n<10&&s.status==='running';n++)s=factoryStep(f,noCut,s);assert.equal(s.status,'failed');assert.match(s.message,/квадрат/);
for(const name of ['factory-music','train-music','robot-music','tap','place','switch','delivery','fail','win']){const b=fs.readFileSync(`public/games/trio/assets/${name}.wav`);assert.equal(b.toString('ascii',0,4),'RIFF');let peak=0,energy=0;for(let i=44;i<b.length;i+=2){const v=b.readInt16LE(i);peak=Math.max(peak,Math.abs(v));energy+=v*v;}assert(peak>1000&&peak<32767);assert(energy>0);}
console.log('Trio: all 18 levels solved; bad routes, materials, robot limits, dispatch failures and nine non-silent audio assets verified.');

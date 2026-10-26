/** Sound-enabled layout and short-letter coverage. Audio is not played.
 * QA_PHASE selects the report iteration (default: final-audio).
 * --list starts no server/browser. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { harness, metrics, root, settle } from './task-card-layout-browser.mjs';

const matrix=['order','focus'].flatMap(layout=>['plain','notebook'].flatMap(look=>
  [[1280,720],[820,1180],[390,844]].map(([width,height])=>
    ({layout,look,width,height,interfaceScale:100,sound:true}))));
const letters=matrix.flatMap(c=>[false,true].flatMap(sound=>['sounds','alphabet'].map(letterMode=>
  ({...c,sound,letterMode,letterCase:'both',unit:0}))));
const nameOf=c=>`${c.layout}-${c.look}-${c.width}x${c.height}-sound-${c.sound?'on':'off'}${c.letterMode?'-'+c.letterMode+'-both':''}`;
const cases=[...matrix.flatMap(config=>['lesson','composition'].map(area=>({config,area}))),
  ...letters.map(config=>({config,area:'letters'}))];
const plan={lesson:matrix.map(nameOf),composition:matrix.map(nameOf),letters:letters.map(nameOf),
  limits:['syllable/composition sound:true; letters sound:true/false; autoSpeech:false; speech is not played',
    'real typed-answer and composition logic; microphone UI fixture does not test real ASR'],
  assertions:['frame and primary stable within 2px','primary and audio buttons visible and hit-testable',
    'short read/type/WordBridge/composition fit without inner scrolling','typed answer and selected part survive hint']};
if(process.argv.includes('--list')) console.log(JSON.stringify(plan,null,2));
else {
  process.env.QA_PHASE=process.env.QA_PHASE || 'final-audio';
  const h=await harness('audio','tests/fixtures/task-card-layout.tsx');
  const files=['app/globals.css','features/lesson/ExerciseCard.tsx','features/lesson/ExerciseActions.tsx',
    'features/lesson/ExerciseFeedback.tsx','features/lesson/WordBridge.tsx',
    'features/trainers/TrainerExerciseCard.tsx','features/portal/AppPortal.tsx',
    'features/lesson/LetterDisplay.tsx','features/lesson/TaskCardBody.tsx'];
  const snapshot=()=>Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
  h.report.audioSourceBefore=snapshot();h.report.plan=plan;h.report.limits.push(...plan.limits);
  const bank=JSON.parse(fs.readFileSync(path.join(root,'content/curriculum/curriculum.json'),'utf8'));
  const ready=async p=>{await p.waitForFunction(()=>!document.querySelector('.free-material.is-pending, .syllable-parts-exercise[aria-busy="true"]'));await settle(p);};
  try {
    for(const {config,area} of cases) {
      const c={name:`${nameOf(config)}-${area}`,config,states:[],failures:[]};h.report.cases.push(c);
      const p=await h.page(config);
      const check=(ok,message)=>{if(!ok)c.failures.push(message);};
      async function capture(name,reference,{short=false,audio=false,sample=false}={}) {
        const m=await metrics(p);
        const buttons=await p.locator('.task-card button').evaluateAll(elements=>elements
          .filter(el=>el.checkVisibility() && /Послушать|Озвучить/.test(el.getAttribute('aria-label')||el.textContent))
          .map(el=>{
            const r=el.getBoundingClientRect(),cx=(r.left+r.right)/2,cy=(r.top+r.bottom)/2;
            return {label:el.getAttribute('aria-label')||el.textContent.trim(),
              rect:{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height},
              hit:[[cx,cy],[cx,r.top+3],[r.right-3,cy],[cx,r.bottom-3],[r.left+3,cy]].map(([x,y])=>{
                const top=document.elementFromPoint(x,y);return !!top && (top===el||el.contains(top));})};
          }));
        c.states.push({name,...m,audioButtons:buttons});
        check(m.frame && m.frame.x>=-1 && m.frame.y>=-1 && m.frame.right<=config.width+1 && m.frame.bottom<=config.height+1,`${name}: frame outside viewport`);
        check(m.button && m.button.y>=-1 && m.button.bottom<=config.height+1 && m.buttonHit.length===5 && m.buttonHit.every(Boolean),`${name}: primary outside viewport or covered`);
        check(m.scroll.width<=config.width+1,`${name}: horizontal overflow`);
        if(reference)for(const key of ['frame','button'])for(const axis of ['x','y','width','height'])
          check(!!m[key] && !!reference[key] && Math.abs(m[key][axis]-reference[key][axis])<=2,`${name}: ${key}.${axis} moved or absent`);
        if(short)for(const body of m.clip.filter(x=>String(x.className).includes('task-card-body')))
          check(body.scrollHeight<=body.height+2,`${name}: short task needs inner scrolling ${body.height}/${body.scrollHeight}`);
        if(audio)check(buttons.length>0,`${name}: sound-enabled audio controls absent`);
        if(sample)check(buttons.some(b=>b.label.includes('Послушать образец')),`${name}: sample audio control absent`);
        for(const b of buttons)check(b.rect.x>=-1 && b.rect.y>=-1 && b.rect.right<=config.width+1 && b.rect.bottom<=config.height+1 && b.hit.every(Boolean),`${name}: audio control clipped or covered: ${b.label}`);
        if(area==='letters') {
          const textGeometry=await p.evaluate(()=>{
            const output=[];
            for(const el of document.querySelectorAll('.letter-display .reading, .letter-display p, .sound-note, .feedback span')) {
              if(!el.checkVisibility())continue;
              const range=document.createRange();range.selectNodeContents(el);
              const rects=[...range.getClientRects()].map(r=>({x:r.x,y:r.y,right:r.right,bottom:r.bottom}));
              const clipped=[];
              for(let ancestor=el;ancestor;ancestor=ancestor.parentElement) {
                const cs=getComputedStyle(ancestor),r=ancestor.getBoundingClientRect();
                if(rects.some(t=>(/hidden|clip|auto|scroll/.test(cs.overflowX)&&(t.x<r.x-2||t.right>r.right+2))||
                  (/hidden|clip|auto|scroll/.test(cs.overflowY)&&(t.y<r.y-2||t.bottom>r.bottom+2))))clipped.push(ancestor.className);
              }
              output.push({className:el.className,text:el.textContent,rects,clipped});
            }
            return output;
          });
          c.states.at(-1).textGeometry=textGeometry;
          check(textGeometry.length>0,`${name}: no visible letter/feedback text measured`);
          for(const t of textGeometry)check(!t.clipped.length && t.rects.every(r=>r.x>=-1 && r.y>=-1 && r.right<=config.width+1 && r.bottom<=config.height+1),`${name}: text clipped: ${t.text}`);
        }
        await p.screenshot({path:path.join(h.output,`${c.name}-${name}.png`)});
        return m;
      }
      try {
        check(await p.evaluate(sound=>window.qaLesson.settings.sound===sound,config.sound),'sound setting differs from scenario');
        if(area==='letters') {
          await p.getByRole('button',{name:'Начать занятие →',exact:true}).click();await ready(p);
          await p.evaluate(()=>window.qaLesson.navigate('letters','read'));await ready(p);
          check(await p.evaluate(()=>window.qaLesson.settings.letterCase==='both'),'both letter cases not selected');
          c.targets=[];
          // The first complete real unit-0 deck contains A, U and M once each.
          for(let step=0;step<3;step++) {
            c.targets.push(await p.evaluate(()=>window.qaLesson.target));
            const read=await capture(`letter-${step+1}`,null,{short:true,audio:config.sound});
            if(step===0) {
              await p.getByRole('button',{name:'Подсказка',exact:true}).click();await ready(p);
              await capture('letter-hint',read,{audio:config.sound});
              await p.getByRole('button',{name:'Скрыть подсказку',exact:true}).click();await ready(p);
            }
            if(step<2){await p.evaluate(()=>window.qaLesson.next(true));await ready(p);}
          }
          check(c.targets.includes('У'),'real letter deck did not cover У');
          await p.evaluate(()=>window.qaLesson.navigate('letters','type'));await ready(p);
          const type=await capture('letter-type',null,{short:true,audio:config.sound});
          const input=p.getByRole('textbox',{name:'Твой ответ'});
          await input.fill('ЖЖЖ');await input.press('Enter');await ready(p);
          check(await p.evaluate(()=>window.qaLesson.feedback.kind)!=='success','wrong letter accepted');
          await capture('letter-error',type,{short:true,audio:config.sound});
          await p.getByRole('button',{name:'Повторить задание',exact:true}).click();await ready(p);
          await input.fill(await p.evaluate(()=>window.qaLesson.target));await input.press('Enter');await ready(p);
          check(await p.evaluate(()=>window.qaLesson.feedback.kind)==='success','correct letter not accepted');
          await capture('letter-success',type,{short:true,audio:config.sound});
        }else if(area==='lesson') {
          await p.getByRole('button',{name:'Начать занятие →',exact:true}).click();await ready(p);
          const read=await capture('read',null,{short:true,audio:true});
          for(const state of ['loading','listening','waiting','error','off']) {
            await p.evaluate(s=>window.qaMic(s),state);await ready(p);
            await capture(`mic-${state}`,read,{short:true,audio:true});
          }
          await p.getByRole('button',{name:'Подсказка',exact:true}).click();await ready(p);
          await capture('read-hint',read,{audio:true});
          await p.getByRole('button',{name:'Скрыть подсказку',exact:true}).click();await ready(p);
          await p.evaluate(()=>window.qaLesson.navigate('syllables','type'));await ready(p);
          const type=await capture('type',null,{short:true,audio:true});
          const input=p.getByRole('textbox',{name:'Твой ответ'});await input.fill('А');
          await p.getByRole('button',{name:'Подсказка',exact:true}).click();await ready(p);
          await capture('type-hint',type,{audio:true});
          await p.getByRole('button',{name:'Скрыть подсказку',exact:true}).click();await ready(p);
          check(await input.inputValue()==='А','hint lost typed answer');
          for(let step=0;step<2;step++) {
            await input.fill(await p.evaluate(()=>window.qaLesson.target));await input.press('Enter');await ready(p);
            check(await p.evaluate(()=>window.qaLesson.feedback.kind)==='success','correct answer not accepted');
            if(step===0){await p.getByRole('button',{name:/Дальше.*Enter/}).click();await ready(p);}
          }
          const bridge=p.getByRole('region',{name:'Из слогов в слово'});await bridge.waitFor();
          await capture('bridge',type,{short:true,audio:true});
          const parts=(await bridge.locator('.task-instruction b').textContent()).split(' · ');
          for(const part of parts)await bridge.getByRole('button',{name:part,exact:true}).and(p.locator('button:enabled')).first().click();
          await ready(p);await bridge.getByRole('button',{name:'Послушать слово',exact:true}).waitFor();
          await capture('bridge-complete',type,{short:true,audio:true});
        }else {
          await p.locator('.portal-grid').getByRole('button',{name:/ШАГ 2 Слоги/}).click();
          await p.locator('.portal-grid').getByRole('button',{name:'Состав слога',exact:true}).click();
          await p.locator('.syllable-parts-exercise').waitFor();await ready(p);
          const initial=await capture('initial',null,{short:true,audio:true,sample:true});
          const itemId=await p.evaluate(()=>new Promise((resolve,reject)=>{
            const open=indexedDB.open('reading-platform-v1');open.onerror=()=>reject(open.error);
            open.onsuccess=()=>{const db=open.result,q=db.transaction('state').objectStore('state').get('local');
              q.onsuccess=()=>{resolve(q.result.profile.activeInstance.itemId);db.close();};q.onerror=()=>{reject(q.error);db.close();};};
          }));
          const parts=bank.items[itemId].partTokens;
          // Accessible labels include "Часть N:"; match the visible token exactly,
          // as the established composition regression does.
          const choose=async part=>p.locator('.curriculum-token-bank button:enabled').filter({hasText:new RegExp('^'+part.text+'$')}).first().click();
          await choose(parts[0]);const chosen=await p.locator('.curriculum-composition').innerText();
          await p.getByRole('button',{name:'Подсказка',exact:true}).click();await ready(p);
          await capture('hint',initial,{audio:true});
          await p.getByRole('button',{name:'Скрыть подсказку',exact:true}).click();await ready(p);
          check(await p.locator('.curriculum-composition').innerText()===chosen,'hint lost chosen part');
          for(const part of parts.slice(1))await choose(part);
          await p.locator('.syllable-parts-exercise button[type="submit"]').click();
          await p.locator('.feedback.success').waitFor();await ready(p);
          await capture('success',initial,{audio:true});
        }
      }catch(e){c.failures.push(`scenario aborted: ${e.message}`);await p.screenshot({path:path.join(h.output,`${c.name}-aborted.png`)});}
      finally {await p.close();fs.writeFileSync(path.join(h.output,'in-progress.json'),JSON.stringify(h.report,null,2));}
    }
  }finally {
    h.report.audioSourceAfter=snapshot();h.report.audioSourcesChanged=JSON.stringify(h.report.audioSourceBefore)!==JSON.stringify(h.report.audioSourceAfter);
    await h.close();
    if(h.report.errors.length || h.report.cases.some(c=>c.failures.length) || h.report.sourcesChanged || h.report.audioSourcesChanged)process.exitCode=1;
  }
}

/** Separate extension: original matrix and its assertions are not modified.
 * QA_PHASE optionally selects the report iteration (default: final-scale).
 * --list validates the planned matrix without starting a server/browser. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { harness, matrix, metrics, root, settle } from './task-card-layout-browser.mjs';

const largeScales=['order','focus'].flatMap(layout=>['plain','notebook'].flatMap(look=>
  [140,160].map(interfaceScale=>({layout,look,width:1920,height:1080,interfaceScale}))));
const adultCases=[...matrix,...largeScales];
const nameOf=c=>`${c.layout}-${c.look}-${c.width}x${c.height}-${c.interfaceScale}`;
const plan={adult:adultCases.map(nameOf),largeScale:largeScales.map(nameOf),
  assertions:['unchanged frame and primary bounds <=2px','full viewport and five hit-test points',
    'all visible shelf/adult buttons reachable','no button overlaps','actual configured zoom',
    'pointer and keyboard open/close adult-check','typed answer survives hint',
    'read and type short task fit without inner scrolling','mock microphone states preserve geometry']};
if(process.argv.includes('--list')) {
  console.log(JSON.stringify(plan,null,2));
} else {
  process.env.QA_PHASE=process.env.QA_PHASE || 'final-scale';
  const h=await harness('extension','tests/fixtures/task-card-layout.tsx');
  const sourceFiles=['app/globals.css','features/lesson/ExerciseCard.tsx','features/lesson/ExerciseActions.tsx',
    'features/lesson/ExerciseFeedback.tsx','features/trainers/TrainerExerciseCard.tsx',
    'features/library/TextExercise.tsx','features/portal/AppPortal.tsx','features/free-practice/FreeExposureFrame.tsx'];
  const snapshot=()=>Object.fromEntries(sourceFiles.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
  h.report.extensionSourceBefore=snapshot();
  h.report.plan=plan;
  const ready=async p=>{await p.waitForFunction(()=>!document.querySelector('.free-material.is-pending'));await settle(p);};
  async function controls(p) {
    return p.evaluate(()=>{
      const box=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
      const visible=el=>{
        const r=el.getBoundingClientRect(),cs=getComputedStyle(el);
        return r.width>0 && r.height>0 && cs.visibility==='visible' &&
          !(el.closest('details:not([open])') && !el.closest('summary'));
      };
      const buttons=[...document.querySelectorAll('.task-card-actions button, .task-card-actions summary, .task-card .task-card-primary')]
        .filter(visible).map(el=>{
          const r=box(el),cx=r.x+r.width/2,cy=r.y+r.height/2;
          const hit=[[cx,cy],[cx,r.y+3],[r.right-3,cy],[cx,r.bottom-3],[r.x+3,cy]].map(([x,y])=>{
            const top=document.elementFromPoint(x,y);return !!top && (top===el || el.contains(top));});
          return {label:el.getAttribute('aria-label') || el.textContent.trim(),disabled:!!el.disabled,rect:r,hit};
        });
      const overlaps=[];
      for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++) {
        const a=buttons[i].rect,b=buttons[j].rect;
        const width=Math.min(a.right,b.right)-Math.max(a.x,b.x),height=Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y);
        if(width>2 && height>2)overlaps.push({a:buttons[i].label,b:buttons[j].label,width,height});
      }
      const chain=[];for(let el=document.querySelector('.task-card');el;el=el.parentElement)
        chain.push({tag:el.tagName,className:el.className,zoom:Number(getComputedStyle(el).zoom)||1});
      const panel=document.querySelector('.adult-check[open] .task-card-adult-panel');
      return {buttons,overlaps,panel:panel?box(panel):null,zoomChain:chain,
        effectiveZoom:chain.reduce((product,e)=>product*e.zoom,1),
        interfaceScale:document.documentElement.dataset.interfaceScale};
    });
  }
  try {
    for(const config of adultCases) {
      const c={name:`${nameOf(config)}-adult`,config,states:[],failures:[]};h.report.cases.push(c);
      const p=await h.page(config);
      const check=(ok,message)=>{if(!ok)c.failures.push(message);};
      async function capture(name,reference) {
        const m=await metrics(p),detail=await controls(p);c.states.push({name,...m,controls:detail});
        check(m.frame && m.frame.x>=-1 && m.frame.y>=-1 && m.frame.right<=config.width+1 && m.frame.bottom<=config.height+1,`${name}: frame outside viewport`);
        check(m.button && m.button.y>=-1 && m.button.bottom<=config.height+1 && m.buttonHit.length===5 && m.buttonHit.every(Boolean),`${name}: primary outside viewport or covered`);
        check(m.scroll.width<=config.width+1,`${name}: horizontal overflow`);
        check(detail.interfaceScale===String(config.interfaceScale),`${name}: saved scale differs`);
        check(Math.abs(detail.effectiveZoom-config.interfaceScale/100)<0.01,`${name}: effective zoom ${detail.effectiveZoom} differs`);
        for(const b of detail.buttons) {
          check(b.rect.x>=-1 && b.rect.y>=-1 && b.rect.right<=config.width+1 && b.rect.bottom<=config.height+1,`${name}: ${b.label} outside viewport`);
          check(b.hit.every(Boolean),`${name}: ${b.label} clipped or covered`);
        }
        check(!detail.overlaps.length,`${name}: buttons overlap: ${detail.overlaps.map(o=>o.a+' / '+o.b).join('; ')}`);
        if(detail.panel) check(detail.panel.x>=-1 && detail.panel.y>=-1 && detail.panel.right<=config.width+1 && detail.panel.bottom<=config.height+1,`${name}: adult panel outside viewport`);
        if(reference)for(const key of ['frame','button'])for(const axis of ['x','y','width','height'])
          check(!!m[key] && Math.abs(m[key][axis]-reference[key][axis])<=2,`${name}: ${key}.${axis} moved or absent`);
        await p.screenshot({path:path.join(h.output,`${c.name}-${name}.png`)});
        return m;
      }
      try {
        await p.getByRole('button',{name:'Начать занятие →',exact:true}).click();await ready(p);
        const initial=await capture('closed');
        const summary=p.locator('.adult-check > summary');
        await summary.click();await p.locator('.adult-check[open]').waitFor();
        const opened=await capture('pointer-open',initial);
        for(const label of ['Получилось','Нужна помощь'])
          await p.locator('.adult-check').getByRole('button',{name:label,exact:true}).click({trial:true,timeout:2000});
        await p.locator('.task-card-adult-panel').evaluate(el=>{el.scrollTop=el.scrollHeight;});
        await capture('panel-scroll',opened);
        await summary.click();await p.locator('.adult-check[open]').waitFor({state:'detached'});await capture('pointer-close',initial);
        await summary.focus();await p.keyboard.press('Enter');await p.locator('.adult-check[open]').waitFor();
        await capture('keyboard-open',initial);
        await p.keyboard.press('Tab');
        check(await p.getByRole('button',{name:'Получилось',exact:true}).evaluate(el=>el===document.activeElement),'Tab from adult summary did not focus first result');
        await summary.focus();await p.keyboard.press('Enter');await p.locator('.adult-check[open]').waitFor({state:'detached'});
        await capture('keyboard-close',initial);
      }catch(e){c.failures.push(`scenario aborted: ${e.message}`);await p.screenshot({path:path.join(h.output,`${c.name}-aborted.png`)});}
      finally{await p.close();}
    }
    for(const config of largeScales) {
      const c={name:`${nameOf(config)}-states`,config,states:[],failures:[]};h.report.cases.push(c);
      const p=await h.page(config);
      const check=(ok,message)=>{if(!ok)c.failures.push(message);};
      async function capture(name,reference,shortTask=false) {
        const m=await metrics(p);c.states.push({name,...m});
        check(m.frame && m.frame.x>=-1 && m.frame.y>=-1 && m.frame.right<=config.width+1 && m.frame.bottom<=config.height+1,`${name}: frame outside viewport`);
        check(m.button && m.button.y>=-1 && m.button.bottom<=config.height+1 && m.buttonHit.length===5 && m.buttonHit.every(Boolean),`${name}: primary outside viewport or covered`);
        check(m.scroll.width<=config.width+1,`${name}: horizontal overflow`);
        if(reference)for(const key of ['frame','button'])for(const axis of ['x','y','width','height'])
          check(!!m[key] && Math.abs(m[key][axis]-reference[key][axis])<=2,`${name}: ${key}.${axis} moved or absent`);
        if(shortTask)for(const body of m.clip.filter(el=>el.className==='task-card-body'))
          check(body.scrollHeight<=body.height+2,`${name}: short task needs inner scrolling`);
        if(['read','type','hint','bridge','completion'].includes(name))await p.screenshot({path:path.join(h.output,`${c.name}-${name}.png`)});
        return m;
      }
      try {
        await p.getByRole('button',{name:'Начать занятие →',exact:true}).click();await ready(p);
        const read=await capture('read',null,true);
        for(const state of ['loading','listening','waiting','error','off']){await p.evaluate(s=>window.qaMic(s),state);await capture(`mic-${state}`,read,true);}
        await p.getByRole('button',{name:'Подсказка',exact:true}).click();await ready(p);await capture('read-hint',read);
        await p.getByRole('button',{name:'Скрыть подсказку',exact:true}).click();await ready(p);
        await p.evaluate(()=>window.qaLesson.navigate('syllables','type'));await ready(p);
        const type=await capture('type',null,true),input=p.getByRole('textbox',{name:'Твой ответ'});
        await input.fill('А');await p.getByRole('button',{name:'Подсказка',exact:true}).click();await ready(p);await capture('hint',type);
        await p.getByRole('button',{name:'Скрыть подсказку',exact:true}).click();await ready(p);
        check(await input.inputValue()==='А','hint lost typed answer');
        await input.fill('ЖЖЖ');await input.press('Enter');await ready(p);await capture('wrong',type);
        check(await p.evaluate(()=>window.qaLesson.feedback.kind)!=='success','wrong answer accepted');
        await p.getByRole('button',{name:'Повторить задание',exact:true}).click();await ready(p);await capture('repeat',type);
        for(let step=0;step<3;step++) {
          await input.fill(await p.evaluate(()=>window.qaLesson.target));await input.press('Enter');await ready(p);
          check(await p.evaluate(()=>window.qaLesson.feedback.kind)==='success','correct answer not accepted');
          await capture(`success-${step+1}`,type);
          const bridge=p.getByRole('region',{name:'Из слогов в слово'});
          if(await bridge.count()) {
            await capture('bridge',type,true);
            const parts=(await bridge.locator('.task-instruction b').textContent()).split(' · ');
            for(const part of parts)await bridge.getByRole('button',{name:part,exact:true}).and(p.locator('button:enabled')).first().click();
            await ready(p);
          }
          await p.getByRole('button',{name:/Дальше.*Enter/}).click();await ready(p);
        }
        check(await p.evaluate(()=>window.qaLesson.done),'completion not reached');await capture('completion',type);
      }catch(e){c.failures.push(`scenario aborted: ${e.message}`);await p.screenshot({path:path.join(h.output,`${c.name}-aborted.png`)});}
      finally{await p.close();}
    }
  } finally {
    h.report.extensionSourceAfter=snapshot();
    h.report.extensionSourcesChanged=JSON.stringify(h.report.extensionSourceBefore)!==JSON.stringify(h.report.extensionSourceAfter);
    await h.close();
    if(h.report.errors.length || h.report.cases.some(c=>c.failures.length) || h.report.sourcesChanged || h.report.extensionSourcesChanged)process.exitCode=1;
  }
}

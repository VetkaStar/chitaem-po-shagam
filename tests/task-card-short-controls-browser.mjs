import path from 'node:path';
import { harness, settle } from './task-card-layout-browser.mjs';

process.env.QA_PHASE = process.env.QA_PHASE || 'v4-controls';
const h = await harness('controls', 'tests/fixtures/task-card-layout.tsx');
const ready = async p => {
  await p.waitForFunction(() => !document.querySelector('.free-material.is-pending'));
  await p.evaluate(() => document.fonts.ready);
  await settle(p);
};
try {
  for (const [width,height] of [[1280,720],[390,844]]) for (const layout of ['order','focus']) {
    const p=await h.page({width,height,layout,look:'plain',interfaceScale:100,unit:12});
    await p.emulateMedia({reducedMotion:'no-preference'});
    await p.getByRole('button',{name:'Начать занятие →',exact:true}).click();await ready(p);
    for (const stage of ['letters','syllables','words','pictures-free','pictures-letters']) {
      const c={name:`${layout}-${width}-${stage}`,failures:[]};h.report.cases.push(c);
      try {
        await p.evaluate(stage=>{
          window.qaLesson.update('motion',true);
          if(stage.startsWith('pictures'))window.qaLesson.update('pictureMode',stage.endsWith('letters')?'letters':'free');
          window.qaLesson.navigate(stage.startsWith('pictures')?'pictures':stage,stage.startsWith('pictures')?'type':'fly');
        },stage);await ready(p);
        // Initial visibility must hold without relying on autofocus scrolling.
        await p.locator('.task-card-body').evaluate(e=>{e.scrollTop=0;});
        c.geometry=await p.locator('.task-card-body').evaluate(body=>{
          const b=body.getBoundingClientRect();
          const controls=[...body.querySelectorAll('input, .illustration-navigation button')].filter(e=>e.checkVisibility());
          return {height:body.clientHeight,scrollHeight:body.scrollHeight,
            controls:controls.map(e=>{const r=e.getBoundingClientRect();return {label:e.getAttribute('aria-label')||e.textContent,
              visible:r.top>=b.top-1&&r.bottom<=b.bottom+1&&r.left>=b.left-1&&r.right<=b.right+1,
              hit:[[r.x+r.width/2,r.y+3],[r.right-3,r.y+r.height/2],[r.x+r.width/2,r.bottom-3],[r.x+3,r.y+r.height/2]].every(([x,y])=>e.contains(document.elementFromPoint(x,y)))}})};
        });
        if(c.geometry.scrollHeight>c.geometry.height+2)c.failures.push('short task needs scrolling');
        if(c.geometry.controls.some(e=>!e.visible||!e.hit))c.failures.push('input or picture navigation clipped/covered');
        if(!stage.startsWith('pictures')) {
          const token=p.locator('.catch-token:not(.caught)').first();
          const before=await token.boundingBox();
          await p.waitForTimeout(800);
          const after=await token.boundingBox();
          c.motion={before,after};
          if(!before||!after||Math.abs(after.x-before.x)<2)c.failures.push('catch token does not move');
          if(await p.locator('.catch-token').count()!==3)c.failures.push('three lanes missing');
          const target=await token.getAttribute('data-token');
          await p.getByRole('textbox',{name:'Твой ответ',exact:true}).fill(target);
          await p.locator('.task-card-actions .primary').click();
          await p.locator('.catch-token.caught').first().waitFor();
        }else{
          await p.getByRole('button',{name:'Посмотреть другую картинку',exact:true}).click();await ready(p);
          if(!(await p.locator('.illustration-position').textContent()).includes('2 из 3'))c.failures.push('picture navigation did not advance');
        }
        await p.screenshot({path:path.join(h.output,c.name+'.png')});
      }catch(e){c.failures.push(e.message);}
    }
    await p.close();
  }
}finally{await h.close();}
if(h.report.errors.length||h.report.sourcesChanged||h.report.cases.some(c=>c.failures.length))process.exitCode=1;

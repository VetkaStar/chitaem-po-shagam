import fs from 'node:fs';
import path from 'node:path';
import { harness, metrics, settle } from './task-card-layout-browser.mjs';

// Uses the real portal/useLesson fixture. Only microphone presentation is mocked;
// dimensions, clipping, text, settings and exposure readiness are real.
process.env.QA_PHASE = process.env.QA_PHASE || 'letters-v3';
const h = await harness('letters', 'tests/fixtures/task-card-layout.tsx');
const ready = async p => {
  await p.waitForFunction(() => !document.querySelector('.free-material.is-pending'));
  await p.evaluate(() => document.fonts.ready);
  await settle(p);
};
try {
  for (const [width, height] of [[1280,720],[390,844]])
  for (const layout of ['order','focus'])
  for (const look of ['plain','notebook']) {
    const p = await h.page({width,height,layout,look,interfaceScale:100,unit:0});
    await p.getByRole('button',{name:'Начать занятие →',exact:true}).click();
    await ready(p);
    const cases = ['alphabet','sounds'].flatMap(letterMode => ['upper','lower','both'].flatMap(letterCase =>
      [false,true].map(sound => ({stage:'letters',letterMode,letterCase,sound}))));
    cases.push(...[false,true].map(sound => ({stage:'syllables',letterMode:'alphabet',letterCase:'both',sound})));
    for (const settings of cases) {
      const c = {name:`${layout}-${look}-${width}-${settings.stage}-${settings.letterMode}-${settings.letterCase}-${settings.sound}`,failures:[],states:[]};
      h.report.cases.push(c);
      try {
        await p.evaluate(settings => {
          window.qaLesson.update('letterMode',settings.letterMode);
          window.qaLesson.update('letterCase',settings.letterCase);
          window.qaLesson.update('sound',settings.sound);
          window.qaLesson.navigate(settings.stage,'read');
        },settings);
        await ready(p);
        const m = await metrics(p); c.states.push(m);
        const details = await p.locator('.task-card').evaluate(card => {
          const body=card.querySelector('.task-card-body'), b=body.getBoundingClientRect();
          const elements=[...card.querySelectorAll('.task-card-material .reading, .letter-display p, .task-line, .task-instruction, .material-tools, .feedback, .task-card-body button')]
            .filter(e=>e.checkVisibility());
          return {target:window.qaLesson.target,body:{height:body.clientHeight,scrollHeight:body.scrollHeight},
            readingSize:parseFloat(getComputedStyle(card.querySelector('.reading')).fontSize),
            speakers:card.querySelectorAll('.task-card-body .speak-button').length,
            sample:!!card.querySelector('.sample'),
            clipped:elements.filter(e=>{const r=e.getBoundingClientRect();return r.top<b.top-1||r.bottom>b.bottom+1||r.left<b.left-1||r.right>b.right+1;}).map(e=>({text:e.textContent,label:e.getAttribute('aria-label')})),
            covered:elements.filter(e=>e.tagName==='BUTTON').filter(e=>{const r=e.getBoundingClientRect();return !e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}).map(e=>e.getAttribute('aria-label')||e.textContent)};
        });
        c.details=details;
        if(details.body.scrollHeight>details.body.height+1)c.failures.push('short task scrolls');
        if(details.clipped.length)c.failures.push('material or feedback clipped');
        if(details.covered.length)c.failures.push('audio button covered');
        if(details.readingSize<60)c.failures.push('target too small');
        if(settings.sound && (details.speakers<3 || !details.sample))c.failures.push('audio controls missing');
        if(m.frame.y<0 || m.frame.bottom>height+1 || !m.buttonHit.every(Boolean))c.failures.push('frame or primary outside viewport/covered');
        if(c.failures.length || (settings.letterCase==='both' && settings.sound))
          await p.screenshot({path:path.join(h.output,c.name+'.png')});
      } catch(e) {c.failures.push(e.message);}
    }
    await p.close();
    fs.writeFileSync(path.join(h.output,'in-progress.json'),JSON.stringify(h.report,null,2));
  }
} finally { await h.close(); }
if(h.report.errors.length || h.report.cases.some(c=>c.failures.length) || h.report.sourcesChanged)process.exitCode=1;

/** Local production acceptance through public UI; no application modules mocked. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'..');
const {chromium}=process.env.PLAYWRIGHT_PACKAGE
  ?await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE,'index.mjs')))
  :createRequire(import.meta.url)('playwright');
const base=process.env.PRODUCTION_URL||'http://127.0.0.1:5184/';
const output=path.resolve(root,process.env.PRODUCTION_REPORT_DIR||'.local/content-pilot-20261104/pilot-production');
fs.mkdirSync(output,{recursive:true});
const report={base,cases:[],errors:[]};
const families=[['mama',['МА','МА'],'МАМА'],['mukha',['МУ','ХА'],'МУХА'],['luna',['ЛУ','НА'],'ЛУНА'],['sumka',['СУМ','КА'],'СУМКА'],['lampa',['ЛАМ','ПА'],'ЛАМПА'],['krupa',['КРУ','ПА'],'КРУПА']];
const texts=[['catfish','Сом','У нас сом.'],['sled','Сани','У Иры сани.'],['bag','Сумка','У мамы сумка.']];
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
async function ready(page){
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>!document.querySelector('[aria-busy="true"],.free-material.is-pending'));
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
}
async function geometry(page){
  const failures=await page.evaluate(()=>{
    const issues=[];
    const selectors=['.task-card-actions button.primary','select[aria-label="Семейство слов"]'];
    for(const selector of selectors)for(const el of document.querySelectorAll(selector)){
      if(!el.checkVisibility())continue;
      const r=el.getBoundingClientRect();
      if(r.top<0||r.bottom>innerHeight+1||r.left<0||r.right>innerWidth+1)issues.push(selector+' outside screen');
      for(let parent=el.parentElement;parent;parent=parent.parentElement){
        const css=getComputedStyle(parent),p=parent.getBoundingClientRect();
        if(/auto|scroll|hidden|clip/.test(css.overflowY)&&(r.top<p.top-1||r.bottom>p.bottom+1))issues.push(selector+' clipped by '+parent.className);
      }
    }
    return issues;
  });
  assert.deepEqual(failures,[]);
}
async function pageFor(viewport){
  const page=await browser.newPage({viewport,reducedMotion:'reduce'});page.setDefaultTimeout(15000);
  page.on('pageerror',e=>report.errors.push(e.message));
  const seed=new URL('__pilot_setup',base).href;
  await page.route(seed,r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Setup</title>'}));
  await page.goto(seed);
  await page.evaluate(()=>{
    localStorage.setItem('reading-profile-v1',JSON.stringify({name:'Проверка',age:'8',start:'syllables'}));
    localStorage.setItem('reading-steps-v3',JSON.stringify({settings:{styleChosen:true,unit:12,curriculumVersion:2,sound:false,autoSpeech:false,autoAdvance:false,motion:false,layout:'order',look:'plain',interfaceScale:100,textFontSize:28,textPresentation:'scroll',showFullText:true,textFlow:'manual',breakEvery:0,breakMinutes:0},stars:0,history:[]}));
  });
  await page.goto(base);await page.locator('#home-trainers').waitFor();await ready(page);
  assert(await page.locator('script[src*="/assets/index-"]').count(),'must use emitted production');
  return page;
}
try{
  for(const viewport of [{width:1280,height:720},{width:390,height:844}]){
    const p=await pageFor(viewport);
    await p.locator('#home-trainers .portal-card').filter({has:p.locator('b',{hasText:/^Слоги$/})}).click();
    await p.getByRole('region',{name:'Тренажёры раздела Слоги',exact:true}).getByRole('button',{name:'Слог',exact:true}).click();
    await p.getByLabel('Семейство слов',{exact:true}).waitFor();await ready(p);
    for(const [id,parts,word] of families){
      await p.getByLabel('Семейство слов',{exact:true}).selectOption(id);await ready(p);
      await geometry(p);
      for(let i=0;i<parts.length;i++){
        await p.locator('summary[aria-label="Проверить вместе со взрослым"]').click();
        await p.getByRole('button',{name:'Получилось',exact:true}).click();await ready(p);
        if(i===0){await p.getByRole('button',{name:/Дальше.*Enter/}).click();await ready(p);}
      }
      const bridge=p.getByRole('region',{name:'Из слогов в слово'});await bridge.waitFor();
      for(const part of parts){await bridge.getByRole('button',{name:part,exact:true}).and(p.locator('button:enabled')).first().click();await ready(p);}
      assert.equal(await bridge.locator('.bridge-word').textContent(),word);
      await geometry(p);
      if(id==='krupa')await p.screenshot({path:path.join(output,`krupa-${viewport.width}.png`)});
      await p.getByRole('button',{name:/^Читать слово целиком/}).click();await ready(p);
      assert(await p.locator('.task-card-material').isVisible());
      report.cases.push(`family ${String(id)} ${viewport.width}`);
    }
    await p.goto(base);await p.locator('#home-trainers').waitFor();await ready(p);
    await p.locator('#home-trainers .portal-card').filter({has:p.locator('b',{hasText:/^Тексты$/})}).click();
    await p.getByRole('region',{name:'Тренажёры раздела Тексты',exact:true}).getByRole('button',{name:'Рассказы',exact:true}).click();
    await p.locator('.text-exercise').waitFor();await ready(p);
    for(const [id,title,line] of texts){
      const picker=p.locator('details.practice-menu').filter({has:p.locator('summary',{hasText:'Выбрать текст'})});
      await picker.locator('summary').click();await ready(p);
      await picker.locator(`[data-text-id="pilot-story-${id}-v1"]`).click();await ready(p);
      if(await picker.getAttribute('open')!==null)await picker.locator('summary').click();
      assert(await p.getByRole('heading',{name:title,exact:true}).isVisible());
      assert((await p.locator('.full-reading-text').textContent()).includes(line));
      await p.screenshot({path:path.join(output,`${id}-${viewport.width}.png`)});
      await p.locator('[data-text-preparation] > summary').click();await ready(p);
      await p.locator('[data-text-preparation] li').first().waitFor();
      assert(await p.locator('[data-text-preparation] li').count()>0);
      await p.locator('[data-text-preparation] > summary').click();
      report.cases.push(`text ${id} ${viewport.width}`);
    }
    await p.close();
  }
  assert.deepEqual(report.errors,[]);
}catch(e){report.errors.push(e.stack);process.exitCode=1;}
finally{await browser.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}

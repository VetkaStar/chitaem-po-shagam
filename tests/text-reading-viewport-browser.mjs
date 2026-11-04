import assert from 'node:assert/strict';
import path from 'node:path';
import { harness, settle } from './task-card-layout-browser.mjs';
process.env.QA_PHASE = process.env.TEXT_PHASE || 'text-reading-implementation';
const h = await harness('viewport','tests/fixtures/text-reading.tsx');
try {
 for (const layout of (process.env.TEXT_QUICK ? ['order'] : ['order','focus'])) for (const look of (process.env.TEXT_QUICK ? ['plain'] : ['plain','notebook'])) for (const [width,height] of (process.env.TEXT_PHONE ? [[390,844]] : process.env.TEXT_QUICK ? [[1280,720]] : [[1280,720],[820,1180],[390,844]])) {
  if(process.env.TEXT_CASES && !process.env.TEXT_CASES.split(',').includes(`${layout}-${look}-${width}`)) continue;
  const c={name:`${layout}-${look}-${width}`,failures:[],states:[]};h.report.cases.push(c);
  const p=await h.page({layout,look,width,height,textFlow:'manual',micConsent:true});
  try {
    await p.locator('.portal-grid').getByRole('button',{name:/ШАГ 6 Тексты/}).click();
    await p.locator('.portal-grid').getByRole('button',{name:'Рассказы',exact:true}).click();
    await p.locator('summary').filter({hasText:'Выбрать текст'}).click();
    await p.getByRole('button',{name:'Росток',exact:true}).click();
    await p.waitForFunction(()=>document.querySelector('.text-reading-scroll .full-reading-text') && !document.querySelector('.text-exercise [aria-busy="true"]'));
    const measure=()=>p.evaluate(()=>{
      const card=document.querySelector('.text-exercise'),box=card.querySelector('.text-reading-scroll');
      const r=box.getBoundingClientRect();
      const primary=card.querySelector('.task-card-primary').getBoundingClientRect();
      const secondary=[...card.querySelectorAll('.task-card-actions .text-button')].map(e=>e.getBoundingClientRect().top);
      const lineStarts=[...box.querySelectorAll('.full-reading-text .full-text-line > span')].map(e=>e.getBoundingClientRect().left);
      const adult=[...card.querySelectorAll('summary')].find(e=>e.textContent.includes('Проверить вместе'));
      return {audioHeights:[...box.querySelectorAll('.full-reading-text .full-text-line > button.quiet')].map(e=>e.getBoundingClientRect().height),primaryBottom:primary.bottom,secondaryTop:Math.min(...secondary),lineStarts,height:box.clientHeight,scrollHeight:box.scrollHeight,bodyScroll:card.querySelector('.task-card-body').scrollHeight,bodyHeight:card.querySelector('.task-card-body').clientHeight,
        box:{y:r.y,bottom:r.bottom},adult:adult?.getBoundingClientRect().bottom,card:card.getBoundingClientRect().bottom,
        lineCount:box.querySelectorAll('.full-reading-text .full-text-line').length,
        font:getComputedStyle(box.querySelector('.full-text-line')).fontSize};
    });
    const first=await measure();c.states.push({first});
    assert.equal(first.lineCount,4);assert.equal(first.font,'28px');assert(first.primaryBottom+3<=first.secondaryTop+0.5,JSON.stringify(first));assert(first.lineStarts.every(x=>Math.abs(x-first.lineStarts[0])<1),JSON.stringify(first));assert(first.adult<height);assert(first.bodyScroll<=first.bodyHeight+2);
    if(width>=820) assert(first.scrollHeight<=first.height+2,JSON.stringify(first));
    for(const sound of [true,false]) {
      await p.evaluate(sound=>window.textTest.model.update('sound',sound),sound);
      await settle(p);await p.waitForFunction(()=>!document.querySelector('.text-exercise [aria-busy="true"]'));
      const audioScroll=await measure();c.states.push({audioScroll,sound});
      assert.equal(audioScroll.font,'28px');assert.equal(audioScroll.lineCount,4);
      assert.equal(audioScroll.audioHeights.length,sound?4:0);
      assert(audioScroll.audioHeights.every(height=>Math.abs(height-36)<0.5),JSON.stringify(audioScroll));
      assert(audioScroll.bodyScroll<=audioScroll.bodyHeight+2,JSON.stringify(audioScroll));
      assert(audioScroll.primaryBottom+3<=audioScroll.secondaryTop+0.5,JSON.stringify(audioScroll));
      assert(audioScroll.adult<height,JSON.stringify(audioScroll));
      if(width>=820) assert(audioScroll.scrollHeight<=audioScroll.height+2,JSON.stringify(audioScroll));
    }
    await p.evaluate(()=>window.textTest.control());
    await p.locator('summary').filter({hasText:'Выбрать текст'}).click();
    await p.getByRole('button',{name:'Росток',exact:true}).click();
    await p.waitForFunction(()=>document.querySelector('.text-reading-scroll .full-reading-text') && !document.querySelector('[aria-busy="true"]'));
    // Save latency must retain the authorized page in every animation frame.
    await p.getByText('Проверить вместе со взрослым',{exact:true}).click();
    await p.evaluate(()=>{window.textTest.recorder.hold=true;window.framesSeen=[];window.watch=true;const tick=()=>{if(!window.watch)return;window.framesSeen.push([...document.querySelectorAll('.text-reading-scroll .full-reading-text .full-text-line')].filter(e=>e.checkVisibility()).length);requestAnimationFrame(tick)};tick();});
    await p.getByRole('button',{name:'Строка прочитана верно',exact:true}).click();
    await p.waitForFunction(()=>window.textTest.recorder.pending>0);
    await p.waitForTimeout(100);
    assert.equal(await p.locator('.text-reading-scroll .full-reading-text .full-text-line:visible').count(),4);
    assert.equal(await p.getByRole('button',{name:/Следующая строка/}).count(),0);
    await p.evaluate(()=>window.textTest.recorder.fail());
    await p.getByRole('alert').waitFor();
    await p.getByRole('button',{name:'Повторить попытку',exact:true}).click();
    await p.getByRole('button',{name:/Следующая строка/}).click();
    await p.waitForFunction(()=>document.querySelector('.text-line-status')?.textContent.includes('Строка 2'));
    const frames=await p.evaluate(()=>{window.watch=false;return window.framesSeen});assert(frames.every(n=>n===4));
    // Layout changes and page browsing never move the active logical line or earn credit.
    await p.evaluate(()=>{window.textTest.model.update('textPresentation','pages');window.textTest.model.update('textFontSize',40);});
    await p.locator('.text-page-controls').waitFor();await settle(p);
    await p.waitForFunction(()=>!document.querySelector('.text-reading-scroll [aria-busy="true"]'));
    for(const sound of [true,false]) {
      await p.evaluate(sound=>window.textTest.model.update('sound',sound),sound);
      await settle(p);await p.waitForFunction(()=>!document.querySelector('.text-reading-scroll [aria-busy="true"]'));
      const sizing=await p.locator('.text-reading-scroll').evaluate(box=>{
        const actual=box.querySelector('.full-reading-text .active-line > .reading-guide');
        const measured=box.querySelector('.text-reading-measure .reading-guide');
        return {actual:actual?.getBoundingClientRect().width,measured:measured.getBoundingClientRect().width,height:box.clientHeight,scroll:box.scrollHeight,letters:box.querySelector('.full-reading-text').textContent.length};
      });
      assert(sizing.actual!==undefined && Math.abs(sizing.actual-sizing.measured)<1,JSON.stringify({sound,...sizing}));
      assert(sizing.scroll<=sizing.height+2,JSON.stringify({sound,...sizing}));
      c.states.push({sound,sizing});
    }
    const pageAdult=p.getByText('Проверить вместе со взрослым',{exact:true});
    if(!await pageAdult.evaluate(e=>e.parentElement.open)) await pageAdult.click();
    // Opening this panel changes available height and may need a newly recorded page.
    await p.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));
    await p.getByRole('button',{name:'Строка прочитана верно',exact:true}).click();
    await p.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));
    c.states.push({pageAdult:'pointer confirmation works after resized page is recorded'});
    const status=await p.locator('.text-line-status').textContent();
    const next=p.locator('.text-page-controls button').last();
    if(await next.isEnabled()) {await next.click();await p.waitForFunction(()=>!document.querySelector('.text-reading-scroll [aria-busy="true"]'));}
    assert.equal(await p.locator('.text-line-status').textContent(),status);
    assert.equal(await p.locator('.text-success').count(),0);
    await p.setViewportSize({width:width+20,height:height+30});await settle(p);
    assert.equal(await p.locator('.text-line-status').textContent(),status);
    c.states.push({pages:await measure()});

    await p.evaluate(()=>{window.textTest.model.update('textPresentation','scroll');window.textTest.model.update('textFontSize',28);});
    await p.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));
    const positions=()=>p.locator('.text-exercise').evaluate(card=>{
      const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
      return {card:rect(card),primary:rect(card.querySelector('.task-card-primary'))};
    });
    const beforeDone=await positions();
    for(let n=0;n<4 && !await p.locator('.text-success').count();n++) {
      const adult=p.getByText('Проверить вместе со взрослым',{exact:true});
      if(await adult.count()) {
        if(!await adult.evaluate(e=>e.parentElement.open)) await adult.click();
        await p.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));
        await p.getByRole('button',{name:'Строка прочитана верно',exact:true}).click();
      }
      await p.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));
      await p.getByRole('button',{name:/^(Следующая строка|Завершить)/}).click();
      await p.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));
    }
    assert.equal(await p.locator('.text-success').count(),1);
    assert.deepEqual(await positions(),beforeDone);
    c.states.push({adultCompletion:'actual pointer clicks; done readiness; constant card and primary geometry'});

    if(layout==='order' && look==='plain' && [1280,390].includes(width)) {
      await p.evaluate(()=>{window.textTest.model.update('textPresentation','pages');window.textTest.model.update('textFontSize',40);window.textTest.long();});
      await p.getByRole('heading',{name:'Длинный абзац',exact:true}).waitFor();
      await p.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));
      const textContent=()=>p.locator('.text-reading-scroll .full-reading-text').textContent();
      const firstPage=await textContent();
      const forward=p.getByRole('button',{name:'Следующая страница',exact:true});
      assert(await forward.isEnabled());
      await p.evaluate(()=>{window.textTest.recorder.inputs=[];window.textTest.recorder.hold=true;});
      await forward.click();await p.waitForFunction(()=>window.textTest.recorder.pending>0);
      assert.equal(await textContent(),firstPage);
      const recorded=await p.evaluate(()=>window.textTest.recorder.inputs);
      assert(recorded.some(input=>input.texts?.some(text=>text.length>0 && text.length<1400)));
      assert(!recorded.some(input=>input.texts?.some(text=>text.length>=1400)));
      await p.evaluate(()=>window.textTest.recorder.fail());
      await p.getByRole('alert').waitFor();assert.equal(await textContent(),firstPage);
      await p.getByRole('button',{name:'Повторить попытку',exact:true}).click();
      await p.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));
      assert.notEqual(await textContent(),firstPage);
      const lastWord=p.locator('.full-reading-text .reading-guide button').last();
      await lastWord.click();await p.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));
      const source=await p.locator('.text-reading-viewport').getAttribute('data-active-source');
      assert(Number(source)>0);
      await p.evaluate(()=>window.textTest.model.update('textFontSize',32));
      await p.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));
      assert.equal(await p.locator('.text-reading-viewport').getAttribute('data-active-source'),source);
      await p.setViewportSize({width,height});await settle(p);
      assert.equal(await p.locator('.text-reading-viewport').getAttribute('data-active-source'),source);
      for(let n=0;n<30;n++) {
        const fit=await p.locator('.text-reading-scroll').evaluate(e=>({height:e.clientHeight,scroll:e.scrollHeight}));
        assert(fit.scroll<=fit.height+2,JSON.stringify(fit));
        if(!await forward.isEnabled()) break;
        await forward.click();await p.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));
      }
      assert.equal(await p.locator('.text-line-status').textContent(),'Строка 1 из 2 · Прочитай вслух');
      assert.equal(await p.locator('.text-success').count(),0);
      await p.getByRole('button',{name:'Отвечаю',exact:true}).click();
      await p.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));
      await p.evaluate(()=>{window.textTest.recorder.hold=true;window.textTest.model.update('textFontSize',24);});
      await p.waitForFunction(()=>window.textTest.recorder.pending>0);
      await p.evaluate(()=>{const answer=window.textTest.answer;[...document.querySelectorAll('.text-options button')].find(b=>b.textContent===answer)?.click();});
      assert.equal(await p.locator('.text-success').count(),0);
      assert(await p.locator('.text-task-controls').evaluate(e=>e.inert));
      await p.evaluate(()=>window.textTest.recorder.commit());
      await p.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));
      c.states.push({longParagraph:'pages, error/retry, source preservation, no navigation credit, child gate checked'});
    }
    await p.screenshot({path:path.join(h.output,c.name+'.png')});
  } catch(e) { c.failures.push(e.stack);console.log(c.name,e.message);await p.screenshot({path:path.join(h.output,c.name+'-failure.png')}); }
  await p.close();
 }
} finally {await h.close();}

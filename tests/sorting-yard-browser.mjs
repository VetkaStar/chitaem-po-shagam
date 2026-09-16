import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
import {createMission} from '../public/games/sorting-yard/model.js';
const require=createRequire(import.meta.url);
const {chromium}=process.env.PLAYWRIGHT_PACKAGE?await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE,'index.mjs'))):require('playwright');
const dir=path.resolve('.local/sorting-yard-browser');fs.mkdirSync(dir,{recursive:true});
const server=await createServer({configFile:path.resolve('vite.pages.config.ts'),base:'/game-test/',server:{host:'127.0.0.1',port:0,hmr:false},logLevel:'error'});await server.listen();
const url=`http://127.0.0.1:${server.httpServer.address().port}/game-test/games/sorting-yard/index.html`;
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const errors=[];
async function drag(page,from,to){await from.scrollIntoViewIfNeeded();const a=await from.boundingBox(),b=await to.boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});await page.mouse.up();}
try{
 if(!process.env.SORTING_TOUCH_ONLY){
 const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.locator('.cell').last().waitFor();assert.equal(await page.locator('.cell').count(),80);
 const cell=i=>page.locator(`[data-cell="${i}"]`);
 await drag(page,page.locator('[data-part="belt"]'),cell(31));assert(await cell(31).evaluate(e=>e.classList.contains('belt')),'Palette drag places belt');
 await drag(page,cell(31),cell(32));assert(await cell(31).evaluate(e=>e.classList.contains('empty')));assert(await cell(32).evaluate(e=>e.classList.contains('belt')));
 await page.locator('#undo').click();assert(await cell(31).evaluate(e=>e.classList.contains('belt')));
 await cell(31).focus();await page.keyboard.press('Enter');await page.keyboard.press('r');assert.equal(await page.locator('#direction').inputValue(),'2');await page.keyboard.press('Delete');assert(await cell(31).evaluate(e=>e.classList.contains('empty')));
 await page.locator('#clear').click();
 const m=createMission(0);
 // Build the first complete production line through actual UI placement/configuration.
 for(let i=0;i<m.solution.length;i++){
   const p=m.solution[i];if(!p)continue;
   await page.locator(`[data-part="${p.kind}"]`).click();await page.locator('#direction').selectOption(String(p.dir));
   if(p.kind==='splitter'){await page.locator('#filter').selectOption(p.filter);await page.locator('#branch').selectOption(String(p.turn));}
   await cell(i).click();
 }
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('sorting-yard-v1')).plans[0]);assert.deepEqual(stored.filter(Boolean).map(p=>[p.kind,p.dir]),m.solution.filter(Boolean).map(p=>[p.kind,p.dir]));
 // Deliberately wrong filter must fail, then the existing plan must be repairable.
 await cell(34).click();await page.locator('#filter').selectOption('solid');await page.locator('#speed').click();await page.locator('#speed').click();await page.locator('#run').click();await page.waitForFunction(()=>document.querySelector('#status').classList.contains('error'),null,{timeout:15000});assert.match(await page.locator('#status').textContent(),/твёрдый груз|попадает/);
 await cell(34).click();await page.locator('#filter').selectOption('water');await page.locator('#step').click();assert.equal(await page.locator('#pause').textContent(),'▶ Дальше');assert(await page.locator('#direction').isDisabled());
 const tokens=await page.locator('.cargo-token').count();assert(tokens>0);await page.locator('#step').click();await page.locator('#pause').click();await page.locator('#success:visible').waitFor({timeout:15000});
 assert.equal(await page.locator('#delivered').textContent(),String(m.queue.length));
 await page.reload();assert.equal(await page.locator('.cell.belt').count(),m.solution.filter(p=>p?.kind==='belt').length);assert.equal(await page.locator('#missions .complete').count(),1);
 // Reference plans exercise the complete UI simulation in the remaining contracts.
 const plans=Object.fromEntries(Array.from({length:9},(_,i)=>[i,createMission(i).solution]));
 await page.evaluate(plans=>localStorage.setItem('sorting-yard-v1',JSON.stringify({completed:[0],plans})),plans);await page.reload();await page.locator('#speed').click();await page.locator('#speed').click();
 for(let id=1;id<9;id++){
  await page.locator(`[data-difficulty="${Math.floor(id/3)}"]`).click();await page.locator(`[data-mission="${id}"]`).click();await page.locator('#run').click();await page.locator('#success:visible').waitFor({timeout:20000});assert.equal(await page.locator('#delivered').textContent(),String(createMission(id).queue.length));
 }
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('sorting-yard-v1')).completed.length),9);
 await page.locator('[data-difficulty="2"]').click();await page.locator('#run').click();await page.waitForTimeout(1600);await page.locator('#pause').click();await page.screenshot({path:path.join(dir,'desktop.png'),fullPage:true});
 await page.locator('[data-difficulty="0"]').click();await page.waitForTimeout(500);assert.equal(await page.locator('#delivered').textContent(),'0');assert.equal(await page.locator('.cargo-token').count(),0);assert(await page.locator('#run').isEnabled());
 for(const width of [320,390,768,1024]){await page.setViewportSize({width,height:1000});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert(!overflow,`Page overflow at ${width}`);await page.locator('#zoom').click();const fits=await page.evaluate(()=>document.querySelector('#viewport').scrollWidth<=document.querySelector('#viewport').clientWidth+1);assert(fits,`Overview fits at ${width}`);if(width===390)await page.screenshot({path:path.join(dir,'mobile.png'),fullPage:true});await page.locator('#zoom').click();}
 }
 const context=await browser.newContext({viewport:{width:390,height:900},isMobile:true,hasTouch:true,reducedMotion:'reduce'});const touch=await context.newPage();touch.on('pageerror',e=>errors.push(e.message));await touch.goto(url);await touch.locator('.cell').last().waitFor();await touch.locator('[data-part="belt"]').tap();await touch.locator('[data-cell="1"]').tap();assert(await touch.locator('[data-cell="1"]').evaluate(e=>e.classList.contains('belt')));
 const cdp=await context.newCDPSession(touch);await touch.locator('[data-cell="1"]').scrollIntoViewIfNeeded();const a=await touch.locator('[data-cell="1"]').boundingBox(),b=await touch.locator('[data-cell="2"]').boundingBox();
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x+a.width/2,y:a.y+a.height/2}]});for(let t=1;t<=8;t++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+a.width/2+(b.x-a.x)*t/8,y:a.y+a.height/2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert(await touch.locator('[data-cell="2"]').evaluate(e=>e.classList.contains('belt')),'Touch drag moves block');assert(await touch.locator('[data-cell="1"]').evaluate(e=>e.classList.contains('empty')));
 await touch.locator('[data-part="splitter"]').tap();assert.equal(await touch.locator('#inspector-title').textContent(),'Разветвитель');await touch.locator('#settings-shortcut').tap();await touch.locator('#filter').selectOption('water');await touch.locator('#back-to-board').tap();await touch.locator('[data-cell="3"]').tap();
 assert.equal(await touch.locator('#filter').inputValue(),'water');assert(await touch.locator('[data-cell="3"]').evaluate(e=>e.classList.contains('splitter')));
 await context.close();
 const privateContext=await browser.newContext();await privateContext.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw Error('blocked');}});});const privatePage=await privateContext.newPage();privatePage.on('pageerror',e=>errors.push(e.message));await privatePage.goto(url);await privatePage.locator('[data-cell="1"]').click();assert.equal(await privatePage.locator('.cell.belt').count(),1);await privateContext.close();
 assert.deepEqual(errors,[]);console.log('Sorting yard browser checks passed.');
}finally{await browser.close();await server.close();}






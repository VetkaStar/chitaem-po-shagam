import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'vite';
import {factoryLevel} from '../public/games/trio/models.js';
const {chromium}=await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE,'index.mjs')));
const server=await createServer({configFile:path.resolve('vite.pages.config.ts'),base:'/trio-test/',server:{host:'127.0.0.1',port:0,hmr:false},logLevel:'error'});await server.listen();const root=`http://127.0.0.1:${server.httpServer.address().port}/trio-test/games/trio/`;
const browser=await chromium.launch({channel:'msedge',headless:true});const errors=[],report=path.resolve('.local/trio-checks');fs.mkdirSync(report,{recursive:true});
async function geometry(page,label){const result=await page.evaluate(()=>{const w=innerWidth,h=innerHeight;return {page:document.documentElement.scrollHeight<=h&&document.documentElement.scrollWidth<=w,out:[...document.querySelectorAll('.header,.metrics,.arena,.tools,.footer,.status')].filter(el=>{const r=el.getBoundingClientRect();return r.left<-.5||r.top<-.5||r.right>w+.5||r.bottom>h+.5;}).map(e=>e.className),arena:document.querySelector('.arena').getBoundingClientRect().height};});assert(result.page,`${label}: page overflow`);assert.deepEqual(result.out,[],`${label}: controls outside viewport`);assert(result.arena>75,`${label}: board too small`);}
async function point(page,cell,cols=7,rows=5){return page.locator('#canvas').evaluate((el,{cell,cols,rows})=>{const r=el.getBoundingClientRect(),s=Math.min((r.width-26)/cols,(r.height-26)/rows);return {x:r.left+(r.width-cols*s)/2+(cell%cols+.5)*s,y:r.top+(r.height-rows*s)/2+(Math.floor(cell/cols)+.5)*s};},{cell,cols,rows});}
try{
for(const game of ['factory','railway','robot']){
 const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(game+': '+e.message));await page.goto(root+game+'.html');await page.locator('#quiet').click();
 for(const [width,height]of [[1280,800],[390,844],[320,568],[768,1024],[844,390],[568,320]]){await page.setViewportSize({width,height});await geometry(page,`${game} ${width}x${height}`);if(width===390||width===1280)await page.screenshot({path:path.join(report,`${game}-${width}.png`)});}
 await page.setViewportSize({width:1280,height:800});await page.locator('#help').click();assert(await page.locator('.app').evaluate(e=>e.inert));await page.locator('#confirm').click();assert(!(await page.locator('.app').evaluate(e=>e.inert)));
 if(game==='factory'){
  const p=await point(page,15),a=await page.locator('[data-part="red"]').boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(p.x,p.y,{steps:12});await page.mouse.up();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mechanisms-trio-factory-v1')).plans[0][15].kind),'red');
  const solution=factoryLevel(0).solution;await page.addInitScript(solution=>localStorage.setItem('mechanisms-trio-factory-v1',JSON.stringify({done:{},plans:{0:solution}})),solution);await page.reload();await page.locator('#quiet').click();await page.locator('#run').click();await page.locator('#stars:visible').waitFor({timeout:25000});assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mechanisms-trio-factory-v1')).done[0]),true);
 }else if(game==='robot'){
  await page.locator('[data-command="act"]').click();for(let i=0;i<3;i++)await page.locator('[data-command="E"]').click();await page.locator('[data-command="act"]').click();await page.locator('#run').click();await page.locator('#stars:visible').waitFor({timeout:12000});
 }else{
  await page.locator('#run').click();for(let t=0;t<400;t++){if(await page.locator('#stars').isVisible())break;for(let i=0;i<2;i++){const b=page.locator(`[data-switch="${i}"]`),cargo=await b.getAttribute('data-approaching');if(cargo!==null&&cargo!==''){const needed=i===0?cargo==='0':cargo==='2';if((await b.getAttribute('aria-pressed')==='true')!==needed)await b.click();}}await page.waitForTimeout(100);}
  assert(await page.locator('#stars').isVisible(),'Dispatcher must deliver its complete queue');
 }
 await page.close();
}
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const touch=await context.newPage();touch.on('pageerror',e=>errors.push('touch: '+e.message));await touch.goto(root+'factory.html');await touch.locator('#quiet').tap();const a=await touch.locator('[data-part="red"]').boundingBox(),b=await point(touch,15),cdp=await context.newCDPSession(touch);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x+a.width/2,y:a.y+a.height/2}]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+a.width/2+(b.x-a.x-a.width/2)*i/8,y:a.y+a.height/2+(b.y-a.y-a.height/2)*i/8}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await touch.evaluate(()=>JSON.parse(localStorage.getItem('mechanisms-trio-factory-v1')).plans[0][15].kind),'red');await touch.locator('#help').tap();assert(await touch.locator('#modal').isVisible());await context.close();
const audioPage=await browser.newPage();await audioPage.addInitScript(()=>{window.playedMedia=[];const native=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.playedMedia.push(this);return native.call(this);};});audioPage.on('pageerror',e=>errors.push('audio: '+e.message));await audioPage.goto(root+'robot.html');await audioPage.locator('#confirm').click();await audioPage.waitForFunction(()=>window.playedMedia.some(m=>!m.paused&&m.currentTime>.1));await audioPage.locator('#music').click();assert(await audioPage.evaluate(()=>window.playedMedia.every(m=>m.paused)));await audioPage.close();
assert.deepEqual(errors,[]);console.log('Trio browser: 3 victories, 18 viewport checks, factory mouse/touch drag, robot commands, live dispatch, modal focus isolation and real music playback passed.');
}finally{await browser.close();await server.close();}

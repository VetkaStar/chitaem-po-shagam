import path from 'node:path';
import { harness,matrix,settle } from './task-card-layout-browser.mjs';
const h=await harness('home');
try {
  for(const config of matrix) {
    const c={name:`${config.layout}-${config.look}-${config.width}x${config.height}-${config.interfaceScale}`,config,failures:[]};
    h.report.cases.push(c);
    const p=await h.page({...config,motion:true});
    const check=(ok,message)=>{if(!ok)c.failures.push(message);};
    try {
      const actions=p.locator('.home-actions');
      if(!await actions.count()) {c.failures.push('Three-action container is absent (baseline)');continue;}
      c.buttons=await actions.locator('button').evaluateAll(buttons=>buttons.map(b=>{
        const r=b.getBoundingClientRect(),css=getComputedStyle(b);
        const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
        const rgb=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);};
        const lum=color=>rgb(color).map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[0.2126,0.7152,0.0722][i],0);
        const fg=lum(css.color),bg=lum(css.backgroundColor);
        return {text:b.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,background:css.backgroundColor,
          primaryMatches:!b.classList.contains('primary') || JSON.stringify(rgb(css.backgroundColor))===JSON.stringify(rgb(css.getPropertyValue('--primary').trim())),
          contrast:(Math.max(fg,bg)+0.05)/(Math.min(fg,bg)+0.05)};
      }));
      check(c.buttons.length===3,'Expected exactly three home actions');
      check(c.buttons.every(b=>b.primaryMatches),'Primary background differs from --primary');
      check(c.buttons.every(b=>b.contrast>=4.5),'A home action has text contrast below 4.5:1');
      check(await p.locator('.portal-grid .portal-card').count()===6,'Expected six trainer cards');
      c.pageWidth=await p.evaluate(()=>document.documentElement.scrollWidth);
      check(c.pageWidth<=config.width+1,`Horizontal overflow: ${c.pageWidth}`);
      check(c.buttons.every(b=>b.x>=0 && b.right<=config.width+1),'A home action is horizontally clipped');
      if(config.width>=1180) check(Math.max(...c.buttons.map(b=>b.y))-Math.min(...c.buttons.map(b=>b.y))<=2,'Three actions do not share one row at desktop width');
      await p.evaluate(()=>{
        window.qaScrollCalls=[];
        // Intentional prototype spy: Reflect.apply supplies the original element as this.
        // oxlint-disable-next-line typescript/unbound-method
        const native=Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView=function(...args){window.qaScrollCalls.push(args[0]);return Reflect.apply(native,this,args);};
      });
      const jump=p.getByRole('button',{name:'Все тренажёры ↓',exact:true});
      await jump.focus();await p.keyboard.press('Enter');await settle(p);
      const heading=p.getByRole('heading',{name:'Все тренажёры',exact:true});
      c.jump=await heading.evaluate(el=>{const r=el.getBoundingClientRect();return {focused:document.activeElement===el,y:r.y,bottom:r.bottom,scrollY,options:window.qaScrollCalls};});
      check(c.jump.focused,'Jump did not focus trainer heading');
      check(c.jump.y>=-1 && c.jump.bottom<=config.height+1,'Trainer heading outside viewport after jump');
      check(c.jump.options.at(-1)?.behavior!=='smooth','Reduced motion used smooth scrolling');
      await p.keyboard.press('Tab');
      check(await p.locator('.portal-card').first().evaluate(el=>el===document.activeElement),'Next Tab did not reach first trainer card');
      c.firstCard=await p.locator('.portal-card').first().boundingBox();
      check(c.firstCard.y<config.height && c.firstCard.y+c.firstCard.height>0,'No trainer card visible after jump');
      if(config.look==='plain') await p.screenshot({path:path.join(h.output,`${c.name}-jump.png`)});
      await p.evaluate(()=>window.scrollTo(0,0));
      await p.getByRole('button',{name:'Начать занятие →',exact:true}).click();
      await p.locator('.exercise').waitFor();
      c.start=true;
      await p.goBack();await p.getByRole('heading',{name:'Привет, Проверка!'}).waitFor();
      await p.getByRole('button',{name:'Учебные программы',exact:true}).click();
      await p.getByRole('heading',{name:'Выбери свой путь'}).waitFor();
      c.programs=true;
      await p.goBack();await p.getByRole('heading',{name:'Привет, Проверка!'}).waitFor();
      if(config.width===1280 && config.look==='plain') {
        await p.emulateMedia({reducedMotion:'no-preference'});
        await jump.click();
        check(await p.evaluate(()=>window.qaScrollCalls.at(-1)?.behavior)==='smooth','Motion enabled did not request smooth scrolling');
      }
    }catch(error){c.failures.push(`scenario aborted: ${error.message}`);await p.screenshot({path:path.join(h.output,`${c.name}-aborted.png`)});}
    finally {await p.close();}
  }
}finally {await h.close();}

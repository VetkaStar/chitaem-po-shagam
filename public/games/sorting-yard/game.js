import { CARGO,FILTERS,DIRS,WIDTH,HEIGHT,createMission,inventory,validBoard,place,createSimulation,advance } from './model.js';
const $=id=>document.getElementById(id);
const KEY='sorting-yard-v1', NAMES={belt:'Лента',pipe:'Труба',splitter:'Разветвитель'}, ARROWS=['↑','→','↓','←'];
let mission,board,selected=null,tool='belt',template={kind:'belt',dir:1,filter:'liquid',turn:1},undo=[],state=null,paused=false,timer=null,speed=1,drag=null,dragFrame=0,suppressClickUntil=0;
let saved={completed:[],plans:{}};
try { const data=JSON.parse(localStorage.getItem(KEY));if(data&&Array.isArray(data.completed)&&data.plans&&typeof data.plans==='object')saved={completed:[...new Set(data.completed.filter(i=>Number.isInteger(i)&&i>=0&&i<9))],plans:data.plans}; } catch {}
const locked=()=>state?.status==='running';
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function persist(){saved.plans[mission.id]=board;try{localStorage.setItem(KEY,JSON.stringify(saved));}catch{}}
function outputs(p){return p.kind==='splitter'?[p.dir,(p.dir+p.turn+4)%4]:Number.isInteger(p.dir)?[p.dir]:[];}
function blockSVG(p,cell=null){
  const points=[[50,0],[100,50],[50,100],[0,50]], end=d=>points[d].join(' ');
  const incoming=[];
  if(cell!==null&&p.kind!=='splitter') for(let d=0;d<4;d++){
    const [dx,dy]=DIRS[d],x=cell%WIDTH+dx,y=Math.floor(cell/WIDTH)+dy;
    if(x<0||x>=WIDTH||y<0||y>=HEIGHT)continue;
    const adjacent=mission.fixed[y*WIDTH+x]||board[y*WIDTH+x];
    if(adjacent&&outputs(adjacent).includes((d+2)%4)&&d!==p.dir)incoming.push(d);
  }
  if(!incoming.length)incoming.push((p.dir+2)%4);
  const base=incoming.map(d=>`M${end(d)} L50 50`).join(' ')+` M50 50 L${end(p.dir)}`;
  const branch=(p.dir+p.turn+4)%4;
  const extra=p.kind==='splitter'?` M50 50 L${end(branch)}`:'';
  const color=p.kind==='pipe'?'#71bcd6':p.kind==='splitter'?'#c3afea':'#d5ba7e';
  const rot=(p.dir-1)*90;
  const labelPos=[[50,13],[87,50],[50,87],[13,50]];
  const input=labelPos[(p.dir+2)%4],yes=labelPos[branch];
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${base+extra}" stroke="#1c2833" stroke-width="31" fill="none"/><path d="${base+extra}" stroke="${color}" stroke-width="19" fill="none"/>${p.kind==='belt'?`<path d="${base}" stroke="#786c53" stroke-width="15" stroke-dasharray="3 7" fill="none"/>`:''}<g transform="rotate(${rot} 50 50)"><path d="M44 39 L57 50 L44 61" stroke="#f8f2db" stroke-width="5" fill="none" stroke-linejoin="round"/></g>${p.kind==='splitter'?`<circle cx="50" cy="50" r="17" fill="#5a496f"/><text x="50" y="56" text-anchor="middle" fill="#fff5d7" font-size="23" font-weight="800">⑂</text><text x="${yes[0]}" y="${yes[1]+5}" text-anchor="middle" fill="#201930" font-size="18" font-weight="900">✓</text><text x="${input[0]}" y="${input[1]+3}" text-anchor="middle" fill="#f5eaff" stroke="#47395b" stroke-width="1" paint-order="stroke" font-size="11" font-weight="800">IN</text>`:''}</svg>`;
}
function describe(cell){const p=mission.fixed[cell]||board[cell],position=`Строка ${Math.floor(cell/WIDTH)+1}, столбец ${cell%WIDTH+1}`;if(!p)return `${position}, пустая клетка. Поставить деталь.`;if(p.kind==='wall')return `${position}, препятствие`;if(p.kind==='source')return `${position}, разгрузка, выход вправо`;if(p.kind==='sink')return `${position}, ${CARGO[p.cargo].phase==='liquid'?'резервуар':'склад'}: ${CARGO[p.cargo].name}`;return `${position}, ${NAMES[p.kind]}, ${ARROWS[p.dir]}${p.kind==='splitter'?`, вбок: ${FILTERS.find(f=>f.id===p.filter).name}`:''}. Выбрать или перетащить.`;}
function renderBoard(){
  const focused=document.activeElement?.dataset.cell;
  $('board').replaceChildren();
  board.forEach((p,cell)=>{
    const fixed=mission.fixed[cell],item=fixed||p,button=document.createElement('button');
    button.type='button';button.className=`cell ${item?.kind||'empty'}`;button.dataset.cell=cell;button.setAttribute('aria-label',describe(cell));
    button.classList.toggle('selected',selected===cell);
    if(!item&&cell===mission.source+1)button.classList.add('next-start');
    if(item?.kind==='source')button.innerHTML='<span class="fixed-icon">⇥</span><span class="cell-label">РАЗГРУЗКА →</span>';
    else if(item?.kind==='sink')button.innerHTML=`<span class="fixed-icon">${CARGO[item.cargo].icon}</span><span class="cell-label">${CARGO[item.cargo].name}</span>`;
    else if(p){button.innerHTML=blockSVG(p,cell);if(p.kind==='splitter')button.insertAdjacentHTML('beforeend',`<span class="filter-badge">${FILTERS.find(f=>f.id===p.filter).icon}</span>`);}
    $('board').append(button);
  });
  renderSimulation();
  if(focused!==undefined)$('board').children[Number(focused)]?.focus({preventScroll:true});
}
function renderPalette(){const stock=inventory(mission,board);for(const kind of ['belt','pipe','splitter']){$(`stock-${kind}`).textContent=stock[kind];const b=$('palette').querySelector(`[data-part="${kind}"]`);b.setAttribute('aria-pressed',String(tool===kind));b.disabled=locked();}
  $('erase').setAttribute('aria-pressed',String(tool==='erase'));
  $('tool-label').textContent=selected!==null&&board[selected]?`Выбран: ${NAMES[board[selected].kind]} · ${ARROWS[board[selected].dir]}`:tool==='erase'?'Удаление: нажми на блок':`${NAMES[template.kind]} ${ARROWS[template.dir]} · готова к установке`;
  $('undo').disabled=!undo.length||locked();$('erase').disabled=locked();$('rotate').disabled=locked();$('clear').disabled=locked();
}
function renderInspector(){
  const p=selected!==null&&board[selected]?board[selected]:template;
  $('inspector-title').textContent=NAMES[p.kind];
  $('settings-shortcut').textContent=p.kind==='splitter'?'⚙ Правило: '+FILTERS.find(f=>f.id===p.filter).name:'⚙ Настроить';
  $('selection-info').textContent=selected!==null&&board[selected]?`Клетка ${Math.floor(selected/WIDTH)+1}:${selected%WIDTH+1}. Можно перетащить на другое место.`:'Настройки для новой детали.';
  $('direction').value=p.dir;$('filter').value=p.filter;$('branch').value=p.turn;
  $('filter-settings').hidden=p.kind!=='splitter';
  $('routing-preview').innerHTML=`<b>${ARROWS[(p.dir+p.turn+4)%4]} ✓ ${FILTERS.find(f=>f.id===p.filter).name}</b><br>${ARROWS[p.dir]} Остальные грузы`;
  for(const id of ['direction','filter','branch'])$(id).disabled=locked();
  $('delete-block').disabled=selected===null||!board[selected]||locked();
}
function renderMissions(){
  const d=mission.difficulty;
  $('difficulties').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.difficulty)===d)));
  $('missions').replaceChildren();for(let i=0;i<3;i++){const b=document.createElement('button'),id=d*3+i;b.textContent=i+1;b.dataset.mission=id;b.setAttribute('aria-current',String(id===mission.id));b.classList.toggle('complete',saved.completed.includes(id));b.setAttribute('aria-label',`Миссия ${i+1}${saved.completed.includes(id)?', выполнена':''}`);$('missions').append(b);}
  $('completed').textContent=`${saved.completed.length}/9`;
}
function renderDestinations(){
  $('destinations').replaceChildren();mission.sinks.forEach(cell=>{const {cargo}=mission.fixed[cell],c=CARGO[cargo],amount=mission.queue.filter(g=>g===cargo).length;const div=document.createElement('div');div.className='destination';div.innerHTML=`<span class="destination-icon">${c.icon}</span><div><b>${c.name}</b><small>${c.phase==='liquid'?'Резервуар · труба':'Склад · лента'}</small></div><strong>${state?.counts[cargo]||0} / ${amount}</strong>`;$('destinations').append(div);});
}
function renderSimulation(){
  $('board').querySelectorAll('.cargo-token').forEach(e=>e.remove());$('board').querySelectorAll('.error').forEach(e=>e.classList.remove('error'));
  if(state){for(const token of state.tokens){const e=document.createElement('span');e.className='cargo-token'+(board[token.cell]?.kind==='pipe'?' in-pipe':'');e.textContent=CARGO[token.cargo].icon;e.title=CARGO[token.cargo].name;e.setAttribute('aria-hidden','true');$('board').children[token.cell].append(e);}if(state.error)$('board').children[state.error.cell]?.classList.add('error');}
  $('delivered').textContent=state?.delivered||0;
  $('queue').querySelectorAll('span').forEach((e,i)=>e.classList.toggle('dispatched',i<(state?.next||0)));
  renderDestinations();$('pause').disabled=!locked();$('pause').textContent=paused?'▶ Дальше':'Ⅱ Пауза';$('stop').disabled=!state;$('run').disabled=locked();$('step').disabled=locked()&&!paused;
}
function stopClock(){clearInterval(timer);timer=null;}
function discardSimulation(){stopClock();state=null;paused=false;$('success').hidden=true;renderSimulation();}
function commit(next,message='Схема обновлена. Запусти партию, чтобы проверить маршруты.'){
  if(locked())return;undo.push(structuredClone(board));if(undo.length>60)undo.shift();discardSimulation();board=next;persist();renderBoard();renderPalette();renderInspector();status(message);
}
function choose(kind){if(locked())return;selected=null;tool=kind;if(kind!=='erase')template={...template,kind};renderBoard();renderPalette();renderInspector();}
function selectCell(cell){if(locked())return;const p=board[cell];if(!p)return;selected=cell;template={...p};tool=p.kind;renderBoard();renderPalette();renderInspector();status(p.kind==='splitter'?'Разветвитель выбран. Настрой правило в панели «Настройка блока».':'Блок выбран. Поверни стрелку или перетащи блок.');}
function drop(cell,block,from=null){if(locked())return;const result=place(mission,board,cell,block,from);if(!result.ok){status(result.reason,true);return;}selected=cell;tool=block.kind;template={...block};commit(result.board,block.kind==='splitter'?'Разветвитель установлен. Настрой, какие грузы должны уходить в боковой выход ✓.':'Деталь установлена. Стрелка показывает, куда поедет груз.');}
function remove(cell){if(locked()||!board[cell])return;const next=structuredClone(board);next[cell]=null;if(selected===cell)selected=null;commit(next,'Деталь возвращена в запас.');}
function configure(key,value){if(locked())return;if(selected!==null&&board[selected]){const next=structuredClone(board);next[selected][key]=value;template={...next[selected]};commit(next,'Настройка применена к выбранному блоку.');}else{template={...template,[key]:value};renderPalette();renderInspector();status('Настройка применится к новой детали.');}}
function cancelDrag(){if(drag?.active)suppressClickUntil=performance.now()+300;drag=null;cancelAnimationFrame(dragFrame);$('drag-ghost').hidden=true;document.body.classList.remove('dragging');$('board').querySelectorAll('.drop-target').forEach(e=>e.classList.remove('drop-target'));}
function load(id){
  cancelDrag();stopClock();state=null;paused=false;mission=createMission(id);const plan=saved.plans[id];board=validBoard(mission,plan)?structuredClone(plan):Array(WIDTH*HEIGHT).fill(null);selected=null;tool='belt';template={kind:'belt',dir:1,filter:'liquid',turn:1};undo=[];
  $('mission-id').textContent=String(id+1).padStart(2,'0');$('mission-title').textContent=mission.title;$('brief').textContent=mission.brief;$('total').textContent=mission.queue.length;$('success').hidden=true;
  $('cargo-list').replaceChildren();mission.goods.forEach(cargo=>{const c=CARGO[cargo],b=document.createElement('button');b.dataset.cargo=cargo;b.setAttribute('aria-pressed','false');b.innerHTML=`<span class="cargo-icon">${c.icon}</span>${c.name}`;$('cargo-list').append(b);});
  $('cargo-info').textContent='Все грузы приезжают упакованными. Лента везёт и коробки, и канистры. К резервуару подведи трубу.';
  $('queue').innerHTML=mission.queue.map(c=>`<span title="${CARGO[c].name}" aria-label="${CARGO[c].name}">${CARGO[c].icon}</span>`).join('');
  renderMissions();renderBoard();renderPalette();renderInspector();status(board.some(Boolean)?'Схема восстановлена. Продолжай строить или запусти партию.':'Начни с ленты рядом с разгрузкой. Перетащи деталь или выбери её и нажми клетку.');$('viewport').scrollLeft=0;
}
function tick(){
  if(!locked())return;
  state=advance(mission,board,state);renderSimulation();
  if(state.status==='failed'){stopClock();paused=false;renderPalette();renderInspector();status(state.error.message,true);}
  else if(state.status==='won'){
    stopClock();paused=false;if(!saved.completed.includes(mission.id))saved.completed.push(mission.id);persist();renderMissions();renderPalette();renderInspector();
    status('Контракт выполнен: каждый груз доставлен по назначению.');$('success').hidden=false;
    $('success-detail').textContent=`Доставлено ${state.delivered} грузов. В схеме ${board.filter(Boolean).length} деталей.`;$('next').textContent=mission.id===8?'Вернуться к первому контракту ↻':'Следующий контракт →';
  } else status(`Партия в пути · доставлено ${state.delivered} из ${mission.queue.length}${paused?' · пауза':''}`);
}
function clock(){stopClock();if(!paused&&locked())timer=setInterval(tick,420/speed);}
function begin(step=false){discardSimulation();state=createSimulation(mission);paused=step;renderPalette();renderInspector();tick();if(!step)clock();}
for(const filter of FILTERS){const option=document.createElement('option');option.value=filter.id;option.textContent=`${filter.icon} ${filter.name}`;$('filter').append(option);}
$('palette').addEventListener('click',e=>{if(e.detail!==0&&performance.now()<suppressClickUntil){suppressClickUntil=0;return;}const b=e.target.closest('[data-part]');if(b)choose(b.dataset.part);});
$('board').addEventListener('click',e=>{
  if(locked())return;if(e.detail!==0&&performance.now()<suppressClickUntil){suppressClickUntil=0;return;}const b=e.target.closest('[data-cell]');if(!b)return;const cell=Number(b.dataset.cell);
  if(mission.fixed[cell]){const fixed=mission.fixed[cell];if(fixed.kind==='sink'){status(`${CARGO[fixed.cargo].name}: ${CARGO[fixed.cargo].phase==='liquid'?'подведи трубу к резервуару':'подведи ленту к складу'}.`);}return;}
  if(tool==='erase')remove(cell);else if(board[cell])selectCell(cell);else drop(cell,template);
});
$('board').addEventListener('keydown',e=>{const b=e.target.closest('[data-cell]');if(!b)return;const cell=Number(b.dataset.cell),offset={ArrowUp:-WIDTH,ArrowRight:1,ArrowDown:WIDTH,ArrowLeft:-1}[e.key];if(offset){e.preventDefault();const next=cell+offset;if(next>=0&&next<board.length&&(Math.abs(offset)!==1||Math.floor(next/WIDTH)===Math.floor(cell/WIDTH)))$('board').children[next].focus();}});
$('difficulties').addEventListener('click',e=>{const b=e.target.closest('[data-difficulty]');if(b)load(Number(b.dataset.difficulty)*3);});
$('missions').addEventListener('click',e=>{const b=e.target.closest('[data-mission]');if(b)load(Number(b.dataset.mission));});
$('cargo-list').addEventListener('click',e=>{const b=e.target.closest('[data-cargo]');if(!b)return;$('cargo-info').textContent=`${CARGO[b.dataset.cargo].name}. ${CARGO[b.dataset.cargo].description}`;$('cargo-list').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button===b)));});
$('settings-shortcut').addEventListener('click',()=>{ $('inspector').scrollIntoView({block:'center'}); (tool==='splitter'?$('filter'):$('direction')).focus({preventScroll:true}); });
$('back-to-board').addEventListener('click',()=>{ $('viewport').scrollIntoView({block:'center'}); if(selected!==null) $('board').children[selected]?.focus({preventScroll:true}); });
$('direction').addEventListener('change',e=>configure('dir',Number(e.target.value)));
$('filter').addEventListener('change',e=>configure('filter',e.target.value));
$('branch').addEventListener('change',e=>configure('turn',Number(e.target.value)));
$('rotate').addEventListener('click',()=>{const p=selected!==null&&board[selected]?board[selected]:template;configure('dir',(p.dir+1)%4);});
$('erase').addEventListener('click',()=>choose(tool==='erase'?template.kind:'erase'));
$('delete-block').addEventListener('click',()=>{if(selected!==null)remove(selected);});
$('undo').addEventListener('click',()=>{if(locked()||!undo.length)return;discardSimulation();board=undo.pop();selected=null;persist();renderBoard();renderPalette();renderInspector();status('Последнее действие отменено.');});
$('clear').addEventListener('click',()=>{if(locked()||!board.some(Boolean))return;selected=null;commit(Array(WIDTH*HEIGHT).fill(null),'Схема очищена. Кнопка «Отмена» вернёт её.');});
$('run').addEventListener('click',()=>{if(!locked())begin();});
$('pause').addEventListener('click',()=>{if(!locked())return;paused=!paused;clock();renderSimulation();status(paused?'Пауза. Нажми «Шаг», чтобы проследить движение.':'Партия снова в пути.');});
$('step').addEventListener('click',()=>{if(!locked())begin(true);else if(paused)tick();});
$('speed').addEventListener('click',()=>{speed=speed===1?2:speed===2?4:1;$('speed').textContent=`${speed}×`;clock();});
$('stop').addEventListener('click',()=>{discardSimulation();renderPalette();renderInspector();status('Проверка остановлена. Схему можно редактировать.');});
$('next').addEventListener('click',()=>load((mission.id+1)%9));
$('zoom').addEventListener('click',()=>{const overview=$('viewport').classList.toggle('overview');$('zoom').setAttribute('aria-pressed',String(overview));$('zoom').innerHTML=overview?'⊞ <span>Крупнее</span>':'⊞ <span>Всё поле</span>';});
new ResizeObserver(()=>{$('viewport').style.setProperty('--viewport-width',`${$('viewport').clientWidth}px`);$('board-help').textContent=$('viewport').scrollWidth>$('viewport').clientWidth?'Поле можно прокручивать ↔':'Стрелки показывают движение груза';}).observe($('viewport'));
// Pointer capture supports mouse, touch and pen; taps remain available as a second input method.
document.addEventListener('pointerdown',e=>{
  // A fresh gesture must never be swallowed by the previous drag's synthetic click guard.
  suppressClickUntil=0;
  if(e.button!==0||locked())return;
  const palette=e.target.closest('[data-part]'),cellButton=e.target.closest('[data-cell]');
  const from=cellButton?Number(cellButton.dataset.cell):null;
  if(!palette&&(from===null||!board[from]))return;
  const element=palette||cellButton;
  drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,from:palette?null:from,block:palette?{...template,kind:palette.dataset.part}:{...board[from]},active:false};
  element.setPointerCapture(e.pointerId);
});
function dragPosition(){if(!drag?.active)return;const r=$('viewport').getBoundingClientRect();if(drag.y>r.top&&drag.y<r.bottom){if(drag.x<r.left+35)$('viewport').scrollLeft-=9;else if(drag.x>r.right-35)$('viewport').scrollLeft+=9;}if(drag.y<65)window.scrollBy(0,-7);else if(drag.y>innerHeight-65)window.scrollBy(0,7);
  $('board').querySelectorAll('.drop-target').forEach(e=>e.classList.remove('drop-target'));document.elementFromPoint(drag.x,drag.y)?.closest('[data-cell]')?.classList.add('drop-target');dragFrame=requestAnimationFrame(dragPosition);
}
document.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;drag.x=e.clientX;drag.y=e.clientY;
  if(!drag.active&&Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>7){drag.active=true;$('drag-ghost').hidden=false;$('drag-ghost').innerHTML=blockSVG(drag.block);document.body.classList.add('dragging');dragFrame=requestAnimationFrame(dragPosition);}
  if(drag.active){e.preventDefault();$('drag-ghost').style.transform=`translate(${drag.x-28}px,${drag.y-30}px)`;}
},{passive:false});
document.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.id)return;const action=drag;if(action.active){const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-cell]');cancelDrag();if(target)drop(Number(target.dataset.cell),action.block,action.from);else status('Перетащи деталь на свободную клетку поля.');}else {cancelDrag();if(action.from===null)choose(action.block.kind);else if(tool==='erase')remove(action.from);else selectCell(action.from);suppressClickUntil=performance.now()+300;}});
document.addEventListener('pointercancel',cancelDrag);
document.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea')||locked())return;if(e.key==='Escape'){cancelDrag();selected=null;renderBoard();renderInspector();renderPalette();}if(e.key.toLowerCase()==='r'){e.preventDefault();$('rotate').click();}if(e.key==='Delete'&&selected!==null){e.preventDefault();remove(selected);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&locked()&&!paused){paused=true;stopClock();renderSimulation();status('Пауза: продолжи партию, когда вернёшься.');}});
load(0);







export const DIRS = [[0,-1],[1,0],[0,1],[-1,0]];
export const CARGO = {
  water: { name:'Вода', icon:'💧', phase:'liquid', color:'#63bad5', description:'Жидкость. Приезжает в канистре. В резервуар поступает по трубе.' },
  oil: { name:'Масло', icon:'🟡', phase:'liquid', color:'#e0b754', description:'Жидкость. Приезжает в канистре. Хранится отдельно от воды и молока.' },
  milk: { name:'Молоко', icon:'🥛', phase:'liquid', color:'#ebeddf', description:'Жидкость. Приезжает в бидоне. Для резервуара нужна труба.' },
  steel: { name:'Металл', icon:'⚙️', phase:'solid', color:'#9cafc7', description:'Твёрдый груз. Едет по конвейеру на склад металла.' },
  wood: { name:'Древесина', icon:'🪵', phase:'solid', color:'#c99a6e', description:'Твёрдый груз. Брёвна едут по конвейеру на свой склад.' },
  glass: { name:'Стекло', icon:'💎', phase:'solid', color:'#a7daca', description:'Твёрдый груз, хотя и прозрачный. Нужен конвейер, а не труба.' },
  apple: { name:'Яблоки', icon:'🍎', phase:'solid', color:'#e68e7b', description:'Твёрдый груз. Яблоки отправляются на продуктовый склад.' },
};
export const FILTERS = [{id:'liquid',name:'Жидкости',icon:'≈'},{id:'solid',name:'Твёрдые грузы',icon:'■'},...Object.entries(CARGO).map(([id,c])=>({id,name:c.name,icon:c.icon}))];
export const matches = (cargo, filter) => filter === 'liquid' || filter === 'solid' ? CARGO[cargo]?.phase === filter : cargo === filter;
const specs = [
  ['Первые развилки','Вода — в резервуар, металл — на склад.',['water','steel'],3],
  ['Дерево или металл?','Раздели два твёрдых груза. Фильтр «твёрдые» здесь не поможет.',['wood','steel'],2],
  ['Прозрачное — не значит жидкое','Молоко и стекло должны попасть в разные места.',['milk','glass'],1],
  ['Три адреса','Сначала отдели жидкость, затем раздели оставшиеся грузы.',['water','steel','wood'],2],
  ['Хрупкая доставка','Масло, стекло и металл ждут в трёх разных местах.',['oil','glass','steel'],3],
  ['Для кухни и мастерской','Отправь молоко, древесину и яблоки по назначению.',['milk','wood','apple'],1],
  ['Жидкости тоже разные','Отдели жидкости, затем раздели воду и масло.',['water','oil','steel','wood'],2],
  ['Без смешивания','Молоку и маслу нужны отдельные резервуары. Стеклу и металлу — склады.',['milk','oil','glass','steel'],1],
  ['Главный инженер','Собери четыре маршрута с ограниченным запасом деталей.',['water','milk','wood','glass'],3],
];
export const WIDTH=10, HEIGHT=8;
const at=(x,y)=>y*WIDTH+x;
const part=(kind,dir=1,filter='liquid',turn=1)=>({kind,dir,filter,turn});
export function createMission(id) {
  if (!Number.isInteger(id) || !specs[id]) throw new RangeError('Unknown mission');
  const [title,brief,goods,row]=specs[id];
  const difficulty=Math.floor(id/3);
  const fixed=Array(WIDTH*HEIGHT).fill(null), solution=Array(WIDTH*HEIGHT).fill(null);
  const source=at(0,row), sinks=[];
  fixed[source]={kind:'source',dir:1};
  const sink=(x,y,cargo)=>{const cell=at(x,y);fixed[cell]={kind:'sink',cargo};sinks.push(cell);};
  const line=(x,y,ex,ey,kind)=>{while(x!==ex||y!==ey){const dir=x<ex?1:x>ex?3:y<ey?2:0;solution[at(x,y)]=part(kind,dir);const [dx,dy]=DIRS[dir];x+=dx;y+=dy;}};
  const laneKind=c=>CARGO[c].phase==='liquid'?'pipe':'belt';
  if(goods.length===2){
    line(1,row,4,row,'belt');solution[at(4,row)]=part('splitter',1,goods[0]);
    line(5,row,9,row,'belt');sink(9,row,goods[1]);
    line(4,row+1,4,7,laneKind(goods[0]));sink(4,7,goods[0]);
  } else {
    line(1,row,2,row,'belt');solution[at(2,row)]=part('splitter',1,goods.length===4?'liquid':goods[0]);
    line(3,row,6,row,'belt');solution[at(6,row)]=part('splitter',1,goods.at(-2));
    line(7,row,9,row,'belt');sink(9,row,goods.at(-1));
    line(6,row+1,6,7,'belt');sink(6,7,goods.at(-2));
    if(goods.length===3){line(2,row+1,2,7,laneKind(goods[0]));sink(2,7,goods[0]);}
    else {
      line(2,row+1,2,5,'pipe');solution[at(2,5)]=part('splitter',2,goods[0]);
      line(1,5,0,5,'pipe');sink(0,5,goods[0]);
      line(2,6,2,7,'pipe');sink(2,7,goods[1]);
    }
  }
  // Obstacles never occupy the reference solution; players can use other free cells.
  const candidates=[at(4,0),at(7,1),at(8,5),at(4,5),at(8,7),at(0,7),at(5,6),at(3,0)];
  candidates.slice(0,2+difficulty*2).forEach(cell=>{if(!fixed[cell]&&!solution[cell])fixed[cell]={kind:'wall'};});
  const stock={belt:0,pipe:0,splitter:0};
  solution.forEach(p=>{if(p)stock[p.kind]++;});
  stock.belt+=difficulty===0?5:difficulty===1?3:1;
  stock.pipe+=difficulty===0?3:difficulty===1?2:1;
  const queue=Array.from({length:goods.length*(difficulty+2)},(_,i)=>goods[(i* (goods.length===4?3:1)+Math.floor(i/goods.length))%goods.length]);
  return {id,title,brief,difficulty,goods,row,width:WIDTH,height:HEIGHT,fixed,source,sinks,stock,queue,solution};
}
export function inventory(mission,board){const left={...mission.stock};board.forEach(p=>{if(p)left[p.kind]--;});return left;}
export function validPart(p){return p&&['belt','pipe','splitter'].includes(p.kind)&&Number.isInteger(p.dir)&&p.dir>=0&&p.dir<4&&FILTERS.some(f=>f.id===p.filter)&&[1,-1].includes(p.turn);}
export function validBoard(mission,board){return Array.isArray(board)&&board.length===WIDTH*HEIGHT&&board.every((p,i)=>p===null||(!mission.fixed[i]&&validPart(p)))&&Object.values(inventory(mission,board)).every(n=>n>=0);}
export function place(mission,board,cell,block,from=null){
  if(!Number.isInteger(cell)||cell<0||cell>=board.length||mission.fixed[cell]||!validPart(block))return {ok:false,reason:'Здесь нельзя поставить блок.'};
  if(from!==null&&(!Number.isInteger(from)||from<0||from>=board.length||!board[from]||mission.fixed[from]))return {ok:false,reason:'Этот блок нельзя переместить.'};
  const next=board.map(p=>p?{...p}:null);
  if(from!==null)next[from]=null;
  next[cell]={...block};
  if(!validBoard(mission,next))return {ok:false,reason:'Эти детали закончились. Перемести уже установленную или убери лишнюю.'};
  return {ok:true,board:next};
}
export function createSimulation(mission){return {tick:0,next:0,tokens:[],delivered:0,counts:{},status:'running',error:null,idle:0,history:[]};}
const failure=(state,cell,message)=>{state.status='failed';state.error={cell,message};return state;};
export function advance(mission,board,state){
  if(state.status!=='running')return state;
  const s=structuredClone(state);s.tick++;let moved=false;
  const occupied=new Set(s.tokens.map(t=>t.cell));
  for(const token of s.tokens){
    if(token.done)continue;
    const current=mission.fixed[token.cell]||board[token.cell];
    if(!current)return failure(s,token.cell,'Лента закончилась: поставь следующий блок.');
    let dir=current.dir;
    if(current.kind==='splitter'&&matches(token.cargo,current.filter))dir=(dir+current.turn+4)%4;
    const [dx,dy]=DIRS[dir];const x=token.cell%WIDTH+dx,y=Math.floor(token.cell/WIDTH)+dy;
    if(x<0||x>=WIDTH||y<0||y>=HEIGHT)return failure(s,token.cell,'Стрелка ведёт за край цеха. Поверни блок.');
    const next=y*WIDTH+x,target=mission.fixed[next]||board[next];
    if(!target||target.kind==='wall')return failure(s,token.cell,`${CARGO[token.cargo].name}: впереди ${target?'препятствие':'нет линии'}. Продли маршрут или поверни стрелку.`);
    if(target.kind==='source')return failure(s,token.cell,'Груз вернулся на разгрузку. Измени направление.');
    if(target.kind==='pipe'&&CARGO[token.cargo].phase!=='liquid')return failure(s,next,`${CARGO[token.cargo].name} — твёрдый груз. В трубу нельзя: нужна лента или другое правило фильтра.`);
    if(target.kind==='splitter'&&dir!==target.dir)return failure(s,next,'Разветвитель принимает груз со стороны IN. Поверни его входом к линии.');
    if(['belt','pipe'].includes(target.kind)&&target.dir===(dir+2)%4)return failure(s,next,'Две стрелки смотрят навстречу. Поверни одну из них.');
    if(target.kind==='sink'){
      if(target.cargo!==token.cargo)return failure(s,next,`${CARGO[token.cargo].name} попадает в «${CARGO[target.cargo].name}». Измени правило разветвителя.`);
      if(CARGO[token.cargo].phase==='liquid'&&current.kind!=='pipe')return failure(s,next,'К резервуару нужна труба. Канистру можно везти лентой, но последний участок — трубопровод.');
      occupied.delete(token.cell);token.cell=next;token.done=true;s.delivered++;s.counts[token.cargo]=(s.counts[token.cargo]||0)+1;s.history.push({cargo:token.cargo,cell:next,tick:s.tick});moved=true;continue;
    }
    if(occupied.has(next))continue;
    if(token.visited.includes(next))return failure(s,next,'Груз ходит по кругу. Убери петлю в маршруте.');
    occupied.delete(token.cell);occupied.add(next);token.cell=next;token.visited.push(next);moved=true;
  }
  s.tokens=s.tokens.filter(t=>!t.done);
  if(s.next<mission.queue.length&&s.tick%3===1&&!occupied.has(mission.source)){
    s.tokens.push({id:s.next,cargo:mission.queue[s.next],cell:mission.source,visited:[mission.source]});s.next++;moved=true;
  }
  s.idle=moved?0:s.idle+1;
  if(s.idle>12)return failure(s,s.tokens[0]?.cell??mission.source,'Затор: грузы мешают друг другу. Раздели встречные маршруты.');
  if(s.delivered===mission.queue.length)s.status='won';
  return s;
}
export function simulate(mission,board,maxTicks=1000){let state=createSimulation(mission);for(let t=0;t<maxTicks&&state.status==='running';t++)state=advance(mission,board,state);return state;}

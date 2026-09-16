export const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
export function factoryLevel(id){
 const paths=[[14,15,16,17,18,19,20],[14,15,16,17,18,19,20],[14,7,8,9,16,17,18,19,20],[14,21,22,23,16,17,18,19,20],[14,7,0,1,2,9,16,17,18,19,20],[14,21,28,29,30,23,16,17,18,19,20]];
 if(!paths[id])throw Error('Unknown level');const path=paths[id],target={shape:id<2?'circle':id<4?'square':'star',color:id%2?'blue':'red'},source=path[0],goal=20;
 const walls=[10,11,24,25,3,31,15,22].filter(i=>!path.includes(i)).slice(0,2+id);
 const solution=Array(35).fill(null);for(let i=1;i<path.length-1;i++){const cell=path[i],next=path[i+1],d=DIRS.findIndex(([x,y])=>cell%7+x===next%7&&Math.floor(cell/7)+y===Math.floor(next/7));solution[cell]={kind:'belt',dir:d};}
 const tools=id<2?[target.color]:id<4?['cut',target.color]:['cut','press',target.color];tools.forEach((kind,i)=>solution[path[i+1]].kind=kind);
 return {id,path,source,goal,walls,target,solution,budget:path.length+1};
}
export function factoryState(level){return {cell:level.source,item:{shape:'circle',color:'gray'},seen:[],status:'running',message:'',delivered:0,ticks:0};}
export function factoryStep(level,board,state){const s=structuredClone(state);if(s.status!=='running')return s;s.ticks++;const p=s.cell===level.source?{dir:level.path[1]===7?0:level.path[1]===21?2:1}:board[s.cell];if(!p)return {...s,status:'failed',message:'Линия закончилась. Добавь деталь.'};const [dx,dy]=DIRS[p.dir],x=s.cell%7+dx,y=Math.floor(s.cell/7)+dy,n=y*7+x;
 if(x<0||x>=7||y<0||y>=5||level.walls.includes(n))return {...s,status:'failed',message:'Стрелка направлена в стену. Поверни деталь.'};
 if(n===level.goal){if(s.item.shape!==level.target.shape||s.item.color!==level.target.color)return {...s,status:'failed',message:'Изделие не совпало с заказом. Проверь форму и цвет.'};s.delivered++;if(s.delivered>=3)return {...s,cell:n,status:'won',message:'Три точных изделия. Заказ выполнен!'};return {...s,cell:level.source,item:{shape:'circle',color:'gray'},seen:[]};}
 const q=board[n];if(!q)return {...s,status:'failed',message:'Здесь нет продолжения. Построй маршрут до склада.'};if(s.seen.includes(n))return {...s,status:'failed',message:'Изделие ходит по кругу. Измени маршрут.'};s.seen.push(n);s.cell=n;
 if(q.kind==='cut')s.item.shape=s.item.shape==='circle'?'square':'circle';
 if(q.kind==='red'||q.kind==='blue')s.item.color=q.kind;
 if(q.kind==='press'){if(s.item.shape!=='square')return {...s,status:'failed',message:'Прессу нужна квадратная заготовка. Сначала поставь резак.'};s.item={shape:'star',color:'gray'};}
 return s;
}
export function railLevel(id){if(!Number.isInteger(id)||id<0||id>5)throw Error('Unknown level');const d=Math.floor(id/2);return {id,d,total:[8,12,16][d],interval:[3.2,2.55,2.05][d],speed:[.14,.16,.18][d],lives:[4,3,2][d],nodes:[[.07,.5],[.35,.5],[.54,.2],[.91,.2],[.60,.5],[.91,.5],[.68,.8],[.91,.8]].map(([x,y])=>[x,id%2?1-y:y]),queue:Array.from({length:[8,12,16][d]},(_,i)=>(i*2+Math.floor(i/3)+id)%3)};}
export function railState(level){return {time:0,spawn:0,queue:[...level.queue],next:0,trains:[],delivered:0,lives:level.lives,status:'running',events:[],serial:0};}
export function railStep(level,state,switches,dt){const s=structuredClone(state);if(s.status!=='running')return s;s.time+=dt;s.events=[];
 if(s.time>=s.spawn&&s.next<s.queue.length){s.trains.push({id:s.serial++,cargo:s.queue[s.next++],from:0,to:1,p:0});s.spawn=s.time+level.interval;}
 for(const train of s.trains){const a=level.nodes[train.from],b=level.nodes[train.to],distance=Math.hypot(a[0]-b[0],a[1]-b[1]);train.p+=dt*level.speed/distance;if(train.p<1)continue;const at=train.to;
  if([3,5,7].includes(at)){const dest={3:0,5:1,7:2}[at];if(dest===train.cargo){s.delivered++;s.events.push('delivery');}else{s.lives--;s.queue.push(train.cargo);s.events.push('fail');}train.done=true;continue;}
  train.from=at;train.p=0;train.to=at===1?(switches[0]?2:4):at===2?3:at===4?(switches[1]?6:5):7;
 }
 s.trains=s.trains.filter(t=>!t.done);if(s.lives<=0)s.status='failed';else if(s.delivered>=level.total)s.status='won';return s;
}
const P=(op,n=1)=>({op,n});
export function robotLevel(id){if(!Number.isInteger(id)||id<0||id>5)throw Error('Unknown level');const d=Math.floor(id/2),mirror=id%2===1;let solution=d===0?[P('act'),P('E',3),P('act'),P('W',3)]:d===1?[P('act'),P('N',3),P('E',3),P('act'),P('W',3),P('S',3)]:[P('act'),P('N',3),P('E',3),P('S'),P('act'),P('N'),P('W',3),P('S',3)];
 if(mirror)solution=solution.map(p=>({...p,op:p.op==='E'?'W':p.op==='W'?'E':p.op}));const source=24+(mirror?4:1),goal=d===0?24+(mirror?1:4):d===1?6+(mirror?1:4):12+(mirror?1:4);const walls=d===0?[8,9,14,15]:[14,15,20,21];return {id,d,source,goal,walls,needed:d+1,solution,max:8};}
export function robotState(level){return {cell:level.source,held:false,delivered:0,pc:0,repeated:0,steps:0,status:'running',message:''};}
export function robotStep(level,program,loop,state){const s=structuredClone(state);if(s.status!=='running')return s;if(!program.length)return {...s,status:'failed',message:'Добавь команды в программу.'};if(s.pc>=program.length){if(!loop)return {...s,status:'failed',message:'Команды закончились. Добавь путь или включи повтор.'};s.pc=0;s.repeated=0;}if(s.steps++>240)return {...s,status:'failed',message:'Программа зациклилась. Проверь маршрут.'};const cmd=program[s.pc];
 if(cmd.op==='act'){if(s.cell===level.source&&!s.held)s.held=true;else if(s.cell===level.goal&&s.held){s.held=false;s.delivered++;if(s.delivered===level.needed)return {...s,status:'won',message:'Все посылки доставлены!'};}else return {...s,status:'failed',message:s.held?'Сдавать посылку нужно на клетке со флагом.':'Брать посылку нужно на клетке с коробкой.'};}
 else{const d={N:0,E:1,S:2,W:3}[cmd.op];if(d===undefined)return {...s,status:'failed',message:'Неизвестная команда.'};const [dx,dy]=DIRS[d],x=s.cell%6+dx,y=Math.floor(s.cell/6)+dy,n=y*6+x;if(x<0||x>=6||y<0||y>=6||level.walls.includes(n))return {...s,status:'failed',message:'Робот упёрся в стену. Исправь этот участок программы.'};s.cell=n;}
 s.repeated++;if(s.repeated>=cmd.n){s.pc++;s.repeated=0;}return s;
}

import assert from 'node:assert/strict';
import {CARGO,createMission,inventory,place,validBoard,createSimulation,advance,simulate,matches,WIDTH} from '../public/games/sorting-yard/model.js';
for(let id=0;id<9;id++){
 const m=createMission(id),board=structuredClone(m.solution);
 assert(validBoard(m,board));assert.deepEqual(m,createMission(id));
 const state=simulate(m,board);assert.equal(state.status,'won',`Mission ${id}: ${state.error?.message}`);assert.equal(state.delivered,m.queue.length);
 for(const cargo of m.goods)assert.equal(state.counts[cargo],m.queue.filter(c=>c===cargo).length);
 const empty=simulate(m,Array(80).fill(null));assert.equal(empty.status,'failed');assert.match(empty.error.message,/нет линии/);
 const splitter=board.findIndex(p=>p?.kind==='splitter');board[splitter].filter='apple';assert.equal(simulate(m,board).status,'failed','Wrong filter cannot win');
 const liquidSink=m.sinks.find(cell=>CARGO[m.fixed[cell].cargo].phase==='liquid');
 if(liquidSink!==undefined){const b=structuredClone(m.solution);const predecessor=b.findIndex((p,cell)=>p&&cell+[[0,-1],[1,0],[0,1],[-1,0]][p.dir][0]+[[0,-1],[1,0],[0,1],[-1,0]][p.dir][1]*WIDTH===liquidSink);b[predecessor].kind='belt';assert.match(simulate(m,b).error.message,/труба/);}
}
assert(matches('water','liquid'));assert(matches('glass','solid'));assert(!matches('glass','liquid'));assert(matches('steel','steel'));assert(!matches('wood','steel'));
const m=createMission(0),empty=Array(80).fill(null),p={kind:'belt',dir:1,filter:'liquid',turn:1};
assert(!place(m,empty,m.source,p).ok);assert(!place(m,empty,-1,p).ok);assert(!place(m,empty,1,{...p,dir:NaN}).ok);
let first=place(m,empty,1,p);assert(first.ok);assert.equal(empty[1],null,'Placement must not mutate input');
let moved=place(m,first.board,2,p,1);assert(moved.ok);assert.equal(moved.board[1],null);assert.equal(inventory(m,moved.board).belt,m.stock.belt-1);
assert.deepEqual(place(m,moved.board,2,p,2).board,moved.board,'Dropping a block onto itself preserves it');
assert(!place(m,empty,2,p,1).ok,'Missing source block cannot be moved');
const full=Array(80).fill(null);let count=0;for(let i=0;i<80&&count<m.stock.belt;i++)if(!m.fixed[i]){full[i]={...p};count++;}
const free=full.findIndex((p,i)=>!p&&!m.fixed[i]);assert(!place(m,full,free,p).ok,'Stock limits enforced');
assert(!validBoard(m,Array(79).fill(null)));const invalid=structuredClone(empty);invalid[2]={...p,filter:'unknown'};assert(!validBoard(m,invalid));
const liquidWrong=structuredClone(m.solution);const filterCell=liquidWrong.findIndex(p=>p?.kind==='splitter');liquidWrong[filterCell].filter='solid';assert.match(simulate(m,liquidWrong).error.message,/твёрдый груз/);
const wrongEntry=structuredClone(m.solution);wrongEntry[filterCell].dir=0;assert.match(simulate(m,wrongEntry).error.message,/IN/);
const loop=Array(80).fill(null),y=m.row;loop[y*10+1]={...p,dir:2};loop[(y+1)*10+1]={...p,dir:1};loop[(y+1)*10+2]={...p,dir:0};loop[y*10+2]={...p,dir:3};assert.match(simulate(m,loop).error.message,/кругу/);
const initial=createSimulation(m),after=advance(m,m.solution,initial);assert.equal(initial.tick,0);assert.equal(after.tick,1);assert.equal(initial.tokens.length,0);
const won=simulate(m,m.solution);assert.deepEqual(advance(m,m.solution,won),won,'Finished simulation is stable');
console.log('Sorting yard: all 9 missions, delivery counts, filters, phases, tank inlets, loops, stock, moves, restore validation and immutable steps passed.');

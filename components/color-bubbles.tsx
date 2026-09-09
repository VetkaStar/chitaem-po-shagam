'use client';
import {useEffect,useRef,useState} from 'react';
import {Volume2} from 'lucide-react';
import {shuffled} from '@/lib/session';
const colors=[{name:'розовые',single:'Розовый',fill:'#ee92bb'},{name:'зелёные',single:'Зелёный',fill:'#85c994'},{name:'голубые',single:'Голубой',fill:'#79c9e7'},{name:'жёлтые',single:'Жёлтый',fill:'#f0d269'}];
export default function ColorBubbles({motion,sound,autoSpeech,onSpeak,onTone}:{motion:boolean;sound:boolean;autoSpeech:boolean;onSpeak:(s:string)=>void;onTone:()=>void}){
 const [board,setBoard]=useState(()=>shuffled([0,0,1,1,2,2,3,3])),[order,setOrder]=useState(()=>[0,...shuffled([1,2,3])]),[step,setStep]=useState(0),[popped,setPopped]=useState<number[]>([]),[moving,setMoving]=useState(motion),[message,setMessage]=useState(''),[celebrate,setCelebrate]=useState(false),[round,setRound]=useState(0);
 const caught=useRef(new Set<number>()),locked=useRef(false),speaker=useRef(onSpeak);speaker.current=onSpeak;
 const done=step===4,color=colors[order[Math.min(step,3)]],task=done?'Все цвета найдены! Молодец!':`Лопни все ${color.name} пузыри.`,found=popped.filter(i=>board[i]===order[step]).length;
 useEffect(()=>{if(sound&&autoSpeech)speaker.current(task)},[task,round,sound,autoSpeech]);
 useEffect(()=>{if(!celebrate)return;const timer=setTimeout(()=>{setStep(s=>s+1);setMessage('');setCelebrate(false);locked.current=false},1800);return()=>clearTimeout(timer)},[celebrate]);
 useEffect(()=>()=>{window.speechSynthesis?.cancel()},[]);
 function pop(i:number){if(done||locked.current||caught.current.has(i))return;if(board[i]!==order[step]){const prompt=`Сейчас ищем ${color.name}. Посмотри на образец сверху.`;setMessage(prompt);if(sound&&autoSpeech)speaker.current(prompt);return}caught.current.add(i);const next=[...caught.current];setPopped(next);setMessage('');try{onTone()}catch{};if(next.filter(j=>board[j]===order[step]).length===2){locked.current=true;setCelebrate(true);const praise=`Молодец! Все ${color.name} найдены!`;setMessage(praise);if(sound&&autoSpeech)speaker.current('Молодец!')}}
 function restart(){caught.current.clear();locked.current=false;setBoard(shuffled([0,0,1,1,2,2,3,3]));const next=shuffled([0,1,2,3]);if(next[0]===order[0])[next[0],next[1]]=[next[1],next[0]];setOrder(next);setStep(0);setPopped([]);setMessage('');setCelebrate(false);setRound(n=>n+1)}
 return <div className="color-bubbles">
 <div className="bubble-goal"><span className="color-swatch" style={{background:color.fill}} aria-hidden/><p>{task}</p>{sound&&<button className="feedback-speaker" aria-label="Озвучить задание с пузырями" onClick={()=>onSpeak(message||task)}><Volume2 size={20}/></button>}</div>
 <div className="bubble-controls"><button aria-pressed={moving&&motion} disabled={!motion} onClick={()=>setMoving(v=>!v)}>{moving&&motion?'Двигаются · остановить':'Стоят · включить движение'}</button><small>{done?'4 из 4 цветов':`Цвет ${step+1} из 4 · найдено ${found} из 2`}</small></div>
 {!motion&&<small>Движение выключено в настройках взрослого.</small>}
 <p className="bubble-response" role="status" aria-live="polite">{message||(done?'Можно сыграть ещё или вернуться к чтению.':'Найди пузыри такого же цвета, как образец.')}</p>
 <div className={'color-bubble-field '+(moving&&motion?'bubble-moving':'bubble-static')} aria-label="Пузыри разных цветов">{board.map((c,i)=><div className="color-bubble-slot" key={round+'-'+i}><button className={'color-bubble '+(popped.includes(i)?'bubble-popped':'')} style={{background:colors[c].fill,animationDelay:`-${i*1.7}s`,animationDuration:`${9+i%3*2}s`,animationPlayState:celebrate?'paused':'running'}} aria-label={`${colors[c].single} пузырь ${i+1}`} disabled={done||celebrate||popped.includes(i)} onClick={()=>pop(i)}>{popped.includes(i)?'✓':''}</button></div>)}</div>
 {done&&<button onClick={restart}>Ещё цвета</button>}
 </div>
}


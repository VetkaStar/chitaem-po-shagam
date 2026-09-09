'use client';
import {useEffect,useRef,useState} from 'react';
import {breaks} from '@/lib/learning';
import ColorBubbles from '@/components/color-bubbles';
import {shuffled} from '@/lib/session';
type Game='menu'|'move'|'bubbles'|'pairs'|'music';
const notes=[261.63,293.66,329.63,392,440];
const song=[0,0,2,2,3,3,2,1,1,0,1,2,1,0];
export default function RestHub({sound,motion,autoSpeech,onSpeak,onReturn}:{sound:boolean;motion:boolean;autoSpeech:boolean;onSpeak:(s:string)=>void;onReturn:()=>void}){
 const [game,setGame]=useState<Game>('menu'),[move,setMove]=useState(0),[popped,setPopped]=useState<number[]>([]),[round,setRound]=useState(0),[cards,setCards]=useState<string[]>([]),[open,setOpen]=useState<number[]>([]),[matched,setMatched]=useState<number[]>([]),[active,setActive]=useState(-1),[playing,setPlaying]=useState(false);
 const audio=useRef<AudioContext|null>(null),timers=useRef<ReturnType<typeof setTimeout>[]>([]),lock=useRef(false);
 function silence(){timers.current.forEach(clearTimeout);timers.current=[];if(audio.current){void audio.current.close();audio.current=null}setPlaying(false);setActive(-1);window.speechSynthesis?.cancel()}
 useEffect(()=>()=>{timers.current.forEach(clearTimeout);void audio.current?.close();window.speechSynthesis?.cancel()},[]);
 function choose(g:Game){silence();setGame(g);setOpen([]);setMatched([]);lock.current=false;setPopped([]);if(g==='pairs')setCards(shuffled(['🌼','🐢','🍓','🌼','🐢','🍓']))}
 function tone(n:number,duration=.4){setActive(n);if(sound){const ctx=audio.current??new AudioContext();audio.current=ctx;void ctx.resume();const o=ctx.createOscillator(),gain=ctx.createGain();o.type='sine';o.frequency.value=notes[n];gain.gain.setValueAtTime(0,ctx.currentTime);gain.gain.linearRampToValueAtTime(.09,ctx.currentTime+.025);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+duration);o.connect(gain);gain.connect(ctx.destination);o.start();o.stop(ctx.currentTime+duration+.03)}timers.current.push(setTimeout(()=>setActive(-1),duration*1000))}
 function melody(){if(playing){silence();return}silence();setPlaying(true);song.forEach((n,i)=>timers.current.push(setTimeout(()=>tone(n,.43),i*600)));timers.current.push(setTimeout(()=>{setPlaying(false);setActive(-1)},song.length*600))}
 function flip(i:number){if(lock.current||open.includes(i)||matched.includes(i))return;const next=[...open,i];setOpen(next);if(next.length===2){if(cards[next[0]]===cards[next[1]]){setMatched(m=>[...m,...next]);setOpen([])}else{lock.current=true;timers.current.push(setTimeout(()=>{setOpen([]);lock.current=false},1300))}}}
 return <div className="rest-hub">
 {game==='menu'?<><p>Выбери, как отдохнуть</p><div className="rest-menu">
 <button onClick={()=>choose('move')}><span>🙌</span><b>Размяться</b><small>Двигаемся вместе</small></button>
 <button onClick={()=>choose('bubbles')}><span>🫧</span><b>Пузырьки</b><small>Найди нужный цвет</small></button>
 <button onClick={()=>choose('pairs')}><span>🍓</span><b>Найди пару</b><small>Открой две картинки</small></button>
 <button onClick={()=>choose('music')}><span>🎵</span><b>Музыкальная полянка</b><small>Играй или слушай мелодию</small></button>
 </div></>:<>
 <button className="text-button" onClick={()=>choose('menu')}>← Другой отдых</button>
 {game==='move'&&<div className="movement"><span className="rest-emoji">{breaks[move].icon}</span><h3>{breaks[move].title}</h3><p>{breaks[move].text}</p><button onClick={()=>onSpeak(breaks[move].text)}>🔊 Послушать</button><button onClick={()=>{window.speechSynthesis?.cancel();setMove(i=>(i+1)%breaks.length)}}>Другое движение →</button></div>}
 {game==='bubbles'&&<ColorBubbles sound={sound} motion={motion} autoSpeech={autoSpeech} onSpeak={onSpeak} onTone={()=>tone(2,.14)}/>}
 {game==='pairs'&&<><p aria-live="polite">{matched.length===6?'Все пары вместе!':'Найди одинаковые картинки'}</p><div className="pair-grid">{cards.map((c,i)=><button key={i} disabled={matched.includes(i)} className={matched.includes(i)?'paired':''} aria-label={open.includes(i)||matched.includes(i)?`Картинка ${c}`:`Открыть карточку ${i+1}`} onClick={()=>flip(i)}>{open.includes(i)||matched.includes(i)?c:'?'}</button>)}</div>{matched.length===6&&<button onClick={()=>choose('pairs')}>Новые пары</button>}</>}
 {game==='music'&&<><span className="music-tree" aria-hidden>🌿</span><p>Нажимай на цветы — сочини свою мелодию</p><div className="music-keys">{['🌼','🌷','🌸','🌻','🌺'].map((s,i)=><button key={s} className={active===i?'note-on':''} aria-label={`Нота ${i+1}`} disabled={playing} onClick={()=>tone(i)}>{s}</button>)}</div><button onClick={melody}>{playing?'■ Остановить мелодию':'▶ Послушать мелодию'}</button><p className="music-verse">Руки к солнцу подними,<br/>Облачку рукой махни.<br/>Тихо плечи опусти,<br/>Улыбнись и отдохни.</p><button onClick={()=>{silence();onSpeak('Руки к солнцу подними. Облачку рукой махни. Тихо плечи опусти. Улыбнись и отдохни.')}}>🔊 Стишок с движениями</button>{!sound&&<small>Звук выключен в настройках взрослого. Цветы всё равно загораются.</small>}</>}
 </>}
 <button className="primary return-lesson" onClick={()=>{silence();onReturn()}}>Вернуться к чтению →</button>
 </div>
}

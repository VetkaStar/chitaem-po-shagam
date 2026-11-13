/** Real app/hook/storage; only media and optional pre-commit latency are controlled by QA. */
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import AppPortal from '../../features/portal/AppPortal';
import LessonWorkspace from '../../features/lesson/LessonWorkspace';
import WordBridge from '../../features/lesson/WordBridge';
import ExerciseCard from '../../features/lesson/ExerciseCard';
import { useLesson, type LessonModel } from '../../features/lesson/use-lesson';
import { FreeExposureContext } from '../../features/free-practice/use-free-exposure';
import { recordFreeExposure, waitForFreeExposure } from '../../features/free-practice/service';
import { loadBundledSupply } from '../../lib/curriculum/bundled';
import { IndexedDbProgressStore } from '../../lib/progress/indexed-db';
import type { FreeExposure } from '../../lib/curriculum/free-exposure';
import '../../app/globals.css';
type QaPilot={model?:LessonModel;hold:boolean;waiters:Array<()=>void>;requested:FreeExposure[];committed:FreeExposure[];spoken:string[];completed:number;
 release:()=>void;bridge?:(unit:number,target:string)=>void;durable:()=>Promise<unknown>};
declare global {interface Window {qaPilot:QaPilot}}
window.qaPilot={hold:false,waiters:[],requested:[],committed:[],spoken:[],completed:0,
 release(){this.hold=false;this.waiters.splice(0).forEach(fn=>fn());},
 async durable(){await waitForFreeExposure();const store=new IndexedDbProgressStore(await loadBundledSupply());try{return await store.read();}finally{await store.close();}}};
function Fixture(){
 const model=useLesson();window.qaPilot.model=model;
 const [bridge,setBridge]=useState({unit:0,target:'МА'});window.qaPilot.bridge=(unit,target)=>setBridge({unit,target});
 const presented:LessonModel={...model,supported:true,speak:text=>window.qaPilot.spoken.push(text)};
 if(new URLSearchParams(location.search).get('mode')==='lesson')return <FreeExposureContext.Provider value={recordFreeExposure}><ExerciseCard model={presented}/></FreeExposureContext.Provider>;
 if(new URLSearchParams(location.search).get('mode')==='bridge')return <FreeExposureContext.Provider value={recordFreeExposure}>
   <WordBridge key={bridge.unit+':'+bridge.target} {...bridge} sound={true} speak={presented.speak} onComplete={()=>window.qaPilot.completed++}/>
 </FreeExposureContext.Provider>;
 return <AppPortal model={presented}>{onAnswer=><LessonWorkspace model={presented} onAnswer={onAnswer}/>}</AppPortal>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);

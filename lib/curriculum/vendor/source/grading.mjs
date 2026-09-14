import {normalise,equalSet} from './normalise.mjs';
const noRead={readingVerified:false,readingCorrect:null};
/** Responses contain learner input, never authoritative correctness. */
export function readingProof(response={}){
 const r=response.reading;
 if(!r||r.verifier!=='companion'||typeof r.correct!=='boolean')return {...noRead,outcome:'needs_verifier'};
 return {readingVerified:true,readingCorrect:r.correct,outcome:r.correct?'correct':'incorrect'};
}
export function grade(item,response={}){
 if(!response||typeof response!=='object'||Array.isArray(response))throw new TypeError('Response must be an object');
 const a=item.answer;if(!a)throw new Error('Task without answer contract');
 if(a.kind==='companion_function'){const f=response.function;if(!f||f.verifier!=='companion'||f.capabilityId!==a.capabilityId||typeof f.correct!=='boolean')return {...noRead,outcome:'needs_verifier',functionVerified:false};return {...noRead,outcome:f.correct?'correct':'incorrect',functionVerified:f.correct&&f.targetHelpLevel===0,functionCapabilityId:a.capabilityId};}
 if(a.kind==='companion_reading')return readingProof(response);
 if(a.kind==='choice'){
  const selection=equalSet(response.optionIds,a.correctOptionIds)?'correct':'incorrect';
  if(item.kind==='read_meaning'){
   const reading=readingProof(response);
   return {...reading,meaningOutcome:selection,outcome:reading.outcome==='needs_verifier'?'needs_verifier':reading.outcome==='correct'&&selection==='correct'?'correct':'incorrect'};
  }
  return {...noRead,outcome:selection};
 }
 if(a.kind==='exact')return {...noRead,outcome:typeof response.text==='string'&&normalise(response.text)===normalise(a.value)?'correct':'incorrect'};
 if(a.kind==='ordered_parts'){
  const ids=response.tokenIds;const ts=item.partTokens??[];const map=new Map(ts.map(x=>[x.tokenId,x.text]));
  const ok=Array.isArray(ids)&&ids.length===ts.length&&new Set(ids).size===ids.length&&ids.every(x=>map.has(x))&&ids.map(x=>map.get(x)).join(a.joiner??'')===a.joined;
  return {...noRead,outcome:ok?'correct':'incorrect'};
 }
 if(a.kind==='spans'){
  const key=x=>x&&Number.isInteger(x.line)&&Number.isInteger(x.start)&&Number.isInteger(x.end)?`${x.line}:${x.start}:${x.end}`:'INVALID';
  return {...noRead,outcome:Array.isArray(response.segments)&&!response.segments.some(x=>key(x)==='INVALID')&&equalSet(response.segments.map(key),a.segments.map(key))?'correct':'incorrect'};
 }
 if(a.kind==='boundaries'){
  const b=response.boundaries;
  const ok=Array.isArray(b)&&b.every(x=>Number.isInteger(x)&&x>0&&x<item.learnerText.length)&&a.acceptedBoundaries.some(k=>equalSet(b,k));
  return {...noRead,outcome:ok?'correct':'incorrect'};
 }
 if(a.kind==='question_set'){
  const ans=response.answers??{};
  if((typeof ans!=='object')||ans===null)throw new TypeError('Answers must be an object or array');
  const results=a.questions.map((q,i)=>{const answer=Array.isArray(ans)?ans[i]:ans[q.id];return {questionId:q.id,questionIndex:i,outcome:!Array.isArray(answer)||answer.length===0?'unanswered':equalSet(answer,q.correctOptionIds)?'correct':'incorrect',skillIds:q.skillIds??[],support:q.support};});
  const rp=readingProof(response);
  return {...rp,questionResults:results,outcome:results.some(x=>x.outcome==='unanswered')?'partial':results.every(x=>x.outcome==='correct')?'correct':'incorrect'};
 }
 if(a.kind==='ordered_ids')return {...noRead,outcome:Array.isArray(response.optionIds)&&response.optionIds.length===a.value.length&&response.optionIds.every((x,i)=>x===a.value[i])?'correct':'incorrect'};
 throw new Error('Unsupported answer '+a.kind);
}
/** For regression tests only: construct a known correct raw answer. Do not expose this to the learner. */
export function exampleCorrectResponse(item){
 const a=item.answer;
 if(a.kind==='companion_function')return {function:{verifier:'companion',correct:true,capabilityId:a.capabilityId,targetHelpLevel:0}};
 if(a.kind==='companion_reading')return {reading:{verifier:'companion',correct:true}};
 if(a.kind==='choice')return {optionIds:[...a.correctOptionIds],...(item.kind==='read_meaning'?{reading:{verifier:'companion',correct:true}}:{})};
 if(a.kind==='exact')return {text:a.value};
 if(a.kind==='ordered_parts')return {tokenIds:item.partTokens.map(x=>x.tokenId)};
 if(a.kind==='spans')return {segments:structuredClone(a.segments)};
 if(a.kind==='boundaries')return {boundaries:[...a.acceptedBoundaries[0]]};
 if(a.kind==='question_set')return {answers:Object.fromEntries(a.questions.map(q=>[q.id,[...q.correctOptionIds]])),reading:{verifier:'companion',correct:true}};
 if(a.kind==='ordered_ids')return {optionIds:[...a.value]};
 throw new Error('Unknown kind');
}

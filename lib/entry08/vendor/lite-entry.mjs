/** First-entry controller 0.8.1. No network, autoplay, or fabricated companion proofs.
 * Persist EVERY returned state before rendering a target or starting target audio.
 * The host owns existing SpeechButton / microphone / storage components.
 */
export const VERSION='0.8.1';
export const P1='method_syllable_first', P2='method_word_first';
export class EntryError extends Error { constructor(code){super(code);this.code=code;} }
const copy=x=>structuredClone(x);
const own=(o,k)=>Object.hasOwn(o,k);
const norm=x=>String(x??'').normalize('NFC').replace(/[\u0300\u0301]/g,'').toUpperCase().replace(/[^А-ЯЁ0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const requireGroup=(bank,id)=>{if(typeof id!=='string'||!own(bank.groups,id))throw new EntryError('UNKNOWN_ENTRY_GROUP');return bank.groups[id];};
const UP={CV:'CVC',VC:'CVC',CVC:'CV2',CV2:'LEN3',LEN3:'MEDIAL',MEDIAL:'INITIAL',INITIAL:'SUBJECT',SUBJECT:'LOCATE2',LOCATE2:'FACTS3',FACTS3:'SEQ2',SEQ2:null,LISTEN:null};
const DOWN={CV:null,VC:'CV',CVC:'CV',CV2:'CV',LEN3:'CV2',MEDIAL:'CV2',INITIAL:'CVC',SUBJECT:'CV2',LOCATE2:'SUBJECT',FACTS3:'LOCATE2',SEQ2:'LOCATE2',LISTEN:null};
const RANK=['letters','syllables','short_words','multi_part','sentences','texts'];
const START={letters:'CV',syllables:'CVC',short_words:'CV2',multi_part:'LEN3',sentences:'SUBJECT',texts:'LOCATE2',unknown:'CVC'};
export const QUESTIONNAIRE=[
 {id:'respondent',text:'Кто сейчас отвечает?',options:[['parent','Взрослый о ребёнке'],['self','Я о себе'],['child','Ребёнок сам']]},
 {id:'age',text:'Сколько лет тому, кто будет заниматься?',options:[['under8','До 8 лет'],['8to12','8–12 лет'],['13plus','13 лет и старше'],['unknown','Не указывать']]},
 {id:'reads',text:'Что уже получается читать самостоятельно?',options:[['letters','Буквы'],['syllables','Слоги'],['short_words','Короткие слова'],['multi_part','Длинные слова'],['sentences','Предложения'],['texts','Небольшие тексты'],['unknown','Не знаю']]},
 {id:'difficulty',text:'Что сейчас труднее всего?',options:[['blending','Соединять слоги в слово'],['long','Читать длинные слова'],['meaning','Понимать прочитанное'],['letters','Различать буквы'],['unknown','Пока не знаю']]},
 {id:'goal',text:'С чего хотелось бы начать?',options:[['words','Читать слова'],['sentences','Читать предложения'],['meaning','Лучше понимать'],['unknown','Подберите начало']]},
 {id:'companion',text:'Во время занятий рядом будет взрослый?',options:[['yes','Да'],['sometimes','Иногда'],['no','Нет']]},
 {id:'input',text:'Как удобнее отвечать?',options:[['voice','Голосом'],['buttons','Нажатием'],['both','Попробуем оба способа']]},
 {id:'interests',text:'Что интересно?',multiple:true,options:[['technology','Техника'],['videogames','Игры'],['animals','Животные'],['everyday','Обычная жизнь'],['unknown','Пропустить']]}
];
export function questionnaireFor(config={}) {
 if(config.respondent==='child')return []; // Never render the adult form to a child.
 return QUESTIONNAIRE.filter(q=>config[q.id]===undefined||config[q.id]===null).map(q=>q.id==='companion'&&config.respondent==='self'?{...q,text:'Во время занятий рядом будет помощник?'}:q);
}
export function settings(a={}){
 const reads=Array.isArray(a.reads)?RANK.filter(x=>a.reads.includes(x)).at(-1):RANK.includes(a.reads)?a.reads:'unknown';
 let group=START[reads??'unknown'];
 if(a.difficulty==='blending')group='CV2';
 if(a.difficulty==='long'&&['multi_part','sentences','texts'].includes(reads))group='LEN3';
 return {...a,respondent:['child','self','parent'].includes(a.respondent)?a.respondent:'child',age:['under8','8to12','13plus','unknown'].includes(a.age)?a.age:'unknown',reads:reads??'unknown',group,program:[P1,P2].includes(a.program)?a.program:P1,input:['voice','buttons','both'].includes(a.input)?a.input:'both',companion:a.companion===true||a.companion==='yes',interests:Array.isArray(a.interests)?a.interests:[]};
}
export function createEntry(a={},id='entry',history={}){
 const c=settings(a),young=['under8','unknown'].includes(c.age);
 return {version:VERSION,id,revision:0,config:c,initialGroup:c.group,group:c.group,active:null,observations:[],used:[],prompts:copy(history.prompts??[]),sourceExposures:[],receipts:[],gap:null,gapHistory:[],readingGroup:c.group,audioSerial:0,wordObserved:false,meaningDone:false,uncertainCards:0,
 visit:{id:id+':v1',number:1,used:0,budget:young?3:5},total:0,totalBudget:young?4:6,paused:false,finished:false,accessReady:false,voiceAvailable:null,voiceOptIn:false,history:copy(history),trace:[]};
}
/** Explicit minor-version migration preserves answers, observations and reserved budget. */
export function upgradeEntry(state){
 if(!['0.8.0',VERSION].includes(state.version))throw new EntryError('ENTRY_VERSION_MISMATCH');
 const s=copy(state);s.version=VERSION;s.readingGroup??=s.group==='LISTEN'?s.initialGroup:s.group;
 s.audioSerial??=0;s.gapHistory??=[];
 if(s.active){s.active.audio=null;s.active.captureId=null;s.active.speechIssue??=null;if(s.active.phase==='listening')s.active.phase=s.active.played?'question':'listen';}
 // Repair the recorded lower-probe case, using observed difficulties only, never ASR uncertainty.
 for(const o of s.observations??[]){if(!['assisted','self_difficulty','observed_difficulty'].includes(o.result))continue;
  let lower=s.gap?.groupId;while(lower&&lower!==o.groupId)lower=DOWN[lower];
  if(s.gap&&lower===o.groupId)s.gap={...s.gap,originGroupId:s.gap.originGroupId??s.gap.groupId,groupId:o.groupId,reason:o.result};
 }
 return changed(s,'migrated_to_'+VERSION);
}
function changed(s,event){s.revision++;s.trace.push({event,revision:s.revision});return s;}
/** Explicit mode changes update the effective configuration, not just device availability. */
export function updateInputMode(state,bank,input){
 if(!['voice','buttons','both'].includes(input))throw new EntryError('INVALID_INPUT_MODE');
 let s=cancelAudio(copy(state));
 if(s.active)s.active.captureId=null;
 if(s.active&&!['question','feedback'].includes(s.active.phase)){
  const issue=s.active.speechIssue;
  s=next(finish(s,bank,issue?'unassessed':'skipped',{reason:issue?.code??'input_changed'}));
 }
 s.config.input=input;
 if(s.group!=='LISTEN')s.readingGroup=s.group;
 s.voiceAvailable=false;s.voiceOptIn=false;s.accessReady=false;
 s.group=input==='buttons'&&!s.config.companion?'LISTEN':(s.readingGroup??s.initialGroup);
 return changed(s,'input_selected_'+input);
}
export function accessReady(state,{voiceAvailable=false,voiceOptIn=false}={}){
 const s=copy(state);s.accessReady=true;
 s.voiceAvailable=!!voiceAvailable;s.voiceOptIn=!!voiceOptIn;
 if(s.config.input==='buttons'||!voiceAvailable||!voiceOptIn){
  if(!s.config.companion){if(s.group!=='LISTEN')s.readingGroup=s.group;s.group='LISTEN';}
 }else{
  if(s.group==='LISTEN')s.group=s.readingGroup??s.initialGroup;
  if(!state.voiceAvailable)s.uncertainCards=0;
  if(s.active)s.active.speechIssue=null;
 }
 return changed(s,'access_ready');
}
function targetKey(card){return norm(card.target);}
function prompted(state,card){return state.prompts.some(e=>e.visitId===state.visit.id&&e.target===targetKey(card))||(state.history.promptedTargetsThisVisit??[]).includes(targetKey(card));}
export function nextScreen(state,bank){
 if(state.version!==VERSION)throw new EntryError('ENTRY_VERSION_MISMATCH');
 requireGroup(bank,state.group);
 if(state.paused)return {kind:'pause'};
 if(state.active)return {kind:'active',instanceId:state.active.instanceId};
 if(!state.accessReady)return {kind:'access'};
 if(state.finished||state.total>=state.totalBudget)return {kind:'report'};
 let gid=state.group;
 if(state.uncertainCards>=2&&!state.config.companion)gid='LISTEN';
 // Reserve a simple meaning task when possible; no obligatory full graph audit.
 if(!state.gap&&!state.meaningDone&&state.wordObserved&&state.totalBudget-state.total<=2&&gid!=='LISTEN')gid='SUBJECT';
 const g=requireGroup(bank,gid);
 const card=g.cardIds.map(id=>bank.cards[id]).find(c=>!state.used.includes(c.id)&&!prompted(state,c));
 if(!card)return {kind:'report',reason:'BANK_OR_PROMPT_LIMIT'};
 const cost=card.type==='passage'?2:1;
 if(state.total+cost>state.totalBudget)return {kind:'report',reason:'TOTAL_LIMIT'};
 if(state.visit.used+cost>state.visit.budget)return {kind:'pause',reason:'VISIT_LIMIT'};
 return {kind:'open',cardId:card.id,groupId:gid,cost,revision:state.revision};
}
export function openCard(state,bank,plan){
 if(plan.kind!=='open'||plan.revision!==state.revision)throw new EntryError('STALE_ENTRY_PLAN');
 if(state.active)throw new EntryError('ACTIVE_ENTRY_EXISTS');
 const expected=nextScreen(state,bank);if(expected.kind!=='open'||expected.cardId!==plan.cardId)throw new EntryError('INVALID_ENTRY_PLAN');
 const s=copy(state),card=bank.cards[plan.cardId],instanceId=`${s.id}:${s.used.length+1}`;
 s.group=plan.groupId;s.active={cardId:card.id,instanceId,phase:card.type==='listen'?'listen':'read',reading:null,helped:false,played:false,retries:0,captureId:null,feedback:null,audio:null,speechIssue:null};
 s.used.push(card.id);s.total+=expected.cost;s.visit.used+=expected.cost;
 // Store presentation BEFORE display. Listening text is recorded when actually played.
 if(card.type!=='listen')s.sourceExposures.push({type:'shown',sourceTaskId:card.sourceTaskId,target:card.target,visitId:s.visit.id,instanceId});
 return changed(s,'card_opened');
}
export function learnerView(state,bank){
 const a=state.active;if(!a)return null;const c=bank.cards[a.cardId];
 const q=a.phase==='question'?c.question:null;
 const options=q?copy(q.options):[];
 // Different stable order per instance, retained across pause/reload. No correctness fields.
 if(options.length){const shift=Number(a.instanceId.split(':').at(-1))%options.length;options.push(...options.splice(0,shift));}
 return {instanceId:a.instanceId,instruction:a.phase==='question'?q.prompt:c.instruction,target:c.type==='listen'?null:c.target,type:c.type,phase:a.phase,options,feedback:a.feedback,speechIssue:copy(a.speechIssue??null),helpParts:a.helped?copy(c.parts):[],
 showMicrophone:(a.phase==='read'||a.phase==='question')&&state.voiceAvailable&&state.voiceOptIn&&state.config.input!=='buttons',showCompanionControls:false,
 secondaryAction:'Пока пропустить',autoPlay:false};
}
export function startCapture(state,captureId){
 if(!state.active||!['read','question'].includes(state.active.phase)||!state.voiceAvailable||!state.voiceOptIn||state.config.input==='buttons')throw new EntryError('VOICE_NOT_READY');
 const s=cancelAudio(copy(state));s.active.captureId=captureId;s.active.speechIssue=null;s.active.feedback=null;return changed(s,'capture_requested');
}
export function cancelCapture(state){const s=copy(state);if(s.active)s.active.captureId=null;return changed(s,'capture_cancelled');}
/** Cancellation belongs to controller state as well as the audio service.
 * A replay cannot revoke an already completed first listening or a reading observation.
 */
export function cancelAudio(state,{instanceId,audioId}={}){
 const a=state.active;if(!a?.audio)return state;
 if(instanceId&&instanceId!==a.instanceId||audioId&&audioId!==a.audio.id)return state;
 const s=copy(state);
 if(s.active.phase==='listening')s.active.phase=s.active.played?'question':'listen';
 s.active.audio=null;return changed(s,'audio_cancelled');
}
/** Only a press produces a speech effect. Commit the state before passing it to media. */
export function requestAudio(state,bank,{scope,optionId,userGesture=false}={}){
 if(!userGesture)throw new EntryError('AUTOPLAY_FORBIDDEN');
 if(!state.active)throw new EntryError('NO_ACTIVE_CARD');
 const s=cancelAudio(copy(state)),a=s.active,c=bank.cards[a.cardId];a.captureId=null;
 let text;
 if(scope==='instruction'){
  text=a.phase==='question'?c.question.prompt:a.phase==='feedback'?(a.feedback??'Ответ сохранён.')+' Нажми «Дальше», чтобы продолжить.':c.instruction;
 }else if(scope==='option'){
  if(a.phase!=='question')throw new EntryError('OPTIONS_NOT_REVEALED');
  text=c.question.options.find(o=>o.id===optionId)?.text;if(!text)throw new EntryError('UNKNOWN_OPTION');
 }else if(scope==='target'){
  text=c.target;
  if(c.type==='listen'&&!a.played)a.phase='listening';
  else if(c.type!=='listen'&&a.phase==='read')a.helped=true;
  s.prompts.push({target:targetKey(c),visitId:s.visit.id,kind:c.type==='listen'?'listening':'target_audio'});
  s.sourceExposures.push({type:'heard',target:c.target,sourceTaskId:c.sourceTaskId,visitId:s.visit.id,instanceId:a.instanceId});
 }else throw new EntryError('UNKNOWN_AUDIO_SCOPE');
 const audioId=`${a.instanceId}:audio:${++s.audioSerial}`;a.audio={id:audioId,scope};
 return {state:changed(s,'audio_button'),effect:{type:'speak',text,lang:'ru-RU',audioId,instanceId:a.instanceId,scope}};
}
export function finishAudio(state,{instanceId,audioId,scope,ok=true,cancelled=false}={}){
 const a=state.active;
 if(!a||a.instanceId!==instanceId||!a.audio||a.audio.scope!==scope||(audioId&&a.audio.id!==audioId))return state;
 const s=copy(state),c=s.active;
 if(scope==='target'&&(c.phase==='listening'||c.phase==='question'&&c.played)){
  c.phase=ok||c.played?'question':'listen';c.played=ok||c.played;
  c.feedback=ok||cancelled?null:'Звук не включился. Можно послушать ещё раз.';
 }
 c.audio=null;return changed(s,ok?'audio_finished':cancelled?'audio_cancelled':'audio_failed');
}
export function showHint(state,bank){
 if(!state.active||state.active.phase!=='read')throw new EntryError('HINT_NOT_AVAILABLE');
 const s=cancelAudio(copy(state)),c=bank.cards[s.active.cardId];s.active.helped=true;s.active.captureId=null;
 s.prompts.push({target:targetKey(c),visitId:s.visit.id,kind:'graphical_hint'});return changed(s,'hint_shown');
}
function speechMatches(transcript,target){
 const t=norm(transcript),k=norm(target);if(t===k)return true;
 // Слоговое чтение: «ко т» permitted for a single printed word; no deleted letters / repeats / lemmas.
 return !k.includes(' ')&&t.replace(/ /g,'')===k;
}
function finish(state,bank,result,extra={}){
 const s=cancelAudio(copy(state)),a=s.active,c=bank.cards[a.cardId];
 if(s.receipts.includes(a.instanceId))return state;
 s.receipts.push(a.instanceId);s.observations.push({instanceId:a.instanceId,cardId:c.id,sourceTaskId:c.sourceTaskId,sourceHash:c.sourceHash,groupId:c.groupId,skillId:c.skillId,visitId:s.visit.id,result,reading:a.reading,helped:a.helped,...extra});
 if(['observed','correct'].includes(result)){
  if(c.type==='read')s.wordObserved=true;
  if(c.type==='passage'||c.type==='listen')s.meaningDone=true;
  if(s.gap&&c.type==='read')s.finished=true;
  else if(UP[c.groupId]===null)s.finished=true;
  else s.group=UP[c.groupId];
 }else if(result==='understanding_difficulty'){
  s.gap={groupId:c.groupId==='LISTEN'?'SUBJECT':c.groupId,reason:result};s.meaningDone=true;s.finished=true;
 }else if(['assisted','self_difficulty','observed_difficulty'].includes(result)){
  const earlier=s.gap;
  // Only a real lower-group difficulty updates the goal; ASR uncertainty never lowers it.
  let lower=earlier?.groupId;while(lower&&lower!==c.groupId)lower=DOWN[lower];
  if(!earlier||lower===c.groupId){
   s.gap={groupId:c.groupId,reason:result,originGroupId:earlier?.originGroupId??earlier?.groupId??c.groupId};
  }
  s.gapHistory??=[];s.gapHistory.push({groupId:c.groupId,result,instanceId:a.instanceId});
  if(DOWN[c.groupId]===null)s.finished=true;else s.group=DOWN[c.groupId];
 }else if(result==='unassessed'){s.uncertainCards++;}
 else if(result==='skipped'){ /* no evidence of failure, try a different target */ }
 if(s.group!=='LISTEN')s.readingGroup=s.group;
 s.active={...a,captureId:null,audio:null,phase:'feedback',feedback:['observed','correct'].includes(result)?'Ответ принят.':result==='assisted'?'Попробовали с подсказкой.':result==='unassessed'?'Этот ответ пока оставим без оценки.':result==='skipped'?'Хорошо, пропустим.':'Попробуем другой пример.'};
 return changed(s,'result_'+result);
}
/** Service errors describe the device/service, never the child's reading ability. */
export function speechIssue(code='asr_uncertain'){
 const raw=String(code);let kind='unclear',retryable=true,message='Не удалось разобрать ответ. Попробуем ещё раз?';
 if(['not-allowed','service-not-allowed','permission_denied','permission-denied'].includes(raw)){
  kind='permission';retryable=false;message='Доступ к микрофону закрыт. Можно включить его в настройках браузера или отвечать нажатием.';
 }else if(['audio-capture','not-found','microphone_not_found'].includes(raw)){
  kind='device';retryable=false;message='Микрофон недоступен. Можно проверить его подключение или отвечать нажатием.';
 }else if(['unsupported','service_unavailable','network','start_failed','recognition_error','language-not-supported'].includes(raw)){
  kind='service';retryable=false;message='Голосовой сервис сейчас недоступен. Можно отвечать нажатием или проверить микрофон позже.';
 }else if(['no-speech','no_speech'].includes(raw)){
  kind='silence';message='Ответа не слышно. Нажми микрофон, скажи ответ и затем нажми «Готово».';
 }
 return {code:raw,kind,retryable,message,actions:retryable?['retry_voice','change_input']:['change_input','check_microphone']};
}
export function submitSpeech(state,bank,{instanceId,captureId,transcript,isFinal,confidence,error}={}){
 const a=state.active;
 // Late, repeated, aborted and unrelated ASR callbacks cannot alter progress.
 if(!a||a.instanceId!==instanceId||a.captureId!==captureId||!a.captureId||a.phase==='feedback')return state;
 if(!isFinal&&!error)return state;
 const c=bank.cards[a.cardId],text=norm(transcript),low=Number.isFinite(confidence)&&confidence<0.80;
 let ok=false,optionId=null;
 if(a.phase==='read')ok=speechMatches(text,c.target);
 else if(a.phase==='question'){
  const matches=c.question.options.filter(o=>norm(o.text)===text);if(matches.length===1){optionId=matches[0].id;ok=true;}
 }
 if(error||!text||low||!ok){
  const s=copy(state),issue=speechIssue(error??(!text?'no_speech':low?'low_confidence':'asr_uncertain'));
  s.active.captureId=null;s.active.speechIssue=issue;s.lastSpeechIssue={...issue,instanceId};
  if(!issue.retryable){
   s.voiceAvailable=false;s.active.feedback=issue.message;
   return changed(s,'speech_error_'+issue.kind);
  }
  s.active.retries++;
  if(s.active.retries>=2)return finish(s,bank,'unassessed',{reason:issue.code,verifier:'asr'});
  s.active.feedback=issue.message;return changed(s,'asr_retry_'+issue.kind);
 }
 if(a.phase==='question')return submitChoice(state,bank,{instanceId,optionId,via:'voice'});
 const s=copy(state);s.active.captureId=null;s.active.reading={status:a.helped?'assisted':'observed',verifier:'asr',tier:'placement_estimate',confidence:Number.isFinite(confidence)?confidence:null};
 // No raw audio or transcript persisted, no companion spoof, no global mastered assignment.
 if(c.type==='passage'){s.active.phase='question';s.active.feedback=null;s.active.retries=0;return changed(s,'reading_observed');}
 return finish(s,bank,a.helped?'assisted':'observed',{verifier:'asr'});
}
export function submitCompanion(state,bank,{instanceId,correct,actor}={}){
 const a=state.active;if(!state.config.companion||actor!=='adult'||!a||a.instanceId!==instanceId||a.phase!=='read'||typeof correct!=='boolean')throw new EntryError('INVALID_COMPANION_ACTION');
 const s=copy(state),c=bank.cards[a.cardId];s.active.reading={status:correct?(a.helped?'assisted':'observed'):'difficulty',verifier:'companion'};
 if(correct&&c.type==='passage'){s.active.phase='question';s.active.feedback=null;return changed(s,'companion_reading');}
 return finish(s,bank,a.helped?'assisted':correct?'observed':'observed_difficulty',{verifier:'companion'});
}
export function submitChoice(state,bank,{instanceId,optionId,via='button'}={}){
 const a=state.active;if(!a||a.instanceId!==instanceId||a.phase!=='question')throw new EntryError('STALE_QUESTION');const c=bank.cards[a.cardId];
 if(!c.question.options.some(o=>o.id===optionId))throw new EntryError('UNKNOWN_OPTION');
 const correct=c.question.correctOptionIds.includes(optionId);
 return finish(state,bank,correct?(a.helped&&c.type!=='listen'?'assisted':'correct'):'understanding_difficulty',{questionId:c.question.id,questionSkillIds:c.question.sourceSkillIds,meaning:correct?'correct':'difficulty',via,mode:c.type==='listen'?'listen':'read'});
}
export function skip(state,bank){if(!state.active||state.active.phase==='feedback')throw new EntryError('NO_ANSWERABLE_CARD');return finish(state,bank,'skipped');}
export function difficulty(state,bank){
 if(!state.active||state.active.phase==='feedback')throw new EntryError('NO_ANSWERABLE_CARD');
 if(state.active.phase==='question')return finish(state,bank,'understanding_difficulty',{verifier:'learner_report',meaning:'difficulty',via:'learner_report',mode:bank.cards[state.active.cardId].type==='listen'?'listen':'read'});
 return finish(state,bank,'self_difficulty',{verifier:'learner_report'});
}
export function next(state){if(!state.active||state.active.phase!=='feedback')throw new EntryError('ANSWER_FIRST');const s=copy(state);s.active=null;return changed(s,'next_pressed');}
export function pause(state){const s=cancelAudio(copy(state));s.paused=true;if(s.active){s.active.captureId=null;if(s.active.phase==='listening')s.active.phase='listen';}return changed(s,'paused');}
export function resume(state){const s=copy(state);s.paused=false;if(!s.active&&s.visit.used>0){s.visit={...s.visit,number:s.visit.number+1,id:s.id+':v'+(s.visit.number+1),used:0};s.history.promptedTargetsThisVisit=[];}return changed(s,'resumed');}
export function finishNow(state){if(state.active&&state.active.phase!=='feedback')throw new EntryError('CLOSE_ACTIVE_FIRST');const s=copy(state);s.active=null;s.finished=true;s.paused=false;return changed(s,'finish_now');}
export function report(state,bank){
 const gid=state.gap?.groupId??(state.group==='LISTEN'?state.initialGroup:state.group),g=requireGroup(bank,gid),p=state.config.program;
 const readingObserved=state.observations.filter(o=>o.reading?.status==='observed');
 const meaningObserved=state.observations.filter(o=>o.meaning==='correct');
 const meaningDifficulties=state.observations.filter(o=>o.meaning==='difficulty');
 const observed=state.observations.filter(o=>o.reading?.status==='observed'||o.meaning==='correct'||['observed','correct'].includes(o.result));
 const describe=o=>({groupId:o.groupId,cardId:o.cardId,target:bank.cards[o.cardId].target,reading:copy(o.reading),meaning:o.meaning??null,mode:o.mode??'read'});
 const shortSupport=gid==='CV'&&!!state.gap;
 const title=shortSupport?'Попробуем слог вместе':g.label;
 const strengths=[];
 if(readingObserved.length)strengths.push('Получилось прочитать «'+bank.cards[readingObserved.at(-1).cardId].target.replace(/[.!?]$/,'')+'».');
 if(meaningObserved.length)strengths.push('Получилось ответить на вопрос '+(meaningObserved.at(-1).mode==='listen'?'к прослушанному рассказу.':'к прочитанному.'));
 if(meaningDifficulties.length)strengths.push('Понимание будем тренировать отдельно.');
 const note=strengths.length?strengths.join(' ')+' Начнём отсюда и уточним дорожку на занятиях.':'Начнём с короткого знакомства. Чтение пока не подтверждено.';
 const origin=state.gap?.originGroupId;
 return {version:VERSION,status:'estimated_start',programId:p,targetGroup:gid,
 startNodeId:shortSupport?'p1.A01':g.nodeByProgram[p],episodeId:shortSupport?'ep.p1.A01.01':g.firstEpisodeByProgram[p],
 sourceProgramId:shortSupport?P1:p,shortSupport,title,
 nextGoals:shortSupport?[title,origin&&origin!=='CV'?'Затем вернёмся к цели: '+requireGroup(bank,origin).label:'Попробуем другой слог с опорой']:[g.label,UP[gid]?requireGroup(bank,UP[gid]).label:'Закрепляем на другом примере'].filter((x,i,a)=>a.indexOf(x)===i),
 observed:observed.map(describe),readingObserved:readingObserved.map(describe),understandingObserved:meaningObserved.map(describe),understandingDifficulties:meaningDifficulties.map(describe),
 unassessed:state.observations.filter(o=>o.result==='unassessed').length,note,strengths,
 confirmedSkills:[],masteredNodes:[],reason:shortSupport?'short_syllable_support':state.gap?.reason??'brief_entry_observations'};
}
/** Interests may choose between real teaching episodes of the SAME goal, never raise difficulty. */
export function chooseLessonEpisode(state,bank,curriculum,profile={}){
 const r=report(state,bank),node=curriculum.nodes[r.startNodeId];if(!node)throw new EntryError('SOURCE_NODE_MISSING');
 const requested=[...new Set(state.config.interests??[])].filter(x=>x!=='unknown').sort();
 const blockedLetters=state.history.unavailableLetters??[],blockedCaps=state.history.unavailableCapabilities??[];
 const saved=profile.personalPath08?.[state.id];
 const candidates=(node.episodeIds??[]).map((id,index)=>{
  const ep=curriculum.episodes[id];if(!ep||ep.nodeId!==node.id)throw new EntryError('SOURCE_EPISODE_MISMATCH');
  const items=ep.steps.map(s=>curriculum.items[s.itemId]).filter(Boolean);
  const tags=[...new Set(items.flatMap(i=>i.interestTags??[]))];
  const blocked=items.some(i=>Array.from(i.requiredLetters??[]).some(x=>blockedLetters.includes(x))||(i.requiredCapabilities??[]).some(x=>blockedCaps.includes(x)));
  return {ep,index,tags,blocked,matched:requested.filter(t=>tags.includes(t))};
 }).filter(c=>!c.blocked);
 if(!candidates.length)throw new EntryError('TEACHING_EPISODE_UNAVAILABLE');
 const savedCandidate=saved?.nodeId===node.id?candidates.find(c=>c.ep.id===saved.episodeId):null;
 const chosen=savedCandidate??(r.shortSupport?candidates.find(c=>c.ep.id===r.episodeId):null)??[...candidates].sort((a,b)=>b.matched.length-a.matched.length||a.index-b.index)[0];
 return {episode:chosen.ep,node,placement:{...r,episodeId:chosen.ep.id},selection:{requested,matched:chosen.matched,
 unmatched:requested.filter(t=>!chosen.matched.includes(t)),reason:savedCandidate?'saved_episode':r.shortSupport?'short_support_priority':chosen.matched.length?'interest_match':'no_matching_theme',
 chosenEpisodeId:chosen.ep.id,candidateEpisodeIds:candidates.map(c=>c.ep.id)}};
}
/** Maps the suggested goal to existing author-written lesson frames. No graph bypass/fake mastery.
 * Start is real teaching, not a dependent formal test. Keep separate teaching cursor in host.
 */
export function learningPlan(state,bank,curriculum,profile){
 const {placement:r,node,episode,selection}=chooseLessonEpisode(state,bank,curriculum,profile);
 const SAY={show_chunks:'Посмотри на части.',model_blend:'Послушай, как соединяются части.',meaning_anchor:'Послушай, что означает слово.',show_whole:'Посмотри на слово.',fade_support:'Теперь попробуй без подсказки.'};
 const KIND={read:'Прочитай.',compose:'Собери по порядку.',boundary:'Раздели слово на слоги.',find_part:'Найди указанную часть.',transform:'Измени выделенную часть.',choice:'Выбери ответ.',passage:'Прочитай. Потом ответь.',read_meaning:'Прочитай. Потом выбери значение.'};
 return {kind:'personal_learning_path',profileToPersist:copy(profile),placement:r,selection,previewOnly:true,
 cursor:{programId:r.programId,sourceProgramId:node.programId,nodeId:node.id,episodeId:episode.id,stepIndex:0,provisional:true},
 frames:episode.steps.map(step=>{const item=curriculum.items[step.itemId];return {sourceStepId:step.id,sourceTaskId:step.itemId??null,kind:step.action,mode:step.mode,display:step.visibleText??item?.learnerText??step.targetWord??'',instruction:SAY[step.action]??KIND[item?.kind]??'Посмотри на пример.',audioText:step.spokenText??null,autoPlay:false,scoring:'practice_observation',staffMetadata:{originalInstruction:step.instruction}};}),
 grants:[],formalChecksUnchanged:true};
}
/** UI coordinator. Services are injected from MAIN APP; no second speech vendor in production. */
export function mediaBridge({speak,recognize,stopSpeech,stopRecognition}){
 let generation=0,pending=null;
 const cancel=()=>{
  generation++;
  const previous=pending;pending=null;previous?.reject(new EntryError('ABORTED'));
  stopRecognition();stopSpeech();
 };
 const run=(operation)=>{
  cancel();const g=generation;
  return new Promise((resolve,reject)=>{
   const token={reject};pending=token;
   Promise.resolve().then(operation).then(value=>{
    if(g!==generation||pending!==token)return;
    pending=null;resolve(value);
   },error=>{if(g!==generation||pending!==token)return;pending=null;reject(error);});
  });
 };
 return {cancel,async play(effect,{userGesture=false}={}){
  if(!userGesture)throw new EntryError('AUTOPLAY_FORBIDDEN');
  return run(()=>speak(effect.text,{lang:'ru-RU'}));
 },async listen({userGesture=false,onResult}={}){
  if(!userGesture)throw new EntryError('RECORDING_REQUIRES_PRESS');
  const result=await run(()=>recognize({lang:'ru-RU'}));onResult(result);
 }};
}

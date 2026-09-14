/** Reference executor for the authored v7 episodes. All functions return state to persist before rendering. */
import {normalise,words,unique} from './normalise.mjs';
import {presentTask,recordAttempt,updateNodeEvidence,nodeEvidenceStatus,missingPrerequisites,selectCheck,isEligible,hasSkill,commitExposure,switchProgram} from './engine.mjs';
const cp=x=>structuredClone(x);
const actionable=new Set(['task','optional_read_target','reveal_then_compose']);
const pos=(p)=>p.programs[p.currentProgramId];
function planId(p,x){return [p.currentProgramId,p.currentVisit?.id,p.revision,x.nodeId??'',x.episodeId??'',x.stepId??'',x.phase??'',x.itemId??'',x.kind].join(':');}
function stamp(p,x){return {...x,planId:planId(p,x),basedOnRevision:p.revision};}
function advanceNode(p,pkg){const state=pos(p),pg=pkg.programs.find(x=>x.id===p.currentProgramId);state.cursor++;state.nodeId=pg.defaultPath[state.cursor]??null;state.episodeIndex=0;state.stepIndex=0;state.stage='teaching';state.actionsSinceProbe=0;state.appDone=false;state.contextFrameShown=false;state.pendingCorrection=null;state.teachingOrder=null;}
function reconcile(profile,pkg){let p=cp(profile);const state=pos(p);if(!state)return p;
 if(state.pendingAction){const a=state.pendingAction;if(a.instanceId&&p.receipts[a.instanceId]){
   const attempt=p.attempts.find(x=>x.instanceId===a.instanceId);
   if(a.kind==='review'){p=updateNodeEvidence(p,pkg,a.nodeId);if(nodeEvidenceStatus(p,pkg,a.nodeId).status!=='mastered'){const r=p.reviewQueue.find(x=>x.nodeId===a.nodeId);if(r)r.dueVisit=(p.currentVisit?.index??p.completedVisits.length)+1;}}
   else if(a.kind==='check'||a.kind==='application'){p=updateNodeEvidence(p,pkg,a.nodeId);if(a.kind==='application')pos(p).appDone=attempt?.outcome==='correct'&&attempt?.independent===true;pos(p).actionsSinceProbe=0;}
   else if(a.kind==='correction_task')pos(p).pendingCorrection=null;
   else if(a.kind==='episode_task'){
      const ep=pkg.episodes[a.episodeId];pos(p).completedSteps=unique([...pos(p).completedSteps,a.stepId]);pos(p).stepIndex++;
      if(pos(p).stepIndex>=ep.steps.length){pos(p).episodeIndex++;pos(p).stepIndex=0;pos(p).actionsSinceProbe=(pos(p).actionsSinceProbe??0)+1;}
   }
   if(attempt&&['incorrect','uncertain','input_error'].includes(attempt.outcome)&&a.kind!=='correction_task'){
     const same=p.attempts.filter(x=>x.sessionId===p.currentVisit?.id&&x.nodeId===a.nodeId&&x.error?.kind===attempt.error?.kind&&x.outcome==='incorrect');
     const anchor=a.phase==='anchor';
     if((anchor||same.length>=2||['uncertain','input_error'].includes(attempt.outcome))&&(p.currentVisit?.supportInsertions??0)<1){
       pos(p).pendingCorrection={nodeId:a.nodeId,itemId:a.itemId,step:0,reason:attempt.outcome==='uncertain'?'unassessable':attempt.outcome==='input_error'?'input':anchor?'unknown_anchor':'difficulty'};
     }
   }
   pos(p).pendingAction=null;p.revision++;
 }}return p;}
/** Returns updated state plus a plan. No task is exposed yet. Caller must use launchAction. */
export function nextAction(profile,pkg){let p=reconcile(profile,pkg);
 if(!p.currentProgramId||!pos(p))return {profile:p,action:{kind:'choose_program'}};
 if(!p.currentVisit)return {profile:p,action:{kind:'begin_visit'}};
 if(p.activeInstance)return {profile:p,action:stamp(p,{kind:'active_task',instance:cp(p.activeInstance)})};
 if(pos(p).activeInfo)return {profile:p,action:stamp(p,{kind:'active_info',info:cp(pos(p).activeInfo)})};
 if(p.currentVisit.actions>=p.currentVisit.budget)return {profile:p,action:{kind:'pause',reason:'ACTION_BUDGET',message:'Можно закончить подход. Следующий начнётся с сохранённого шага.'}};
 const due=p.reviewQueue.find(r=>r.programId===p.currentProgramId&&r.dueVisit<=p.currentVisit.index);
 if(due)return {profile:p,action:stamp(p,{kind:'review',nodeId:due.nodeId,itemId:due.itemId,mode:due.mode,phase:'review',instruction:'Прочитай или выполни ещё раз без свежей подсказки. Это проверка удержания знакомого материала.'})};
 for(let guard=0;guard<200;guard++){
  const s=pos(p),node=pkg.nodes[s.nodeId];
  if(!node){const pending=p.reviewQueue.filter(r=>r.programId===p.currentProgramId);return {profile:p,action:{kind:pos(p).practiceOnly?'practice_path_finished_unassessed':pending.length?'await_retention':'route_complete',pendingReviews:pending.map(r=>({nodeId:r.nodeId,dueVisit:r.dueVisit})),message:pending.length?'Основной путь закончен; устойчивость проверим в следующих подходах.':'Учебный путь и назначенные проверки удержания завершены.'}};}
  if(s.pendingCorrection){const c=s.pendingCorrection;return {profile:p,action:stamp(p,{kind:c.step===0?'correction_info':'correction_task',nodeId:c.nodeId,itemId:c.itemId,phase:'support',mode:node.routeMode,reason:c.reason,instruction:c.reason==='unassessable'?'Сначала выберем доступный способ ответа. Не удалось оценить — не ошибка чтения.':c.reason==='input'?'Проверим управление. Ошибка нажатия не снижает навык.':pkg.items[c.itemId].hints?.[0]??pkg.taskSets[node.taskSetId].explanation})};}
  const existing=hasSkill(p,pkg,node.skillId);const own=nodeEvidenceStatus(p,pkg,node.id);
  if(existing){s.skippedByEvidence??=[];if(own.status==='learning')s.skippedByEvidence.push({nodeId:node.id,skillId:node.skillId,reason:'evidence_reused_not_lessons_completed'});advanceNode(p,pkg);p.revision++;continue;}
  const missing=missingPrerequisites(p,pkg,node.id);if(missing.length&&!s.practiceOnly)return {profile:p,action:stamp(p,{kind:'missing_skill',nodeId:node.id,missingSkills:missing,candidateNodes:missing.map(skill=>({skillId:skill,nodeIds:pkg.programs.find(x=>x.id===p.currentProgramId).defaultPath.filter(id=>pkg.nodes[id].skillId===skill)})),message:'Нужен подготовительный шаг или явная входная проверка. Не открываем проверку, игнорируя предпосылку.'})};
  // One initial model and one further complete episode before the first probe; remaining episodes supply ongoing practice.
  const mayCheck=s.episodeIndex>=2&&!s.practiceOnly;
  if(mayCheck&&!p.currentVisit.checkedNodes.includes(node.id)){
   const check=selectCheck(pkg,node.id,p);
   if(check.kind==='task')return {profile:p,action:stamp(p,{kind:'check',...check,kind:'check',nodeId:node.id,phase:'independent',instruction:node.checkStepTemplate.prompt})};
   if(check.reason==='MISSING_CAPABILITY')return {profile:p,action:stamp(p,{...check,kind:'capability_support_needed',nodeId:node.id,message:'Для самостоятельной пробы не хватает конкретных букв или функций. В тренажёре текст можно открыть с помощью.'})};
   if(check.reason==='NO_UNSEEN_CANDIDATE')return {profile:p,action:stamp(p,{...check,kind:'needs_new_probe',nodeId:node.id,message:'Свежие примеры этого навыка исчерпаны. Тренировка доступна; навык не объявляется освоенным без проверки.'})};
   // familiar checks after a prompt wait until another visit, not until a fabricated new word exists.
  }
  if(mayCheck&&!s.appDone)return {profile:p,action:stamp(p,{kind:'application',nodeId:node.id,itemId:node.applicationId,phase:'application',mode:node.routeMode,instruction:pkg.items[node.applicationId].assistantPrompt})};
  if(s.episodeIndex<node.episodeIds.length){
   if(!s.teachingOrder){const score=eid=>{const ep=pkg.episodes[eid],ids=ep.steps.map(z=>z.itemId).filter(Boolean);return Math.max(0,...ids.map(id=>(pkg.items[id].interestTags??[]).filter(t=>p.interests.includes(t)).length));};s.teachingOrder=[...node.episodeIds].sort((a,b)=>score(b)-score(a));p.revision++;}
   const eid=s.teachingOrder[s.episodeIndex],ep=pkg.episodes[eid],step=ep.steps[s.stepIndex];
   if(!step)throw new Error('Broken episode cursor');
   if(!s.contextFrameShown&&s.episodeIndex===0&&s.stepIndex===0){const tag=p.interests.find(t=>node.optionalContextFrames[t]);if(tag&&eid===node.episodeIds[0]){return {profile:p,action:stamp(p,{kind:'context_info',nodeId:node.id,mode:'listen',phase:'model',instruction:node.optionalContextFrames[tag],visibleText:pkg.items[node.trainingIds[0]].learnerText,contextTag:tag})};}s.contextFrameShown=true;p.revision++;}
   if(step.optional&&step.requiresAvailableTarget&&!isEligible(pkg.items[step.itemId],p,{mode:'read'})){s.completedSteps.push(step.id+':skipped-unavailable-optional');s.stepIndex++;if(s.stepIndex>=ep.steps.length){s.episodeIndex++;s.stepIndex=0;}p.revision++;continue;}
   return {profile:p,action:stamp(p,{...step,kind:actionable.has(step.action)?'episode_task':'episode_info',nodeId:node.id,episodeId:eid,stepId:step.id})};
  }
  if(s.practiceOnly){advanceNode(p,pkg);p.revision++;continue;}
  return {profile:p,action:{kind:'pause',reason:'NEXT_VISIT_CHECK',nodeId:node.id,message:'Материал отработан. Следующую самостоятельную пробу предложим в другом подходе. Можно остановиться или выбрать свободный тренажёр.'}};
 }
 throw new Error('Route traversal invariant failed');
}
/** Validate a plan against current state. A stale UI cannot launch a different programme or skill. */
export function launchAction(profile,pkg,action,{instanceId}={}){
 const cur=nextAction(profile,pkg),p=cur.profile,a=cur.action;
 if(action.planId!==a.planId||!action.planId)throw new Error('Stale or non-launchable route plan');
 if(['active_task','active_info'].includes(a.kind))return p;
 if(['check','application','review','episode_task','correction_task'].includes(a.kind)){
   const launch={instanceId:instanceId??'trial:'+a.planId,itemId:a.itemId,nodeId:a.nodeId,phase:a.phase,mode:a.mode,context:'route',episodeId:a.episodeId,stepId:a.stepId};
   let out=presentTask(p,pkg,launch);pos(out).pendingAction={...a,instanceId:launch.instanceId};
   if(a.kind==='correction_task'){out.activeInstance.helpLevel=4;out.currentVisit.supportInsertions=(out.currentVisit.supportInsertions??0)+1;}
   // The step says what is printed/spoken; these are part of the exposure ledger too.
   const it=pkg.items[a.itemId];out=commitExposure(out,{texts:[a.instruction??'',it.assistantPrompt??'']});return out;
 }
 if(['episode_info','correction_info','context_info'].includes(a.kind)){
   const it=a.itemId?pkg.items[a.itemId]:null;let texts=[a.visibleText??'',...(a.visibleParts??[]),...(a.parts??[]),...(a.chunks??[])];
   if(it&&a.showText!==false)texts.push(it.learnerText);
   let out=commitExposure(p,{texts:texts.filter(Boolean),heardPassages:(a.action==='listen_context'&&it?.kind==='passage')?[it.learnerText]:[],promptedTexts:a.promptLevel>=2?[a.visibleText??it?.learnerText??'']:[]});
   pos(out).activeInfo={...a};out.currentVisit.actions++;out.revision++;return out;
 }
 throw new Error('This action requires an explicit support, recovery, or pause decision');
}
export function acknowledgeInfo(profile,pkg,planId){const p=cp(profile),s=pos(p),a=s?.activeInfo;if(!a||a.planId!==planId)throw new Error('No matching information screen');
 if(a.kind==='context_info'){s.contextFrameShown=true;}
 else if(a.kind==='correction_info')s.pendingCorrection.step=1;
 else {s.completedSteps=unique([...s.completedSteps,a.stepId]);s.stepIndex++;const ep=pkg.episodes[a.episodeId];if(s.stepIndex>=ep.steps.length){s.episodeIndex++;s.stepIndex=0;s.actionsSinceProbe=(s.actionsSinceProbe??0)+1;}}
 s.activeInfo=null;p.revision++;return p;
}
export function answerAction(profile,pkg,result){const p=recordAttempt(profile,pkg,result);return reconcile(p,pkg);}
/** Human-selected entry is not mastery. Prerequisites still apply. */
export function chooseEntry(profile,pkg,nodeId){const p=cp(profile),prog=pkg.programs.find(x=>x.id===p.currentProgramId);if(!prog?.defaultPath.includes(nodeId)||p.activeInstance||pos(p).activeInfo)throw new Error('Invalid entry change');const s=pos(p);s.nodeId=nodeId;s.cursor=prog.defaultPath.indexOf(nodeId);s.episodeIndex=0;s.stepIndex=0;s.appDone=false;s.stage='teaching';s.pendingAction=null;s.teachingOrder=null;s.contextFrameShown=false;p.revision++;return p;}
export function launchFree(profile,pkg,itemId,{mode='read',instanceId}={}){return presentTask(profile,pkg,{itemId,mode,phase:'free',context:'free',instanceId:instanceId??'free:'+profile.revision,nodeId:null});}
/** Explicit practice-only bypass after exhausted reserves. No prerequisite or skill is fabricated. */
export function continuePracticeOnly(profile,pkg,{nodeId,verifier,reason}){
 const p=cp(profile);if(verifier!=='companion'||!reason||pos(p)?.nodeId!==nodeId||p.activeInstance)throw new Error('Explicit companion decision required');
 pos(p).practiceOnlyNodes??=[];pos(p).practiceOnlyNodes.push({nodeId,reason,verification:'not_assessed'});advanceNode(p,pkg);pos(p).practiceOnly=true;p.revision++;return p;
}
/** Help for missing functions is a separate finite practice block. Unknown ancillary segments are read by the helper. */
export function capabilitySupportPlan(pkg,{capability,letter}){
 const source=capability?pkg.capabilitySupports[capability]:pkg.letterSupport[letter];if(!source)throw new Error('Unknown support');
 return {title:source.title??'Буква '+letter,explanation:source.explanation??source.intro??'',trainingIds:[...(source.trainingIds??[])],checkIds:[...(source.checkIds??[])],maxActions:3,returnToOrigin:true,scope:'only_target_function',supportCapability:capability??null,supportLetter:letter??null};
}
/** Demonstration runner deliberately has no access to independent assessment. */
export function demoSteps(pkg,method){const x=pkg.methodComparison[method];if(!x)throw new Error('Unknown method');return cp(pkg.episodes[x.episodeId]);}

export function resumeAssessment(profile,pkg,{nodeId,verifier}){if(verifier!=='companion')throw new Error('Explicit decision required');const p=chooseEntry(profile,pkg,nodeId);pos(p).practiceOnly=false;return p;}

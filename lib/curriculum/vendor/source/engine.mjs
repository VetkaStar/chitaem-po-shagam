import {normalise,words,unique,stableShuffle} from './normalise.mjs';
import {grade} from './grading.mjs';
export {normalise} from './normalise.mjs';
const clone=x=>structuredClone(x);const arr=x=>Array.isArray(x);const obj=x=>x&&typeof x==='object'&&!arr(x);
const phases=new Set(['guided','model','anchor','independent','application','review','support','demo','free']);
const modes=new Set(['read','listen','shared']);
const hasAll=(req,known)=>req.every(x=>known.includes(x));
export function createProfile(id='local'){
 return {schemaVersion:2,id,revision:0,currentProgramId:null,knownLetters:[],availableCapabilities:[],interests:[],
  support:{allowMotion:false,optionalMicrophone:true},programs:{},attempts:[],receipts:{},
  exposures:{itemIds:[],stimuli:[],words:[],families:[],heardPassages:[],events:[]},
  confirmedSkills:[],skillBasis:{},capabilityEvidence:{},activeInstance:null,currentVisit:null,completedVisits:[],reviewQueue:[],legacyPractice:[]};
}
function changed(p){p.revision++;return p;}
function position(program){return {version:program.version,nodeId:program.defaultPath[0],cursor:0,episodeIndex:0,stepIndex:0,stage:'teaching',completedNodes:[],provisionalNodes:[],completedSteps:[],suspendedInstance:null,suspendedPlan:null};}
export function beginVisit(profile,id,{budget=5}={}){
 if(typeof id!=='string'||!id||!Number.isInteger(budget)||budget<1||budget>30)throw new Error('Invalid visit');
 const p=clone(profile);if(p.currentVisit){if(p.currentVisit.id===id)return p;throw new Error('End current visit first');}
 if(p.completedVisits.includes(id))throw new Error('A completed visit id cannot be reused');
 p.currentVisit={id,index:p.completedVisits.length,budget,actions:0,checkedNodes:[]};return changed(p);
}
export function endVisit(profile){const p=clone(profile);if(!p.currentVisit)return p;p.completedVisits.push(p.currentVisit.id);p.currentVisit=null;return changed(p);}
export function switchProgram(profile,programId,pkg){
 const program=pkg.programs.find(x=>x.id===programId);if(!program)throw new Error('Unknown program');const p=clone(profile);
 if(p.currentProgramId===programId)return p;
 if(p.activeInstance){if(['free','demo'].includes(p.activeInstance.context))throw new Error('Finish or close the free task first');p.programs[p.currentProgramId].suspendedInstance=p.activeInstance;}
 p.programs[programId]??=position(program);p.currentProgramId=programId;
 const saved=p.programs[programId].suspendedInstance;p.activeInstance=saved&&!p.receipts[saved.instanceId]?saved:null;p.programs[programId].suspendedInstance=null;
 return changed(p);
}
/** Imported parent observations remain observations; this function is for an explicit verified entry checkpoint. */
export function confirmEntrySkill(profile,pkg,skillId,{verifier,reason}){
 if(verifier!=='companion'||!reason||!pkg.skills[skillId])throw new Error('Explicit companion checkpoint required');
 const p=clone(profile);p.confirmedSkills=unique([...p.confirmedSkills,skillId]);p.skillBasis[skillId]={status:'confirmed_entry',reason,verifier,source:'explicit_entry_checkpoint'};return changed(p);
}
export function hasSkill(profile,pkg,skillId){
 if(profile.confirmedSkills.includes(skillId)||['pending_retention','mastered','confirmed_entry'].includes(profile.skillBasis[skillId]?.status))return true;
 // Equivalences need actual evidence, never merely a label or a known word.
 for(const rule of pkg.skillEquivalence??[]){
  if(rule.to!==skillId)continue;const b=profile.skillBasis[rule.from];if(!b)continue;
  if(rule.condition==='two_verified_novel_words_two_visits'&&b.novelDecodingVerified===true&&['pending_retention','mastered'].includes(b.status))return true;
  if(rule.condition!=='two_verified_novel_words_two_visits'&&b.source==='node_assessment'&&b.status==='mastered'&&b.readingAndQuestionsVerified===true)return true;
 }
 return false;
}
export function missingPrerequisites(profile,pkg,nodeId){const n=pkg.nodes[nodeId];if(!n)throw new Error('Unknown node');return n.prerequisiteSkills.filter(x=>!hasSkill(profile,pkg,x));}
export function missingCapabilities(item,profile){return {letters:[...item.requiredLetters].filter(x=>!profile.knownLetters.includes(x)),capabilities:(item.requiredCapabilities??[]).filter(x=>!profile.availableCapabilities.includes(x))};}
export function isEligible(item,profile,{mode='read'}={}){
 if(mode==='listen')return true;const m=missingCapabilities(item,profile);return !m.letters.length&&!m.capabilities.length;
}
/** Record written and auditory exposure separately. Whole heard stories cannot become cold stories later. */
export function commitExposure(profile,{texts=[],heardPassages=[],itemIds=[],familyIds=[],promptedTexts=[]}={}){
 const p=clone(profile),e=p.exposures,visitId=p.currentVisit?.id??'outside_visit';
 const ns=texts.map(normalise);e.stimuli=unique([...e.stimuli,...ns]);e.words=unique([...e.words,...texts.flatMap(words)]);e.itemIds=unique([...e.itemIds,...itemIds]);e.families=unique([...e.families,...familyIds]);
 e.heardPassages=unique([...e.heardPassages,...heardPassages.map(normalise)]);
 e.events.push({visitId,texts:ns,heardPassages:heardPassages.map(normalise),promptedTexts:promptedTexts.map(normalise),itemIds:[...itemIds]});
 return changed(p);
}
export function commitVisibleText(profile,texts){return commitExposure(profile,{texts});}
/** Same-target help is modality-independent and lasts for the current visit.
 * The attempt/active-instance fallback covers older profiles where visual help was
 * persisted as helpLevel but not entered into exposures.events.promptedTexts.
 */
export function wasTargetPromptedThisVisit(profile,target){
 const visitId=profile.currentVisit?.id;
 if(!visitId)return false;
 const canonical=normalise(target);
 const prompted=(profile.exposures?.events??[]).some(e=>e.visitId===visitId&&(e.promptedTexts??[]).some(t=>normalise(t)===canonical));
 const helped=a=>a?.sessionId===visitId&&normalise(a.canonicalTarget)===canonical&&((a.helpLevel??0)>0||a.readingTargetAudioPlayed===true);
 return prompted||(profile.attempts??[]).some(helped)||helped(profile.activeInstance);
}
function promptedThisVisit(profile,item){return wasTargetPromptedThisVisit(profile,item.learnerText);}
export function isFresh(item,set,profile){
 const e=profile.exposures;const f=set.freshness;
 if(f==='unprompted_known'){
  const vid=profile.currentVisit?.id;
  return !promptedThisVisit(profile,item)&&!profile.attempts.some(a=>a.sessionId===vid&&a.phase==='independent'&&a.canonicalTarget===normalise(item.learnerText));
 }
 if(e.itemIds.includes(item.id))return false;
 if(f==='target_unseen')return !(item.targetWords??words(item.learnerText)).some(w=>e.words.includes(w));
 if(f==='stimulus_unseen')return !e.stimuli.includes(normalise(item.learnerText));
 if(f==='passage_unseen')return !e.stimuli.includes(normalise(item.learnerText))&&!e.heardPassages.includes(normalise(item.learnerText))&&!e.families.includes(item.exposureFamily);
 return true;
}
export function checkInventory(pkg,nodeOrSetId,profile,{mode}={}){
 const node=pkg.nodes[nodeOrSetId];const set=pkg.taskSets[node?.taskSetId??nodeOrSetId];if(!set)throw new Error('Unknown set');
 mode??=node?.routeMode??set.routeMode??'read';
 const ids=unique([...set.checkIds,...(set.supplementalCheckIds??[])]);
 return ids.map(id=>({itemId:id,eligible:isEligible(pkg.items[id],profile,{mode}),fresh:isFresh(pkg.items[id],set,profile),missing:missingCapabilities(pkg.items[id],profile)}));
}
export function selectCheck(pkg,nodeOrSetId,profile,{mode}={}){
 const node=pkg.nodes[nodeOrSetId];const set=pkg.taskSets[node?.taskSetId??nodeOrSetId];if(!set)throw new Error('Unknown set');
 if(node){const missing=missingPrerequisites(profile,pkg,node.id);if(missing.length)return {kind:'blocked',reason:'MISSING_SKILL',missingSkills:missing,nodeId:node.id};}
 const inventory=checkInventory(pkg,nodeOrSetId,profile,{mode});let candidates=inventory.filter(x=>x.eligible&&x.fresh);
 if(!candidates.length){const eligible=inventory.filter(x=>x.eligible);return {kind:'blocked',reason:eligible.length?(set.freshness==='unprompted_known'?'WAIT_NEW_VISIT':'NO_UNSEEN_CANDIDATE'):'MISSING_CAPABILITY',inventory,recovery:eligible.length?pkg.recoveryPolicy.noFreshReadingCandidate:null};}
 const score=x=>(pkg.items[x.itemId].interestTags??[]).filter(t=>profile.interests.includes(t)).length;
 const used=new Set(profile.attempts.filter(a=>a.nodeId===node?.id&&a.phase==='independent'&&a.outcome==='correct'&&a.independent).map(a=>a.itemId));
 candidates.sort((a,b)=>Number(used.has(a.itemId))-Number(used.has(b.itemId))||score(b)-score(a));return {kind:'task',itemId:candidates[0].itemId,setId:set.id,nodeId:node?.id??null,mode:mode??node?.routeMode??set.routeMode??'read',freshness:set.freshness};
}
function taskMembership(pkg,node,itemId,phase,{episodeId,stepId}={}){
 if(phase==='independent')return [...node.checkIds,...(node.supplementalCheckIds??[])].includes(itemId);
 if(phase==='application')return node.applicationId===itemId;
 if(phase==='support')return [...node.trainingIds,...node.checkIds,...(node.supplementalCheckIds??[]),...(node.allowedEpisodeTaskIds??[])].includes(itemId);
 if(phase==='review')return [...node.checkIds,...(node.supplementalCheckIds??[]),...node.trainingIds].includes(itemId);
 if(episodeId||stepId){const ep=pkg.episodes[episodeId];return !!ep&&ep.nodeId===node.id&&node.episodeIds.includes(episodeId)&&ep.steps.some(s=>s.id===stepId&&s.itemId===itemId&&s.phase===phase);}
 return false;
}
/** Pure state transition. Persist its return value atomically BEFORE rendering the target. */
export function presentTask(profile,pkg,args){
 const {instanceId,itemId,nodeId=null,phase='guided',context='route',mode:askedMode,episodeId,stepId}=args;
 if(typeof instanceId!=='string'||!instanceId||!pkg.items[itemId])throw new Error('Invalid instance/task');
 if(!phases.has(phase)||!['route','free','demo','support'].includes(context))throw new Error('Invalid launch context');
 if(!profile.currentVisit)throw new Error('beginVisit required');
 const item=pkg.items[itemId],node=nodeId?pkg.nodes[nodeId]:null;
 if(context==='route'){
  if(!node||node.programId!==profile.currentProgramId)throw new Error('Cross-program or missing node');
  if(!taskMembership(pkg,node,itemId,phase,{episodeId,stepId}))throw new Error('Task/node/phase mismatch');
  const practiceOnly=profile.programs[profile.currentProgramId]?.practiceOnly===true;
  if(practiceOnly&&phase==='independent')throw new Error('Practice-only continuation cannot certify new skills');
  const miss=missingPrerequisites(profile,pkg,nodeId);if(miss.length&&phase!=='support'&&!practiceOnly)throw new Error('Missing prerequisite skill: '+miss.join(','));
 }
 if(context==='demo'){
  const ep=pkg.episodes[episodeId];if(!ep||ep.purpose!=='demonstration'||!ep.steps.some(s=>s.id===stepId&&s.itemId===itemId))throw new Error('Invalid demo step');
 }
 if(context==='support'){
  const source=pkg.capabilitySupports[args.supportCapability]??pkg.letterSupport[args.supportLetter];
  const ids=source?[...(source.trainingIds??[]),...(source.checkIds??[])]:[];
  if(!source||!ids.includes(itemId))throw new Error('Unknown concrete support task');
 }
 const mode=askedMode??node?.routeMode??'read';if(!modes.has(mode)||!item.allowedModes.includes(mode))throw new Error('Unsupported mode');
 if(context==='route'&&phase==='independent'&&mode!==node.routeMode)throw new Error('Route check mode mismatch');
 if(context==='route'&&phase==='independent'&&!isEligible(item,profile,{mode}))throw new Error('Missing capability');
 if(profile.receipts[instanceId]){const old=profile.receipts[instanceId];if(old.itemId!==itemId||old.nodeId!==nodeId)throw new Error('Receipt identity mismatch');return clone(profile);}
 if(profile.activeInstance){const a=profile.activeInstance;if(a.instanceId===instanceId&&a.itemId===itemId&&a.nodeId===nodeId&&a.mode===mode)return clone(profile);throw new Error('Finish, pause, or skip active task');}
 const set=node?pkg.taskSets[node.taskSetId]:{freshness:'item_unseen'};
 const fresh=isFresh(item,set,profile),novel=!(item.targetWords??words(item.learnerText)).some(w=>profile.exposures.words.includes(w));
 if(context==='route'&&phase==='independent'&&!fresh)throw new Error('Check is not fresh under its declared criterion');
 // Transform result and future answers are not exposed until actually requested or produced.
 let p=commitExposure(profile,{texts:[item.learnerText],itemIds:[itemId],familyIds:[item.exposureFamily],heardPassages:mode==='listen'&&item.kind==='passage'?[item.learnerText]:[]});
 const optionOrder={};if(item.options.length)optionOrder.task=stableShuffle(item.options.map(o=>o.id),instanceId+':task');
 for(const q of item.answer.questions??[])optionOrder[q.id]=stableShuffle(q.options.map(o=>o.id),instanceId+':'+q.id);
 p.activeInstance={instanceId,itemId,nodeId,programId:profile.currentProgramId,phase,context,mode,sessionId:p.currentVisit.id,visitIndex:p.currentVisit.index,contentVersion:pkg.contentVersion,contentHash:item.contentHash,
  canonicalTarget:normalise(item.learnerText),freshAtPresentation:fresh,novelTargetAtPresentation:novel,eligibleAtPresentation:isEligible(item,profile,{mode}),optionOrder,
  promptFreeAtPresentation:!wasTargetPromptedThisVisit(profile,item.learnerText),
  helpLevel:0,readingTargetAudioPlayed:false,answers:{},episodeId:episodeId??null,stepId:stepId??null,supportCapability:args.supportCapability??null,supportLetter:args.supportLetter??null};
 p.currentVisit.actions++;if(context==='route'&&phase==='independent')p.currentVisit.checkedNodes=unique([...p.currentVisit.checkedNodes,nodeId]);return changed(p);
}
export function revealOptions(profile,pkg){
 const a=profile.activeInstance;if(!a)throw new Error('No active task');const it=pkg.items[a.itemId];
 if(it.kind==='read_meaning'&&!a.readingStageFinished)throw new Error('Finish reading stage before revealing options');
 const texts=[...(it.options??[]).map(o=>o.text),...(it.answer.questions??[]).flatMap(q=>[q.prompt,...q.options.map(o=>o.text)])];
 const p=commitExposure(profile,{texts});p.activeInstance.optionsRevealed=true;return p;
}
export function recordReadingStage(profile,pkg,{instanceId,reading}){
 const a=profile.activeInstance;if(!a||a.instanceId!==instanceId)throw new Error('Stale reading stage');
 const it=pkg.items[a.itemId];if(!['passage','read_meaning'].includes(it.kind))throw new Error('No separate reading stage');
 const p=clone(profile);p.activeInstance.readingStageFinished=true;p.activeInstance.reading=clone(reading??{});return changed(p);
}
export function requestHelp(profile,pkg,{level=1,targetAudio=false,revealAnswer=false}={}){
 const a=profile.activeInstance;if(!a)throw new Error('No active task');if(!Number.isInteger(level)||level<0||level>4)throw new Error('Invalid help');
 const p=clone(profile);p.activeInstance.helpLevel=Math.max(a.helpLevel,revealAnswer?4:level);p.activeInstance.readingTargetAudioPlayed ||= targetAudio&&a.mode!=='listen';
 const it=pkg.items[a.itemId];let texts=[],prompts=[];
 // level > 0 is target-specific help (including visual segmentation), not an access setting.
 if(level>0||targetAudio||revealAnswer)prompts=[it.learnerText];
 if(revealAnswer)texts=[it.resultText??it.learnerText];
 return commitExposure(p,{texts,promptedTexts:prompts,heardPassages:targetAudio&&it.kind==='passage'?[it.learnerText]:[]});
}
function validateSubmission(result){
 if(!obj(result)||typeof result.instanceId!=='string')throw new Error('Invalid submission');
 for(const k of ['nodeId','itemId','programId','contentHash','freshAtPresentation','independent','questionResults'])if(k in result)throw new Error('Protected result field: '+k);
 if(!obj(result.response)&&!['uncertain','skipped','input_error'].includes(result.disposition))throw new Error('Raw response required');
 if(result.disposition&&!['uncertain','skipped','input_error'].includes(result.disposition))throw new Error('Invalid disposition');
}
/** Recompute correctness from raw learner response. partial is saved but never creates mastery. */
export function recordAttempt(profile,pkg,result){
 validateSubmission(result);if(profile.receipts[result.instanceId])return clone(profile);
 const active=profile.activeInstance;if(!active||active.instanceId!==result.instanceId)throw new Error('Stale or missing instance');
 const item=pkg.items[active.itemId],node=pkg.nodes[active.nodeId];
 const p=clone(profile);let response=clone(result.response??{});
 if(item.kind==='passage'){
  const incoming=response.answers??{};const mapped=arr(incoming)?Object.fromEntries(item.answer.questions.map((q,i)=>[q.id,incoming[i]]).filter(([,v])=>v!==undefined)):incoming;
  if(!obj(mapped))throw new Error('Invalid question answers');
  const allowed=new Set(item.answer.questions.map(q=>q.id));if(Object.keys(mapped).some(k=>!allowed.has(k)))throw new Error('Unknown question id');
  response.answers={...active.answers,...mapped};p.activeInstance.answers=clone(response.answers);
 }
 if(!response.reading&&active.reading)response.reading=active.reading;
 let g=result.disposition?{outcome:result.disposition,readingVerified:false}:grade(item,response);
 if('outcome'in result&&result.outcome!==g.outcome)throw new Error('Claimed outcome does not match raw grading');
 if(g.outcome==='partial'){
  p.activeInstance.lastPartial=clone(g);if(response.reading)p.activeInstance.reading=clone(response.reading);
  return changed(p);
 }
 if(g.outcome==='needs_verifier')g={...g,outcome:'uncertain'};
 const mode=active.mode;
 const independent=g.outcome==='correct'&&active.helpLevel===0&&(!active.readingTargetAudioPlayed||mode==='listen');
 const readingVerified=mode==='read'&&g.readingVerified===true&&g.readingCorrect===true;
 const promptFree=!promptedThisVisit(profile,item); // a recent model or revealed answer prevents an independent same-visit check
 const verifiedIndependent=independent&&(active.phase!=='independent'||promptFree);
 const questions=g.questionResults??[];
 const ev={...active,outcome:g.outcome,questionResults:questions,readingVerified,meaningOutcome:g.meaningOutcome??null,
  independent:verifiedIndependent,decodingTransfer:verifiedIndependent&&readingVerified&&node?.assessment.freshness==='target_unseen'&&active.phase==='independent'&&active.freshAtPresentation&&active.novelTargetAtPresentation&&['decoding','reading_and_meaning'].includes(item.evidenceType)&&!node?.evidencePolicy?.recognitionOnly,
  readingEvidenceMode:mode,subskillIds:questions.filter(q=>q.outcome==='correct').flatMap(q=>q.skillIds),
  functionVerified:active.context==='support'&&g.functionVerified===true&&g.functionCapabilityId===active.supportCapability&&active.helpLevel===0,functionCapabilityId:g.functionCapabilityId??null,
  response:clone(response),error:result.error?{kind:result.error.kind,origin:result.error.origin,confirmed:result.error.confirmed===true,letterPair:result.error.letterPair??null}:null};
 if(mode==='listen')ev.readingVerified=false;
 p.attempts.push(ev);p.receipts[active.instanceId]={itemId:active.itemId,nodeId:active.nodeId,outcome:g.outcome};
 p.activeInstance=null;
 if(active.programId&&p.programs[active.programId])p.programs[active.programId].suspendedInstance=null;
 if(item.resultText){return commitExposure(changed(p),{texts:[item.resultText],promptedTexts:active.helpLevel>0?[item.resultText]:[]});}
 return changed(p);
}
export const submitAnswer=recordAttempt;
function checkMatches(a,node,pkg,{retention=false}={}){
 const item=pkg.items[a.itemId],assessment=node.assessment;
 if(!a.independent||a.outcome!=='correct'||a.context!=='route'||a.mode!==node.routeMode)return false;
 if(!retention&&!a.freshAtPresentation)return false;
 if(assessment.requiresReading&&!a.readingVerified)return false;
 if(!retention&&assessment.freshness==='target_unseen'&&!a.novelTargetAtPresentation)return false;
 if(assessment.requiresMeaningSameTrial&&a.meaningOutcome!=='correct')return false;
 if(item.kind==='passage'){
  if(a.questionResults.length!==item.answer.questions.length||a.questionResults.some(x=>x.outcome!=='correct'))return false;
  if(!assessment.requiredQuestionSkillIds.every(s=>a.subskillIds.includes(s)))return false;
 }
 if(item.kind!==assessment.kind)return false;
 return true;
}
export function nodeEvidenceStatus(profile,pkg,nodeId){
 const node=pkg.nodes[nodeId];if(!node)throw new Error('Unknown node');
 const all=profile.attempts.filter(a=>a.nodeId===nodeId&&a.phase==='independent'&&checkMatches(a,node,pkg));
 const ids=new Set(all.map(a=>a.itemId)),visits=new Set(all.map(a=>a.sessionId));
 const app=profile.attempts.some(a=>a.nodeId===nodeId&&a.itemId===node.applicationId&&a.phase==='application'&&a.independent&&a.outcome==='correct'&&a.context==='route');
 const enough=ids.size>=2&&visits.size>=2&&app;const baseline=all.length?Math.max(...all.map(a=>a.visitIndex)):-1;
 const retention=profile.attempts.some(a=>a.nodeId===nodeId&&a.phase==='review'&&a.visitIndex>=baseline+3&&checkMatches(a,node,pkg,{retention:true}));
 const novelty=all.filter(a=>a.decodingTransfer);const novelOK=new Set(novelty.map(a=>a.canonicalTarget)).size>=2&&new Set(novelty.map(a=>a.sessionId)).size>=2;
 return {nodeId,independentItems:ids.size,visits:visits.size,application:app,baselineVisit:baseline,
  novelDecodingVerified:novelOK,readingAndQuestionsVerified:enough&&node.assessment.requiresReading,
  status:enough?(retention?'mastered':'pending_retention'):'learning'};
}
/** Record a node basis from verified attempts only. A pending-retention basis permits the next teaching step without claiming durable mastery. */
export function updateNodeEvidence(profile,pkg,nodeId){
 const n=pkg.nodes[nodeId],s=nodeEvidenceStatus(profile,pkg,nodeId);const p=clone(profile);
 if(s.status==='learning')return p;
 p.skillBasis[n.skillId]={...s,source:'node_assessment',contentVersion:pkg.contentVersion};
 if(s.status==='mastered'){p.confirmedSkills=unique([...p.confirmedSkills,n.skillId]);p.reviewQueue=p.reviewQueue.filter(r=>r.nodeId!==nodeId);p.programs[n.programId].completedNodes=unique([...p.programs[n.programId].completedNodes,nodeId]);}
 else if(!p.reviewQueue.some(r=>r.nodeId===nodeId)){
  const good=profile.attempts.find(a=>a.nodeId===nodeId&&a.phase==='independent'&&checkMatches(a,n,pkg));
  p.reviewQueue.push({nodeId,programId:n.programId,itemId:good.itemId,dueVisit:s.baselineVisit+3,mode:n.routeMode});
  p.programs[n.programId].provisionalNodes=unique([...p.programs[n.programId].provisionalNodes,nodeId]);
 }
 return changed(p);
}
/** Explicit exact-function confirmation, not broad inference from a coarse flag. */
export function confirmCapability(profile,pkg,key,{verifier,observedItemIds,reason}){
 const c=pkg.capabilitySupports[key];if(!c||verifier!=='companion'||!reason||!arr(observedItemIds)||new Set(observedItemIds).size<2||observedItemIds.some(x=>!c.checkIds.includes(x)))throw new Error('Two authored checks and explicit companion confirmation required');
 const observed=new Set(profile.attempts.filter(a=>a.context==='support'&&a.functionVerified&&a.functionCapabilityId===key&&a.supportCapability===key).map(a=>a.itemId));if(observedItemIds.some(id=>!observed.has(id)))throw new Error('Recorded target-function evidence required');
 const p=clone(profile);p.availableCapabilities=unique([...p.availableCapabilities,key]);p.capabilityEvidence[key]={verifier,observedItemIds:clone(observedItemIds),reason,scope:'exact_function_only'};return changed(p);
}
export function applyTransform(item){const a=item.learnerText,o=item.operation;if(!o)throw new Error('Not a transform');if(o.kind==='replace'){if(a[o.index]!==o.from)throw new Error('Source mismatch');return a.slice(0,o.index)+o.to+a.slice(o.index+1);}if(o.kind==='replace_part')return o.targetParts.join('');if(o.kind==='reorder_letters')return o.indices.map(i=>a[i]).join('');throw new Error('Unknown operation');}
/** Conservative migration: preserve all history, do not turn old group flags into all detailed functions. */
export function migrateV1(old,pkg){
 if(!obj(old)||old.schemaVersion!==1)throw new Error('Expected v1 profile');const p=createProfile(typeof old.id==='string'?old.id:'local');
 p.knownLetters=arr(old.knownLetters)?old.knownLetters.filter(x=>typeof x==='string'&&/^[А-ЯЁ]$/u.test(x)):[];
 p.interests=arr(old.interests)?old.interests.filter(x=>typeof x==='string'):[];p.legacyPractice=[{sourceSchema:1,originalProfile:clone(old),note:'Legacy evidence preserved; not silently promoted to v7 mastery.'}];
 for(const k of ['itemIds','stimuli','words'])p.exposures[k]=arr(old.exposures?.[k])?unique(old.exposures[k].filter(x=>typeof x==='string')):[];
 for(const prog of pkg.programs){p.programs[prog.id]=position(prog);const oldPos=old.programs?.[prog.id];if(oldPos&&prog.defaultPath.includes(oldPos.nodeId)){p.programs[prog.id].nodeId=oldPos.nodeId;p.programs[prog.id].cursor=prog.defaultPath.indexOf(oldPos.nodeId);p.programs[prog.id].stage='recheck_prerequisites';}}
 if(pkg.programs.some(x=>x.id===old.currentProgramId))p.currentProgramId=old.currentProgramId;
 p.migration={from:1,to:2,requiresCapabilityReview:true,oldGroupFlags:clone(old.availablePatterns??[]),backupPreserved:true};return p;
}
export function validateProfile(p,pkg){
 const failures=[];const fail=(ok,msg)=>{if(!ok)failures.push(msg)};
 fail(obj(p)&&p.schemaVersion===2,'schemaVersion');if(!obj(p))return failures;
 fail(typeof p.id==='string'&&p.id.length>0,'id');fail(Number.isInteger(p.revision)&&p.revision>=0,'revision');
 for(const k of ['knownLetters','availableCapabilities','interests','attempts','confirmedSkills','completedVisits','reviewQueue','legacyPractice'])fail(arr(p[k]),k);
 for(const k of ['programs','receipts','exposures','skillBasis','capabilityEvidence','support'])fail(obj(p[k]),k);
 if(failures.length)return failures;
 fail(p.knownLetters.every(x=>typeof x==='string'&&/^[А-ЯЁ]$/u.test(x)),'letters');fail(p.availableCapabilities.every(x=>typeof x==='string'&&x in pkg.capabilitySupports),'capabilities');
 for(const k of ['itemIds','stimuli','words','families','heardPassages','events'])fail(arr(p.exposures[k]),'exposures.'+k);
 fail(p.interests.every(x=>typeof x==='string'),'interests[]');
 fail(p.confirmedSkills.every(x=>typeof x==='string'&&x in pkg.skills),'confirmedSkills[]');
 fail(p.completedVisits.every(x=>typeof x==='string')&&new Set(p.completedVisits).size===p.completedVisits.length,'completedVisits[]');
 for(const k of ['itemIds','stimuli','words','families','heardPassages'])fail((p.exposures[k]??[]).every(x=>typeof x==='string'),'exposures.'+k+'[]');
 if(p.currentProgramId!==null)fail(pkg.programs.some(x=>x.id===p.currentProgramId),'program');
 for(const [id,pos] of Object.entries(p.programs)){
  const prog=pkg.programs.find(x=>x.id===id);fail(!!prog&&obj(pos),'position');if(!prog||!obj(pos))continue;
  fail(prog.nodeIds.includes(pos.nodeId)||pos.nodeId===null,'position.nodeId');fail(Number.isInteger(pos.cursor)&&pos.cursor>=0&&pos.cursor<=prog.defaultPath.length,'position.cursor');
  fail(Number.isInteger(pos.episodeIndex)&&pos.episodeIndex>=0&&Number.isInteger(pos.stepIndex)&&pos.stepIndex>=0,'episode cursor');
  for(const k of ['completedNodes','provisionalNodes','completedSteps'])fail(arr(pos[k]),'position.'+k);
 }
 if(p.activeInstance!==null){const a=p.activeInstance;fail(obj(a)&&pkg.items[a.itemId]&&typeof a.instanceId==='string'&&phases.has(a.phase)&&modes.has(a.mode),'activeInstance');}
 if(p.currentVisit!==null)fail(obj(p.currentVisit)&&typeof p.currentVisit.id==='string'&&Number.isInteger(p.currentVisit.index)&&Number.isInteger(p.currentVisit.actions),'visit');
 for(const a of p.attempts)fail(obj(a)&&typeof a.instanceId==='string'&&pkg.items[a.itemId]&&typeof a.independent==='boolean'&&['correct','incorrect','uncertain','skipped','input_error'].includes(a.outcome),'attempt');
 for(const e of p.exposures.events??[])fail(obj(e)&&arr(e.texts)&&arr(e.promptedTexts)&&arr(e.heardPassages)&&typeof e.visitId==='string','exposure event');
 return failures;
}
export function exportProfile(p){return JSON.stringify(p);}
export function importProfile(raw,pkg){
 if(typeof raw!=='string'||raw.length>20_000_000)throw new Error('Invalid profile file');const p=JSON.parse(raw);
 const f=validateProfile(p,pkg);if(f.length)throw new Error('Invalid profile: '+unique(f).join(', '));return p;
}

/** Use authored hint level: revealing a definition is level four, not a disguised hint-free response. */
export function applyHint(profile,pkg,index=0){const a=profile.activeInstance;if(!a)throw new Error('No active task');const t=pkg.items[a.itemId];if(!Number.isInteger(index)||index<0||index>=t.hints.length)throw new Error('Invalid hint index');return requestHelp(profile,pkg,{level:t.hintLevels?.[index]??(index===0?1:4),revealAnswer:(t.hintLevels?.[index]??(index===0?1:4))===4});}

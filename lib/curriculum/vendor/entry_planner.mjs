/** Reference decision functions for onboarding-0.7.3. Not a UI or a replacement RouteEngine.
 * All decisions are versioned project parameters; source curriculum and grading stay unchanged.
 */
import {grade} from './source/grading.mjs';
import {normalise, words} from './source/normalise.mjs';
import {hasSkill, confirmEntrySkill, switchProgram, beginVisit, wasTargetPromptedThisVisit} from './source/engine.mjs';
import {chooseEntry, nextAction} from './source/route.mjs';
export const P1='method_syllable_first',P2='method_word_first';
const rank=['letters','syllables','short_words','multi_part','sentences','texts'];
const initial={letters:'CV',syllables:'CVC',short_words:'CV2',multi_part:'LEN3',sentences:'SUBJECT',texts:'FACTS3',unknown:'CVC'};
const bySkill=(r,s)=>Object.values(r.groups).find(g=>g.skillId===s);
const unique=x=>[...new Set(x)];
/** Fail fast on incompatible IDs; an unknown group is never a completion signal. */
export class EntryDataError extends Error{
 constructor(groupId){super('UNKNOWN_ENTRY_GROUP: '+String(groupId));this.name='EntryDataError';this.code='UNKNOWN_ENTRY_GROUP';this.groupId=groupId;}
}
function requireGroup(registry,groupId){
 if(typeof groupId!=='string'||!Object.hasOwn(registry.groups,groupId))throw new EntryDataError(groupId);
 return registry.groups[groupId];
}
export function normaliseAnswers(a={}){
 const selected=rank.filter(x=>(a.reads??[]).includes(x));
 const highest=selected.at(-1)??'unknown';
 const chosen=[P1,P2].includes(a.program)?a.program:P1;
 // Priority: recurring current blending difficulty overrides high self-report; a letter-pair report alone does not.
 const override=selected.some(x=>['short_words','multi_part','sentences','texts'].includes(x))&&(a.blendingDifficulty==='often'||a.onlyMemorisedWords===true);
 return {...a,reads:selected,highest,program:chosen,programChoiceReason:a.program===chosen?'explicit':'default_no_preference',initialGroup:override?'CV2':initial[highest],initialRule:override?'F01_blending_override':'F02_'+highest,budget:[3,5,7].includes(a.budget)?a.budget:5,
  companionAvailable:a.companionAvailable===true,sideGroups:['LP','MS'].filter(x=>(a.letterPairs??[]).includes(x)).map(x=>x+'_SIGN')};
}
export function accessDecision(a){
 if(a.visualTextUsable===false)return 'ACCESS_NEEDED';
 if(a.canUseButtons===false&&a.canUseKeyboard===false&&a.companionCanSelect!==true)return 'ACCESS_NEEDED';
 if(a.companionAvailable!==true&&a.instructionsReadable!==true&&a.audioUsable!==true)return 'ACCESS_NEEDED';
 return 'OK';
}
/** Entry questions are intentionally allowed with unknown skills: this is a probe, not a course check.
 * Only a previously observed barrier excludes an item. A reported suspicion queues a side check.
 */
export function selectProbe(registry,profile,groupId,state={}){
 const g=requireGroup(registry,groupId);
 const tried=new Set(state.usedItemIds??[]),excludedLetters=new Set(state.unavailableLetters??[]),excludedCaps=new Set(state.unavailableCapabilities??[]);
 const rows=[];
 for(const row of g.items){
  let reason=null;
  if(tried.has(row.itemId))reason='already_attempted_in_checkpoint';
  else if([...row.requiredLetters].some(c=>excludedLetters.has(c)))reason='observed_letter_barrier';
  else if(row.requiredCapabilities.some(c=>excludedCaps.has(c)))reason='observed_function_barrier';
  else if(wasTargetPromptedThisVisit(profile,row.text))reason='prompted_this_visit';
  else if(g.freshTargetRequired&&(registry.items[row.itemId].targetWords??words(row.text)).some(w=>profile.exposures.words.includes(w)))reason='target_already_seen';
  else if(g.evidenceRule==='text'&&(profile.exposures.stimuli.includes(normalise(row.text))||profile.exposures.heardPassages.includes(normalise(row.text))||profile.exposures.families.includes(registry.items[row.itemId].exposureFamily)))reason='passage_already_seen_or_heard';
  else if(g.evidenceRule==='familiar_reading'&&!(state.familiarTargets??profile.exposures.words).includes(normalise(row.text)))reason='no_familiar_anchor';
  rows.push({itemId:row.itemId,reason});
  if(!reason)return {kind:'probe',groupId,itemId:row.itemId,text:row.text,rejections:rows.filter(x=>x.reason)};
 }
 return {kind:'probe_unavailable',groupId,rejections:rows,reason:rows.every(x=>x.reason==='prompted_this_visit')?'WAIT_NEW_VISIT':'ENTRY_BANK_UNAVAILABLE'};
}
/** Derive one entry observation from an actual persisted attempt + pre-presentation checkpoint metadata.
 * Metadata must be created by the app at launch, not supplied by the learner's answer.
 */
export function evaluateAttempt(registry,groupId,attempt,metadata){
 const g=requireGroup(registry,groupId),row=g.items.find(i=>i.itemId===attempt.itemId);
 if(!row||metadata.groupId!==groupId||metadata.instanceId!==attempt.instanceId)throw Error('Entry identity mismatch');
 if(attempt.contentHash!==row.contentHash)throw Error('Content hash mismatch');
 const base={groupId,itemId:row.itemId,instanceId:attempt.instanceId,target:normalise(row.text),covers:row.covers??[],sessionId:attempt.sessionId,source:'entry_probe'};
 if(['skipped','uncertain','input_error'].includes(attempt.outcome))return {...base,result:'unassessed',reason:attempt.outcome};
 if(metadata.purpose!=='entry_probe')return {...base,result:'unassessed',reason:'not_an_entry_checkpoint'};
 if(metadata.independentAccess!==true)return {...base,result:'unassessed',reason:'access_not_established'};
 if(attempt.helpLevel!==0||attempt.readingTargetAudioPlayed||attempt.promptFreeAtPresentation===false||metadata.promptFree!==true)return {...base,result:'assisted',reason:'target_help'};
 if(attempt.mode!=='read')return {...base,result:'unassessed',reason:'listening_is_separate'};
 if(g.freshTargetRequired&&!metadata.novelTargetBeforeShow)return {...base,result:'unassessed',reason:'not_a_new_target'};
 if(g.evidenceRule==='text'&&!metadata.freshPassageBeforeShow)return {...base,result:'unassessed',reason:'not_a_cold_passage'};
 if(g.evidenceRule==='familiar_reading'&&!metadata.familiarBeforeShow)return {...base,result:'unassessed',reason:'not_a_known_target'};
 const graded=grade(registry.items[row.itemId],attempt.response??{}),reading=attempt.response?.reading;
 if(['reading','familiar_reading','text','read_meaning'].includes(g.evidenceRule)){
  if(reading?.verifier!=='companion'||typeof reading.correct!=='boolean')return {...base,result:'unassessed',reason:'no_reading_verifier'};
  if(!reading.correct)return {...base,result:'fail',reason:'reading',verifiedByCompanion:true};
  if(metadata.onlyMemorised===true&&g.evidenceRule==='reading')return {...base,result:'unassessed',reason:'recognition_not_decoding'};
 }
 let ok=graded.outcome==='correct';
 if(g.evidenceRule==='text')ok=row.questionIds.every(qid=>graded.questionResults?.some(q=>q.questionId===qid&&q.outcome==='correct'));
 if(graded.outcome==='partial')return {...base,result:'unassessed',reason:'partial'};
 return {...base,result:ok?'pass':'fail',reason:ok?'target_success':g.evidenceRule==='boundary'?'boundary':g.evidenceRule==='choice'?'selection':'meaning',verifiedByCompanion:metadata.companionObserved===true||reading?.verifier==='companion'};
}
export function groupStatus(registry,groupId,observations=[]){
 const g=requireGroup(registry,groupId);let rows=observations.filter(x=>x.groupId===groupId);
 // Retests get a new checkpoint; caller supplies only observations belonging to this checkpoint.
 const seen=new Set();rows=rows.filter(r=>{if(!['pass','fail','assisted'].includes(r.result)||seen.has(r.target))return false;seen.add(r.target);return true;});
 const passed=rows.filter(r=>r.result==='pass'),bad=rows.filter(r=>r.result!=='pass'),coverage=unique(passed.flatMap(r=>r.covers??[]));
 if(passed.length>=2&&g.requiredCoverage.every(x=>coverage.includes(x))){
  const verified=passed.filter(r=>r.verifiedByCompanion);let pair=null;
  for(let i=0;i<verified.length;i++)for(let j=i+1;j<verified.length;j++)if(g.requiredCoverage.every(c=>[...(verified[i].covers??[]),...(verified[j].covers??[])].includes(c))&&!pair)pair=[verified[i],verified[j]];
  return {status:'pass',proofs:(pair??passed.slice(0,2)).map(r=>r.instanceId),canConfirm:!!pair};
 }
 if(bad.length>=2)return {status:'needs_teaching',reason:bad.some(r=>r.reason==='reading')?'reading':bad[0].reason,proofs:bad.map(r=>r.instanceId)};
 if(rows.length>=g.maxScored)return {status:'mixed',proofs:rows.map(r=>r.instanceId)};
 return {status:'pending',proofs:rows.map(r=>r.instanceId)};
}
export function confirmEligibleGroups(profile,pkg,registry,observations,checkpointId){
 let p=structuredClone(profile);const applied=[];
 for(const g of Object.values(registry.groups)){
  const s=groupStatus(registry,g.id,observations);
  if(s.status!=='pass'||!s.canConfirm||hasSkill(p,pkg,g.skillId))continue;
  p=confirmEntrySkill(p,pkg,g.skillId,{verifier:'companion',reason:JSON.stringify({specVersion:registry.specVersion,checkpointId,groupId:g.id,instanceIds:s.proofs})});applied.push(g.skillId);
 }
 return {profile:p,applied};
}
/** After the initial checkpoint, successful groups point to a learning goal, not to fabricated mastery. */
export function chooseGoal(registry,answers,groupId,status,allStatuses={}){
 const a=normaliseAnswers(answers),g=requireGroup(registry,groupId);
 if(a.program===P2&&['CV','VC','CVC'].includes(groupId))return {groupId:'ANCHOR',reason:'word_first_anchor'};
 if(a.program===P2&&groupId==='CV2'&&status.status!=='pass'){
  const target=allStatuses.ANCHOR?.status==='pass'?'BOUNDARY':'ANCHOR';return {groupId:target,reason:'known_word_then_analysis'};
 }
 if(status.status==='pass'){
  if(g.successNextGroup!==null)requireGroup(registry,g.successNextGroup);
  return {groupId:g.successNextGroup,reason:'next_target_after_entry_pass'};
 }
 return {groupId,reason:status.status==='needs_teaching'?'observed_learning_target':'tentative_from_self_report'};
}
export function episodeForNode(pkg,nodeId,interests=[]){
 const n=pkg.nodes[nodeId];if(!n)throw Error('Unknown node');
 const score=eid=>Math.max(0,...pkg.episodes[eid].steps.filter(s=>s.itemId).map(s=>(pkg.items[s.itemId].interestTags??[]).filter(t=>interests.includes(t)).length));
 return [...n.episodeIds].map((id,idx)=>({id,idx,score:score(id)})).sort((a,b)=>b.score-a.score||a.idx-b.idx)[0]?.id??null;
}
/** Concrete free practice. No call to continuePracticeOnly, no course cursor movement, no mastery. */
export function practicePlan(pkg,registry,groupId,answers,reason){
 const a=normaliseAnswers(answers),g=requireGroup(registry,groupId);
 const sourceNode=g.nodeByProgram[a.program]??g.sourceNodeId;
 const episodeId=episodeForNode(pkg,sourceNode,a.interestTags??[]);
 const items=g.orderedItemIds;const requestedMode=a.audioUsable===true&&a.practiceMode==='listen'?'listen':'read';
 const mode=items.slice(0,3).every(id=>pkg.items[id].allowedModes.includes(requestedMode))?requestedMode:'read';
 // Each item retains its authored prompt/key. Help is optional and must be logged before display.
 return {kind:'provisional_free',reason,selectedProgramId:a.program,sourceNodeId:sourceNode,sourceEpisodeId:episodeId,startNodeId:null,startEpisodeId:null,
  orderedTaskIds:items.slice(0,3),mode,modeFallback:mode!==requestedMode,entryRetestGroup:groupId,advanceCourse:false,uses:'launchFree + recordReadingStage/revealOptions + recordAttempt',canListen:a.audioUsable===true&&items.slice(0,3).every(id=>pkg.items[id].allowedModes.includes('listen'))};
}
/** Resolve only prerequisites of the intended target; never search the whole course from A01.
 * Existing source functions still guard a formal route launch. Missing evidence leads to an explicit checkpoint.
 */
export function resolvePlacement(pkg,registry,profile,answers,targetGroup,statuses={},probeState={}){
 // null is the explicit terminal successor from chooseGoal; undefined and unknown IDs are data errors.
 const g=targetGroup===null?null:requireGroup(registry,targetGroup);
 const a=normaliseAnswers(answers);if(accessDecision(a)!=='OK')return {kind:'access_setup',startNodeId:null,startEpisodeId:null,reason:'ACCESS_NEEDED'};
 if(targetGroup===null)return {kind:'scope_complete',startNodeId:null,startEpisodeId:null,practice:practicePlan(pkg,registry,'STORY5',a,'curriculum_scope_not_course_completion')};
 if(a.skipAssessment===true||probeState.deferEntry===true)return {kind:'provisional_free',...practicePlan(pkg,registry,targetGroup,a,'ENTRY_DEFERRED'),pendingCheckpoint:targetGroup};
 if(!a.companionAvailable)return {kind:'provisional_free',...practicePlan(pkg,registry,targetGroup,a,'NO_COMPANION'),pendingCheckpoint:targetGroup};
 const nid=g.nodeByProgram[a.program];
 if(!nid)return {kind:'provisional_free',...practicePlan(pkg,registry,targetGroup,a,'SHARED_PREREQUISITE'),pendingCheckpoint:targetGroup};
 if(pkg.programs.find(p=>p.id===a.program).supportNodes.includes(nid))return {kind:'side_support',sourceNodeId:nid,sourceEpisodeId:episodeForNode(pkg,nid,a.interestTags??[]),returnToOrigin:true,advanceCourse:false};
 const visited=new Set();let target=nid;const trace=[];
 while(true){
  if(visited.has(target))throw Error('Prerequisite cycle');visited.add(target);
  const n=pkg.nodes[target],missing=n.prerequisiteSkills.filter(s=>!hasSkill(profile,pkg,s));
  if(!missing.length)break;
  const s=missing[0],pg=bySkill(registry,s);if(!pg)throw Error('Registry lacks required checkpoint: '+s);
  trace.push({nodeId:target,missingSkillId:s,groupId:pg.id});
  if(['needs_teaching','mixed'].includes(statuses[pg.id]?.status)){
   const lower=pg.nodeByProgram[a.program];
   if(!lower)return {kind:'provisional_free',...practicePlan(pkg,registry,pg.id,a,'SHARED_PREREQUISITE'),recommendedNodeId:nid,returnToNodeId:nid,pendingCheckpoint:pg.id,trace};
   target=lower;continue;
  }
  const probe=selectProbe(registry,profile,pg.id,probeState[pg.id]??{});
  return {kind:probe.kind==='probe'?'entry_checkpoint_needed':'entry_checkpoint_unavailable',recommendedNodeId:nid,recommendedEpisodeId:episodeForNode(pkg,nid,a.interestTags??[]),missingSkillId:s,next:probe,practice:practicePlan(pkg,registry,targetGroup,a,'PENDING_PREREQUISITE'),startNodeId:null,startEpisodeId:null,trace};
 }
 let p=switchProgram(profile,a.program,pkg);if(p.activeInstance)throw Error('Complete or pause active instance before placement');
 p=chooseEntry(p,pkg,target);if(!p.currentVisit)p=beginVisit(p,'entry-plan-preview',{budget:a.budget});
 p.interests=[...(a.interestTags??profile.interests)];const next=nextAction(p,pkg);
 if(['missing_skill','capability_support_needed'].includes(next.action.kind))return {kind:'engine_gate',profileToPersist:next.profile,recommendedNodeId:target,next:next.action,practice:practicePlan(pkg,registry,targetGroup,a,'ENGINE_GATE'),startNodeId:null,startEpisodeId:null,trace};
 if(!['episode_info','episode_task','context_info'].includes(next.action.kind))return {kind:'engine_action',profileToPersist:next.profile,next:next.action,startNodeId:null,startEpisodeId:null,trace};
 const actualNode=next.action.nodeId,ep=next.action.episodeId??next.profile.programs[a.program].teachingOrder?.[0]??episodeForNode(pkg,actualNode,p.interests);
 return {kind:'formal_route',startProgramId:a.program,recommendedNodeId:nid,startNodeId:actualNode,startEpisodeId:ep,firstStepId:pkg.episodes[ep].steps[0].id,firstAction:next.action,trace,profileToPersist:next.profile};
}

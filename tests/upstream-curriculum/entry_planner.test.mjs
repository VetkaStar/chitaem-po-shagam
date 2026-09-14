import {registerHotfixTests} from './hotfix-regression.test.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createProfile,beginVisit,presentTask,recordReadingStage,revealOptions,recordAttempt,hasSkill,requestHelp} from './source/engine.mjs';
import {exampleCorrectResponse} from './source/grading.mjs';
import {launchFree} from './source/route.mjs';
import {normalise} from './source/normalise.mjs';
import {P1,P2,normaliseAnswers,selectProbe,evaluateAttempt,groupStatus,confirmEligibleGroups,chooseGoal,resolvePlacement,episodeForNode} from './entry_planner.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
const pkg=JSON.parse(fs.readFileSync(root+'source/curriculum.json'));
const r=JSON.parse(fs.readFileSync(root+'entry_registry.json'));
const tests=[];function test(name,fn){fn();tests.push(name);}
const A={companionAvailable:true,instructionsReadable:true,canUseButtons:true};
let serial=0;
function trial(p,groupId,index=0,{wrong=false,help=false,listen=false,unverified=false,readingWrong=false,disposition,onlyMemorised=false}={}){
 const row=r.groups[groupId].items[index],it=pkg.items[row.itemId],instanceId='test-'+(++serial);
 const meta={purpose:'entry_probe',groupId,instanceId,promptFree:true,independentAccess:true,novelTargetBeforeShow:!p.exposures.words.includes(normalise(it.learnerText)),freshPassageBeforeShow:!p.exposures.stimuli.includes(normalise(it.learnerText)),familiarBeforeShow:true,companionObserved:!unverified,onlyMemorised};
 p=presentTask(p,pkg,{instanceId,itemId:row.itemId,phase:'free',context:'free',mode:listen?'listen':'read'});
 if(help)p=requestHelp(p,pkg,{level:2});
 let response=exampleCorrectResponse(it);
 if(unverified&&response.reading)response.reading.verifier='asr';
 if(readingWrong&&response.reading)response.reading.correct=false;
 if(wrong){if(response.reading&&!['passage','read_meaning'].includes(it.kind))response.reading.correct=false;else if(response.answers){const qid=row.questionIds[0];response.answers[qid]=['o2'];}else if(response.boundaries)response.boundaries=[1];else if(response.optionIds)response.optionIds=['o3'];}
 if(['passage','read_meaning'].includes(it.kind)){p=recordReadingStage(p,pkg,{instanceId,reading:response.reading});p=revealOptions(p,pkg);}
 p=recordAttempt(p,pkg,{instanceId,response,...(disposition?{disposition}:{})});
 const attempt=p.attempts.at(-1);return {profile:p,observation:evaluateAttempt(r,groupId,attempt,meta),attempt};
}
function two(p,group,opts={}){let x=trial(p,group,0,opts),y=trial(x.profile,group,1,opts);return {profile:y.profile,observations:[x.observation,y.observation]};}
function profile(){return beginVisit(createProfile('test'),'visit-1',{budget:30});}
function withSkills(groups){let p=profile(),obs=[];for(const g of groups){const x=two(p,g);p=x.profile;obs.push(...x.observations);}return {profile:confirmEligibleGroups(p,pkg,r,obs,'test-checkpoint').profile,observations:obs};}

test('Pinned v0.7 source and all literal item/hash/question/node/episode references',()=>{
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(root+'source/curriculum.json')).digest('hex'),r.curriculumSha256);
 for(const g of Object.values(r.groups)){
  assert(pkg.skills[g.skillId]);assert(g.items.length>=3);
  for(const row of g.items){const it=pkg.items[row.itemId];assert(it);assert.equal(it.contentHash,row.contentHash);assert.equal(it.learnerText,row.text);assert.deepEqual(it.answer,row.answer);for(const qid of row.questionIds)assert(it.answer.questions.some(q=>q.id===qid));}
  for(const [program,node] of Object.entries(g.nodes)){assert.equal(pkg.nodes[node.nodeId].programId,program);for(const eid of node.orderedEpisodeIds)assert.equal(pkg.episodes[eid].nodeId,node.nodeId);}
 }
 for(const c of Object.values(r.capabilities)){assert(c.orderedCheckIds.length>=2);for(const id of c.orderedCheckIds)assert.equal(pkg.items[id].answer.capabilityId,c.id);}
});
const levels=['letters','syllables','short_words','multi_part','sentences','texts'],expected=['CV','CVC','CV2','LEN3','SUBJECT','FACTS3'];
for(let mask=0;mask<64;mask++)test('Multiple-answer priority mask '+mask,()=>{
 const reads=levels.filter((_,i)=>mask&(1<<i)),idx=levels.indexOf(reads.at(-1));assert.equal(normaliseAnswers({reads:[...reads,'unknown']}).initialGroup,idx<0?'CVC':expected[idx]);
 assert.equal(normaliseAnswers({reads:[...reads].reverse()}).initialGroup,idx<0?'CVC':expected[idx]);
});
test('Blending often overrides sentences; a reported letter pair alone does not',()=>{assert.equal(normaliseAnswers({reads:['short_words','sentences'],blendingDifficulty:'often',letterPairs:['LP']}).initialGroup,'CV2');assert.equal(normaliseAnswers({reads:['short_words','sentences'],letterPairs:['LP']}).initialGroup,'SUBJECT');});
test('Unknown program has explicit P1 default',()=>assert.equal(normaliseAnswers({program:'unknown'}).program,P1));
test('Exact first and replacement item; no alternative across medial/initial classes',()=>{
 assert.equal(selectProbe(r,profile(),'CV2').text,'ЛУНА');assert.equal(selectProbe(r,profile(),'CV2',{unavailableLetters:['Л']}).text,'РАМА');
 assert.equal(selectProbe(r,profile(),'MEDIAL').text,'СУМКА');assert.equal(selectProbe(r,profile(),'INITIAL').text,'СТОЛ');
 assert.equal(selectProbe(r,profile(),'MEDIAL',{unavailableCapabilities:['cluster.medial.2']}).kind,'probe_unavailable');
});
test('КОТ + МАМА do not certify either group, all letters, or other prerequisites',()=>{
 let a=trial(profile(),'CVC',0),b=trial(a.profile,'CV2',2);const out=confirmEligibleGroups(b.profile,pkg,r,[a.observation,b.observation],'cp');assert.deepEqual(out.applied,[]);assert.deepEqual(out.profile.knownLetters,[]);
});
test('КОТ + РАК certify exactly decode.cvc; target C01 requests MA/MU checkpoint, not fabricated blend.cv',()=>{
 const x=withSkills(['CVC']);assert.deepEqual(x.profile.confirmedSkills,['decode.cvc']);assert.equal(hasSkill(x.profile,pkg,'blend.cv'),false);
 const out=resolvePlacement(pkg,r,x.profile,A,'CV2');assert.equal(out.kind,'entry_checkpoint_needed');assert.equal(out.missingSkillId,'blend.cv');assert.equal(out.next.itemId,'task.41a973db156b');
});
test('CV confirmed -> exact P1 C01 first episode without marking other lessons completed',()=>{
 const x=withSkills(['CV']);const out=resolvePlacement(pkg,r,x.profile,A,'CV2');assert.equal(out.kind,'formal_route');assert.equal(out.startNodeId,'p1.C01');assert.equal(out.startEpisodeId,'ep.p1.C01.01');assert.deepEqual(out.profileToPersist.programs[P1].completedNodes,[]);
});
test('LUNA + RAMA -> CV2 only; length3 and clusters stay unknown',()=>{
 const x=withSkills(['CV2']);assert.deepEqual(x.profile.confirmedSkills,['decode.cv_cv']);for(const s of ['blend.cv','blend.vc','decode.internal_cluster','decode.initial_cluster','decode.cv_cv_cv'])assert(!hasSkill(x.profile,pkg,s));
 const goal=chooseGoal(r,A,'CV2',{status:'pass'});assert.equal(goal.groupId,'LEN3');const out=resolvePlacement(pkg,r,x.profile,A,goal.groupId);assert.equal(out.startNodeId,'p1.C04');
});
test('Internal and initial failures lead to different exact P1 and P2 nodes',()=>{
 const p=withSkills(['CV','CVC','CV2']).profile;
 for(const program of [P1,P2]){let out=resolvePlacement(pkg,r,p,{...A,program},'MEDIAL');assert.equal(out.startNodeId,program===P1?'p1.C05':'p2.BR01');out=resolvePlacement(pkg,r,p,{...A,program},'INITIAL');assert.equal(out.startNodeId,program===P1?'p1.C06':'p2.BR02');}
});
test('P2 failed CVC prerequisite -> explicit shared free block; source P1 cursor not created',()=>{
 const p=withSkills(['CV2']).profile;const out=resolvePlacement(pkg,r,p,{...A,program:P2},'MEDIAL',{CVC:{status:'needs_teaching'}});assert.equal(out.kind,'provisional_free');assert.equal(out.sourceNodeId,'p1.A03');assert.equal(out.returnToNodeId,'p2.BR01');assert.equal(out.startNodeId,null);assert(!p.programs[P1]);
});
test('Reading a phrase correctly but answering wrongly -> meaning failure, not letter failure',()=>{
 const x=two(profile(),'SUBJECT',{wrong:true});const s=groupStatus(r,'SUBJECT',x.observations);assert.equal(s.status,'needs_teaching');assert.equal(s.reason,'meaning');const p=withSkills(['CV2']).profile;assert.equal(resolvePlacement(pkg,r,p,A,'SUBJECT').startNodeId,'p1.E01');
});
test('Two correct phrase tasks certify only subject_action, not object/location/sequence',()=>{
 const x=withSkills(['SUBJECT']);assert.deepEqual(x.profile.confirmedSkills,['phrase.subject_action']);
});
test('Two facts3 tasks certify facts3 only; locate2 prerequisite needs its own checkpoint',()=>{
 const x=withSkills(['FACTS3']);assert.deepEqual(x.profile.confirmedSkills,['text.facts3']);assert(!hasSkill(x.profile,pkg,'text.locate2'));assert(!hasSkill(x.profile,pkg,'text.sequence3'));
});
test('Boundary [2] succeeds, tokenIds cannot prove boundary',()=>{
 const x=withSkills(['BOUNDARY']);assert(hasSkill(x.profile,pkg,'analyse.split'));assert(!hasSkill(x.profile,pkg,'decode.cv_cv'));assert.equal(resolvePlacement(pkg,r,x.profile,{...A,program:P2},'FADE').startNodeId,'p2.P05');
});
test('One error plus two later successes of same group follows fixed two-of-three rule',()=>{
 let p=profile(),obs=[];for(let i=0;i<3;i++){const x=trial(p,'CVC',i,{wrong:i===0});p=x.profile;obs.push(x.observation);}assert.equal(groupStatus(r,'CVC',obs).status,'pass');
});
test('A replayed same target cannot make two successful examples',()=>{
 const x=trial(profile(),'CVC',0);assert.equal(groupStatus(r,'CVC',[x.observation,{...x.observation,instanceId:'other'}]).status,'pending');
});
for(const option of ['help','listen','unverified','onlyMemorised'])test('No decoding confirmation from '+option,()=>{
 const x=two(profile(),'CV2',{[option]:true});assert.deepEqual(confirmEligibleGroups(x.profile,pkg,r,x.observations,'cp').applied,[]);
});
for(const disposition of ['skipped','input_error','uncertain'])test(disposition+' is not an academic failure',()=>{
 const x=two(profile(),'CVC',{disposition});assert.equal(groupStatus(r,'CVC',x.observations).status,'pending');assert(x.observations.every(o=>o.result==='unassessed'));
});
test('No companion -> concrete free practice; existing RouteEngine/profile remains unchanged',()=>{
 const p=profile(),before=structuredClone(p);const out=resolvePlacement(pkg,r,p,{...A,companionAvailable:false,reads:['sentences'],program:P2},'SUBJECT');assert.equal(out.kind,'provisional_free');assert.equal(out.startNodeId,null);assert.deepEqual(out.orderedTaskIds.slice(0,2),['task.e5874fcf2645','task.19e1c5ac1e67']);assert.deepEqual(p,before);
 const launched=launchFree(p,pkg,out.orderedTaskIds[0],{instanceId:'free-proof',mode:out.mode});assert.equal(launched.activeInstance.context,'free');assert.equal(launched.currentProgramId,null);
});
test('Skip all checks uses explicit deferred free practice, not retry loop',()=>{
 const out=resolvePlacement(pkg,r,profile(),{...A,skipAssessment:true},'CV2');assert.equal(out.kind,'provisional_free');assert.equal(out.reason,'ENTRY_DEFERRED');assert.equal(out.orderedTaskIds[0],'task.380f03bb4e44');
});
test('No usable instruction channel returns access screen, no learning failure',()=>{
 const out=resolvePlacement(pkg,r,profile(),{...A,companionAvailable:false,instructionsReadable:false,audioUsable:false},'CV2');assert.equal(out.kind,'access_setup');
});
test('Exact episode ranking matches native nextAction for games and neutral interests',()=>{
 const p=withSkills(['CV2']).profile;for(const interestTags of [[],['videogames'],['technology']]){const out=resolvePlacement(pkg,r,p,{...A,interestTags},'LEN3');assert.equal(out.startEpisodeId,episodeForNode(pkg,'p1.C04',interestTags));}
});
test('All candidates unavailable has named recovery, never selects another structure',()=>{
 const out=selectProbe(r,profile(),'CVC',{usedItemIds:r.groups.CVC.orderedItemIds});assert.equal(out.kind,'probe_unavailable');assert.equal(out.reason,'ENTRY_BANK_UNAVAILABLE');
});
test('Recognized familiar words do not prove new word transfer',()=>{
 const p=profile();p.exposures.words=['КОДЫ','БОТЫ','МОДЫ','ФОТО'];assert.equal(selectProbe(r,p,'NEWCV2').kind,'probe_unavailable');
});
test('Correct letter choice does not confirm decoding; each letter of pair must be covered',()=>{
 const x=withSkills(['LP_SIGN']);assert(hasSkill(x.profile,pkg,'letter.lp'));assert(!hasSkill(x.profile,pkg,'letter.lp_in_word'));assert.deepEqual(x.profile.knownLetters,[]);
});
test('Object checkpoint uses actual object questions, not subject-label coincidence',()=>{for(const x of r.groups.OBJECT.items)assert.match(x.answer.questions[0].prompt,/^(Что|Кого) /);});
test('Temporal checkpoint requires before and after coverage',()=>{const x=two(profile(),'SEQ2');assert.equal(groupStatus(r,'SEQ2',x.observations).status,'pass');const beforeOnly=[x.observations[0],{...x.observations[1],covers:['first']}];assert.equal(groupStatus(r,'SEQ2',beforeOnly).status,'pending');});
test('Boundary practice never requests unsupported listen mode',()=>{const out=resolvePlacement(pkg,r,profile(),{...A,companionAvailable:false,audioUsable:true,practiceMode:'listen',program:P2},'BOUNDARY');assert.equal(out.mode,'read');assert.equal(out.modeFallback,true);assert.equal(out.canListen,false);});
registerHotfixTests(test);
const report={specVersion:r.specVersion,curriculumSha256:r.curriculumSha256,testCount:tests.length,passed:tests.length,failed:0,scope:'Original 97 cases plus 23 focused regression cases, including persisted review launch; not a full UI, pause-controller or pedagogical trial',tests};
fs.writeFileSync(root+'test_report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:0},null,2));

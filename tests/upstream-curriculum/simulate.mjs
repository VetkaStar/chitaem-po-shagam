import {createHash} from 'node:crypto';
/** Synthetic route integration, not a model of a real learner. Correctness is an oracle fixture. */
import fs from 'node:fs';import assert from 'node:assert/strict';
import * as E from './engine.mjs';import * as R from './route.mjs';import {exampleCorrectResponse} from './grading.mjs';
const rawCurriculum=fs.readFileSync(new URL('./curriculum.json',import.meta.url));
const inputSha256=createHash('sha256').update(rawCurriculum).digest('hex');
const pkg=JSON.parse(rawCurriculum);
const which=process.argv[2]??'p1';const scenarios={p1:{method:0},p2:{method:1},p2_demos:{method:1,demos:true},p1_errors:{method:0,errors:true},p2_errors:{method:1,errors:true},switch:{method:0,switch:true},switch_demos:{method:1,demos:true,switch:true}};
const cfg=scenarios[which];if(!cfg)throw new Error('Unknown scenario');let serial=0;
let p=E.createProfile('synthetic_'+which);p.knownLetters=[...'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'];p.availableCapabilities=Object.keys(pkg.capabilitySupports);p.interests=['retro_pc','videogames'];
p=E.switchProgram(p,pkg.programs[cfg.method].id,pkg);p=E.beginVisit(p,'s0',{budget:5});
for(const s of ['blend.cv','blend.vc','decode.cvc'])p=E.confirmEntrySkill(p,pkg,s,{verifier:'companion',reason:'Technical baseline from the specified curriculum entry. Not actual child evidence.'});
const newVisit=()=>{p=E.beginVisit(E.endVisit(p),'s'+(++serial),{budget:5});};
if(cfg.demos){for(const m of ['p1','p2'])for(const st of R.demoSteps(pkg,m).steps){const it=pkg.items[st.itemId];p=E.commitExposure(p,{texts:[st.visibleText??'',...(st.chunks??[]),it?.learnerText??'',it?.resultText??''],heardPassages:[],promptedTexts:st.promptLevel>=2?[st.visibleText??it?.learnerText??'']:[]});}newVisit();}
const seenErrors=new Map();const log=[];let terminal=null;let switched=false;const completed=[];const start=Date.now();
for(let iteration=0;iteration<5000;iteration++){
 if(cfg.switch&&!switched&&p.attempts.length>=25){const from=p.currentProgramId;p=E.switchProgram(p,pkg.programs[1-cfg.method].id,pkg);log.push({action:'switch',from,to:p.currentProgramId,attempts:p.attempts.length});switched=true;}
 const out=R.nextAction(p,pkg);p=out.profile;const a=out.action;
 if(['pause','await_retention'].includes(a.kind)){if(a.kind==='await_retention'&&a.pendingReviews.length===0)throw new Error('Bad terminal');newVisit();continue;}
 if(a.kind==='route_complete'){completed.push(p.currentProgramId);if(cfg.switch&&completed.length===1){p=E.switchProgram(p,pkg.programs[cfg.method].id,pkg);continue;}terminal=a.kind;break;}
 if(a.kind==='active_info'){p=R.acknowledgeInfo(p,pkg,a.info.planId);continue;}
 if(!['episode_info','episode_task','check','application','review','correction_info','correction_task','context_info','active_task'].includes(a.kind)){terminal={...a,inventory:undefined};break;}
 log.push({nodeId:a.nodeId,kind:a.kind,stepId:a.stepId,itemId:a.itemId,visit:p.currentVisit.id});
 if(a.kind!=='active_task')p=R.launchAction(p,pkg,a,{instanceId:'sim.'+which+'.'+iteration});
 if(p.programs[p.currentProgramId].activeInfo){p=R.acknowledgeInfo(p,pkg,p.programs[p.currentProgramId].activeInfo.planId);continue;}
 if(!p.activeInstance)throw new Error('No active task after launch');
 const t=pkg.items[p.activeInstance.itemId];let response=exampleCorrectResponse(t);const nid=p.activeInstance.nodeId;
 if(cfg.errors&&p.activeInstance.phase==='independent'&&(seenErrors.get(nid)??0)<1){seenErrors.set(nid,1);p=E.requestHelp(p,pkg,{level:4,targetAudio:t.kind==='read',revealAnswer:true});}
 if(['passage','read_meaning'].includes(t.kind))p=E.recordReadingStage(p,pkg,{instanceId:p.activeInstance.instanceId,reading:{verifier:'companion',correct:true}});
 if(t.options.length||t.answer.questions?.length)p=E.revealOptions(p,pkg);
 p=R.answerAction(p,pkg,{instanceId:p.activeInstance.instanceId,response});
}
const report={inputSha256,version:pkg.contentVersion,scenario:which,config:cfg,terminal,visits:p.completedVisits.length,attempts:p.attempts.length,confirmedSkills:p.confirmedSkills.length,completedPrograms:completed,steps:log.length,ms:Date.now()-start,remainingReviews:p.reviewQueue.length,position:p.programs[p.currentProgramId]?.nodeId,tail:log.slice(-12),constraints:'All required letters/functions available; only initial three general skills preconfirmed. Remaining skills earned through actual check/application/retention transitions. Errors scenario gives first check per node with help, not every possible pattern of difficulties.'};
fs.writeFileSync(new URL('../reports/simulation_'+which+'.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(terminal!=='route_complete')process.exitCode=1;

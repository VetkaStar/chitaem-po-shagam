/** Public v7 boundary. Runtime input MUST also pass validation; TypeScript is not an input validator. */
export type ProgramId = string;
export type TaskId = string;
export type NodeId = string;
export type Mode = 'read'|'listen'|'shared';
export type Phase = 'model'|'anchor'|'guided'|'independent'|'application'|'review'|'support'|'demo'|'free';
export type Context = 'route'|'free'|'support'|'demo';
export type Outcome = 'correct'|'incorrect'|'uncertain'|'skipped'|'input_error';
export type GradeOutcome = Outcome|'partial'|'needs_verifier';
export type Freshness = 'target_unseen'|'stimulus_unseen'|'passage_unseen'|'item_unseen'|'layout_unseen'|'unprompted_known';
export interface Option {id:string;text:string}
export interface Segment {line:number;start:number;end:number}
export interface Question {id:string;prompt:string;options:Option[];correctOptionIds:string[];support:string;skillIds:string[];feedback?:string}
export interface ReadingProof {verifier:'companion';correct:boolean}
export interface FunctionProof {verifier:'companion';correct:boolean;capabilityId:string;targetHelpLevel:0|1|2|3|4}
export interface RawResponse {optionIds?:string[];text?:string;tokenIds?:string[];segments?:Segment[];boundaries?:number[];answers?:Record<string,string[]>;reading?:ReadingProof;function?:FunctionProof}
export interface Submission {instanceId:string;response?:RawResponse;disposition?:'uncertain'|'skipped'|'input_error';error?:{kind:string;origin:'companion'|'deterministic_task'|'ASR_hypothesis';confirmed:boolean;letterPair?:'Л/П'|'М/Ш'}}
export type AnswerContract =
 |{kind:'companion_reading';expected:string;accept?:string;reject?:string}
 |{kind:'companion_function';expected:string;capabilityId:string;criterion:string}
 |{kind:'choice';correctOptionIds:string[]}
 |{kind:'exact';value:string}
 |{kind:'ordered_parts';joined:string;joiner?:string}
 |{kind:'spans';segments:Segment[]}
 |{kind:'boundaries';acceptedBoundaries:number[][]}
 |{kind:'question_set';questions:Question[];readingScoredSeparately?:boolean}
 |{kind:'ordered_ids';value:string[]};
export interface Task {id:TaskId;contentVersion:string;contentHash:string;kind:'read'|'choice'|'find_part'|'transform'|'compose'|'passage'|'boundary'|'read_meaning';learnerText:string;assistantPrompt:string;answer:AnswerContract;options:Option[];hints:string[];hintLevels?:number[];requiredLetters:string;requiredCapabilities:string[];parts?:string[];partsAfterAnswer?:string[];partTokens?:{tokenId:string;text:string}[];lines?:string[];resultText?:string;operation?:unknown;allowedModes:Mode[];freeTrainerVisible:boolean;evidenceType:string;interestTags:string[];targetWords:string[];exposureFamily:string;targetCapability?:string}
export interface EpisodeStep {id:string;next:string;action:string;instruction:string;phase:Phase;mode:Mode;itemId?:TaskId;visibleText?:string;spokenText?:string;chunks?:string[];fullTextHidden?:boolean;hideAllParts?:boolean;showQuestions?:boolean;optional?:boolean;requiresAvailableTarget?:boolean;promptLevel?:number;recordExposureBeforeShow:true;claimMastery:false}
export interface Episode {id:string;nodeId:NodeId;programId:ProgramId;title:string;version:string;steps:EpisodeStep[];purpose:'teaching_not_independent_probe'|'demonstration';oneVisitNotRequired:true}
export interface Node {id:NodeId;programId:ProgramId;version:string;taskSetId:string;title:string;skillId:string;nodeRole:'main'|'support'|'bridge'|'review';prerequisiteSkills:string[];defaultNext:string;routeMode:Mode;trainingIds:TaskId[];checkIds:TaskId[];supplementalCheckIds:TaskId[];applicationId:TaskId;applicationKind:'meaning_application'|'analysis_application';episodeIds:string[];assessment:{skillId:string;kind:Task['kind'];freshness:Freshness;requiredQuestionSkillIds:string[];requiresReading:boolean;requiresMeaningSameTrial:boolean;mode:Mode}}
export interface ProgramManifest {id:ProgramId;version:string;title:string;nodeIds:NodeId[];defaultPath:NodeId[];supportNodes:NodeId[];suggestedEntry:NodeId;entrySkills:string[];exitSkills:string[];sharedFinalStage:NodeId[];trialStatus:string}
export interface QuestionResult {questionId:string;questionIndex:number;outcome:'correct'|'incorrect'|'unanswered';skillIds:string[];support:string}
export interface Grade {outcome:GradeOutcome;readingVerified:boolean;readingCorrect:boolean|null;meaningOutcome?:'correct'|'incorrect';questionResults?:QuestionResult[];functionVerified?:boolean;functionCapabilityId?:string}
export interface TaskInstance {instanceId:string;programId:ProgramId|null;nodeId:NodeId|null;itemId:TaskId;context:Context;phase:Phase;mode:Mode;sessionId:string;visitIndex:number;contentVersion:string;contentHash:string;canonicalTarget:string;freshAtPresentation:boolean;novelTargetAtPresentation:boolean;eligibleAtPresentation:boolean;optionOrder:Record<string,string[]>;helpLevel:0|1|2|3|4;readingTargetAudioPlayed:boolean;answers:Record<string,string[]>;readingStageFinished?:boolean;reading?:ReadingProof;episodeId:string|null;stepId:string|null;lastPartial?:Grade}
export interface Attempt extends TaskInstance {outcome:Outcome;independent:boolean;readingVerified:boolean;decodingTransfer:boolean;questionResults:QuestionResult[];subskillIds:string[];response:RawResponse;functionVerified:boolean;functionCapabilityId:string|null}
export interface EpisodePosition {version:string;nodeId:NodeId|null;cursor:number;episodeIndex:number;stepIndex:number;stage:string;completedNodes:NodeId[];provisionalNodes:NodeId[];completedSteps:string[];suspendedInstance:TaskInstance|null;teachingOrder?:string[]|null;practiceOnly?:boolean;activeInfo?:unknown;pendingAction?:unknown}
export interface ExposureEvent {visitId:string;texts:string[];heardPassages:string[];promptedTexts:string[];itemIds:TaskId[]}
export interface Profile {schemaVersion:2;id:string;revision:number;currentProgramId:ProgramId|null;knownLetters:string[];availableCapabilities:string[];interests:string[];programs:Record<string,EpisodePosition>;attempts:Attempt[];receipts:Record<string,{itemId:TaskId;nodeId:NodeId|null;outcome:Outcome}>;exposures:{itemIds:TaskId[];stimuli:string[];words:string[];families:string[];heardPassages:string[];events:ExposureEvent[]};confirmedSkills:string[];skillBasis:Record<string,unknown>;capabilityEvidence:Record<string,unknown>;activeInstance:TaskInstance|null;currentVisit:{id:string;index:number;budget:number;actions:number;checkedNodes:string[];supportInsertions?:number}|null;completedVisits:string[];reviewQueue:{nodeId:NodeId;programId:ProgramId;itemId:TaskId;dueVisit:number;mode:Mode}[];legacyPractice:unknown[];support:Record<string,unknown>}
// The persisted runtime schema is integer 2, while the content schema uses SemVer 2.0.0.
// Two programmes are entries in ProgramManifest[], not an enum in every renderer.

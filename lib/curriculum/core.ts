import * as engineModule from './vendor/source/engine.mjs';
import * as routeModule from './vendor/source/route.mjs';
import type { Profile, Submission, ReadingProof } from './contracts.js';
import type { Curriculum, Action } from './types.js';
// The upstream modules remain byte-identical. This boundary supplies the declared public types.
interface Engine {
  createProfile(id?: string): Profile;
  beginVisit(p: Profile, id: string, options: { budget: number }): Profile;
  endVisit(p: Profile): Profile;
  switchProgram(p: Profile, id: string, c: Curriculum): Profile;
  validateProfile(p: unknown, c: Curriculum): string[];
  nodeEvidenceStatus(p: Profile, c: Curriculum, nodeId: string): { status: string; [key:string]: unknown };
  requestHelp(p: Profile, c: Curriculum, options: { level?: number; targetAudio?: boolean; revealAnswer?: boolean }): Profile;
  recordReadingStage(p: Profile, c: Curriculum, input: { instanceId: string; reading?: ReadingProof }): Profile;
  revealOptions(p: Profile, c: Curriculum): Profile;
  commitExposure(p: Profile, input: { texts: string[] }): Profile;
}
interface Route {
  nextAction(p: Profile, c: Curriculum): { profile: Profile; action: Action };
  launchAction(p: Profile, c: Curriculum, a: Action, options: { instanceId: string }): Profile;
  acknowledgeInfo(p: Profile, c: Curriculum, planId: string): Profile;
  answerAction(p: Profile, c: Curriculum, s: Submission): Profile;
  launchFree(p: Profile, c: Curriculum, itemId: string, options: { mode: string; instanceId: string }): Profile;
}
export const engine = engineModule as unknown as Engine;
export const routeEngine = routeModule as unknown as Route;

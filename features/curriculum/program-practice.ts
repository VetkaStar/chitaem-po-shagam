import type { ProgressState, Supply } from '../../lib/curriculum/types.js';
import { programPracticeBranches, type ProgramPracticeBranch } from '../../lib/curriculum/program-pilot.js';
import { engine } from '../../lib/curriculum/core.js';
import { park } from './state-transitions.js';
import type { InfoPresentation } from './presentation-types.js';
import { exposureInput } from '../../lib/curriculum/free-exposure.js';

export function practiceBranches(supply: Supply) {
  return supply.curriculum.programPracticeBranches ? programPracticeBranches : [];
}
export function selectedPractice(s: ProgressState) {
  return s.studyMode === 'custom' && s.route ? s.customRoutes[s.route.routeId]?.programPractice : undefined;
}
export function practiceReadiness(s: ProgressState, supply: Supply, branch: ProgramPracticeBranch) {
  const tasks = branch.steps.map(step => supply.curriculum.items[step.itemId]);
  return {
    letters: [...new Set(tasks.flatMap(task => Array.from(task.requiredLetters).filter(letter => !s.profile.knownLetters.includes(letter))))],
    capabilities: [...new Set(tasks.flatMap(task => task.requiredCapabilities.filter(id => !s.profile.availableCapabilities.includes(id))))],
  };
}
export function practiceOffer(s: ProgressState, supply: Supply, nodeId?: string) {
  if (s.studyMode !== 'recommended' || s.profile.activeInstance) return undefined;
  const program = s.profile.currentProgramId;
  if (!program || s.profile.programs[program]?.activeInfo) return undefined;
  return practiceBranches(supply).find(branch => branch.programId === program &&
    branch.anchorNodeId === (nodeId ?? s.profile.programs[program]?.nodeId) &&
    !s.programPracticeDismissed?.includes(branch.id) &&
    (!s.customRoutes[branch.id] || s.customRoutes[branch.id].position < branch.steps.length));
}
export function enterPractice(s: ProgressState, supply: Supply, branchId: string) {
  const branch = practiceBranches(supply).find(b => b.id === branchId);
  if (!branch || selectedPractice(s)) throw new Error('INVALID_PRACTICE_ENTRY');
  const returnTo = { studyMode: s.studyMode, route: structuredClone(s.route), programId: s.profile.currentProgramId };
  park(s);
  const route = s.customRoutes[branch.id] ??= {
    source: 'custom', routeId: branch.id, version: 1, steps: structuredClone(branch.steps), position: 0,
    suspendedInstance: null, activeInfo: null,
  };
  route.programPractice = { branchId, returnTo };
  s.studyMode = 'custom';
  s.route = { source: 'custom', routeId: branch.id, version: 1 };
  s.profile.activeInstance = route.suspendedInstance;
  route.suspendedInstance = null;
  s.profile.revision++;
}
export function returnFromPractice(s: ProgressState) {
  const current = selectedPractice(s);
  if (!current) throw new Error('NOT_PROGRAM_PRACTICE');
  park(s);
  const { studyMode, route, programId } = current.returnTo;
  s.studyMode = studyMode;
  s.route = structuredClone(route);
  s.profile.currentProgramId = programId;
  const holder = studyMode === 'recommended' && programId ? s.profile.programs[programId]
    : studyMode === 'custom' && route ? s.customRoutes[route.routeId]
    : studyMode === 'demonstration' && route ? s.demonstrationRuns?.[route.routeId as 'p1' | 'p2']
    : studyMode === 'entry' ? s.onboarding.entry : null;
  if (holder) { s.profile.activeInstance = holder.suspendedInstance; holder.suspendedInstance = null; }
  else if (studyMode === 'free') { s.profile.activeInstance = s.suspendedFreeInstance; s.suspendedFreeInstance = null; }
  s.profile.revision++;
}
export function customInformation(s: ProgressState): InfoPresentation | null {
  if (s.studyMode !== 'custom' || !s.route) return null;
  const route = s.customRoutes[s.route.routeId], info = route.steps[route.position]?.information;
  return route.activeInfo && info ? { kind: 'info', planId: route.activeInfo, instruction: info.instruction, texts: info.texts, spokenTexts: [] } : null;
}
export function launchCustomInformation(s: ProgressState, supply: Supply, planId: string) {
  const route = s.customRoutes[s.route!.routeId], info = route.steps[route.position]?.information;
  if (!info || route.activeInfo || !s.profile.currentVisit) throw new Error('INVALID_CUSTOM_INFORMATION');
  s.profile = engine.commitExposure(s.profile, exposureInput(supply, { texts: [info.instruction, ...info.texts], promptedTexts: info.promptedTexts }));
  route.activeInfo = planId;
  s.profile.currentVisit!.actions++;
}
export function acknowledgeCustomInformation(s: ProgressState, planId: string) {
  const route = s.customRoutes[s.route!.routeId];
  if (route.activeInfo !== planId || !route.steps[route.position]?.information) throw new Error('STALE_CUSTOM_INFORMATION');
  route.activeInfo = null;
  route.position++;
  s.profile.revision++;
}

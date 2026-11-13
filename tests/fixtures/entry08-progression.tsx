import { createRoot } from 'react-dom/client';
import PersonalLesson from '../../features/entry08/PersonalLesson';
import * as P from '../../lib/entry08/personal';
import { entry as E } from '../../lib/entry08/api';
import bank from '../../content/curriculum/lite-bank.json';
import curriculumData from '../../content/curriculum/curriculum.json';
import type { Curriculum } from '../../lib/curriculum/types';
import '../../app/globals.css';
const c = curriculumData as unknown as Curriculum;
const root = createRoot(document.getElementById('root')!);
const entry = E.createEntry({ age: '8to12', reads: 'short_words' }, 'browser-progression');
let run = P.startPersonal(entry, bank, c, {});
let profile: P.PersonalReadiness = { knownLetters: [], availableCapabilities: [], confirmedSkills: [], skillBasis: {} };
function render() {
  root.render(<PersonalLesson view={P.personalView(run, c, profile)} voiceEnabled={false}
    dispatch={(action, payload) => {
      if (action === 'personal_answer') run = P.answerPersonal(run, c, { ...payload, instanceId: run.active!.instanceId } as P.PersonalAnswer);
      if (action === 'personal_next') run = P.nextPersonal(run, c, { profile });
      if (action === 'personal_continue') run = P.nextPersonal(run, c, { profile, continueEpisode: true });
      if (action === 'personal_advance') run = P.nextPersonal(run, c, { profile, acceptProposed: true });
      if (action === 'personal_finish') document.title = 'Preparation';
      render();
    }} />);
}
function read() {
  const node = c.nodes['p1.A01'];
  const episode = node.episodeIds.map(id => c.episodes[id]).find(ep => ep.steps.some(step => c.items[step.itemId!]?.kind === 'read'))!;
  run = P.startPersonal(entry, bank, c, {});
  run.cursor = { ...run.cursor, nodeId: node.id, episodeId: episode.id, stepIndex: episode.steps.findIndex(step => c.items[step.itemId!]?.kind === 'read') };
  run.active = null; run.visit.used = 0; run.promptedTargets = [];
  run = P.nextPersonal(run, c);
  render();
}
function complete(ready: boolean) {
  read();
  const node = c.nodes[run.cursor.nodeId];
  const tasks = [...new Set(node.episodeIds.flatMap(id => c.episodes[id].steps.flatMap(step => step.itemId ? [step.itemId] : [])))].map(id => c.items[id]);
  const first = tasks[0], second = tasks.find(t => t.learnerText !== first.learnerText)!;
  run.observations = [first, second].map((task, i) => ({ instanceId: `i${i}`, taskId: task.id, nodeId: node.id, visitId: `v${i}`, target: task.learnerText, result: 'correct', reading: 'observed', assisted: false, verifier: 'companion' }));
  run.active = null; run.cursor.stepIndex = c.episodes[run.cursor.episodeId].steps.length;
  profile = { knownLetters: [], availableCapabilities: [], confirmedSkills: [], skillBasis: {} };
  if (!ready) profile.entry08 = { ...entry, history: { unavailableLetters: Array.from('АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ') } };
  if (ready) for (const step of c.episodes[c.nodes[node.defaultNext].episodeIds[0]].steps) {
    const task = c.items[step.itemId!];
    profile.knownLetters.push(...Array.from(task?.requiredLetters ?? (step.visibleText ?? '').toUpperCase().match(/[А-ЯЁ]/g) ?? []));
    profile.availableCapabilities.push(...(task?.requiredCapabilities ?? []));
  }
  run = P.nextPersonal(run, c, { profile });
  render();
}
Object.assign(window, { progressionFixture: { read, complete, snapshot: () => structuredClone({ run, profile }) } });
read();

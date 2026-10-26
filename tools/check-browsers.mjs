import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const names = process.argv.slice(2);
const selected = names.length ? names : [
  'first-entry', 'profile-switch', 'instruction-audio', 'answers', 'trainer-menu', 'section-answers',
  'library-answers', 'text-audio', 'remaining-trainers', 'syllable-parts', 'topic-menu', 'word-bridge-enter',
  'curriculum', 'c01', 'curriculum-executors', 'curriculum-trainers', 'curriculum-onboarding',
  'curriculum-roadmap', 'curriculum-free', 'curriculum-free-app', 'curriculum-option-audio',
  'entry08', 'speech-settings', 'rest', 'release-review',
  'task-card-layout', 'home-actions', 'task-card-text', 'task-card-scale',
  'task-card-audio-layout', 'task-card-letters', 'task-card-modes', 'task-card-short-controls',
];
const output = path.resolve('.local/release-review/browser');
fs.mkdirSync(output, { recursive: true });
const resultFile = path.join(output, 'results.json');
const latest = new Map((fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile, 'utf8')) : [])
  .map(result => [result.name, result]));
const results = [];
for (const name of selected) {
  const file = `tests/${name}-browser.mjs`;
  const log = fs.openSync(path.join(output, `${name}.log`), 'w');
  const started = Date.now();
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, [file], { env: process.env, stdio: ['ignore', log, log], windowsHide: true });
    const timer = setTimeout(() => { child.kill(); }, name.startsWith('task-card-') ? 600000 : 180000);
    child.on('error', () => { clearTimeout(timer); resolve(-1); });
    child.on('exit', (code) => { clearTimeout(timer); resolve(code ?? -1); });
  });
  fs.closeSync(log);
  results.push({ name, code, seconds: Math.round((Date.now() - started) / 1000), testedAt: new Date().toISOString() });
  latest.set(name, results.at(-1));
  fs.writeFileSync(resultFile, JSON.stringify([...latest.values()], null, 2));
  console.log(`${code === 0 ? 'PASS' : 'FAIL'} ${name} (${results.at(-1).seconds}s)`);
}
if (results.some((result) => result.code !== 0)) process.exitCode = 1;

import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'content/curriculum/provenance.json'),'utf8'));
for(const file of manifest.files){
  const bytes=fs.readFileSync(path.join(root,file.path));
  if(bytes.length!==file.bytes||sha(bytes)!==file.sha256)throw Error('SUPPLY_MISMATCH: '+file.path);
}
console.log('PASS supplied file SHA256/bytes: '+manifest.files.length);
if(!process.argv.includes('--run-tests'))process.exit(0);
const output=path.join(root,'.local','curriculum-upstream-run');
for(const dir of ['source','reports'])fs.mkdirSync(path.join(output,dir),{recursive:true});
for(const name of ['engine.mjs','route.mjs','grading.mjs','normalise.mjs'])
  fs.copyFileSync(path.join(root,'lib/curriculum/vendor/source',name),path.join(output,'source',name));
fs.copyFileSync(path.join(root,'lib/curriculum/vendor/entry_planner.mjs'),path.join(output,'entry_planner.mjs'));
fs.copyFileSync(path.join(root,'content/curriculum/curriculum.json'),path.join(output,'source/curriculum.json'));
fs.copyFileSync(path.join(root,'content/curriculum/entry_registry.json'),path.join(output,'entry_registry.json'));
for(const name of ['tests.mjs','simulate.mjs','validate.py'])
  fs.copyFileSync(path.join(root,'tests/upstream-curriculum',name),path.join(output,'source',name));
for(const name of ['entry_planner.test.mjs','hotfix-regression.test.mjs'])
  fs.copyFileSync(path.join(root,'tests/upstream-curriculum',name),path.join(output,name));
function run(command,args,cwd,report){
  const result=spawnSync(command,args,{cwd,encoding:'utf8',windowsHide:true,maxBuffer:20_000_000});
  if(report)fs.writeFileSync(path.join(output,'reports',report),result.stdout??'');
  if(result.error||result.status!==0)throw Error([command,...args,result.error?.message,result.stderr,result.stdout].join('\n'));
  console.log('PASS '+args.join(' '));
}
run(process.env.PYTHON_COMMAND||'python',['validate.py'],path.join(output,'source'),'validation.json');
run(process.execPath,['tests.mjs'],path.join(output,'source'));
run(process.execPath,['entry_planner.test.mjs'],output);
for(const scenario of ['p1','p2','p2_demos','p1_errors','p2_errors','switch','switch_demos'])
  run(process.execPath,['simulate.mjs',scenario],path.join(output,'source'));
console.log('Upstream verification completed; reports: .local/curriculum-upstream-run/reports');

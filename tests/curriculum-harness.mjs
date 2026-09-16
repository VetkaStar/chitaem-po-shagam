import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript');
export const root = path.resolve(import.meta.dirname,'..');
export const output = path.join(root,'.local','curriculum-tests');
export function compileCurriculum() {
  for (const dir of ['lib/curriculum','lib/progress','lib/entry08','features/curriculum','features/onboarding','features/roadmap']) {
    const copy = (relative) => {
      for (const entry of fs.readdirSync(path.join(root,relative),{withFileTypes:true})) {
        const source = path.join(relative,entry.name);
        if (entry.isDirectory()) { copy(source); continue; }
        if (!/\.(ts|mjs)$/.test(entry.name)) continue;
        const destination = path.join(output,source.replace(/\.ts$/,'.js'));
        fs.mkdirSync(path.dirname(destination),{recursive:true});
        if (entry.name.endsWith('.ts')) {
          const result = ts.transpileModule(fs.readFileSync(path.join(root,source),'utf8'),{
            compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}
          });
          const compiled=result.outputText.replace(/from\s+(['"])(\.[^'"]+)\1/g,(all,quote,spec)=> {
            if(spec.endsWith('.json')) return all;
            return /\.(js|mjs)$/.test(spec) ? all : `from ${quote}${spec}.js${quote}`;
          }).replace(/import\s+(\w+)\s+from\s+['"]([^'"]+\.json)['"];?/g,(_all,name,spec)=>`const ${name} = ${fs.readFileSync(path.resolve(root,path.dirname(source),spec),'utf8')};`);
          fs.writeFileSync(destination,compiled);
        } else fs.copyFileSync(path.join(root,source),destination);
      }
    };
    copy(dir);
  }
  return output;
}
export function supplyText() {
  return ['curriculum.json','entry_registry.json'].map(name => fs.readFileSync(path.join(root,'content','curriculum',name),'utf8'));
}

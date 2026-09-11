import os, shutil, json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
source=(root/'node_modules').resolve()
dest=root/'node_modules.standalone'
if dest.exists(): raise RuntimeError('Staging directory already exists')
links=[]
count=0
def copy(src,dst):
 global count
 dst.mkdir()
 for e in os.scandir(src):
  a=Path(e.path); b=dst/e.name
  if os.path.isjunction(a) or a.is_symlink():
   resolved=a.resolve()
   try: relative=resolved.relative_to(source)
   except ValueError: raise RuntimeError('External dependency: '+str(a))
   links.append({'path':str(b.relative_to(dest)), 'target':str(relative)})
  elif e.is_dir(follow_symlinks=False): copy(a,b)
  else: shutil.copy2(a,b); count+=1
copy(source,dest)
(root/'.local/dependency-links.json').write_text(json.dumps(links),encoding='utf-8')
print('Copied files:',count,'Internal links:',len(links),flush=True)

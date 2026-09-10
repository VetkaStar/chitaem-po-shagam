from pathlib import Path
from PIL import Image
import json, hashlib
root=Path(__file__).resolve().parents[1]
source=root/'materials/illustrations/incoming'
records=[]
for folder,widths in [('words-23-46',[320,640]),('stories',[560,320,1120])]:
 out=root/'public/illustrations'/folder
 out.mkdir(parents=True,exist_ok=True)
 for file in sorted((source/folder).glob('*.png')):
  with Image.open(file) as image:
   image=image.convert('RGB')
   for width in widths:
    height=round(image.height*width/image.width)
    name=file.stem+('' if width==widths[0] else f'-{width}w')+'.webp'
    dest=out/name
    image.resize((width,height),Image.Resampling.LANCZOS).save(dest,'WEBP',quality=78,method=6)
    records.append({'src':dest.relative_to(root/'public').as_posix(),'width':width,'height':height,'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'source':file.relative_to(root).as_posix()})
(root/'docs/NEW-ILLUSTRATIONS-IMPORT.json').write_text(json.dumps({'images':records},ensure_ascii=False,indent=2),encoding='utf-8')
print('WebP files:',len(records),'Total bytes:',sum(r['bytes'] for r in records))

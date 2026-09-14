#!/usr/bin/env python3
"""Deterministic content-contract checks, not a clinical validation of teaching efficacy."""
import json,sys,hashlib,re
from pathlib import Path
p=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).with_name('curriculum.json')
d=json.loads(p.read_text(encoding='utf-8')); failures=[];checks=0

def check(condition,label):
 global checks
 checks+=1
 if not condition:failures.append(label)
items=d['items'];nodes=d['nodes'];sets=d['taskSets'];episodes=d['episodes']
for key,t in items.items():
 check(key==t['id'],f'{key}: id')
 check(t['contentVersion']==d['contentVersion'],f'{key}: version')
 raw={k:v for k,v in t.items() if k!='contentHash'}
 check(hashlib.sha256(json.dumps(raw,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()==t['contentHash'],f'{key}: hash')
 check(all(k in d['capabilitySupports'] for k in t['requiredCapabilities']),f'{key}: capabilities')
 check(t['freeTrainerVisible'] is True,f'{key}: free access')
 check('textReadMode' not in t,f'{key}: global mode forbidden')
 check(bool(t.get('assistantPrompt')) and len(t.get('hints',[]))>=2,f'{key}: prompt/hints')
 a=t['answer'];k=a['kind']
 if k=='exact':
  o=t.get('operation',{});s=t['learnerText'];expected=None
  if o.get('kind')=='replace':
   check(s[o['index']]==o['from'],f'{key}: replace source');expected=s[:o['index']]+o['to']+s[o['index']+1:]
  elif o.get('kind')=='replace_part':
   check(''.join(o['sourceParts'])==s,f'{key}: source parts');check(sum(x!=y for x,y in zip(o['sourceParts'],o['targetParts']))==1,f'{key}: one part');expected=''.join(o['targetParts'])
  elif o.get('kind')=='reorder_letters':
   check(sorted(o['indices'])==list(range(len(s))),f'{key}: permutation');expected=''.join(s[i] for i in o['indices'])
  if expected is not None:check(expected==a['value']==t['resultText'],f'{key}: transformation result')
 elif k=='choice':check(set(a['correctOptionIds'])<=set(o['id'] for o in t['options']) and bool(a['correctOptionIds']),f'{key}: choice key')
 elif k=='question_set':
  check(bool(a['questions']),f'{key}: questions')
  check(len({q['id'] for q in a['questions']})==len(a['questions']),f'{key}: question ids')
  check(t['questions']==a['questions'],f'{key}: duplicate question consistency')
  for q in a['questions']:
   check(bool(q.get('skillIds')),f'{key}/{q["id"]}: skill')
   check(q['support'].lower().strip('.!?') in t['learnerText'].lower(),f'{key}/{q["id"]}: support substring')
   check(set(q['correctOptionIds'])<=set(o['id'] for o in q['options']),f'{key}/{q["id"]}: answer')
 elif k=='ordered_parts':
  check(a.get('joiner','').join(x['text'] for x in t['partTokens'])==a['joined'],f'{key}: parts')
  check(len({x['tokenId'] for x in t['partTokens']})==len(t['partTokens']),f'{key}: distinct tokens')
 elif k=='spans':
  lines=t.get('lines',t['learnerText'].split(' / '))
  for s in a['segments']:check(0<=s['line']<len(lines) and 0<=s['start']<s['end']<=len(lines[s['line']]),f'{key}: span bounds')
 elif k=='boundaries':
  check(bool(a['acceptedBoundaries']) and ''.join(t['partsAfterAnswer'])==t['learnerText'],f'{key}: boundary parts')
  for seq in a['acceptedBoundaries']:check(seq==sorted(set(seq)) and all(0<x<len(t['learnerText']) for x in seq),f'{key}: boundary positions')
 else:check(k in ['companion_reading','companion_function','ordered_ids'],f'{key}: answer kind')
for sid,s in sets.items():
 check(len(s['trainingIds'])>=4 and len(s['checkIds'])>=4,f'{sid}: finite filled bank')
 check(all(k in items for k in s['trainingIds']+s['checkIds']+[s['applicationId']]+s.get('supplementalCheckIds',[])),f'{sid}: item references')
 check(all(x in d['sources'] for x in s['sources']),f'{sid}: sources')
for nid,n in nodes.items():
 check(n['taskSetId'] in sets,f'{nid}: set')
 check(n['routeMode'] in ['read','listen'],f'{nid}: node mode')
 check(n['episodeIds'] and len(n['episodeIds'])==len(n['trainingIds']),f'{nid}: all training episodes')
 for ident in n['checkIds']+n.get('supplementalCheckIds',[]):
  t=items[ident]
  check(t['kind']==n['assessment']['kind'],f'{nid}/{ident}: check kind')
  if t['kind']=='passage':check(set(n['assessment']['requiredQuestionSkillIds'])<=set(s for q in t['answer']['questions'] for s in q['skillIds']),f'{nid}/{ident}: actual target question')
for eid,e in episodes.items():
 check(e['nodeId'] in nodes and bool(e['steps']),f'{eid}: binding')
 for i,s in enumerate(e['steps']):
  check(s['next']==(e['steps'][i+1]['id'] if i+1<len(e['steps']) else 'EPISODE_END'),f'{eid}: next')
  if s.get('itemId'):check(s['itemId'] in items,f'{eid}/{s["id"]}: item')
  check(bool(s['instruction']),f'{eid}/{s["id"]}: exact instruction')
  if s['action']=='meaning_anchor':check(bool(s['spokenText']),f'{eid}: definition')
for pg in d['programs']:
 known=set(pg['entrySkills']);bad=[]
 for nid in pg['defaultPath']:
  n=nodes[nid]
  expanded=True
  while expanded:
   prior=len(known)
   for r in d['skillEquivalence']:
    if r['from'] in known:known.add(r['to'])
   expanded=len(known)>prior
  missing=set(n['prerequisiteSkills'])-known
  if missing:bad.append({'node':nid,'missing':sorted(missing)})
  known.add(n['skillId'])
 check(not bad,pg['id']+': prerequisite graph '+str(bad))
 check(set(pg['exitSkills'])<=known,pg['id']+': exit skills')
 check(len(pg['defaultPath'])==len(set(pg['defaultPath'])),pg['id']+': path duplicates')
for c in d['capabilitySupports'].values():check(len(c['trainingIds'])>=2 and len(c['checkIds'])>=2,'cap support '+c['id'])
for key in ['p1','p2']:
 demo=d['methodComparison'][key];check(demo['probeCandidates']==[],key+': demo no reserve consumption')
 check(episodes[demo['episodeId']]['purpose']=='demonstration',key+': demonstration scope')
check(sets['vc']['freshness']=='stimulus_unseen','syllable not word')
check(sets['fade_parts']['freshness']=='unprompted_known','fade known not lifetime novel')
check(nodes['p2.Q03']['nodeRole']=='review','explicit duplicate review')
check(nodes['p1.D02']['routeMode']=='listen' and nodes['p1.D04']['routeMode']=='listen','early complex contextual listening')
result={'inputSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'version':d['contentVersion'],'checks':checks,'failures':failures,'status':'PASS' if not failures else 'FAIL','nodes':len(nodes),'taskSets':len(sets),'items':len(items),'episodes':len(episodes),'scope':'structural and authored-contract checks, not pedagogical efficacy'}
print(json.dumps(result,ensure_ascii=False,indent=2))
sys.exit(bool(failures))

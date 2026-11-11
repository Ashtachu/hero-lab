#!/usr/bin/env python3
"""Fail-closed Hero Lab patch ingestion. Python 3.11, beautifulsoup4, requests."""
import argparse, copy, datetime as dt, hashlib, json, os, re, sys
from pathlib import Path
from bs4 import BeautifulSoup
import requests

ROOT=Path(__file__).resolve().parents[1]
SOURCE='https://overwatch.blizzard.com/en-us/news/patch-notes/pc%20/'
DATE_RE=re.compile(r'\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(20\d{2})\b',re.I)
CHANGE_RE=re.compile(r'^(?P<metric>.+?)\s+(?P<direction>increased|decreased|reduced|raised|lowered)\s+(?:from\s+)?(?P<old>\d+(?:\.\d+)?)\s*(?:%|seconds?|s|meters?|m|hp|health)?\s+(?:to\s+|(?:up|down)\s+from\s+)(?P<new>\d+(?:\.\d+)?)',re.I)
ALT_CHANGE_RE=re.compile(r'^(?P<metric>.+?)\s+(?P<direction>increased|decreased|reduced|raised|lowered)\s+to\s+(?P<new>\d+(?:\.\d+)?)\s*%?\s*\((?:up|down)\s+from\s+(?P<old>\d+(?:\.\d+)?)\s*%?\)',re.I)
# Do not change unrelated numeric game modes, perks, or weapon data automatically.
HERO_STAT_ALIASES={'health':'health','base health':'health','armor':'armor','shields':'shields'}

def now(): return dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z')
def clean(s):return ' '.join(str(s).split())
def text(tag):return clean(tag.get_text(' ',strip=True))
def normalize(s):return re.sub(r'[^a-z0-9]','',s.lower())
def read_json(path,default):
    p=Path(path);return json.loads(p.read_text()) if p.exists() else default

def fetch(url=SOURCE):
    if not url.startswith('https://overwatch.blizzard.com/en-us/news/patch-notes/'):
        raise ValueError('Only official Blizzard patch-note URLs allowed')
    resp=requests.get(url,timeout=35,headers={'User-Agent':'HeroLabPatchEngine/1.0 (patch research; contact via repository issues)','Accept':'text/html'})
    resp.raise_for_status();html=resp.text
    if len(html)<3000 or 'patch' not in html.lower():raise RuntimeError('Unexpected page content; ingestion aborted')
    return html

def parse_official(html,roster):
    """Preserve raw patch sentences; only convert isolated, explicit numeric changes.
    The site can change its markup at any time, so unknown text remains queued for review."""
    soup=BeautifulSoup(html,'html.parser');main=soup.select_one('main') or soup.select_one('article') or soup.body
    if main is None:raise ValueError('No readable official patch content')
    # Site markup uses heading-level nesting for patch date / hero / ability; parse structurally.
    names={normalize(h['name']):h['name'] for h in roster}
    names.update({'dva':'D.Va','lucio':'Lúcio','torbjorn':'Torbjörn'})
    collected=[];current_date=None;current_hero=None;ability=None;section='';mode='standard';seen=set();date_count=0
    for node in main.find_all(['h1','h2','h3','h4','h5','h6','p','li'],recursive=True):
        # Ignore nodes nested in another selected block (e.g. li inside p).
        if node.find_parent(['h1','h2','h3','h4','h5','h6','p','li']) is not None:continue
        label=text(node)
        if not label:continue
        heading=node.name.startswith('h')
        datem=DATE_RE.search(label)
        if datem and heading and len(label)<140:
            parsed=dt.datetime.strptime(datem.group(0),'%B %d, %Y').date()
            current_date=parsed.isoformat();current_hero=None;ability=None;section='';mode='standard';date_count+=1
            continue
        if not current_date:continue
        if heading:
            l=label.lower()
            if 'stadium' in l or '6v6' in l:mode='stadium' if 'stadium' in l else '6v6'
            if ('hero updates' in l or l in ('tank','damage','support')):section='heroes';mode='standard';current_hero=None;ability=None;continue
            if any(q in l for q in ('bug fixes','map updates','general updates','stadium updates','event updates','perks updates')):
                section='other';current_hero=None;ability=None
                if 'stadium' in l:mode='stadium'
                continue
            hero=names.get(normalize(label))
            if hero and section=='heroes':current_hero=hero;ability=None;continue
            if current_hero and section=='heroes':ability=label
            continue
        if node.name!='li' or len(label)>450:continue
        if not current_hero or section!='heroes':continue
        entry={'patch_date':current_date,'hero':current_hero,'ability':ability,'text':label,'game_mode':mode,'status':'needs_review'}
        raw=clean(label.strip('•'))
        m=CHANGE_RE.match(raw) or ALT_CHANGE_RE.match(raw)
        if m:
            entry.update({'metric':clean(m.group('metric')).strip(' .'),'old_value':float(m.group('old')),'new_value':float(m.group('new')),'status':'parsed_pending_validation'})
        fingerprint=hashlib.sha256(json.dumps(entry,sort_keys=True).encode()).hexdigest()[:16]
        if fingerprint not in seen:entry['id']=fingerprint;collected.append(entry);seen.add(fingerprint)
    if date_count==0:raise RuntimeError('No patch dates parsed: HTML changed, refusing to mark checked')
    return collected

def validate(entry,baseline):
    """Auto-approve only exact standard-mode hero base health/armor/shields values when baseline old matches.
    Never silently map generic ability numbers, percentages, perk stats, or mode-specific lines."""
    if entry.get('status')!='parsed_pending_validation':return entry
    metric=entry['metric'].lower().strip()
    key=HERO_STAT_ALIASES.get(metric)
    if not key or entry['game_mode']!='standard' or entry.get('ability'):
        entry['validation_reason']='Not safe for direct stat mapping; requires manual review';return entry
    hero=next((h for h in baseline['heroes'] if h['name']==entry['hero']),None)
    record=(hero or {}).get('stats',{}).get(key)
    if not record or record.get('verification_status')!='verified':
        entry['validation_reason']='Verified baseline missing';return entry
    try:old=float(record['current_value'])
    except (TypeError,ValueError):entry['validation_reason']='Baseline is nonnumeric';return entry
    if abs(old-entry['old_value'])>0.0001:
        entry['validation_reason']=f'Baseline {old:g} != documented old {entry["old_value"]:g}; review history';return entry
    if not 0<=entry['new_value']<=2000:
        entry['validation_reason']='Value outside expected bounds';return entry
    entry['status']='auto_verified';entry['stat_key']=key;entry['scope']='hero';entry['validation_reason']='Exact metric and baseline matched'
    return entry

def apply_verified(db,entry):
    h=next((h for h in db['heroes'] if h['name']==entry['hero']),None)
    if not h or entry['status']!='auto_verified':return False
    row=h['stats'].get(entry['stat_key']);
    if not row:return False
    row['previous_value']=row['current_value'];row['current_value']=str(int(entry['new_value']) if float(entry['new_value']).is_integer() else entry['new_value'])
    row['patch_version']=entry['patch_date'];row['verified_at']=now();row['verification_status']='verified';
    # Recompute only numeric derived hero total HP where every component is numeric.
    if entry['stat_key'] in ('health','armor','shields'):
        try:
            total=sum(float(h['stats'][k]['current_value']) for k in ('health','armor','shields'))
            totalrow=h['stats'].get('total_hp')
            if totalrow:
                totalrow['previous_value']=totalrow.get('current_value');totalrow['current_value']=str(int(total) if total.is_integer() else total)
                totalrow['patch_version']=entry['patch_date'];totalrow['verified_at']=now()
        except (ValueError,TypeError,KeyError):pass
    return True

def ingest(html,baseline,state):
    entries=parse_official(html,baseline['heroes'])
    entries=[validate(e,baseline) for e in entries]
    known={c['id'] for c in state.get('entries',[])}
    new=[e for e in entries if e['id'] not in known]
    state['entries']=sorted(state.get('entries',[])+new,key=lambda e:(e['patch_date'],e['id']),reverse=True)
    state['checked_at']=now();state['source_url']=SOURCE;state['last_error']=None
    dates=sorted({dt.datetime.strptime(m.group(0),'%B %d, %Y').date().isoformat() for m in DATE_RE.finditer(BeautifulSoup(html,'html.parser').get_text(' ',strip=True))},reverse=True)
    if dates:state['latest_seen_date']=dates[0]
    # New entries are available as reviewed annotations, even if not direct verified stats.
    db=copy.deepcopy(baseline)
    for e in reversed(state['entries']):apply_verified(db,e)
    # Feed the historical comparison and universal search with parsed evidence.
    # Pending records are labeled explicitly; they never alter combat stats.
    next_id=max((p.get('id',0) for p in db.get('patches',[])),default=0)+1
    for e in reversed(state['entries']):
        version=e['patch_date']
        record=next((p for p in db['patches'] if p['patch_version']==version),None)
        if record is None:
            record={'id':next_id,'patch_version':version,'patch_date':version,
                    'title':'Official Blizzard patch notes — '+version,
                    'summary':'Imported official hero notes; unvalidated changes require review',
                    'source_id':2,'verified_at':state['checked_at'],'game_mode':'mixed',
                    'source':db['sources'].get('2',{}),'changes':[]}
            db['patches'].append(record);next_id+=1
        if any(c.get('live_event_id')==e['id'] for c in record['changes']):continue
        hero=next((h for h in db['heroes'] if h['name']==e['hero']),None)
        record['changes'].append({'id':int(e['id'][:12],16),'live_event_id':e['id'],'patch_id':record['id'],
            'hero_id':hero['id'] if hero else None,'hero_name':e['hero'],'entity_type':'ability' if e.get('ability') else 'hero',
            'entity_name':e.get('ability') or e['hero'],'stat_key':e.get('stat_key') or e.get('metric'),
            'old_value':e.get('old_value'),'new_value':e.get('new_value'),
            'change_type':'verified' if e['status']=='auto_verified' else 'pending_review',
            'source_id':2,'verified_at':state['checked_at'],'game_mode':e['game_mode'],
            'notes':e['text']+(' [Unvalidated: not applied to combat math]' if e['status']!='auto_verified' else ''),
            'source':db['sources'].get('2',{})})
    db['meta']['patch_notes_checked_at']=state['checked_at']
    if dates:
        db['meta']['latest_patch_date']=dates[0];db['meta']['latest_patch_version']=dates[0]
        db['meta']['current_patch_status']='Official page checked. Pending review items do not modify combat calculations.'
    # Existing patch table is retained; supplement with recent reviewed/pending records in UI metadata.
    db['liveEngine']={'status':'checked','checked_at':state['checked_at'],'source_url':SOURCE,'latest_seen_date':state.get('latest_seen_date'),'entries':state['entries'][:300]}
    return db,new

def write_site(db):
    path=ROOT/'site/index.html'
    original=path.read_text()
    repl='window.OW_DB = '+json.dumps(db,ensure_ascii=False,separators=(',',':'))+';\n</script>'
    updated,count=re.subn(r'window\.OW_DB = \{.*?\};\s*</script>',lambda m:repl,original,count=1,flags=re.S)
    if count!=1:raise RuntimeError('Unable to safely locate embedded snapshot')
    path.write_text(updated)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--fixture',help='Use local official HTML fixture (tests only)');parser.add_argument('--dry-run',action='store_true');args=parser.parse_args()
    baseline=read_json(ROOT/'state/baseline.json',None)
    if not baseline:raise RuntimeError('Missing baseline snapshot')
    state=read_json(ROOT/'state/patch-state.json',{'entries':[]})
    try:html=Path(args.fixture).read_text() if args.fixture else fetch()
    except Exception as ex:
        print('Polling failed: '+str(ex),file=sys.stderr);sys.exit(2)
    try:db,new=ingest(html,baseline,state)
    except Exception as ex:
        print('Parsing/validation failed: '+str(ex),file=sys.stderr);sys.exit(3)
    print(f'Parsed {len(parse_official(html,baseline["heroes"]))} hero change notes; {len(new)} new; {sum(e["status"]=="auto_verified" for e in new)} approved')
    if not args.dry_run:
        (ROOT/'state/patch-state.json').write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n')
        write_site(db)
        (ROOT/'state/new-events.json').write_text(json.dumps(new,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()

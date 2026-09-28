import json, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parent
REG=json.loads((ROOT/'registry.json').read_text(encoding='utf-8'))
CHANNELS={c['lane']:c for c in REG['channels']}
def route(job):
    lane=job.get('lane')
    if lane not in CHANNELS: raise ValueError(f'unknown lane: {lane}')
    c=CHANNELS[lane]; recovery=bool(job.get('recovery_trigger'))
    if c.get('slot_type')=='HOLD': raise ValueError(f'hold lane cannot receive normal job: {lane}')
    if c.get('slot_type')=='CONTROL_BACKUP' and not recovery: raise ValueError(f'control lane requires recovery_trigger: {lane}')
    if not c.get('production_eligible') and c.get('slot_type')!='CONTROL_BACKUP': raise ValueError(f'lane is not production eligible: {lane}')
    if not job.get('benchmark_source') or not job.get('benchmark_evidence'): raise ValueError('market evidence required')
    out=dict(job); out['target_channel']=c['profile']; out['slot_type']=c['slot_type']; out['next_stage']='01'; return out
def route_batch(batch):
    ids=set(); titles=set(); out=[]
    for raw in batch:
        if raw['job_id'] in ids: raise ValueError('duplicate job_id')
        title=raw['title'].strip().lower()
        if title in titles: raise ValueError('duplicate title')
        ids.add(raw['job_id']); titles.add(title); out.append(route(raw))
    return out
if __name__=='__main__':
    data=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
    print(json.dumps({'batch_id':data['batch_id'],'jobs':route_batch(data['jobs'])},ensure_ascii=False))

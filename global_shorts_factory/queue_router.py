import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
REG = json.loads((ROOT/'channel_registry.json').read_text(encoding='utf-8'))

LANE_TO_PROFILE = {c['lane']: c['profile'] for c in REG['channels']}


def route(job):
    lane = job.get('lane')
    if lane not in LANE_TO_PROFILE:
        raise ValueError(f'unknown lane: {lane}')
    job = dict(job)
    job['target_channel'] = LANE_TO_PROFILE[lane]
    job.setdefault('current_stage', '00')
    job.setdefault('status', 'READY')
    job.setdefault('next_stage', '01')
    return job


def route_batch(batch):
    seen_ids=set(); seen_titles=set(); out=[]
    for raw in batch:
        jid=raw['job_id']; title=raw['title'].strip().lower()
        if jid in seen_ids: raise ValueError(f'duplicate job_id: {jid}')
        if title in seen_titles: raise ValueError(f'duplicate title in batch: {raw["title"]}')
        seen_ids.add(jid); seen_titles.add(title)
        out.append(route(raw))
    return out


if __name__ == '__main__':
    src = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT/'batch_2026-09-28.json'
    data=json.loads(src.read_text(encoding='utf-8'))
    routed=route_batch(data['jobs'])
    print(json.dumps({'batch_id':data['batch_id'],'jobs':routed}, ensure_ascii=False, indent=2))

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
REG = json.loads((ROOT / 'channel_registry.json').read_text(encoding='utf-8'))

CHANNELS = {c['lane']: c for c in REG['channels']}


def route(job):
    lane = job.get('lane')
    if lane not in CHANNELS:
        raise ValueError(f'unknown lane: {lane}')

    channel = CHANNELS[lane]
    recovery = bool(job.get('recovery_trigger'))

    if channel.get('slot_type') == 'HOLD':
        raise ValueError(f'hold lane cannot receive normal job: {lane}')

    if channel.get('slot_type') == 'CONTROL_BACKUP' and not recovery:
        raise ValueError(f'control lane requires recovery_trigger: {lane}')

    if not channel.get('production_eligible') and channel.get('slot_type') != 'CONTROL_BACKUP':
        raise ValueError(f'lane is not production eligible: {lane}')

    if not job.get('benchmark_source') or not job.get('benchmark_evidence'):
        raise ValueError(f'market evidence required before routing: {job.get("job_id")}')

    routed = dict(job)
    routed['target_channel'] = channel['profile']
    routed['slot_type'] = channel['slot_type']
    routed.setdefault('current_stage', '00')
    routed.setdefault('status', 'READY')
    routed.setdefault('next_stage', '01')
    return routed


def route_batch(batch):
    seen_ids = set()
    seen_titles = set()
    out = []
    for raw in batch:
        jid = raw['job_id']
        title = raw['title'].strip().lower()
        if jid in seen_ids:
            raise ValueError(f'duplicate job_id: {jid}')
        if title in seen_titles:
            raise ValueError(f'duplicate title in batch: {raw["title"]}')
        seen_ids.add(jid)
        seen_titles.add(title)
        out.append(route(raw))
    return out


if __name__ == '__main__':
    src = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'batch_2026-09-28.json'
    data = json.loads(src.read_text(encoding='utf-8'))
    routed = route_batch(data['jobs'])
    print(json.dumps({'batch_id': data['batch_id'], 'jobs': routed}, ensure_ascii=False, indent=2))

#!/usr/bin/env python3
"""Pre-import diagnostics for the unreviewed Email's Gym library.
Not a clinical / coaching quality validator and NOT a production approval tool.
Run: python tools/inspect_source_library.py
"""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
data=json.loads((root/'data/program-library-UNREVIEWED.json').read_text())
programs=data['programs']; exercises=data['exercises']; ids={e['id'] for e in exercises}
errors=[]; warnings=[]
if len(ids)!=len(exercises):errors.append('Duplicate exercise IDs')
if len({p['id'] for p in programs})!=len(programs):errors.append('Duplicate program IDs')
for p in programs:
    pid=p['id']; template_map={t['id']:t for t in p['templates']}
    if len(p['week_plan'])!=p['block_weeks'] or len(p['expanded_weeks'])!=p['block_weeks']:
        errors.append(f'{pid}: week count mismatch')
    for t in p['templates']:
        for ex in t['exercises']:
            if ex['exercise_id'] not in ids: errors.append(f'{pid}/{t["id"]}: unknown exercise {ex["exercise_id"]}')
            if not ex.get('alternatives'): warnings.append(f'{pid}/{t["id"]}/{ex["exercise_id"]}: no contextual alternatives approved')
            if ex['exercise_id']=='plank' and 'reps' in ex: warnings.append(f'{pid}/{t["id"]}: plank recorded with untyped reps range (intended timed hold)')
    for week in p['expanded_weeks']:
        if len(week['sessions'])!=p['days_per_week']:errors.append(f'{pid} week {week["week"]}: session count mismatch')
        for session in week['sessions']:
            if session['template_id'] not in template_map:errors.append(f'{pid}: unknown session template {session["template_id"]}')
    if pid in ('hybrid-4','conditioning-3'):
        warnings.append(f'{pid}: interval arithmetic and week-specific minutes require manual correction per audit')
print(f'Programs: {len(programs)}; exercises: {len(exercises)}')
print(f'Errors (structural only): {len(errors)}; Warnings (not exhaustive): {len(warnings)}')
for e in errors:print('ERROR:',e)
for w in warnings[:18]:print('WARN:',w)
if len(warnings)>18:print(f'... {len(warnings)-18} additional warnings')
print('STATUS: NOT APPROVED FOR PUBLICATION even if all structural checks pass.')
raise SystemExit(1 if errors else 0)

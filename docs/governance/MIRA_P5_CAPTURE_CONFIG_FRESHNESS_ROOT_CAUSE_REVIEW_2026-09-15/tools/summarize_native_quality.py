#!/usr/bin/env python3
import re, collections, sys
from pathlib import Path
re_q=re.compile(r'CameraKit quality session=(?P<sid>\d+) n=(?P<n>\d+) ready=(?P<ready>\d+) valid=(?P<valid>\d+) area=(?P<area>\w+) pose=(?P<pose>\w+) light=(?P<light>\w+)')
path=Path(sys.argv[1])
text=path.read_text(errors='replace').splitlines()
c=collections.Counter(); n=ready=valid=0; can=0
for line in text:
    m=re_q.search(line)
    if not m: continue
    n+=1; d=m.groupdict()
    if d['ready']=='1': ready+=1
    if d['valid']=='1': valid+=1
    if d['area']=='good' and d['pose']=='good' and d['light'] in ('good','normal'): can+=1
    c[(d['area'],d['pose'],d['light'],d['valid'],d['ready'])]+=1
print(f'file={path}')
print(f'quality_events={n} ready_true={ready} valid_true={valid} canCapture_like={can}')
print('combo (area,pose,light,valid,ready):')
for k,v in c.most_common(40):
    print(f'  {v}\t{k}')

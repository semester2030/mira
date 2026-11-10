"""Verify only the supplied source patch; never claim full E2C/E3 acceptance."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
from datetime import datetime, timezone
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'evidence' / 'current'
OUT.mkdir(parents=True, exist_ok=True)
def now(): return datetime.now(timezone.utc).isoformat()
def digest(b): return hashlib.sha256(b).hexdigest()
def source_files():
    result = {}
    for folder in ['mira-api', 'partners-portal', 'lib', 'test', 'verification']:
        for p in sorted((ROOT/folder).rglob('*')):
            if p.is_file():
                b=p.read_bytes()
                result[p.relative_to(ROOT).as_posix()]={'sha256':digest(b),'bytes':len(b)}
    return result
files=source_files()
identity={'runId':str(uuid4()),'startedAt':now(), 'scope':'source patch unit/syntax checks only',
          'commit':None,'commitReason':'No Git repository in the supplied partial package; no commit invented',
          'files':files,'contentSha256':digest(json.dumps(files,sort_keys=True,separators=(',',':')).encode())}
(OUT/'source-identity.json').write_text(json.dumps(identity,indent=2))
def run(label, argv, timeout=60):
    started=now()
    try:
        r=subprocess.run(argv,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=timeout)
        code,output=r.returncode,r.stdout
    except subprocess.TimeoutExpired as e:
        code=-1; output='TIMEOUT\n'+str(e.output or '')
    except OSError as e:
        code=-1; output=str(e)
    log=OUT/(label+'.log');log.write_text(output)
    status='PASS' if code==0 else 'FAIL'
    if label=='service-shell-browser' and code!=0 and any(x in output for x in
        ['socket() failed: Operation not permitted','Executable doesn\'t exist','Failed to create a ProcessSingleton']):
        status='BLOCKED'
    return {'name':label,'command':argv,'startedAt':started,'endedAt':now(),'exitCode':code,
            'status':status,'log':str(log.relative_to(ROOT))}

checks=[]
checks.append(run('unit-acceptance',['node','--test','verification/local-acceptance.test.mjs','verification/e3-refresh-evaluator.test.mjs','verification/run-identity.test.mjs']))
checks.append(run('syntax-service-shell',['node','--check','partners-portal/web/js/e2b-service-shell.js']))
checks.append(run('syntax-catalog-journey',['node','--check','partners-portal/web/js/catalog-journey.js']))
checks.append(run('service-shell-browser',['node','--test','verification/service-shell.browser.test.mjs']))
checks.append(run('dom-snapshot-module',['node','--input-type=module','-e',
    "import('./mira-api/src/marketplace/taxonomy/elegance-e2c-dom-snapshot.ts').then(m=>{if(typeof m.readFullServiceLayout!=='function'||typeof m.readAvailabilityFromForm!=='function')process.exit(1);console.log('Node TS module loads; DOM functions not executed');})"]))
missing=[p for p in ['mira-api/package.json','pubspec.yaml','mira-api/prisma/schema.prisma',
    'mira-api/src/marketplace/commerce.types.ts',
    'lib/features/marketplace/data/elegance_taxonomy_source.dart',
    'lib/features/marketplace/data/discover_catalog_query.dart'] if not (ROOT/p).is_file()]
environment={'missingExamples':missing, 'tools':{n:shutil.which(n) for n in ['node','npm','git','flutter','dart','psql']}}
(OUT/'environment.json').write_text(json.dumps(environment,indent=2))
stable=source_files()==files
result={'runId':identity['runId'],'startedAt':identity['startedAt'],'endedAt':now(),
        'commit':identity['commit'],'contentSha256':identity['contentSha256'], 'sourceUnchanged':stable,
        'verdict':'PARTIAL_IMPLEMENTATION_NOT_CLOSED', 'checks':checks,
        'integratedE2C':'NOT_RUN: incomplete project and browser environment blocked',
        'integratedE3':'NOT_RUN: incomplete project and Flutter/Dart unavailable',
        'production':'OUT_OF_SCOPE','physicalDevice':'OUT_OF_SCOPE'}
(OUT/'local-results.json').write_text(json.dumps(result,indent=2))
print(json.dumps({'runId':identity['runId'],'contentSha256':identity['contentSha256'],
                  'sourceUnchanged':stable,'checks':[{k:v for k,v in c.items() if k in ['name','status','exitCode']} for c in checks]},indent=2))
raise SystemExit(0 if stable and all(c['status']=='PASS' for c in checks) else 1)

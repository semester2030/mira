import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { captureAcceptanceRun, assertAcceptanceContentUnchanged } from '../mira-api/src/marketplace/taxonomy/acceptance-run-identity.ts';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mira-identity-unit-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [name, text] of Object.entries({
    'mira-api/package.json': '{}', 'pubspec.yaml': 'name: identity_fixture',
    'mira-api/src/a.ts': 'export const a=1;', 'lib/a.dart': 'const a=1;',
    'test/a_test.dart': '// fixture test', 'partners-portal/web/a.js': 'const a=1;',
  })) { fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true }); fs.writeFileSync(path.join(root,name),text); }
  for (const args of [['init','--quiet'],['add','.'],['-c','user.name=Unit Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','fixture']])
    execFileSync('git', args, { cwd: root });
  return root;
}
test('identity refuses an incomplete project, not a fabricated commit', (t) => {
  const root=fixture(t); fs.unlinkSync(path.join(root,'pubspec.yaml'));
  assert.throws(()=>captureAcceptanceRun(root),/Incomplete project/);
});
test('identity includes Dart, Dart tests, API and portal bytes with stable digest and unique run ids', (t) => {
  const root=fixture(t), a=captureAcceptanceRun(root), b=captureAcceptanceRun(root);
  for (const f of ['lib/a.dart','test/a_test.dart','mira-api/src/a.ts','partners-portal/web/a.js']) assert.ok(a.files[f]?.sha256);
  assert.equal(a.contentSha256,b.contentSha256); assert.notEqual(a.runId,b.runId);
  assert.match(a.commit,/^[a-f0-9]{40}$/); assert.ok(Number.isFinite(Date.parse(a.startedAt)));
  assert.doesNotThrow(()=>assertAcceptanceContentUnchanged(a,root));
});
test('editing Dart or its test invalidates a captured run even without changing commit', (t) => {
  const root=fixture(t), a=captureAcceptanceRun(root);
  fs.appendFileSync(path.join(root,'lib/a.dart'),'// change');
  assert.throws(()=>assertAcceptanceContentUnchanged(a,root),/Source changed/);
  const b=captureAcceptanceRun(root); fs.appendFileSync(path.join(root,'test/a_test.dart'),'// change');
  assert.throws(()=>assertAcceptanceContentUnchanged(b,root),/Source changed/);
});
test('reports are outside source hashing and source symlinks are rejected', (t) => {
  const root=fixture(t), a=captureAcceptanceRun(root);
  fs.writeFileSync(path.join(root,'REPORT.md'),'a report');
  assert.doesNotThrow(()=>assertAcceptanceContentUnchanged(a,root));
  fs.symlinkSync(path.join(root,'REPORT.md'),path.join(root,'lib/report-link'));
  assert.throws(()=>captureAcceptanceRun(root),/Symlink/);
});

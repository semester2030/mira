/**
 * ACC — portal shell: exclusive views, list≠editor, always-tab (no !narrow expand-all).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const shellSrc = fs.readFileSync(path.join(__dirname, 'portal-shell.js'), 'utf8');
const productSrc = fs.readFileSync(path.join(__dirname, 'e2b-product-shell.js'), 'utf8');
const serviceSrc = fs.readFileSync(path.join(__dirname, 'e2b-service-shell.js'), 'utf8');
const dashSrc = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const cssSrc = fs.readFileSync(path.join(root, 'css/e2b-product-editor.css'), 'utf8');

assert.ok(dashSrc.includes('js/portal-shell.js'), 'dashboard must load portal-shell');
assert.ok(shellSrc.includes('MiraPortalShell'), 'exports MiraPortalShell');
assert.ok(shellSrc.includes('history.pushState') || shellSrc.includes('history.replaceState'), 'history routes');
assert.ok(shellSrc.includes('popstate'), 'browser back/forward');
assert.ok(shellSrc.includes('data-portal-view'), 'view attribute');
assert.ok(shellSrc.includes('setDirtyGuard'), 'dirty leave guard');
assert.ok(shellSrc.includes('usesCatalogAsServices'), 'salon/clinic map services→catalog');
assert.ok(shellSrc.includes('setExclusive'), 'list/editor exclusivity helper');
assert.ok(dashSrc.includes('portal-draft-card'), 'human draft cards');
assert.ok(dashSrc.includes('DRAFT_STATUS_AR'), 'Arabic draft status map');
assert.ok(!/row\.textContent\s*=[\s\S]{0,80}d\.kind\s*\+\s*' · '/.test(dashSrc), 'no technical draft row text');
assert.ok(!/· rev /.test(dashSrc), 'public drafts UI must not show rev');

assert.ok(
  productSrc.includes('never expand all roles on desktop') || productSrc.includes('Always one field-group tab'),
  'product tabs always filtered',
);
assert.ok(!/showRole\s*=\s*\(?\s*!narrow/.test(productSrc), 'product must not use !narrow show-all');
assert.ok(
  serviceSrc.includes('never expand all on desktop') || serviceSrc.includes('Always one tab of fields'),
  'service tabs always filtered',
);
assert.ok(productSrc.includes("label: 'الأساسيات'"), 'product basics tab');
assert.ok(productSrc.includes("label: 'الخيارات والمخزون'"), 'product offer tab');
assert.ok(productSrc.includes("label: 'الوسائط'"), 'product media tab');
assert.ok(productSrc.includes("label: 'التفاصيل والإعدادات'"), 'product more tab');
assert.ok(serviceSrc.includes("label: 'المكان'"), 'service place tab');
assert.ok(serviceSrc.includes("label: 'الإتاحة والتقويم'"), 'service schedule tab');

assert.ok(cssSrc.includes('.portal-shell'), 'portal shell CSS');
assert.ok(cssSrc.includes('body.portal-mode-list #e2bEditorPanel'), 'hide editor in list mode');
assert.ok(cssSrc.includes('body.portal-mode-edit #e2bListPanel'), 'hide list in edit mode');
assert.ok(productSrc.includes('MiraPortalShell.openProductEditor'), 'product focus uses shell');
assert.ok(serviceSrc.includes('MiraPortalShell.openServiceEditor'), 'service focus uses shell');

console.log(JSON.stringify({ ok: true, suite: 'portal-shell.structure' }));

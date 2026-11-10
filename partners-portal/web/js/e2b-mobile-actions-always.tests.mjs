/**
 * ACC — editor-actions must not be step-hidden via afterCompose/tail roles.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productShell = fs.readFileSync(path.join(__dirname, 'e2b-product-shell.js'), 'utf8');
const serviceShell = fs.readFileSync(path.join(__dirname, 'e2b-service-shell.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../css/e2b-product-editor.css'), 'utf8');

assert.ok(
  /afterCompose\s*=\s*\[[^\]]*preview-publish[^\]]*\]/.test(productShell.replace(/\n/g, ' ')),
  'product afterCompose must not list editor-actions among step-hidden sections',
);
assert.ok(!/afterCompose\s*=\s*\[[^\]]*editor-actions/.test(productShell.replace(/\n/g, ' ')));
assert.ok(productShell.includes('isAlwaysVisibleActionsNode'));
assert.ok(productShell.includes('forceShowActionsNodes'));
assert.ok(productShell.includes('revealStepForElement'));
assert.ok(serviceShell.includes("role === 'editor-actions'"));
assert.ok(css.includes('e2b-mobile-actions-always'));
assert.ok(css.includes('[data-section-role="editor-actions"]'));

console.log(JSON.stringify({ ok: true, productActionsSeparated: true, serviceGuarded: true }));

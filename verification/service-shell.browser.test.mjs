import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateDesktopGeometry, evaluateFullServiceLayout, compareAvailabilitySnapshot }
  from '../mira-api/src/marketplace/taxonomy/elegance-e2c-acceptance-evaluators.ts';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
test('actual service shell moves nodes and preserves file, values, events, and idempotence', async () => {
  const require = createRequire(import.meta.url);
  const { chromium } = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright'));
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const fixture = `<!doctype html><html dir="rtl"><body class="e2b-service-mode" data-partner-type="salon">
      <section id="catalogSection"><form id="catalogForm">
        <p role="status">حُفظت المسودة</p>
        <div data-section-role="detail-media"><input type="file" id="detailFile"></div>
        <div data-section-role="details"><input name="concernTags" value="وسم محفوظ"></div>
        <div data-section-role="commerce"><button type="button" id="existingButton">زر</button></div>
        <div data-section-role="basics"><input name="nameAr" value="خدمة محفوظة"></div>
        <div data-section-role="place"></div><details data-section-role="template"></details>
        <details data-section-role="secondary"></details>
        <div data-section-role="main-media"></div><div data-section-role="availability"></div>
        <div data-section-role="preview-publish"></div>
        <div data-section-role="editor-actions" data-testid="e2b-editor-actions"><button id="catalogForm-save">حفظ</button></div>
      </form></section></body></html>`;
    await page.setContent(fixture);
    await page.locator('#detailFile').setInputFiles({ name: 'preserved.txt', mimeType: 'text/plain', buffer: Buffer.from('selected file') });
    await page.evaluate(() => {
      window.originalInput = document.getElementById('detailFile');
      window.originalButton = document.getElementById('existingButton');
      window.clickCount = 0;
      window.originalButton.addEventListener('click', () => window.clickCount++);
    });
    await page.addScriptTag({ path: path.join(root, 'partners-portal/web/js/e2b-service-shell.js') });
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const state = await page.evaluate(() => {
        const form = document.getElementById('catalogForm');
        window.MiraE2BServiceShell.composeServiceLayout(form);
        window.MiraE2BServiceShell.composeServiceLayout(form);
        const fold = form.querySelector('[data-testid="e2c-advanced-sections"]');
        window.originalButton.click();
        return {
          roles: [...form.children].map(n => n.getAttribute('data-testid') === 'e2c-editor-compose' ? 'compose' : n.getAttribute('data-section-role')).filter(Boolean),
          advancedRoles: [...fold.children].map(n => n.getAttribute('data-section-role')).filter(Boolean),
          foldOpen: fold.open, foldCount: form.querySelectorAll('[data-testid="e2c-advanced-sections"]').length,
          sameNode: document.getElementById('detailFile') === window.originalInput,
          fileName: window.originalInput.files[0]?.name,
          value: form.querySelector('[name="concernTags"]').value, clicks: window.clickCount,
        };
      });
      assert.equal(evaluateFullServiceLayout({ formRoles: state.roles, advancedRoles: state.advancedRoles, advancedOpen: state.foldOpen }).ok, true);
      assert.equal(state.foldCount, 1); assert.equal(state.sameNode, true);
      assert.equal(state.fileName, 'preserved.txt'); assert.equal(state.value, 'وسم محفوظ');
      assert.equal(state.clicks, width === 1280 ? 1 : 2);
    }
    // Recomposition must preserve a user's explicit expanded state.
    assert.equal(await page.evaluate(() => {
      const form = document.getElementById('catalogForm');
      const fold = form.querySelector('[data-testid="e2c-advanced-sections"]');
      fold.open = true; window.MiraE2BServiceShell.composeServiceLayout(form);
      return fold.open;
    }), true);
    // No service layout changes while the service mode is inactive.
    assert.equal(await page.evaluate(() => {
      const form = document.getElementById('catalogForm'); document.body.classList.remove('e2b-service-mode');
      const before = form.innerHTML; window.MiraE2BServiceShell.composeServiceLayout(form);
      return before === form.innerHTML;
    }), true);
  } finally { await browser.close(); }
});

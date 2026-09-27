import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { PrismaClient } from '@prisma/client';

const root = new URL('../', import.meta.url).pathname;
const repo = join(root, '..');
const evidence = join(repo, 'docs/mira-commerce-reference/evidence/ph3-rc3');
const chromeBin = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const apiPort = 3000;
const webPort = 8090;
const apiBase = `http://127.0.0.1:${apiPort}/api/v1`;
const adminKey = 'ph3-rc3-shot';
const brandToken = 'token-rc3-shot-brand';
const clinicToken = 'token-rc3-shot-clinic';
const otherToken = 'token-rc3-shot-other';

function assertLocal(url) {
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    throw new Error('REFUSE database host');
  }
  if (!url.includes('mira_ph2_rc6_test_shot')) {
    throw new Error('REFUSE database name');
  }
}

async function waitFor(url, attempts = 80) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
    } catch {
      // server still booting
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`server did not answer ${url}`);
}

function staticServer() {
  const roots = {
    '/partner/': join(repo, 'partners-portal/web'),
    '/admin/': join(repo, 'admin-portal/web'),
  };
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
  return createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${webPort}`);
    const mount = Object.keys(roots).find((prefix) => url.pathname.startsWith(prefix));
    if (!mount) {
      res.writeHead(404);
      res.end('missing');
      return;
    }
    const relative = normalize(decodeURIComponent(url.pathname.slice(mount.length))).replace(/^(\.\.(\/|\\|$))+/, '');
    const file = join(roots[mount], relative);
    if (!file.startsWith(roots[mount])) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    try {
      let body = await readFile(file);
      if (extname(file) === '.html') {
        body = Buffer.from(body.toString('utf8').replaceAll(
          'https://mira-api-n4p3.onrender.com/api/v1',
          apiBase,
        ));
      }
      res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('missing');
    }
  });
}

async function browser() {
  const profile = await mkdtemp(join(tmpdir(), 'mira-rc3-chrome-'));
  const chrome = spawn(chromeBin, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=1280,900',
    '--remote-debugging-port=9333',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    'about:blank',
  ], { stdio: 'ignore' });
  await waitFor('http://127.0.0.1:9333/json/version');
  const version = await (await fetch('http://127.0.0.1:9333/json/version')).json();
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve);
    socket.addEventListener('error', reject);
  });
  let seq = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    }
  });
  function call(method, params = {}) {
    const id = ++seq;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  const target = await call('Target.createTarget', { url: 'about:blank' });
  const attached = await call('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const session = attached.sessionId;
  function send(method, params = {}) {
    return call('Target.sendMessageToTarget', { sessionId: session, message: JSON.stringify({ id: ++seq, method, params }) });
  }
  // Flattened sessions answer on the same socket with sessionId. Rebind the parser.
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.sessionId === session && message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    }
  });
  function page(method, params = {}) {
    const id = ++seq;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, sessionId: session }));
    });
  }
  await page('Page.enable');
  await page('Runtime.enable');
  await page('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.prompt = () => 'أبقوا الاسم المنشور'; window.confirm = () => false; window.alert = () => { window.__xssAlert = true; };
      window.clickNamed = (selector, textIncludes, label) => {
        const card = [...document.querySelectorAll(selector)].find((node) => node.innerText.includes(textIncludes));
        const button = [...card.querySelectorAll('button')].find((node) => node.textContent === label);
        button.click();
        return true;
      };`,
  });
  async function open(url, storage) {
    await page('Page.addScriptToEvaluateOnNewDocument', {
      source: Object.entries(storage).map(([key, value]) => `localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)});`).join(''),
    });
    await page('Page.navigate', { url });
    await new Promise((resolve) => setTimeout(resolve, 600));
    for (let i = 0; i < 40; i += 1) {
      const state = await page('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
      if (state.result?.value === 'complete') break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  async function evalJson(expression) {
    const result = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  }
  async function shot(name) {
    const metrics = await page('Page.getLayoutMetrics');
    const width = Math.ceil(metrics.cssContentSize?.width || metrics.contentSize.width);
    const height = Math.ceil(metrics.cssContentSize?.height || metrics.contentSize.height);
    const image = await page('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height, scale: 1 },
    });
    await writeFile(join(evidence, name), Buffer.from(image.data, 'base64'));
    return { name, width, height };
  }
  async function setViewport(width, height) {
    await page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  }
  return {
    chrome, profile, open, evalJson, shot, setViewport,
    async close() {
      socket.close();
      chrome.kill();
      await new Promise((resolve) => setTimeout(resolve, 400));
      await rm(profile, { recursive: true, force: true }).catch(() => undefined);
    },
  };
}

async function main() {
  assertLocal(process.env.DATABASE_URL || '');
  await mkdir(evidence, { recursive: true });
  const mediaDir = await mkdtemp(join(tmpdir(), 'mira-rc3-media-'));
  const prisma = new PrismaClient();
  const brand = await prisma.partner.create({ data: { type: 'brand', status: 'active', nameAr: 'بيانات اختبار RC3', nameEn: 'RC3 fixture', city: 'الرياض' } });
  const clinic = await prisma.partner.create({ data: { type: 'clinic', status: 'active', nameAr: 'عيادة اختبار RC3', nameEn: 'RC3 clinic fixture', city: 'الرياض' } });
  const other = await prisma.partner.create({ data: { type: 'brand', status: 'active', nameAr: 'شريك آخر للاختبار', nameEn: 'Other fixture', city: 'جدة' } });
  await prisma.partnerUser.create({ data: { partnerId: brand.id, email: 'rc3-shot-brand@test.local', accessToken: brandToken } });
  await prisma.partnerUser.create({ data: { partnerId: clinic.id, email: 'rc3-shot-clinic@test.local', accessToken: clinicToken } });
  await prisma.partnerUser.create({ data: { partnerId: other.id, email: 'rc3-shot-other@test.local', accessToken: otherToken } });
  const api = spawn(process.execPath, ['dist/main.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(apiPort), ADMIN_API_KEY: adminKey, MIRA_MEDIA_DIR: mediaDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const apiLog = [];
  api.stdout.on('data', (chunk) => apiLog.push(String(chunk)));
  api.stderr.on('data', (chunk) => apiLog.push(String(chunk)));
  const web = staticServer();
  await new Promise((resolve) => web.listen(webPort, '127.0.0.1', resolve));
  const notes = [];
  let ui;
  let failure;
  try {
    await waitFor(`${apiBase}/health`);
    const png = (await readFile(join(root, 'src/marketplace/fixtures/ph3-rc3-sample.png'))).toString('base64');
    const mp4 = (await readFile(join(root, 'src/marketplace/fixtures/ph3-rc3-sample.mp4'))).toString('base64');
    const brandHeaders = { authorization: `Bearer ${brandToken}`, 'content-type': 'application/json' };
    const clinicHeaders = { authorization: `Bearer ${clinicToken}`, 'content-type': 'application/json' };
    const product = await (await fetch(`${apiBase}/partners-portal/products`, {
      method: 'POST', headers: brandHeaders,
      body: JSON.stringify({ nameAr: 'فستان اختبار RC3', nameEn: 'RC3 dress', descriptionAr: 'وصف منشور للاختبار', priceHalalas: 8900, externalUrl: 'https://example.com/rc3-fixture', concernTags: ['لون'] }),
    })).json();
    await fetch(`${apiBase}/partners-portal/products/${product.id}/media`, { method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'image/png', dataBase64: png }) });
    await fetch(`${apiBase}/partners-portal/products/${product.id}/media`, { method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'video/mp4', dataBase64: mp4 }) });
    await fetch(`${apiBase}/partners-portal/products/${product.id}/submit-review`, { method: 'POST', headers: brandHeaders });
    const preview = await (await fetch(`${apiBase}/admin/catalog-reviews/product/${product.id}`, { headers: { 'x-admin-key': adminKey } })).json();
    await fetch(`${apiBase}/admin/catalog-reviews/product/${product.id}/decision`, {
      method: 'POST', headers: { 'x-admin-key': adminKey, 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'approve', revision: preview.submittedRevision }),
    });
    await fetch(`${apiBase}/partners-portal/products/${product.id}`, {
      method: 'PATCH', headers: brandHeaders,
      body: JSON.stringify({ nameAr: 'مسودة الفستان', nameEn: 'RC3 dress', descriptionAr: 'وصف المسودة', priceHalalas: 8900, externalUrl: 'https://example.com/rc3-fixture', concernTags: ['لون'] }),
    });
    await fetch(`${apiBase}/partners-portal/products/${product.id}/submit-review`, { method: 'POST', headers: brandHeaders });
    const xss = await (await fetch(`${apiBase}/partners-portal/products`, {
      method: 'POST', headers: brandHeaders,
      body: JSON.stringify({ nameAr: '<img src=x onerror=alert(1)> "اقتباس"', nameEn: 'xss', descriptionAr: '<b>وصف</b>', priceHalalas: 1000, externalUrl: 'https://example.com/xss', concernTags: ['لون'] }),
    })).json();
    await fetch(`${apiBase}/partners-portal/products/${xss.id}/media`, { method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'image/png', dataBase64: png }) });
    const service = await (await fetch(`${apiBase}/partners-portal/services`, {
      method: 'POST', headers: clinicHeaders,
      body: JSON.stringify({ nameAr: 'جلسة اختبار RC3', nameEn: 'RC3 session', descriptionAr: 'وصف الخدمة', durationMin: 30, priceHalalas: 4500, concernTags: ['عناية'] }),
    })).json();
    await fetch(`${apiBase}/partners-portal/services/${service.id}/media`, { method: 'POST', headers: clinicHeaders, body: JSON.stringify({ mimeType: 'image/png', dataBase64: png }) });
    await fetch(`${apiBase}/partners-portal/services/${service.id}/submit-review`, { method: 'POST', headers: clinicHeaders });
    const servicePreview = await (await fetch(`${apiBase}/admin/catalog-reviews/service/${service.id}`, { headers: { 'x-admin-key': adminKey } })).json();
    await fetch(`${apiBase}/admin/catalog-reviews/service/${service.id}/decision`, {
      method: 'POST', headers: { 'x-admin-key': adminKey, 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'approve', revision: servicePreview.submittedRevision }),
    });
    await fetch(`${apiBase}/partners-portal/services/${service.id}`, {
      method: 'PATCH', headers: clinicHeaders,
      body: JSON.stringify({ nameAr: 'مسودة الجلسة', nameEn: 'RC3 session', descriptionAr: 'وصف جديد', durationMin: 30, priceHalalas: 4500, concernTags: ['عناية'] }),
    });
    await fetch(`${apiBase}/partners-portal/services/${service.id}/submit-review`, { method: 'POST', headers: clinicHeaders });

    ui = await browser();
    await ui.setViewport(1280, 900);
    await ui.open(`http://127.0.0.1:${webPort}/partner/dashboard.html`, { mira_partner_token: brandToken });
    await ui.evalJson(`(async () => { for (let i = 0; i < 40 && !document.body.innerText.includes('تعديل'); i++) await new Promise(r => setTimeout(r, 100)); return document.body.innerText.includes('<img src=x onerror=alert(1)>'); })()`);
    const xssSafe = await ui.evalJson(`document.querySelectorAll('img[src="x"]').length === 0 && window.__xssAlert !== true && document.body.innerText.includes('<img src=x onerror=alert(1)>')`);
    if (!xssSafe) throw new Error('xss text was not rendered safely');
    notes.push('partner xss text rendered without an image or alert');
    const desktop = await ui.shot('partner-desktop.png');
    notes.push(`partner desktop ${desktop.width}x${desktop.height}`);
    await ui.evalJson(`clickNamed('.list-item', 'فستان اختبار RC3', 'تعديل')`);
    await ui.evalJson(`(async () => { for (let i = 0; i < 20 && !document.body.innerText.includes('حفظ المسودة'); i++) await new Promise(r => setTimeout(r, 50)); return true; })()`);
    const form = await ui.shot('partner-edit.png');
    notes.push(`partner edit ${form.width}x${form.height}`);
    await ui.evalJson(`document.querySelector('#catalogForm input[name=nameAr]').value = 'مسودة بعد الحفظ'`);
    await ui.evalJson(`document.querySelector('#catalogForm').requestSubmit()`);
    await ui.evalJson(`(async () => { for (let i = 0; i < 40 && !document.body.innerText.includes('مسودة بعد الحفظ'); i++) await new Promise(r => setTimeout(r, 100)); return document.body.innerText.includes('حُفظت المسودة على العنصر نفسه') || document.body.innerText.includes('مسودة بعد الحفظ'); })()`);
    await ui.open(`http://127.0.0.1:${webPort}/partner/dashboard.html`, { mira_partner_token: brandToken });
    const returned = await ui.evalJson(`(async () => { for (let i = 0; i < 40 && !document.body.innerText.includes('مسودة بعد الحفظ'); i++) await new Promise(r => setTimeout(r, 100)); return document.body.innerText.includes('مسودة بعد الحفظ') && document.body.innerText.includes('فستان اختبار RC3'); })()`);
    if (!returned) throw new Error('draft did not reload from the server');
    notes.push('draft reloaded after leaving the page');
    await ui.evalJson(`clickNamed('.list-item', 'فستان اختبار RC3', 'إرسال للمراجعة')`);
    await ui.evalJson(`(async () => { for (let i = 0; i < 40 && !document.body.innerText.includes('أُرسل للمراجعة'); i++) await new Promise(r => setTimeout(r, 100)); return true; })()`);
    await ui.setViewport(480, 900);
    const narrow = await ui.shot('partner-narrow.png');
    notes.push(`partner narrow ${narrow.width}x${narrow.height}`);

    await ui.setViewport(1280, 900);
    await ui.open(`http://127.0.0.1:${webPort}/admin/index.html`, { mira_admin_key: adminKey });
    await ui.evalJson(`(async () => { for (let i = 0; i < 40 && document.querySelector('[data-view=reviews]') == null; i++) await new Promise(r => setTimeout(r, 100)); document.querySelector('[data-view=reviews]').click(); for (let i = 0; i < 50 && !document.body.innerText.includes('رقم النسخة المعروضة'); i++) await new Promise(r => setTimeout(r, 150)); const video = document.querySelector('video'); if (video) { await new Promise(resolve => { const done = () => resolve(true); video.addEventListener('loadeddata', () => { video.currentTime = 0.2; }, { once: true }); video.addEventListener('seeked', done, { once: true }); setTimeout(done, 1500); }); } return document.body.innerText.includes('رقم النسخة المعروضة'); })()`);
    const adminShot = await ui.shot('admin-preview.png');
    notes.push(`admin preview ${adminShot.width}x${adminShot.height}`);
    const seen = await ui.evalJson(`document.body.innerText.match(/رقم النسخة المعروضة: (\\d+)/)?.[1]`);
    await fetch(`${apiBase}/partners-portal/products/${product.id}`, {
      method: 'PATCH', headers: brandHeaders,
      body: JSON.stringify({ nameAr: 'اسم لم يُعاين', nameEn: 'RC3 dress', descriptionAr: 'وصف المسودة', priceHalalas: 8900, externalUrl: 'https://example.com/rc3-fixture', concernTags: ['لون'] }),
    });
    await ui.evalJson(`clickNamed('article', 'فستان اختبار RC3', 'اعتماد')`);
    const conflict = await ui.evalJson(`(async () => { for (let i = 0; i < 40 && !document.body.innerText.includes('تغير المحتوى بعد المعاينة'); i++) await new Promise(r => setTimeout(r, 100)); return document.body.innerText.includes('تغير المحتوى بعد المعاينة'); })()`);
    if (!conflict) throw new Error('409 message was not shown');
    const publicAfterConflict = await (await fetch(`${apiBase}/marketplace/catalog/product/${product.id}`)).json();
    if (publicAfterConflict.nameAr !== 'فستان اختبار RC3') throw new Error('unreviewed name was published');
    notes.push(`conflict kept published name; seen revision ${seen}`);
    const conflictShot = await ui.shot('admin-conflict.png');
    notes.push(`admin conflict ${conflictShot.width}x${conflictShot.height}`);
    await fetch(`${apiBase}/partners-portal/products/${product.id}/submit-review`, { method: 'POST', headers: brandHeaders });
    await ui.evalJson(`clickNamed('article', 'فستان اختبار RC3', 'معاينة')`);
    const readyAgain = await ui.evalJson(`(async () => {
      for (let i = 0; i < 40; i++) {
        const card = [...document.querySelectorAll('article')].find((node) => node.innerText.includes('فستان اختبار RC3'));
        if (card && card.innerText.includes('المعاينة جاهزة') && card.innerText.includes('اسم لم يُعاين') && !card.innerText.includes('تم الاعتماد')) return card.innerText;
        await new Promise((r) => setTimeout(r, 150));
      }
      return '';
    })()`);
    if (!String(readyAgain).includes('المعاينة جاهزة')) throw new Error('re-preview did not finish on the product card');
    const stillOld = await (await fetch(`${apiBase}/marketplace/catalog/product/${product.id}`)).json();
    if (stillOld.nameAr !== 'فستان اختبار RC3') throw new Error('re-preview published the draft');
    await ui.evalJson(`clickNamed('article', 'فستان اختبار RC3', 'اعتماد')`);
    let approvedName = '';
    for (let i = 0; i < 40; i += 1) {
      approvedName = ((await (await fetch(`${apiBase}/marketplace/catalog/product/${product.id}`)).json()) ).nameAr;
      if (approvedName === 'اسم لم يُعاين') break;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    if (approvedName !== 'اسم لم يُعاين') {
      const cardText = await ui.evalJson(`([...document.querySelectorAll('article')].find((node) => node.innerText.includes('فستان اختبار RC3')) || document.body).innerText`);
      throw new Error(`separate approve click did not complete: ${approvedName} :: ${cardText}`);
    }
    const published = await (await fetch(`${apiBase}/marketplace/catalog/product/${product.id}`)).json();
    if (published.id !== product.id || published.nameAr !== 'اسم لم يُعاين') throw new Error(`approved name ${published.nameAr}`);
    notes.push('separate approve published the re-previewed revision on the same id');

    await ui.setViewport(480, 900);
    await ui.open(`http://127.0.0.1:${webPort}/admin/index.html`, { mira_admin_key: adminKey });
    await ui.evalJson(`(async () => { for (let i = 0; i < 40 && document.querySelector('[data-view=reviews]') == null; i++) await new Promise(r => setTimeout(r, 100)); document.querySelector('#sidebar')?.classList.remove('open'); document.querySelector('[data-view=reviews]').click(); document.querySelector('#sidebar')?.classList.remove('open'); for (let i = 0; i < 50 && !document.body.innerText.includes('جلسة اختبار RC3'); i++) await new Promise(r => setTimeout(r, 150)); return document.body.innerText.includes('جلسة اختبار RC3'); })()`);
    const adminNarrow = await ui.shot('admin-narrow.png');
    notes.push(`admin narrow ${adminNarrow.width}x${adminNarrow.height}`);
    await ui.evalJson(`clickNamed('article', 'جلسة اختبار RC3', 'رفض')`);
    await ui.setViewport(1280, 900);
    await ui.open(`http://127.0.0.1:${webPort}/partner/dashboard.html`, { mira_partner_token: clinicToken });
    const clinicText = await ui.evalJson(`(async () => { for (let i = 0; i < 40 && !document.body.innerText.includes('أبقوا الاسم المنشور'); i++) await new Promise(r => setTimeout(r, 100)); return document.body.innerText; })()`);
    if (!String(clinicText).includes('جلسة اختبار RC3') || !String(clinicText).includes('أبقوا الاسم المنشور')) throw new Error('reject note missing');
    const clinicShot = await ui.shot('partner-service-reject.png');
    notes.push(`service reject ${clinicShot.width}x${clinicShot.height}`);
    await ui.open(`http://127.0.0.1:${webPort}/partner/dashboard.html`, { mira_partner_token: otherToken });
    const isolated = await ui.evalJson(`(async () => { for (let i = 0; i < 30 && document.body.innerText.includes('جاري التحميل'); i++) await new Promise(r => setTimeout(r, 100)); return document.body.innerText; })()`);
    if (String(isolated).includes('فستان اختبار RC3') || String(isolated).includes('جلسة اختبار RC3')) throw new Error('other partner saw foreign items');
    notes.push('other partner catalog did not list the fixture items');
    await writeFile(join(evidence, 'ui-assertions.txt'), `${notes.join('\n')}\n`);
    console.log(notes.join('\n'));
    console.log('ph3 rc3 browser evidence passed');
  } catch (error) {
    failure = error;
    console.error(error);
    await writeFile(join(evidence, 'ui-error.txt'), `${error.stack || error}\n${apiLog.join('').slice(-4000)}`).catch(() => undefined);
  } finally {
    if (ui) await ui.close().catch(() => undefined);
    web.close();
    api.kill();
    await prisma.$disconnect();
    await rm(mediaDir, { recursive: true, force: true }).catch(() => undefined);
    if (api.exitCode == null) await new Promise((resolve) => api.once('exit', resolve));
  }
  if (failure) throw failure;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

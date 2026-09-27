import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { PrismaClient } from '@prisma/client';

const root = new URL('../', import.meta.url).pathname;
const repo = join(root, '..');
const evidence = join(repo, 'docs/mira-commerce-reference/evidence/ph3-rc4');
const chromeBin = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const apiPort = 3000;
const webPort = 8090;
const apiBase = `http://127.0.0.1:${apiPort}/api/v1`;
const adminKey = 'ph3-rc4-shot';
const brandToken = 'token-rc4-shot-brand';
const clinicToken = 'token-rc4-shot-clinic';

function assertLocal(url) {
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) throw new Error('REFUSE database host');
  if (!url.includes('mira_ph2_rc6_test_rc4ui')) throw new Error('REFUSE database name');
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

function pngSize(buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
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
        body = Buffer.from(body.toString('utf8').replaceAll('https://mira-api-n4p3.onrender.com/api/v1', apiBase));
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
  const profile = await mkdtemp(join(tmpdir(), 'mira-rc4-chrome-'));
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
  function call(method, params = {}, sessionId) {
    const id = ++seq;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
  const target = await call('Target.createTarget', { url: 'about:blank' });
  const attached = await call('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const session = attached.sessionId;
  function page(method, params = {}) {
    return call(method, params, session);
  }
  await page('Page.enable');
  await page('Runtime.enable');
  await page('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.prompt = () => 'أبقوا الوصف المنشور'; window.confirm = () => false; window.alert = () => { window.__xssAlert = true; };
      window.clickNamed = (selector, textIncludes, label) => {
        const card = [...document.querySelectorAll(selector)].find((node) => node.innerText.includes(textIncludes));
        const button = [...card.querySelectorAll('button')].find((node) => node.textContent === label);
        button.click();
        return true;
      };`,
  });
  async function settle() {
    for (let i = 0; i < 40; i += 1) {
      const state = await page('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
      if (state.result?.value === 'complete') return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  async function open(url, storage) {
    await page('Page.addScriptToEvaluateOnNewDocument', {
      source: Object.entries(storage).map(([key, value]) => `localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)});`).join(''),
    });
    await page('Page.navigate', { url });
    await settle();
  }
  async function reload() {
    await page('Page.reload', { ignoreCache: true });
    await settle();
  }
  async function evalJson(expression) {
    const result = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  }
  async function shot(name, width, height) {
    const image = await page('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    });
    const buffer = Buffer.from(image.data, 'base64');
    const size = pngSize(buffer);
    if (size.width !== width) throw new Error(`${name} width ${size.width} expected ${width}`);
    await writeFile(join(evidence, name), buffer);
    return { name, ...size, viewportHeight: height };
  }
  async function setViewport(width, height) {
    await page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false, scale: 1 });
    await reload();
  }
  return {
    chrome, profile, open, evalJson, shot, setViewport, reload,
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
  const mediaDir = await mkdtemp(join(tmpdir(), 'mira-rc4-media-'));
  const prisma = new PrismaClient();
  const brand = await prisma.partner.create({ data: { type: 'brand', status: 'active', nameAr: 'بيانات اختبار RC4', nameEn: 'RC4 fixture', city: 'الرياض' } });
  const clinic = await prisma.partner.create({ data: { type: 'clinic', status: 'active', nameAr: 'عيادة اختبار RC4', nameEn: 'RC4 clinic fixture', city: 'الرياض' } });
  await prisma.partnerUser.create({ data: { partnerId: brand.id, email: 'rc4-shot-brand@test.local', accessToken: brandToken } });
  await prisma.partnerUser.create({ data: { partnerId: clinic.id, email: 'rc4-shot-clinic@test.local', accessToken: clinicToken } });
  const api = spawn(process.execPath, ['dist/main.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(apiPort), ADMIN_API_KEY: adminKey, MIRA_MEDIA_DIR: mediaDir, NODE_ENV: 'development' },
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
    const adminHeaders = { 'x-admin-key': adminKey, 'content-type': 'application/json' };

    async function publishProduct(nameAr, nameEn, descriptionAr) {
      const created = await (await fetch(`${apiBase}/partners-portal/products`, {
        method: 'POST', headers: brandHeaders,
        body: JSON.stringify({ nameAr, nameEn, descriptionAr, priceHalalas: 6400, externalUrl: 'https://example.com/rc4-ui', concernTags: ['لون'] }),
      })).json();
      await fetch(`${apiBase}/partners-portal/products/${created.id}/media`, { method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'image/png', dataBase64: png }) });
      await fetch(`${apiBase}/partners-portal/products/${created.id}/media`, { method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'video/mp4', dataBase64: mp4 }) });
      await fetch(`${apiBase}/partners-portal/products/${created.id}/submit-review`, { method: 'POST', headers: brandHeaders });
      const preview = await (await fetch(`${apiBase}/admin/catalog-reviews/product/${created.id}`, { headers: adminHeaders })).json();
      const decision = await fetch(`${apiBase}/admin/catalog-reviews/product/${created.id}/decision`, {
        method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: preview.submittedRevision }),
      });
      if (decision.status !== 201) throw new Error(`publish failed ${decision.status}`);
      return created;
    }

    const shown = await publishProduct('منتج العرض', 'Shown product', 'وصف منشور للعرض');
    await fetch(`${apiBase}/partners-portal/products/${shown.id}`, {
      method: 'PATCH', headers: brandHeaders,
      body: JSON.stringify({ nameAr: 'مسودة العرض', nameEn: 'RC4 English', descriptionAr: '' }),
    });
    await fetch(`${apiBase}/partners-portal/products/${shown.id}/submit-review`, { method: 'POST', headers: brandHeaders });
    const conflicted = await publishProduct('منتج التعارض', 'Conflict product', 'وصف التعارض');
    await fetch(`${apiBase}/partners-portal/products/${conflicted.id}`, {
      method: 'PATCH', headers: brandHeaders,
      body: JSON.stringify({ nameAr: 'مسودة التعارض', nameEn: 'Conflict draft', descriptionAr: 'وصف مسودة التعارض' }),
    });
    await fetch(`${apiBase}/partners-portal/products/${conflicted.id}/submit-review`, { method: 'POST', headers: brandHeaders });
    const service = await (await fetch(`${apiBase}/partners-portal/services`, {
      method: 'POST', headers: clinicHeaders,
      body: JSON.stringify({ nameAr: 'خدمة الرفض', nameEn: 'Reject service', descriptionAr: '<b>وصف الخدمة</b>', durationMin: 30, priceHalalas: 2500, concernTags: ['عناية'] }),
    })).json();
    await fetch(`${apiBase}/partners-portal/services/${service.id}/media`, { method: 'POST', headers: clinicHeaders, body: JSON.stringify({ mimeType: 'image/png', dataBase64: png }) });
    await fetch(`${apiBase}/partners-portal/services/${service.id}/submit-review`, { method: 'POST', headers: clinicHeaders });
    const tagged = await (await fetch(`${apiBase}/partners-portal/products`, {
      method: 'POST', headers: brandHeaders,
      body: JSON.stringify({ nameAr: '<img src=x onerror=alert(1)> "اقتباس"', nameEn: 'Tagged "name"', descriptionAr: '<b>وصف</b>', priceHalalas: 1200, externalUrl: 'https://example.com/rc4-text', concernTags: ['لون'] }),
    })).json();
    await fetch(`${apiBase}/partners-portal/products/${tagged.id}/media`, { method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'image/png', dataBase64: png }) });

    ui = await browser();
    const layoutExpression = `(() => {
      const view = document.documentElement.clientWidth;
      const sidebar = document.querySelector('#sidebar');
      const closed = sidebar && !sidebar.classList.contains('open') && getComputedStyle(sidebar).position === 'fixed';
      const nodes = [...document.querySelectorAll('.main, .main button, .main img, .main video, .topbar, article')];
      const offenders = nodes.flatMap((node) => {
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return [];
        if (rect.left < -1 || rect.right > view + 1) return [{ text: (node.textContent || '').slice(0, 48), left: Math.round(rect.left), right: Math.round(rect.right) }];
        return [];
      });
      const buttons = [...document.querySelectorAll('article button')].map((node) => {
        const rect = node.getBoundingClientRect();
        return { text: node.textContent, left: Math.round(rect.left), right: Math.round(rect.right), inside: rect.left >= -1 && rect.right <= view + 1 && rect.width > 0 };
      });
      return {
        view,
        scrollWidth: document.documentElement.scrollWidth,
        menu: document.querySelector('#menuToggle')?.getAttribute('aria-expanded'),
        sidebarOpen: sidebar?.classList.contains('open') === true,
        sidebarPosition: sidebar ? getComputedStyle(sidebar).position : '',
        closed,
        offenders,
        buttons,
      };
    })()`;

    await ui.setViewport(1280, 900);
    await ui.open(`http://127.0.0.1:${webPort}/partner/dashboard.html`, { mira_partner_token: brandToken });
    const xssSafe = await ui.evalJson(`(async () => { for (let i = 0; i < 40 && !document.body.innerText.includes('منتج العرض'); i++) await new Promise(r => setTimeout(r, 100)); return document.querySelectorAll('img[src="x"]').length === 0 && window.__xssAlert !== true && document.body.innerText.includes('<img src=x onerror=alert(1)>'); })()`);
    if (!xssSafe) throw new Error('tagged text was not rendered as text');
    notes.push('partner tagged text rendered without an image or alert');
    await ui.evalJson(`clickNamed('.list-item', 'منتج العرض', 'تعديل')`);
    const form = await ui.evalJson(`(() => {
      const description = document.querySelector('#catalogForm textarea[name=descriptionAr]');
      const english = document.querySelector('#catalogForm input[name=nameEn]');
      return { description: description ? description.value : null, english: english ? english.value : null, clear: document.body.innerText.includes('المسودة تطلب مسح الوصف') };
    })()`);
    if (!form || form.description !== '' || form.english !== 'RC4 English' || form.clear !== true) throw new Error(`form reload ${JSON.stringify(form)}`);
    notes.push('edit form reloaded an empty description and the English draft');
    await ui.evalJson(`document.querySelector('#catalogForm').scrollIntoView({ block: 'start' })`);
    const partnerShot = await ui.shot('partner-form-1280.png', 1280, 900);
    notes.push(`partner form ${partnerShot.width}x${partnerShot.height}`);

    async function openReviews() {
      const ready = await ui.evalJson(`(async () => {
        for (let i = 0; i < 40 && document.querySelector('[data-view=reviews]') == null; i++) await new Promise(r => setTimeout(r, 100));
        document.querySelector('[data-view=reviews]').click();
        for (let i = 0; i < 50 && !document.body.innerText.includes('رقم النسخة المعروضة'); i++) await new Promise(r => setTimeout(r, 150));
        return document.body.innerText.includes('المسودة تطلب مسح الوصف') && document.body.innerText.includes('RC4 English');
      })()`);
      if (!ready) throw new Error('admin preview did not show the clear request and English draft');
    }

    await ui.open(`http://127.0.0.1:${webPort}/admin/index.html`, { mira_admin_key: adminKey });
    await openReviews();
    const desktop = await ui.evalJson(layoutExpression);
    if (desktop.sidebarPosition !== 'sticky' || desktop.offenders.length || desktop.scrollWidth > desktop.view + 1) {
      throw new Error(`desktop layout ${JSON.stringify(desktop)}`);
    }
    const desktopShot = await ui.shot('admin-1280-preview.png', 1280, 900);
    notes.push(`admin 1280 preview ${desktopShot.width}x${desktopShot.height}; scroll ${desktop.scrollWidth}`);

    await ui.setViewport(480, 900);
    await openReviews();
    await ui.evalJson(`(async () => { document.querySelector('#menuToggle').click(); await new Promise((resolve) => setTimeout(resolve, 350)); return true; })()`);
    const opened = await ui.evalJson(layoutExpression);
    if (opened.menu !== 'true' || opened.sidebarOpen !== true) throw new Error(`menu did not open ${JSON.stringify(opened)}`);
    const navInside = await ui.evalJson(`(() => { const node = document.querySelector('#sidebar .nav-item'); const rect = node.getBoundingClientRect(); const view = document.documentElement.clientWidth; return { left: rect.left, right: rect.right, top: rect.top, width: rect.width, view, transform: getComputedStyle(document.querySelector('#sidebar')).transform, dir: document.documentElement.dir }; })()`);
    if (!(navInside.left >= -1 && navInside.right <= navInside.view + 1 && navInside.width > 0)) throw new Error(`open menu item is outside the viewport ${JSON.stringify(navInside)}`);
    const openShot = await ui.shot('admin-480-menu-open.png', 480, 900);
    notes.push(`admin 480 menu open ${openShot.width}x${openShot.height}`);
    await ui.evalJson(`(async () => { document.querySelector('#menuToggle').click(); await new Promise((resolve) => setTimeout(resolve, 350)); return true; })()`);
    const closed = await ui.evalJson(layoutExpression);
    if (closed.menu !== 'false' || closed.sidebarOpen || closed.offenders.length || closed.buttons.some((button) => !button.inside) || closed.scrollWidth > closed.view + 1) {
      throw new Error(`narrow layout ${JSON.stringify(closed)}`);
    }
    const narrowShot = await ui.shot('admin-480-preview.png', 480, 900);
    notes.push(`admin 480 preview ${narrowShot.width}x${narrowShot.height}; buttons ${closed.buttons.length}; scroll ${closed.scrollWidth}`);
    await fetch(`${apiBase}/partners-portal/products/${conflicted.id}`, {
      method: 'PATCH', headers: brandHeaders,
      body: JSON.stringify({ nameAr: 'اسم لم يُعاين', nameEn: 'Conflict draft', descriptionAr: 'وصف مسودة التعارض' }),
    });
    await ui.evalJson(`clickNamed('article', 'منتج التعارض', 'اعتماد')`);
    const conflict = await ui.evalJson(`(async () => { for (let i = 0; i < 40 && !document.body.innerText.includes('تغير المحتوى بعد المعاينة'); i++) await new Promise(r => setTimeout(r, 100)); return document.body.innerText.includes('تغير المحتوى بعد المعاينة'); })()`);
    if (!conflict) throw new Error('409 message was not shown');
    const kept = await (await fetch(`${apiBase}/marketplace/catalog/product/${conflicted.id}`)).json();
    if (kept.nameAr !== 'منتج التعارض') throw new Error('conflict published the unseen name');
    const conflictShot = await ui.shot('admin-480-conflict.png', 480, 900);
    notes.push(`admin 480 conflict ${conflictShot.width}x${conflictShot.height}`);
    await fetch(`${apiBase}/partners-portal/products/${conflicted.id}/submit-review`, { method: 'POST', headers: brandHeaders });
    await ui.evalJson(`clickNamed('article', 'منتج التعارض', 'معاينة')`);
    const readyAgain = await ui.evalJson(`(async () => {
      for (let i = 0; i < 40; i++) {
        const card = [...document.querySelectorAll('article')].find((node) => node.innerText.includes('منتج التعارض'));
        if (card && card.innerText.includes('المعاينة جاهزة') && card.innerText.includes('اسم لم يُعاين')) return true;
        await new Promise((r) => setTimeout(r, 150));
      }
      return false;
    })()`);
    if (!readyAgain) throw new Error('re-preview did not finish');
    await ui.evalJson(`clickNamed('article', 'منتج التعارض', 'اعتماد')`);
    let approved = '';
    for (let i = 0; i < 40; i += 1) {
      approved = ((await (await fetch(`${apiBase}/marketplace/catalog/product/${conflicted.id}`)).json())).nameAr;
      if (approved === 'اسم لم يُعاين') break;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    if (approved !== 'اسم لم يُعاين') throw new Error(`approve did not publish ${approved}`);
    notes.push('narrow approve published the re-previewed revision on the same id');
    await ui.evalJson(`clickNamed('article', 'خدمة الرفض', 'رفض')`);
    let rejected = false;
    for (let i = 0; i < 40; i += 1) {
      const row = await prisma.service.findUnique({ where: { id: service.id } });
      rejected = row?.reviewStatus === 'rejected' && row.descriptionAr === '<b>وصف الخدمة</b>';
      if (rejected) break;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    if (!rejected) throw new Error('reject did not keep the service description');
    notes.push('narrow reject kept the submitted service description unpublished');

    await ui.setViewport(390, 844);
    await openReviews();
    const phone = await ui.evalJson(layoutExpression);
    if (phone.menu !== 'false' || phone.offenders.length || phone.buttons.some((button) => !button.inside) || phone.scrollWidth > phone.view + 1) {
      throw new Error(`390 layout ${JSON.stringify(phone)}`);
    }
    await ui.evalJson(`(async () => { document.querySelector('#menuToggle').click(); await new Promise((resolve) => setTimeout(resolve, 350)); return true; })()`);
    const phoneOpen = await ui.evalJson(`document.querySelector('#menuToggle').getAttribute('aria-expanded') === 'true' && document.querySelector('#sidebar').classList.contains('open')`);
    if (!phoneOpen) throw new Error('390 menu did not open');
    const phoneOpenShot = await ui.shot('admin-390-menu-open.png', 390, 844);
    await ui.evalJson(`(async () => { document.querySelector('#menuToggle').click(); await new Promise((resolve) => setTimeout(resolve, 350)); return true; })()`);
    const phoneClosed = await ui.evalJson(layoutExpression);
    if (phoneClosed.sidebarOpen || phoneClosed.offenders.length) throw new Error(`390 menu did not close ${JSON.stringify(phoneClosed)}`);
    const phoneShot = await ui.shot('admin-390-preview.png', 390, 844);
    notes.push(`admin 390 menu ${phoneOpenShot.width}x${phoneOpenShot.height}; preview ${phoneShot.width}x${phoneShot.height}; scroll ${phone.scrollWidth}`);
    notes.push('browser checks used desktop Chrome viewports only; the phone app was not launched');

    await writeFile(join(evidence, 'ui-assertions.txt'), `${notes.join('\n')}\n`);
    await rm(join(evidence, 'ui-error.txt'), { force: true });
    console.log(notes.join('\n'));
    console.log('ph3 rc4 browser evidence passed');
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

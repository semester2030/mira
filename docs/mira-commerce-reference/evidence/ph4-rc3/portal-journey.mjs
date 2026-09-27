import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const scriptDir = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
function arg(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}
const repo = resolve(arg('--root', resolve(scriptDir, '../../../..')));
const outDir = resolve(arg('--out', resolve(scriptDir, '../ph4-rc4')));
const journey = JSON.parse(readFileSync(arg('--journey', '/tmp/ph4-rc3-journey.json'), 'utf8'));
mkdirSync(outDir, { recursive: true });
const requests = [];
const evidence = [];
const caption = 'نص إعلان طويل للتحقق من التفاف الحقول والأزرار وأسباب الرفض في العرض الضيق دون قصها داخل البطاقة';
const rejection = 'سبب الرفض الطويل: النص يحتاج توضيح الجهة والسعر والرابط، ولا يُعتمد تلقائيًا عند تعارض النسخة.';

function staticServer(directory, port) {
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const file = normalize(join(directory, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)));
    if (!file.startsWith(directory)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const body = readFileSync(file);
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
      res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function socketCall(socket, pending) {
  return (method, params = {}) => {
    const id = pending.next;
    pending.next += 1;
    return new Promise((resolve, reject) => {
      pending.map.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  };
}

class Page {
  constructor(browser, socket, width) {
    this.browser = browser;
    this.width = width;
    this.height = browser.height;
    const pending = { next: 1, map: new Map() };
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.method === 'Network.requestWillBeSent') {
        const headers = message.params.request.headers || {};
        requests.push({
          url: message.params.request.url,
          method: message.params.request.method,
          hasAuthorization: Object.keys(headers).some((key) => key.toLowerCase() === 'authorization'),
          hasAdminKey: Object.keys(headers).some((key) => key.toLowerCase() === 'x-admin-key'),
        });
      }
      if (message.id && pending.map.has(message.id)) {
        const { resolve, reject } = pending.map.get(message.id);
        pending.map.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      }
    });
    this.send = socketCall(socket, pending);
  }

  async ready() {
    await this.send('Network.enable');
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Emulation.setDeviceMetricsOverride', {
      width: this.browser.width,
      height: this.browser.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
  }

  async open(url) {
    await this.send('Page.navigate', { url });
    await wait(800);
  }

  async eval(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }

  async click(selector) {
    const ok = await this.eval(`(() => { const node = document.querySelector(${JSON.stringify(selector)}); if (!node) return false; node.click(); return true; })()`);
    if (!ok) throw new Error(`missing ${selector}`);
    await wait(600);
  }

  async clickText(text) {
    const point = await this.eval(`(() => {
      const node = [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === ${JSON.stringify(text)});
      if (!node) return null;
      node.scrollIntoView({ block: 'center', inline: 'nearest' });
      const rect = node.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom };
    })()`);
    if (!point) throw new Error(`missing button ${text}`);
    if (point.width < 8 || point.y < 0 || point.bottom > this.height + 1) throw new Error(`button not in view ${text}`);
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    evidence.push({ mouse: text, width: this.width, point });
    await wait(700);
  }

  async setField(name, value) {
    const ok = await this.eval(`(() => { const node = document.querySelector(${JSON.stringify(`input[name="${name}"]`)}); if (!node) return false; node.value = ${JSON.stringify(value)}; return true; })()`);
    if (!ok) throw new Error(`missing field ${name}`);
  }

  async shot(name, focus = '#adsSection, #adsForm, .panel') {
    await this.eval(`document.querySelector(${JSON.stringify(focus)})?.scrollIntoView({ block: 'center' })`);
    await wait(200);
    const metrics = await this.eval(`(() => {
      const panel = document.querySelector('#adsSection, .panel') || document.body;
      const buttons = [...document.querySelectorAll('#adsSection button, .ad-actions button')].map((node) => {
        const rect = node.getBoundingClientRect();
        return { text: node.textContent.trim(), width: Math.round(rect.width), height: Math.round(rect.height), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom) };
      });
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
        document: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth },
        panel: { scrollWidth: panel.scrollWidth, clientWidth: panel.clientWidth },
        buttons,
      };
    })()`);
    const image = await this.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(outDir, name), Buffer.from(image.data, 'base64'));
    evidence.push({ name, width: this.width, metrics });
    if (metrics.viewport.width !== this.width) throw new Error(`${name} viewport ${metrics.viewport.width} != ${this.width}`);
    if (metrics.panel.scrollWidth > metrics.panel.clientWidth + 1) throw new Error(`${name} panel overflow`);
    const clipped = metrics.buttons.filter((button) => button.right > metrics.viewport.width + 1 || button.width < 8);
    if (clipped.length) throw new Error(`${name} clipped ${clipped.map((item) => item.text).join(',')}`);
  }
}

class Browser {
  constructor(width, height, port) {
    this.width = width;
    this.height = height;
    this.port = port;
  }

  async start() {
    this.chrome = spawn(chromePath, [
      '--headless=new', '--disable-gpu', '--no-first-run',
      `--window-size=${this.width},${this.height}`,
      `--remote-debugging-port=${this.port}`,
      'about:blank',
    ], { stdio: 'ignore' });
    let version;
    for (let i = 0; i < 40; i += 1) {
      try {
        version = await (await fetch(`http://127.0.0.1:${this.port}/json/version`)).json();
        break;
      } catch {
        await wait(150);
      }
    }
    if (!version) throw new Error('chrome did not start');
    this.browserSocket = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      this.browserSocket.addEventListener('open', resolve, { once: true });
      this.browserSocket.addEventListener('error', reject, { once: true });
    });
    const pending = { next: 1, map: new Map() };
    this.browserSocket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.map.has(message.id)) {
        const { resolve, reject } = pending.map.get(message.id);
        pending.map.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      }
    });
    this.browserSend = socketCall(this.browserSocket, pending);
  }

  async page() {
    const created = await this.browserSend('Target.createTarget', { url: 'about:blank' });
    const list = await (await fetch(`http://127.0.0.1:${this.port}/json/list`)).json();
    const target = list.find((item) => item.id === created.targetId);
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
    const page = new Page(this, socket, this.width);
    await page.ready();
    return page;
  }

  stop() {
    this.browserSocket.close();
    this.chrome.kill();
  }
}

async function loginPartner(page) {
  const api = encodeURIComponent(journey.apiBase);
  await page.open(`http://127.0.0.1:8765/login.html?api-base=${api}`);
  await page.setField('email', journey.email);
  await page.setField('accessToken', journey.token);
  await page.eval(`document.querySelector('form').requestSubmit()`);
  await wait(1200);
  const ready = await page.eval(`!!document.querySelector('#adsForm')`);
  if (!ready) throw new Error(await page.eval(`document.body.innerText.slice(0, 300)`));
}

async function loginAdmin(page) {
  const api = encodeURIComponent(journey.apiBase);
  await page.open(`http://127.0.0.1:8766/index.html?api-base=${api}`);
  await page.eval(`document.querySelector('#adminKey').value = ${JSON.stringify(journey.adminKey)}`);
  await page.click('#loginBtn');
  await page.click('[data-view="ads"]');
  await wait(500);
}

const partners = await staticServer(`${repo}/partners-portal/web`, 8765);
const admin = await staticServer(`${repo}/admin-portal/web`, 8766);
const browser = new Browser(390, 844, 9223);
await browser.start();
try {
  const partner = await browser.page();
  const hold = await browser.page();
  const rejector = await browser.page();
  await loginPartner(partner);
  await partner.setField('targetKind', 'product');
  await partner.setField('targetId', journey.productId);
  await partner.setField('captionAr', caption);
  await partner.eval(`document.querySelector('#adsForm').requestSubmit()`);
  await wait(1000);
  await partner.shot('partner-ads-form-390.png', '#adsForm');
  await partner.clickText('إرسال للمراجعة');
  for (const [width, height, port] of [[480, 900, 9224], [1280, 800, 9225]]) {
    const sized = new Browser(width, height, port);
    await sized.start();
    const partnerShot = await sized.page();
    const adminShot = await sized.page();
    await loginPartner(partnerShot);
    await partnerShot.eval(`document.querySelector('#adsForm')?.scrollIntoView({ block: 'center' })`);
    await partnerShot.shot(`partner-ads-form-${width}.png`, '#adsForm');
    await loginAdmin(adminShot);
    await adminShot.eval(`[...document.querySelectorAll('button')].find((item) => item.textContent.trim() === 'معاينة')?.scrollIntoView({ block: 'center' })`);
    await adminShot.shot(`admin-ads-${width}.png`);
    await sized.stop();
    await wait(400);
  }
  await loginAdmin(hold);
  await hold.clickText('معاينة');
  await hold.shot('admin-ads-preview-390.png');
  await loginAdmin(rejector);
  await rejector.eval(`document.querySelector('.ad-note').value = ${JSON.stringify(rejection)}`);
  await rejector.clickText('معاينة');
  await rejector.shot('admin-ads-rejection-390.png');
  await rejector.clickText('رفض');
  await partner.clickText('تعديل المسودة');
  await partner.setField('captionAr', `${caption} — بعد الرفض`);
  await partner.eval(`document.querySelector('#adsForm').requestSubmit()`);
  await wait(800);
  await partner.clickText('إرسال للمراجعة');
  await hold.clickText('اعتماد النسخة المعروضة');
  const conflict = await hold.eval(`document.body.innerText`);
  if (!conflict.includes('لم يُعتمد شيء تلقائيًا')) throw new Error(`409 text missing: ${conflict.slice(0, 400)}`);
  await hold.shot('admin-ads-409-390.png');
  await hold.clickText('معاينة');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const enabled = await hold.eval(`(() => { const node = [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === 'اعتماد النسخة المعروضة'); return !!node && !node.disabled; })()`);
    if (enabled) break;
    await wait(200);
    if (attempt === 19) throw new Error('approve stayed disabled after the new preview');
  }
  await hold.clickText('اعتماد النسخة المعروضة');
  await wait(1000);
  const approved = await hold.eval(`document.body.innerText`);
  if (!approved.includes('تم تسجيل القرار') && !approved.includes('لا إعلانات بانتظار المراجعة')) {
    throw new Error(`fresh approve missing: ${approved.slice(0, 400)}`);
  }
  await partner.clickText('سحب');
  await wait(800);
  await browser.stop();

  const operational = requests.filter((item) => item.url.includes('/api/v1/'));
  if (operational.some((item) => !item.url.startsWith(journey.apiBase))) throw new Error('request left the local api');
  for (const path of ['/partners-portal/login', '/partners-portal/ads', '/admin/catalog-ads']) {
    if (!operational.some((item) => item.url.includes(path))) throw new Error(`missing ${path}`);
  }
  const decision = operational.filter((item) => item.url.includes('/decision'));
  if (decision.length < 2) throw new Error('expected reject and approve requests');
  writeFileSync(join(outDir, 'portal-metrics.json'), JSON.stringify({
    sourceRoot: repo,
    evidence,
    localApi: true,
    requestCount: operational.length,
    decisionCount: decision.length,
    note: 'Chrome headless at the real window size. Not a phone run. Overview route is the local login gate; ad routes use the catalog ad service.',
  }, null, 2));
  console.log('portal journey passed');
} finally {
  try { browser.stop(); } catch { /* already closed */ }
  partners.close();
  admin.close();
}

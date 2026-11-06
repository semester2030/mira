/**
 * Headed/headless browser journey for U04/F06 against local UploadSession API.
 * Spawns nothing itself — expects MIRA_RC4_BROWSER_BASE and MIRA_RC4_BROWSER_TOKEN.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, createReadStream, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MIRA_P21_OUT_DIR || join(process.cwd(), '..', 'audit-out', 'p2-1-rc4', 'logs', 'browser');
mkdirSync(outDir, { recursive: true });

const apiBase = process.env.MIRA_RC4_BROWSER_BASE;
const token = process.env.MIRA_RC4_BROWSER_TOKEN;
const ownerId = process.env.MIRA_RC4_BROWSER_OWNER_ID;
const fixture = join(__dirname, 'fixtures', 'valid-large.mp4');

if (!apiBase || !token || !ownerId) {
  console.error('missing MIRA_RC4_BROWSER_BASE/TOKEN/OWNER_ID');
  process.exit(2);
}

const apiJs = readFileSync(join(__dirname, '../../../../partners-portal/web/js/api.js'), 'utf8');
const html = `<!doctype html>
<html lang="ar" dir="rtl"><head>
<meta charset="utf-8"/>
<meta name="mira-api-base" content="${apiBase}"/>
<title>MIRA P2.1 RC4 browser</title>
</head><body>
<h1>MIRA upload journey</h1>
<pre id="log"></pre>
<script>
localStorage.setItem('mira_partner_token', ${JSON.stringify(token)});
</script>
<script>${apiJs}</script>
<script>
window.__miraLog = [];
function log(m){ window.__miraLog.push(m); document.getElementById('log').textContent = window.__miraLog.join('\\n'); }
window.runJourney = async function(file, ownerId) {
  log('start');
  const clientMediaId = crypto.randomUUID();
  let sessionId = null;
  const ctrl = new AbortController();
  // Phase 1: start multipart then abort after first progress (simulate reload mid-upload)
  try {
    await PartnersApi.uploadViaSession('services', ownerId, file, {
      clientMediaId,
      idempotencyKey: clientMediaId,
      mimeType: file.type || 'video/mp4',
      signal: ctrl.signal,
      onSession: (s) => { sessionId = s.sessionId; log('session:'+sessionId); sessionStorage.setItem('mira_upload_resume:'+ownerId+':'+clientMediaId, JSON.stringify({sessionId, byteSize:file.size, checksum:s.declaredChecksum, name:file.name})); },
      onProgress: (r) => {
        log('progress:'+r);
        if (r != null && r > 0 && !ctrl.signal.aborted) {
          log('abort-mid-upload');
          ctrl.abort();
        }
      },
      onProcessing: () => log('processing'),
    });
    log('unexpected-ready-phase1');
  } catch (e) {
    log('phase1-err:'+(e && (e.name || e.code) || e.message));
  }
  // Simulate page reload: clear in-memory, restore sessionId from sessionStorage
  const raw = sessionStorage.getItem('mira_upload_resume:'+ownerId+':'+clientMediaId);
  const saved = raw ? JSON.parse(raw) : null;
  log('restored:'+(saved && saved.sessionId));
  const state = await PartnersApi.uploadViaSession('services', ownerId, file, {
    clientMediaId,
    idempotencyKey: clientMediaId,
    sessionId: saved && saved.sessionId,
    mimeType: file.type || 'video/mp4',
    onSession: (s) => log('resume-session:'+s.sessionId+' parts:'+((s.completedParts||[]).length)),
    onProgress: (r) => log('resume-progress:'+r),
    onProcessing: () => log('resume-processing'),
  });
  log('final:'+state.status+':'+state.catalogMediaId);
  // mismatch file same size different bytes
  const wrong = new File([new Uint8Array(file.size).fill(7)], file.name, { type: file.type });
  try {
    await PartnersApi.uploadViaSession('services', ownerId, wrong, {
      sessionId: state.sessionId,
      mimeType: 'video/mp4',
    });
    log('mismatch-unexpected-ok');
  } catch (e) {
    log('mismatch:'+(e && e.code || e.message));
  }
  return { sessionId: state.sessionId, status: state.status, catalogMediaId: state.catalogMediaId, logs: window.__miraLog.slice() };
};
</script>
</body></html>`;

// Serve html + fixture
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url?.startsWith('/index')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }
  if (req.url === '/file.mp4') {
    res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': statSync(fixture).size });
    createReadStream(fixture).pipe(res);
    return;
  }
  res.writeHead(404);
  res.end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const pageUrl = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const requests = [];
page.on('request', (req) => {
  const u = req.url();
  if (u.includes('/upload-sessions')) {
    requests.push({ method: req.method(), url: u.replace(/sig=[^&]+/g, 'sig=REDACTED') });
  }
});
await page.goto(pageUrl);
const result = await page.evaluate(async ({ ownerId, fileUrl }) => {
  const buf = await fetch(fileUrl).then((r) => r.arrayBuffer());
  const file = new File([buf], 'valid-large.mp4', { type: 'video/mp4' });
  return window.runJourney(file, ownerId);
}, { ownerId, fileUrl: `http://127.0.0.1:${port}/file.mp4` });

await page.screenshot({ path: join(outDir, 'u04-f06-journey.png'), fullPage: true });
await browser.close();
server.close();

const ok = result && result.status === 'ready' && result.catalogMediaId && (result.logs || []).some((l) => String(l).startsWith('restored:'));
const out = {
  ok: !!ok,
  result,
  requests: requests.slice(0, 80),
  fileBytes: statSync(fixture).size,
  sha256: createHash('sha256').update(readFileSync(fixture)).digest('hex'),
};
writeFileSync(join(outDir, 'browser-journey.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ ok: out.ok, status: result?.status, catalogMediaId: result?.catalogMediaId, logs: result?.logs?.slice(-8) }, null, 2));
process.exit(out.ok ? 0 : 1);

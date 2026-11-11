import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../../partners-portal/web');
const phase2 = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../mira-api/src/marketplace/taxonomy/phase2-orb-assets.v1.json'), 'utf8'),
);

const entries = Object.entries(phase2.byImageKey).filter(([k, v]) =>
  ['jewelry','children','gifts','occasions'].some((p) => k === p || k.startsWith(p + '.')),
);

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const filePath = path.join(root, urlPath.replace(/^\//, ''));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404); res.end('missing'); return;
  }
  const buf = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': buf.length });
  res.end(buf);
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { port } = server.address();
const rows = [];
let failed = 0;
for (const [imageKey, meta] of entries) {
  const expected = meta.orb; // e.g. assets/e2b-ref/orbs/jewelry.png
  const url = `http://127.0.0.1:${port}/${expected}`;
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const isPng = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const ok = res.status === 200 && isPng && buf.length > 1000;
  if (!ok) failed += 1;
  rows.push({
    categoryId: meta.categoryId || imageKey,
    imageKey,
    expectedPath: expected,
    loadedUrl: url,
    httpStatus: res.status,
    bytes: buf.length,
    pngMagic: isPng,
    result: ok ? 'PASS' : 'FAIL',
  });
}
server.close();
const out = path.join(__dirname, 'PORTAL_ORB_LOAD_RESULTS.json');
fs.writeFileSync(out, JSON.stringify({ port, failed, rows }, null, 2));
const md = [
  '| categoryId | imageKey | expected | http | bytes | png | result |',
  '|---|---|---|---:|---:|---|---|',
  ...rows.map((r) => `| ${r.categoryId} | ${r.imageKey} | ${r.expectedPath} | ${r.httpStatus} | ${r.bytes} | ${r.pngMagic} | ${r.result} |`),
  '',
  `failed=${failed}`,
].join('\n');
fs.writeFileSync(path.join(__dirname, 'PORTAL_ORB_LOAD_RESULTS.md'), md);
console.log(md);
if (failed) process.exit(1);

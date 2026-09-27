/**
 * Standalone ONE-SHOT Perfect HD mask acceptance (4 concerns only).
 * No Nest required. Does not print secrets or persist face/mask images.
 *
 * Usage:
 *   PERFECT_API_KEY=... node mira-api/src/ai/scripts/hd-one-shot-standalone.mjs [imagePath]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DST_ACTIONS = ['hd_age_spot', 'hd_pore', 'hd_wrinkle', 'hd_redness'];
const BASE =
  (process.env.PERFECT_BASE_URL ||
    process.env.PERFECT_CORP_BASE_URL ||
    'https://yce-api-01.makeupar.com/s2s/v2.0').replace(/\/+$/, '');
const KEY = (
  process.env.PERFECT_API_KEY ||
  process.env.PERFECT_CORP_API_KEY ||
  ''
).trim();
const POLL_MS = Number(process.env.PERFECT_CORP_POLL_INTERVAL_MS || 1500);
const POLL_MAX = Number(process.env.PERFECT_CORP_POLL_MAX_MS || 120000);

function redactUrl(u) {
  try {
    const x = new URL(u);
    return x.hostname; // evidence: host only — no path, query, or signed params
  } catch {
    return '[redacted-url]';
  }
}

function asRec(v) {
  return v && typeof v === 'object' ? v : null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function upload(imageBytes) {
  const isPng = imageBytes[0] === 0x89 && imageBytes[1] === 0x50;
  const contentType = isPng ? 'image/png' : 'image/jpeg';
  const fileName = isPng ? 'mira_hd.png' : 'mira_hd.jpg';
  const initRes = await fetch(`${BASE}/file/skin-analysis`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: [
        {
          content_type: contentType,
          file_name: fileName,
          file_size: imageBytes.length,
        },
      ],
    }),
  });
  const initJson = await initRes.json();
  if (!initRes.ok) {
    throw new Error(
      `FILE_INIT ${initRes.status}: ${JSON.stringify(initJson).slice(0, 240)}`,
    );
  }
  const file = initJson?.data?.files?.[0];
  const fileId = file?.file_id;
  const req0 = file?.requests?.[0];
  if (!fileId || !req0?.url) throw new Error('FILE_INIT missing file_id/url');
  const headers = {
    'Content-Type': contentType,
    'Content-Length': String(imageBytes.length),
  };
  if (req0.headers && typeof req0.headers === 'object') {
    for (const [k, v] of Object.entries(req0.headers)) {
      if (typeof v === 'string') headers[k] = v;
    }
  }
  const put = await fetch(req0.url, {
    method: req0.method || 'PUT',
    headers,
    body: imageBytes,
  });
  if (!put.ok) {
    throw new Error(`UPLOAD ${put.status}: ${(await put.text()).slice(0, 160)}`);
  }
  return fileId;
}

async function createTask(fileId) {
  const body = {
    src_file_id: fileId,
    dst_actions: DST_ACTIONS,
    miniserver_args: { enable_mask_overlay: false },
    format: 'json',
  };
  const res = await fetch(`${BASE}/task/skin-analysis`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      `TASK_CREATE ${res.status}: ${JSON.stringify(json).slice(0, 300)}`,
    );
  }
  const taskId = json?.data?.task_id || json?.task_id;
  if (!taskId) throw new Error('TASK_CREATE missing task_id');
  return { taskId, requestSanitized: { ...body, src_file_id: '[redacted]' } };
}

async function poll(taskId) {
  const deadline = Date.now() + POLL_MAX;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${BASE}/task/skin-analysis/${encodeURIComponent(taskId)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${KEY}` },
      },
    );
    const json = await res.json();
    if (!res.ok) {
      throw new Error(
        `TASK_POLL ${res.status}: ${JSON.stringify(json).slice(0, 300)}`,
      );
    }
    const data = asRec(json.data) || json;
    const status = String(data.task_status || data.taskStatus || '').toLowerCase();
    if (status === 'success') return data;
    if (status === 'error') {
      throw new Error(
        `TASK_ERROR: ${JSON.stringify(data.error || data).slice(0, 300)}`,
      );
    }
    await sleep(POLL_MS);
  }
  throw new Error(`TASK_TIMEOUT after ${POLL_MAX}ms`);
}

function parseArtifacts(data) {
  const artifacts = [];
  const results = asRec(data.results) || {};
  const output = Array.isArray(results.output) ? results.output : [];
  for (const item of output) {
    const row = asRec(item);
    if (!row || typeof row.type !== 'string') continue;
    artifacts.push({
      concernType: row.type,
      region: typeof row.region === 'string' ? row.region : undefined,
      rawScore: typeof row.raw_score === 'number' ? row.raw_score : undefined,
      uiScore: typeof row.ui_score === 'number' ? row.ui_score : undefined,
      outputMaskName:
        typeof row.output_mask_name === 'string'
          ? row.output_mask_name
          : undefined,
      maskUrls: Array.isArray(row.mask_urls)
        ? row.mask_urls.filter((u) => typeof u === 'string')
        : [],
    });
  }
  const collectNested = (obj, prefix) => {
    for (const [key, val] of Object.entries(obj || {})) {
      if (!key.startsWith(prefix) && prefix !== '') continue;
      if (!key.startsWith('hd_')) continue;
      const rec = asRec(val);
      if (!rec) continue;
      if (
        'raw_score' in rec ||
        'ui_score' in rec ||
        'output_mask_name' in rec ||
        'mask_urls' in rec
      ) {
        artifacts.push({
          concernType: key,
          rawScore: typeof rec.raw_score === 'number' ? rec.raw_score : undefined,
          uiScore: typeof rec.ui_score === 'number' ? rec.ui_score : undefined,
          outputMaskName:
            typeof rec.output_mask_name === 'string'
              ? rec.output_mask_name
              : undefined,
          maskUrls: Array.isArray(rec.mask_urls)
            ? rec.mask_urls.filter((u) => typeof u === 'string')
            : [],
        });
        continue;
      }
      for (const [region, rv] of Object.entries(rec)) {
        const sub = asRec(rv);
        if (!sub) continue;
        if (
          !('raw_score' in sub) &&
          !('ui_score' in sub) &&
          !('output_mask_name' in sub) &&
          !('mask_urls' in sub)
        ) {
          continue;
        }
        artifacts.push({
          concernType: key,
          region,
          rawScore: typeof sub.raw_score === 'number' ? sub.raw_score : undefined,
          uiScore: typeof sub.ui_score === 'number' ? sub.ui_score : undefined,
          outputMaskName:
            typeof sub.output_mask_name === 'string'
              ? sub.output_mask_name
              : undefined,
          maskUrls: Array.isArray(sub.mask_urls)
            ? sub.mask_urls.filter((u) => typeof u === 'string')
            : [],
        });
      }
    }
  };
  collectNested(data, 'hd_');
  collectNested(results, 'hd_');
  // dedupe
  const map = new Map();
  for (const a of artifacts) {
    const k = `${a.concernType}::${a.region || 'root'}`;
    const prev = map.get(k);
    if (!prev) map.set(k, a);
    else {
      map.set(k, {
        ...prev,
        ...a,
        maskUrls: a.maskUrls.length ? a.maskUrls : prev.maskUrls,
        rawScore: a.rawScore ?? prev.rawScore,
        uiScore: a.uiScore ?? prev.uiScore,
        outputMaskName: a.outputMaskName ?? prev.outputMaskName,
      });
    }
  }
  return [...map.values()];
}

async function main() {
  const imagePath =
    process.argv[2] ||
    path.resolve(__dirname, '../../../../assets/images/premium_face_base.png');
  const outDir =
    process.argv[3] ||
    path.resolve(
      __dirname,
      '../../../../docs/governance/MIRA_PERFECT_HD_MASKS_REAL_ONE_SHOT_2026-09-12',
    );

  if (!KEY) {
    console.error(JSON.stringify({ phase: 'blocked', reason: 'PERFECT_KEY_MISSING' }));
    process.exit(3);
  }
  if (!fs.existsSync(imagePath)) {
    console.error(JSON.stringify({ phase: 'blocked', reason: 'IMAGE_MISSING' }));
    process.exit(2);
  }

  // Network preflight (no auth secret logged)
  try {
    const edge = await fetch(BASE);
    console.log(
      JSON.stringify({
        phase: 'preflight',
        keyPresent: true,
        base: BASE,
        edgeStatus: edge.status,
        image: path.basename(imagePath),
        dstActions: DST_ACTIONS,
      }),
    );
  } catch (e) {
    console.error(
      JSON.stringify({
        phase: 'blocked',
        reason: 'NETWORK_UNAVAILABLE',
        message: String(e.message || e).slice(0, 160),
      }),
    );
    process.exit(4);
  }

  const imageBytes = fs.readFileSync(imagePath);
  const meta = await sharp(imageBytes, { failOn: 'none' }).rotate().metadata();
  const sourceWidth = meta.width || 0;
  const sourceHeight = meta.height || 0;
  const shortSide = Math.min(sourceWidth, sourceHeight);
  if (shortSide < 1080) {
    console.error(
      JSON.stringify({
        phase: 'blocked',
        reason: 'HD_RESOLUTION',
        shortSide,
        sourceWidth,
        sourceHeight,
      }),
    );
    process.exit(5);
  }

  try {
    const fileId = await upload(imageBytes);
    console.log(JSON.stringify({ phase: 'uploaded' }));
    const { taskId, requestSanitized } = await createTask(fileId);
    console.log(
      JSON.stringify({ phase: 'task_created', taskIdPrefix: taskId.slice(0, 12) }),
    );
    const data = await poll(taskId);
    console.log(JSON.stringify({ phase: 'task_success' }));

    const artifacts = parseArtifacts(data);
    const materialized = [];
    for (const a of artifacts) {
      const row = {
        concernType: a.concernType,
        region: a.region,
        rawScore: a.rawScore ?? null,
        uiScore: a.uiScore ?? null,
        outputMaskName: a.outputMaskName ?? null,
        maskUrlCount: a.maskUrls.length,
        maskUrlHosts: a.maskUrls.map(redactUrl),
        scoreOnly: a.maskUrls.length === 0 && !a.outputMaskName,
        downloadOk: false,
        width: null,
        height: null,
        format: null,
        hasAlpha: null,
        nonEmptySpatial: null,
        alignedWithSource: null,
        alignmentNotes: null,
        downloadError: null,
      };
      const url = a.maskUrls[0];
      if (!url) {
        row.alignmentNotes = row.scoreOnly
          ? 'SCORE_ONLY_FOR_THIS_OUTPUT'
          : 'mask URL missing';
        materialized.push(row);
        continue;
      }
      try {
        const res = await fetch(url);
        if (!res.ok) {
          row.downloadError = `HTTP ${res.status}`;
          materialized.push(row);
          continue;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        const m = await sharp(buf, { failOn: 'none' }).metadata();
        const { data: raw, info } = await sharp(buf, { failOn: 'none' })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        let nonzero = 0;
        for (let i = 3; i < raw.length; i += info.channels) {
          if (raw[i] > 8) nonzero++;
        }
        row.downloadOk = true;
        row.width = m.width || null;
        row.height = m.height || null;
        row.format = m.format || null;
        row.hasAlpha = m.hasAlpha === true || (m.channels || 0) >= 4;
        row.nonEmptySpatial = nonzero > 64;
        row.alignedWithSource =
          row.width === sourceWidth && row.height === sourceHeight;
        row.alignmentNotes = row.alignedWithSource
          ? 'mask dimensions == source (offset 0)'
          : `mask ${row.width}x${row.height} vs source ${sourceWidth}x${sourceHeight}`;
      } catch (err) {
        row.downloadError = String(err.message || err).slice(0, 160);
      }
      materialized.push(row);
    }

    const byMetric = (id) =>
      materialized.filter((m) => m.concernType === id || m.concernType === id.replace(/^hd_/, ''));

    const summary = {
      phase: 'done',
      apiVersion: 's2s/v2.0',
      endpoint: `${BASE}/task/skin-analysis`,
      requestSanitized,
      taskIdPrefix: taskId.slice(0, 12),
      sourceWidth,
      sourceHeight,
      shortSide,
      enableMaskOverlay: false,
      hdOnly: true,
      unitsConsumed: 'unknown',
      artifacts: materialized,
      matrix: DST_ACTIONS.map((metric) => {
        const rows = byMetric(metric);
        const whole =
          rows.find((r) => r.region === 'whole' || r.region === 'all') ||
          rows.find((r) => !r.region) ||
          rows[0];
        const maskReturned = rows.some(
          (r) => r.downloadOk || r.maskUrlCount > 0 || r.outputMaskName,
        );
        return {
          metric,
          rawScore: whole?.rawScore ?? null,
          uiScore: whole?.uiScore ?? null,
          maskReturned,
          dimensions:
            whole?.width && whole?.height
              ? `${whole.width}x${whole.height}`
              : null,
          aligned: whole?.alignedWithSource ?? null,
          subregions: rows
            .filter((r) => r.region)
            .map((r) => ({
              region: r.region,
              rawScore: r.rawScore,
              uiScore: r.uiScore,
              maskReturned: !!(r.downloadOk || r.maskUrlCount || r.outputMaskName),
              dimensions:
                r.width && r.height ? `${r.width}x${r.height}` : null,
              aligned: r.alignedWithSource,
            })),
        };
      }),
      passHints: {
        ageSpotMask: byMetric('hd_age_spot').some((r) => r.downloadOk),
        poreMask: byMetric('hd_pore').some((r) => r.downloadOk),
        wrinkleMask: byMetric('hd_wrinkle').some((r) => r.downloadOk),
        rednessMask: byMetric('hd_redness').some((r) => r.downloadOk),
        allAligned: materialized
          .filter((r) => r.downloadOk)
          .every((r) => r.alignedWithSource === true),
      },
    };

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, 'SANITIZED_PROVIDER_RESPONSE.json'),
      JSON.stringify(summary, null, 2),
    );

    // Ephemeral session for technical viewer ONLY — never ZIP'd / never History.
    // Stores source + mask bytes in /tmp for LAN iPhone review of THIS acceptance.
    if (process.env.MIRA_HD_EPHEMERAL_SESSION === '1') {
      const ephemeral = {
        createdAt: new Date().toISOString(),
        sourceWidth,
        sourceHeight,
        sourceContentType: 'image/jpeg',
        sourceBase64: imageBytes.toString('base64'),
        masks: [],
      };
      for (const a of artifacts) {
        const url = a.maskUrls[0];
        if (!url) continue;
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const buf = Buffer.from(await res.arrayBuffer());
          ephemeral.masks.push({
            concernType: a.concernType,
            region: a.region,
            rawScore: a.rawScore,
            uiScore: a.uiScore,
            contentType: res.headers.get('content-type') || 'image/png',
            width: null,
            height: null,
            maskBase64: buf.toString('base64'),
          });
          const m = await sharp(buf, { failOn: 'none' }).metadata();
          ephemeral.masks[ephemeral.masks.length - 1].width = m.width;
          ephemeral.masks[ephemeral.masks.length - 1].height = m.height;
        } catch {
          /* skip */
        }
      }
      const sessionPath = '/tmp/mira_hd_ephemeral_session.json';
      fs.writeFileSync(sessionPath, JSON.stringify(ephemeral));
      console.log(
        JSON.stringify({
          phase: 'ephemeral_session',
          path: sessionPath,
          maskCount: ephemeral.masks.length,
          note: 'NOT for ZIP; session-scoped owner review only',
        }),
      );
    }

    console.log(JSON.stringify({ phase: 'written', outDir }));
    console.log(JSON.stringify({ matrix: summary.matrix, passHints: summary.passHints }, null, 2));
  } catch (e) {
    console.error(
      JSON.stringify({
        phase: 'error',
        message: String(e.message || e).slice(0, 500),
      }),
    );
    process.exit(1);
  }
}

main();

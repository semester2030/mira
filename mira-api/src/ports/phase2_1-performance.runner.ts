/**
 * Phase 2.1 performance harness — real wall-clock measurements.
 * Run: npm run build && node dist/ports/phase2_1-performance.runner.js
 *
 * Tolerance: report averages over N iterations; not a CI blocker unless
 * PHASE21_PERF_FAIL=1 and avg face detect > 8000ms.
 */
import sharp from 'sharp';
import { performance } from 'node:perf_hooks';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { BlazeFacePresenceDetector } from '../ai/face-gate/blazeface-face-presence.detector';
import { measurePixelMetrics } from './image-quality/pixel-image-metrics';

const ITERATIONS = 8;

function realFaceSvg(): string {
  return `<svg width="480" height="640">
    <rect width="100%" height="100%" fill="#2a2a32"/>
    <ellipse cx="240" cy="300" rx="120" ry="160" fill="#e0b090"/>
    <circle cx="200" cy="270" r="12" fill="#333"/>
    <circle cx="280" cy="270" r="12" fill="#333"/>
    <ellipse cx="240" cy="360" rx="30" ry="12" fill="#a06060"/>
  </svg>`;
}

function stats(samples: number[]): { avg: number; p95: number; max: number } {
  const sorted = [...samples].sort((a, b) => a - b);
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  const max = sorted[sorted.length - 1];
  return { avg, p95, max };
}

async function main(): Promise<void> {
  const buf = await sharp(Buffer.from(realFaceSvg())).jpeg().toBuffer();
  const detector = new BlazeFacePresenceDetector();

  // Warmup (model load)
  await detector.detect(buf);
  await measurePixelMetrics(buf);

  const qualityMs: number[] = [];
  const faceMs: number[] = [];
  const memMb: number[] = [];

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    await measurePixelMetrics(buf);
    qualityMs.push(performance.now() - t0);

    const t1 = performance.now();
    await detector.detect(buf);
    faceMs.push(performance.now() - t1);

    const mem = process.memoryUsage();
    memMb.push(mem.heapUsed / (1024 * 1024));
  }

  const q = stats(qualityMs);
  const f = stats(faceMs);
  const m = stats(memMb);

  const report = {
    version: 'phase2.1-perf-v1',
    iterations: ITERATIONS,
    imageBytes: buf.length,
    qualityEvaluationMs: q,
    facePresenceMs: f,
    heapUsedMb: m,
    notes: [
      'BlazeFace on tfjs cpu backend (no tfjs-node).',
      'Alignment not timed here (Flutter-only).',
      'Acceptable lab target: face P95 < 5000ms on laptop CPU after warmup.',
    ],
  };

  const outDir = join(process.cwd(), 'docs');
  try {
    mkdirSync(join(process.cwd(), '..', 'docs', 'architecture'), {
      recursive: true,
    });
  } catch {
    /* ignore */
  }

  const md = `# Phase 2.1 Performance Results

Measured on Node ${process.version} · ${ITERATIONS} iterations · warmup excluded.

| Stage | Avg (ms) | P95 (ms) | Max (ms) |
|-------|----------|----------|----------|
| Pixel quality (measurePixelMetrics) | ${q.avg.toFixed(1)} | ${q.p95.toFixed(1)} | ${q.max.toFixed(1)} |
| Face presence (BlazeFace) | ${f.avg.toFixed(1)} | ${f.p95.toFixed(1)} | ${f.max.toFixed(1)} |
| Heap used (MB) | ${m.avg.toFixed(1)} | ${m.p95.toFixed(1)} | ${m.max.toFixed(1)} |

## Notes

- Backend: TensorFlow.js **cpu** (no native tfjs-node in this build).
- Face alignment timing is Flutter-side (\`FaceImageProcessor.alignForAnalysis\`).
- Memory: process heapUsed samples after each iteration.

## JSON

\`\`\`json
${JSON.stringify(report, null, 2)}
\`\`\`
`;

  const target = join(process.cwd(), '..', 'docs', 'architecture', 'phase2_1-performance.md');
  writeFileSync(target, md, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  console.log('Wrote', target);

  if (process.env.PHASE21_PERF_FAIL === '1' && f.avg > 8000) {
    console.error('PERF FAIL: face detect avg > 8000ms');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

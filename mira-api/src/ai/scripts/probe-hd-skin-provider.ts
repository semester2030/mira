/**
 * Production HD Skin provider path probe (no HTTP/Firebase).
 * Proves ONE analyzeSkinHdMasks + ephemeralMasks materialization.
 * Usage: cd mira-api && NODE_OPTIONS=--dns-result-order=ipv4first \
 *   npx ts-node -r dotenv/config src/ai/scripts/probe-hd-skin-provider.ts [imagePath]
 * Does NOT print secrets or write face/mask bytes to Desktop.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dns from 'node:dns';
import { ConfigService } from '@nestjs/config';
import { PerfectCorpService } from '../services/perfect-corp.service';
import { PERFECT_HD_FACE_EXPLORER_ACTIONS } from '../contracts/perfect-hd-mask.types';
import { parsePerfectHdMaskPayload } from '../services/perfect-hd-mask.parser';
import { materializeHdMaskArtifacts } from '../services/materialize-hd-masks';
import sharp from 'sharp';

dns.setDefaultResultOrder('ipv4first');

async function main() {
  const imagePath =
    process.argv[2] ??
    path.resolve(__dirname, '../../../../assets/images/premium_face_base.png');
  if (!fs.existsSync(imagePath)) {
    console.error('IMAGE_MISSING');
    process.exit(2);
  }
  const key =
    process.env.PERFECT_API_KEY?.trim() ||
    process.env.PERFECT_CORP_API_KEY?.trim();
  if (!key) {
    console.error('PERFECT_KEY_MISSING');
    process.exit(3);
  }

  const config = {
    get: (k: string, def?: unknown) => {
      if (k === 'PERFECT_API_KEY' || k === 'PERFECT_CORP_API_KEY') return key;
      if (k === 'PERFECT_BASE_URL' || k === 'PERFECT_CORP_BASE_URL') {
        return (
          process.env.PERFECT_BASE_URL ||
          process.env.PERFECT_CORP_BASE_URL ||
          'https://yce-api-01.makeupar.com/s2s/v2.0'
        );
      }
      if (k === 'PERFECT_CORP_POLL_INTERVAL_MS') return 1500;
      if (k === 'PERFECT_CORP_POLL_MAX_MS') return 180000;
      return process.env[k] ?? def;
    },
  } as unknown as ConfigService;

  const perfect = new PerfectCorpService(config);
  const bytes = fs.readFileSync(imagePath);
  const meta = await sharp(bytes, { failOn: 'none' }).rotate().metadata();
  const sourceWidth = meta.width ?? 0;
  const sourceHeight = meta.height ?? 0;
  const shortSide = Math.min(sourceWidth, sourceHeight);
  if (shortSide < 1080) {
    console.error('HD_GATE_FAIL', { shortSide, sourceWidth, sourceHeight });
    process.exit(4);
  }

  console.log(
    JSON.stringify({
      phase: 'start',
      actions: PERFECT_HD_FACE_EXPLORER_ACTIONS.length,
      dims: `${sourceWidth}x${sourceHeight}`,
    }),
  );

  const { rawYouCam } = await perfect.analyzeSkinHdMasks(
    bytes,
    [...PERFECT_HD_FACE_EXPLORER_ACTIONS],
  );
  const parsed = parsePerfectHdMaskPayload(rawYouCam);
  const { ephemeralMasks } = await materializeHdMaskArtifacts(
    parsed.artifacts,
    sourceWidth,
    sourceHeight,
  );
  const mapped = perfect.mapFromRawYouCam(rawYouCam).result;

  const withBytes = ephemeralMasks.filter((m) => !!m.maskBase64);
  const summary = {
    phase: 'done',
    perfectTasks: 1,
    artifactCount: parsed.artifacts.length,
    ephemeralMaskCount: ephemeralMasks.length,
    masksWithBytes: withBytes.length,
    scoreOnlyCount: ephemeralMasks.filter((m) => m.scoreOnly).length,
    sampleConcerns: withBytes.slice(0, 8).map((m) => ({
      concernType: m.concernType,
      region: m.region ?? null,
      hasBase64: true,
      width: m.width ?? null,
      height: m.height ?? null,
      aligned: m.alignedWithSource ?? null,
      rawScore: m.rawScore ?? null,
      uiScore: m.uiScore ?? null,
    })),
    skinResultKeys: Object.keys(mapped ?? {}).slice(0, 20),
    landmarkFallback: 0,
    dualPerfectCalls: 0,
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error('PROBE_FAIL', e instanceof Error ? e.message : String(e));
  process.exit(1);
});

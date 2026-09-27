/**
 * One-shot HD mask acceptance against Perfect S2S (owner-approved).
 * Usage: cd mira-api && npx ts-node -r dotenv/config src/ai/scripts/run-hd-mask-acceptance.ts
 * Does NOT print API keys. Does NOT write face/mask image bytes to Desktop.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ConfigService } from '@nestjs/config';
import { PerfectCorpService } from '../services/perfect-corp.service';
import { PerfectHdMaskAcceptanceService } from '../services/perfect-hd-mask-acceptance.service';

async function main() {
  const imagePath =
    process.argv[2] ??
    path.resolve(
      __dirname,
      '../../../../assets/images/premium_face_base.png',
    );
  if (!fs.existsSync(imagePath)) {
    console.error('IMAGE_MISSING', imagePath);
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
      if (k === 'PERFECT_CORP_POLL_MAX_MS') return 120000;
      return process.env[k] ?? def;
    },
  } as unknown as ConfigService;

  const perfect = new PerfectCorpService(config);
  const acceptance = new PerfectHdMaskAcceptanceService(perfect);
  const bytes = fs.readFileSync(imagePath);

  console.log(
    JSON.stringify({
      phase: 'start',
      image: path.basename(imagePath),
      bytes: bytes.length,
      keyPresent: true,
    }),
  );

  try {
    const out = await acceptance.runTechnicalAcceptance(bytes);
    // allow restricting actions via env for one-shot

    const sanitized = {
      phase: 'done',
      report: {
        ...out.report,
        artifacts: out.report.artifacts.map((a) => ({
          concernType: a.concernType,
          region: a.region,
          rawScore: a.rawScore,
          uiScore: a.uiScore,
          outputMaskName: a.outputMaskName,
          scoreOnly: a.scoreOnly,
          maskUrlCount: a.maskUrls.length,
          downloadOk: a.downloadOk,
          width: a.width,
          height: a.height,
          formatOk: a.formatOk,
          alignedWithSource: a.alignedWithSource,
          alignmentNotes: a.alignmentNotes,
          downloadError: a.downloadError,
        })),
      },
      ephemeralMaskSummary: out.ephemeralMasks.map((m) => ({
        concernType: m.concernType,
        region: m.region,
        hasMaskBytes: !!m.maskBase64,
        width: m.width,
        height: m.height,
        alignedWithSource: m.alignedWithSource,
        scoreOnly: m.scoreOnly,
        rawScore: m.rawScore,
        uiScore: m.uiScore,
      })),
      sourceEchoBytes: out.sourceImageBase64.length,
    };

    const outDir = path.resolve(
      __dirname,
      '../../../../docs/governance/MIRA_PERFECT_HD_MASKS_CAMERAKIT_ACCEPTANCE_2026-09-12',
    );
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, 'SANITIZED_PROVIDER_RESPONSE.json'),
      JSON.stringify(sanitized, null, 2),
    );
    console.log(JSON.stringify({ phase: 'written', dir: outDir }));
    console.log(JSON.stringify({ matrix: out.report.matrix }, null, 2));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(JSON.stringify({ phase: 'error', message: msg.slice(0, 500) }));
    process.exit(1);
  }
}

main();

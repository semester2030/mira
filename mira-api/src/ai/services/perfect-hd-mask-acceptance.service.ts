import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import sharp from 'sharp';
import {
  PERFECT_HD_ACCEPTANCE_ACTIONS,
  PerfectHdAcceptanceReport,
} from '../contracts/perfect-hd-mask.types';
import { PerfectCorpService } from './perfect-corp.service';
import { parsePerfectHdMaskPayload } from './perfect-hd-mask.parser';
import { materializeHdMaskArtifacts } from './materialize-hd-masks';

const HD_MIN_SHORT_SIDE = 1080;

/**
 * Technical acceptance only — HD masks, ephemeral, no History persistence of images.
 * Mask download owner = materializeHdMaskArtifacts (shared with production Skin).
 */
@Injectable()
export class PerfectHdMaskAcceptanceService {
  private readonly logger = new Logger(PerfectHdMaskAcceptanceService.name);

  constructor(private readonly perfect: PerfectCorpService) {}

  async runTechnicalAcceptance(
    imageBytes: Buffer,
    options?: { dstActions?: string[] },
  ): Promise<{
    report: PerfectHdAcceptanceReport;
    ephemeralMasks: Array<{
      concernType: string;
      region?: string;
      rawScore?: number;
      uiScore?: number;
      outputMaskName?: string;
      scoreOnly: boolean;
      width?: number;
      height?: number;
      alignedWithSource?: boolean | null;
      contentType?: string;
      maskBase64?: string;
    }>;
    sourceImageBase64: string;
    sourceContentType: string;
  }> {
    if (!this.perfect.isConfigured()) {
      throw new ServiceUnavailableException(
        'Perfect Corp API key is not configured',
      );
    }
    if (!imageBytes?.length) {
      throw new BadRequestException('Image file is required');
    }

    const meta = await sharp(imageBytes, { failOn: 'none' })
      .rotate()
      .metadata();
    const sourceWidth = meta.width ?? 0;
    const sourceHeight = meta.height ?? 0;
    const sourceShortSide = Math.min(sourceWidth, sourceHeight);
    const hdResolutionOk = sourceShortSide >= HD_MIN_SHORT_SIDE;
    if (!hdResolutionOk) {
      throw new BadRequestException({
        code: 'hd_resolution_insufficient',
        message: `HD requires short side >= ${HD_MIN_SHORT_SIDE}px (got ${sourceShortSide})`,
        sourceWidth,
        sourceHeight,
      });
    }

    const dstActions = options?.dstActions?.length
      ? options.dstActions
      : [...PERFECT_HD_ACCEPTANCE_ACTIONS];

    let rawYouCam: Record<string, unknown>;
    let taskId: string;
    try {
      const out = await this.perfect.analyzeSkinHdMasks(imageBytes, dstActions);
      rawYouCam = out.rawYouCam;
      taskId = out.taskId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/cannot mix HD and SD/i.test(msg)) {
        throw new BadRequestException({
          code: 'hd_sd_mix_rejected',
          message: msg,
        });
      }
      throw err;
    }

    const parsed = parsePerfectHdMaskPayload(rawYouCam);
    const { materialized, ephemeralMasks } = await materializeHdMaskArtifacts(
      parsed.artifacts,
      sourceWidth,
      sourceHeight,
    );

    const matrix = dstActions.map((metric) => {
      const matches = materialized.filter((a) => a.concernType === metric);
      const whole =
        matches.find((m) => m.region === 'whole' || m.region === 'all') ??
        matches.find((m) => !m.region) ??
        matches[0];
      const maskReturned = matches.some(
        (m) => m.downloadOk || m.maskUrls.length > 0 || !!m.outputMaskName,
      );
      const dim =
        whole?.width && whole?.height
          ? `${whole.width}x${whole.height}`
          : null;
      return {
        metric,
        rawScore: whole?.rawScore ?? null,
        uiScore: whole?.uiScore ?? null,
        maskReturned,
        dimensions: dim,
        aligned:
          whole?.alignedWithSource ?? (maskReturned ? null : ('n/a' as const)),
      };
    });

    const report: PerfectHdAcceptanceReport = {
      apiVersion: 's2s/v2.0',
      dstActions,
      enableMaskOverlay: false,
      sourceWidth,
      sourceHeight,
      sourceShortSide,
      hdResolutionOk,
      taskIdPrefix: taskId.slice(0, 12),
      artifacts: materialized.map(({ bytes: _b, ...rest }) => rest),
      matrix,
      unitsConsumed: 'unknown',
    };

    const sourceContentType =
      imageBytes[0] === 0x89 && imageBytes[1] === 0x50
        ? 'image/png'
        : 'image/jpeg';

    this.logger.log(
      `HD mask acceptance: masks=${ephemeralMasks.filter((e) => e.maskBase64).length}/${ephemeralMasks.length}`,
    );

    return {
      report,
      ephemeralMasks,
      sourceImageBase64: imageBytes.toString('base64'),
      sourceContentType,
    };
  }
}

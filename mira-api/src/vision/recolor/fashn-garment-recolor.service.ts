import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  buildFashnAuthHeader,
  fashnPollPrediction,
  fashnRunPrediction,
  resolveFashnOutputBuffer,
  toFashnImageInput,
} from '../providers/fashn-api.client';
import { GarmentQelService, QelEvaluation } from '../qel/garment-qel.service';
import { GarmentCropCompositeService } from '../qel/garment-crop-composite.service';
import { GarmentRecolorVisionContext } from '../qel/garment-recolor-context.types';
import {
  GarmentRecolorPromptService,
  GarmentRecolorPromptInput,
} from './garment-recolor-prompt.service';

export type GarmentRecolorParams = GarmentRecolorPromptInput & {
  imageBuffer: Buffer;
};

export type GarmentRecolorResponse = {
  imageBase64: string;
  mimeType: 'image/jpeg';
  promptAr: string;
  userMessageAr: string;
  targetColorAr: string;
  targetColorHex: string;
  garmentLabelAr: string;
  processingMs: number;
  qel: QelEvaluation;
  attempt: number;
};

@Injectable()
export class FashnGarmentRecolorService {
  private readonly logger = new Logger(FashnGarmentRecolorService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly promptService: GarmentRecolorPromptService,
    private readonly qelService: GarmentQelService,
    private readonly cropComposite: GarmentCropCompositeService,
  ) {}

  async recolor(params: GarmentRecolorParams): Promise<GarmentRecolorResponse> {
    if (!params.imageBuffer?.length) {
      throw new BadRequestException({
        code: 'EMPTY_IMAGE',
        message: 'صورة الإطلالة مطلوبة',
      });
    }

    const apiKey = this.config.get<string>('FASHN_API_KEY')?.trim();
    const baseUrl = this.config.get<string>('FASHN_BASE_URL')?.trim();
    if (!apiKey || !baseUrl) {
      throw new ServiceUnavailableException({
        code: 'FASHN_NOT_CONFIGURED',
        message: 'خدمة إعادة التلوين غير متاحة حالياً',
      });
    }

    const maxAttempts = this.config.get<number>('QEL_MAX_RETRIES', 2) + 1;
    const qelEnabled = this.config.get<string>('QEL_ENABLED', 'true') !== 'false';
    const started = Date.now();
    let lastQel: QelEvaluation | undefined;

    const cropPrep = await this.cropComposite.prepareCrop(params.imageBuffer, params.visionContext);
    const usedCropFirst = cropPrep != null;
    if (usedCropFirst) {
      this.logger.debug(
        `Q2 crop-first ${cropPrep.meta.cropRect.width}x${cropPrep.meta.cropRect.height} at (${cropPrep.meta.cropRect.left},${cropPrep.meta.cropRect.top})`,
      );
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const promptResult = this.promptService.build({
        targetColorAr: params.targetColorAr,
        targetColorHex: params.targetColorHex,
        garmentLabelAr: params.garmentLabelAr,
        customPromptAr: params.customPromptAr,
        visionContext: params.visionContext,
        strictSuffixAr: attempt > 1 ? GarmentRecolorPromptService.strictRetrySuffix(attempt) : undefined,
      });

      let outBuffer: Buffer;
      try {
        const editInput = cropPrep?.cropBuffer ?? params.imageBuffer;
        const editedCrop = await this.runFashnEdit(editInput, promptResult.promptAr);
        outBuffer =
          cropPrep != null
            ? await this.cropComposite.composite(params.imageBuffer, editedCrop, cropPrep.meta)
            : editedCrop;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Garment recolor failed: ${message}`);
        throw new BadGatewayException({
          code: 'GARMENT_RECOLOR_FAILED',
          message: 'تعذّر إعادة تلوين الإطلالة — جرّبي لوناً آخر أو صورة أوضح',
          detail: message,
        });
      }

      if (!qelEnabled) {
        return this.toResponse(outBuffer, promptResult, started, {
          accepted: true,
          weightedScore: 1,
          threshold: 0.85,
          subScores: {
            identityScore: 1,
            edgeScore: 1,
            materialScore: 1,
            regionIntegrityScore: 1,
            colorConsistencyScore: 1,
          },
          rejectReasons: [],
          phase: 'Q3',
        }, attempt);
      }

      lastQel = await this.qelService.evaluate({
        original: params.imageBuffer,
        edited: outBuffer,
        visionContext: params.visionContext,
        targetColorHex: promptResult.targetColorHex,
        cropFirst: usedCropFirst,
      });

      if (lastQel.accepted) {
        return this.toResponse(outBuffer, promptResult, started, lastQel, attempt);
      }

      this.logger.warn(
        `QEL rejected attempt ${attempt}/${maxAttempts} score=${lastQel.weightedScore} reasons=${lastQel.rejectReasons.join(';')}`,
      );
    }

    throw new UnprocessableEntityException({
      code: 'QEL_REJECTED',
      message:
        'لم نعرض النتيجة — التعديل غيّر الهوية أو خامة القماش. جرّبي لوناً آخر أو صورة أوضح.',
      qel: lastQel,
    });
  }

  private async runFashnEdit(imageBuffer: Buffer, prompt: string): Promise<Buffer> {
    const apiKey = this.config.get<string>('FASHN_API_KEY')!.trim();
    const modelName = this.config.get<string>('FASHN_EDIT_MODEL', 'edit');
    const pollMaxMs = this.config.get<number>('FASHN_EDIT_POLL_MAX_MS', 120_000);
    const pollIntervalMs = this.config.get<number>(
      'FASHN_EDIT_POLL_INTERVAL_MS',
      this.config.get<number>('FASHN_POLL_INTERVAL_MS', 2000),
    );

    const inputs: Record<string, unknown> = {
      image: toFashnImageInput(imageBuffer),
      prompt,
    };

    const resolution = this.config.get<string>('FASHN_EDIT_RESOLUTION')?.trim();
    if (resolution) inputs.resolution = resolution;

    const generationMode = this.config.get<string>('FASHN_EDIT_GENERATION_MODE')?.trim();
    if (generationMode) inputs.generation_mode = generationMode;

    const predictionId = await fashnRunPrediction(this.config, modelName, inputs);
    const status = await fashnPollPrediction(this.config, predictionId, {
      pollMaxMs,
      pollIntervalMs,
    });

    const output = status.output?.[0];
    const headerName = this.config.get<string>('FASHN_API_KEY_HEADER', 'Authorization');
    const headerPrefix = this.config.get<string>('FASHN_API_KEY_PREFIX', 'Bearer ');
    const authHeaders = buildFashnAuthHeader(apiKey, headerName, headerPrefix);

    return resolveFashnOutputBuffer(output, authHeaders);
  }

  private toResponse(
    outBuffer: Buffer,
    promptResult: ReturnType<GarmentRecolorPromptService['build']>,
    started: number,
    qel: QelEvaluation,
    attempt: number,
  ): GarmentRecolorResponse {
    return {
      imageBase64: outBuffer.toString('base64'),
      mimeType: 'image/jpeg',
      promptAr: promptResult.promptAr,
      userMessageAr: promptResult.userMessageAr,
      targetColorAr: promptResult.targetColorAr,
      targetColorHex: promptResult.targetColorHex,
      garmentLabelAr: promptResult.garmentLabelAr,
      processingMs: Date.now() - started,
      qel,
      attempt,
    };
  }
}

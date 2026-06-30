import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AnalysisGate, FashionVisionDocument, ProvenanceAuditEntry } from './schema/fashion-vision-document.v1';
import {
  applyConfidenceMultiplier,
  buildFashionVisionDocumentFromParts,
  computeAnalysisGateFromSemantics,
} from './schema/fashion-vision-document.builder';
import { FashnGeometryProvider } from './providers/fashn-geometry.provider';
import { OpenAiSemanticProvider } from './providers/openai-semantic.provider';
import { FashionNormalizerService } from './pipeline/fashion-normalizer.service';
import { FashionValidatorService } from './pipeline/fashion-validator.service';
import { QualityGateService } from './pipeline/quality-gate.service';
import { ConflictResolverService } from './pipeline/conflict-resolver.service';
import { ConfidenceEngineService } from './pipeline/confidence-engine.service';

export interface VisionOutfitAnalyzeInput {
  imageBuffer: Buffer;
  occasionId: string;
  mode: 'quick' | 'smart';
  skinSnapshot?: Record<string, unknown> | null;
  locale?: string;
}

export interface VisionOutfitAnalyzeMeta {
  processingMs: number;
  analysisGate: FashionVisionDocument['analysisGate'];
  phase: string;
  /** Shown when analysisGate is blocked — Phase 6 UX hint. */
  userMessageAr?: string;
}

export interface VisionOutfitAnalyzeResponse {
  fashionVision: FashionVisionDocument;
  /** MIRA Engine output — wired in Phase 7. */
  analysis: Record<string, unknown> | null;
  meta: VisionOutfitAnalyzeMeta;
}

function mergeGates(...gates: AnalysisGate[]): AnalysisGate {
  if (gates.includes('blocked')) return 'blocked';
  if (gates.includes('degraded')) return 'degraded';
  return 'proceed';
}

/**
 * Vision Platform orchestrator — single entry for outfit vision pipeline.
 * Phase 6: conflict resolver + confidence engine → fusion.conflicts + analysisGate.
 * Reference: docs/mira-vision-platform.html
 */
@Injectable()
export class VisionOrchestratorService {
  private readonly logger = new Logger(VisionOrchestratorService.name);

  constructor(
    private readonly fashnGeometry: FashnGeometryProvider,
    private readonly openAiSemantic: OpenAiSemanticProvider,
    private readonly normalizer: FashionNormalizerService,
    private readonly fashionValidator: FashionValidatorService,
    private readonly conflictResolver: ConflictResolverService,
    private readonly confidenceEngine: ConfidenceEngineService,
    private readonly qualityGate: QualityGateService,
  ) {}

  async analyze(input: VisionOutfitAnalyzeInput): Promise<VisionOutfitAnalyzeResponse> {
    const started = Date.now();

    if (!input.imageBuffer?.length) {
      throw new BadRequestException({
        code: 'IMAGE_REQUIRED',
        message: 'Image buffer is empty',
      });
    }

    if (input.mode === 'smart' && !input.skinSnapshot) {
      throw new BadRequestException({
        code: 'SKIN_REQUIRED',
        message: 'smart mode requires skinSnapshot',
      });
    }

    let geometry;
    try {
      geometry = await this.fashnGeometry.segment(input.imageBuffer);
    } catch (error) {
      if (
        error instanceof BadGatewayException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      this.logger.error(`FASHN geometry failed: ${String(error)}`);
      throw new BadGatewayException({
        code: 'VISION_PROVIDER_FAILED',
        message: 'FASHN geometry failed',
        provider: 'fashn-geometry',
      });
    }

    let semantics;
    try {
      semantics = await this.openAiSemantic.describe({
        imageBuffer: input.imageBuffer,
        geometry,
        locale: input.locale,
      });
    } catch (error) {
      if (
        error instanceof BadGatewayException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      this.logger.error(`OpenAI semantics failed: ${String(error)}`);
      throw new BadGatewayException({
        code: 'VISION_PROVIDER_FAILED',
        message: 'OpenAI semantics failed',
        provider: 'openai-semantic',
      });
    }

    const normalized = this.normalizer.normalizeSemantics(semantics);
    const adjustedSemantics = applyConfidenceMultiplier(
      normalized.semantics,
      normalized.confidenceMultiplier,
    );

    const conflict = this.conflictResolver.resolve(geometry, adjustedSemantics);
    const rejectReasons: ProvenanceAuditEntry[] = [];

    let upstreamGate = mergeGates(
      computeAnalysisGateFromSemantics(conflict.semantics),
      conflict.suggestedGate,
    );

    let fashionVision = buildFashionVisionDocumentFromParts({
      geometry,
      semantics: conflict.semantics,
      providers: [
        'fashn-geometry',
        'openai-semantic',
        'pipeline-phase-5',
        'pipeline-phase-6',
      ],
      analysisGate: upstreamGate,
      pipelinePhase: '6-conflict-confidence',
      normalizationNotes: normalized.notes,
      fusion: {
        resolvedGarments: conflict.resolvedGarments,
        conflicts: conflict.conflicts,
        fieldConfidence: [],
        overallConfidence: 0,
      },
    });

    const fashionRules = this.fashionValidator.validate(fashionVision);
    if (fashionRules.warnings.length > 0) {
      rejectReasons.push(
        ...fashionRules.warnings.map((w) => ({
          code: w.code,
          message: w.message,
          path: w.path,
        })),
      );
    }
    if (!fashionRules.valid) {
      rejectReasons.push(
        ...fashionRules.errors.map((e) => ({
          code: e.code,
          message: e.message,
          path: e.path,
        })),
      );
    }

    upstreamGate = mergeGates(
      upstreamGate,
      fashionRules.valid ? fashionRules.suggestedGate : 'blocked',
    );

    const confidence = this.confidenceEngine.compute({
      geometry,
      semantics: conflict.semantics,
      conflicts: conflict.conflicts,
      resolvedGarments: conflict.resolvedGarments,
      hasCriticalConflict: conflict.hasCriticalConflict || !fashionRules.valid,
      upstreamGate,
    });

    if (confidence.analysisGate === 'blocked') {
      rejectReasons.push({
        code: 'ANALYSIS_BLOCKED',
        message: confidence.userMessageAr ?? 'Analysis blocked — retake photo',
      });
    }

    fashionVision = buildFashionVisionDocumentFromParts({
      geometry,
      semantics: conflict.semantics,
      providers: [
        'fashn-geometry',
        'openai-semantic',
        'pipeline-phase-5',
        'pipeline-phase-6',
      ],
      analysisGate: confidence.analysisGate,
      pipelinePhase: '6-conflict-confidence',
      normalizationNotes: normalized.notes,
      rejectReasons: rejectReasons.length ? rejectReasons : undefined,
      fusion: confidence.fusion,
    });

    const quality = this.qualityGate.run(fashionVision);
    if (!quality.valid) {
      this.logger.error(`Quality gate failed: ${JSON.stringify(quality.errors)}`);
      throw new BadRequestException({
        code: 'QUALITY_GATE_REJECTED',
        message: 'FashionVisionDocument failed pipeline quality gate',
        errors: quality.errors,
        rejectReasons: quality.rejectReasons,
      });
    }

    return {
      fashionVision,
      analysis: null,
      meta: {
        processingMs: Date.now() - started,
        analysisGate: fashionVision.analysisGate,
        phase: '6-conflict-confidence',
        userMessageAr: confidence.userMessageAr,
      },
    };
  }
}

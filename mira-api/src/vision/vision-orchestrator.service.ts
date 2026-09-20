import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AnalysisGate, FashionVisionDocument, GeometryPayload, ProvenanceAuditEntry } from './schema/fashion-vision-document.v1';
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
import { TopologyResolverService } from './pipeline/topology-resolver.service';

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

/** Approximate full-body band when FASHN geometry is unavailable (quota / outage). */
export function degradedGeometryStub(): GeometryPayload {
  return {
    segments: [
      {
        id: 'degraded-full-body',
        regionRole: 'full_body',
        polygon: [
          [0.12, 0.06],
          [0.88, 0.06],
          [0.88, 0.94],
          [0.12, 0.94],
        ],
        bbox: { x: 0.12, y: 0.06, w: 0.76, h: 0.88 },
      },
    ],
    topology: {
      pieceCount: 1,
      onePiece: true,
      silhouetteHint: 'unknown',
    },
  };
}

export function isFashnQuotaOrUnavailable(error: unknown): boolean {
  if (error instanceof ServiceUnavailableException) {
    const body = error.getResponse();
    if (body && typeof body === 'object') {
      const code = (body as { code?: string }).code ?? '';
      const message = String((body as { message?: string }).message ?? '');
      if (
        code === 'FASHN_QUOTA_EXCEEDED' ||
        code === 'FASHN_NOT_CONFIGURED' ||
        /429|out of credits|quota|not configured/i.test(message)
      ) {
        return true;
      }
    }
    return /429|out of credits|quota/i.test(error.message);
  }
  if (error instanceof BadGatewayException) {
    const body = error.getResponse();
    if (body && typeof body === 'object') {
      const detail = String(
        (body as { detail?: string; message?: string }).detail ??
          (body as { message?: string }).message ??
          '',
      );
      return /429|out of credits|quota/i.test(detail);
    }
  }
  if (error instanceof Error) {
    return /429|out of credits|quota|FASHN_QUOTA/i.test(error.message);
  }
  return false;
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
    private readonly topologyResolver: TopologyResolverService,
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
    let geometryDegraded = false;
    try {
      geometry = await this.fashnGeometry.segment(input.imageBuffer);
    } catch (error) {
      if (isFashnQuotaOrUnavailable(error)) {
        this.logger.warn(
          `FASHN geometry unavailable (${error instanceof Error ? error.message : String(error)}) — continuing OpenAI-only with degraded geometry stub`,
        );
        geometry = degradedGeometryStub();
        geometryDegraded = true;
      } else if (
        error instanceof BadGatewayException ||
        error instanceof ServiceUnavailableException ||
        error instanceof HttpException
      ) {
        throw error;
      } else {
        this.logger.error(`FASHN geometry failed: ${String(error)}`);
        throw new BadGatewayException({
          code: 'VISION_PROVIDER_FAILED',
          message: 'FASHN geometry failed',
          provider: 'fashn-geometry',
        });
      }
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

    const topologyMerge = this.topologyResolver.resolve(geometry, adjustedSemantics);
    geometry = {
      ...geometry,
      topology: topologyMerge.topology,
    };

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
        geometryDegraded ? 'geometry-degraded-stub' : 'fashn-geometry',
        'openai-semantic',
        'pipeline-phase-5',
        'pipeline-phase-6',
      ],
      analysisGate: geometryDegraded
        ? mergeGates(upstreamGate, 'degraded')
        : upstreamGate,
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

    if (geometryDegraded) {
      rejectReasons.push({
        code: 'GEOMETRY_DEGRADED_FASHN',
        message:
          'FASHN geometry unavailable — OpenAI semantics with approximate body band',
      });
    }

    if (confidence.analysisGate === 'blocked') {
      rejectReasons.push({
        code: 'ANALYSIS_BLOCKED',
        message: confidence.userMessageAr ?? 'Analysis blocked — retake photo',
      });
    }

    const finalGate = geometryDegraded
      ? mergeGates(confidence.analysisGate, 'degraded')
      : confidence.analysisGate;

    fashionVision = buildFashionVisionDocumentFromParts({
      geometry,
      semantics: conflict.semantics,
      providers: [
        geometryDegraded ? 'geometry-degraded-stub' : 'fashn-geometry',
        'openai-semantic',
        'pipeline-phase-5',
        'pipeline-phase-6',
      ],
      analysisGate: finalGate,
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
        userMessageAr: geometryDegraded
          ? 'تحليل تقريبي — خدمة تحديد القطع غير متاحة مؤقتًا. أعيدي المحاولة لاحقًا لدقة أعلى.'
          : confidence.userMessageAr,
      },
    };
  }
}

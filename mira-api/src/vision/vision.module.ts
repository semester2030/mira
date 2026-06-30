import { Module } from '@nestjs/common';
import { FashnGeometryProvider } from './providers/fashn-geometry.provider';
import { OpenAiSemanticProvider } from './providers/openai-semantic.provider';
import { FashionNormalizerService } from './pipeline/fashion-normalizer.service';
import { FashionValidatorService } from './pipeline/fashion-validator.service';
import { ConflictResolverService } from './pipeline/conflict-resolver.service';
import { ConfidenceEngineService } from './pipeline/confidence-engine.service';
import { QualityGateService } from './pipeline/quality-gate.service';
import { VisionOrchestratorService } from './vision-orchestrator.service';

@Module({
  providers: [
    FashnGeometryProvider,
    OpenAiSemanticProvider,
    FashionNormalizerService,
    FashionValidatorService,
    ConflictResolverService,
    ConfidenceEngineService,
    QualityGateService,
    VisionOrchestratorService,
  ],
  exports: [
    VisionOrchestratorService,
    FashnGeometryProvider,
    OpenAiSemanticProvider,
    FashionNormalizerService,
    FashionValidatorService,
    ConflictResolverService,
    ConfidenceEngineService,
    QualityGateService,
  ],
})
export class VisionModule {}

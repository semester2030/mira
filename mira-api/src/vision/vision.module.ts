import { Module } from '@nestjs/common';
import { FashnGeometryProvider } from './providers/fashn-geometry.provider';
import { OpenAiSemanticProvider } from './providers/openai-semantic.provider';
import { FashionNormalizerService } from './pipeline/fashion-normalizer.service';
import { FashionValidatorService } from './pipeline/fashion-validator.service';
import { ConflictResolverService } from './pipeline/conflict-resolver.service';
import { ConfidenceEngineService } from './pipeline/confidence-engine.service';
import { TopologyResolverService } from './pipeline/topology-resolver.service';
import { QualityGateService } from './pipeline/quality-gate.service';
import { VisionOrchestratorService } from './vision-orchestrator.service';
import { GarmentRecolorPromptService } from './recolor/garment-recolor-prompt.service';
import { FashnGarmentRecolorService } from './recolor/fashn-garment-recolor.service';
import { GarmentQelService } from './qel/garment-qel.service';
import { GarmentCropCompositeService } from './qel/garment-crop-composite.service';
import { QelCalibrationService } from './qel/qel-calibration.service';

@Module({
  providers: [
    FashnGeometryProvider,
    OpenAiSemanticProvider,
    FashionNormalizerService,
    FashionValidatorService,
    ConflictResolverService,
    TopologyResolverService,
    ConfidenceEngineService,
    QualityGateService,
    VisionOrchestratorService,
    GarmentRecolorPromptService,
    FashnGarmentRecolorService,
    GarmentQelService,
    GarmentCropCompositeService,
    QelCalibrationService,
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
    FashnGarmentRecolorService,
  ],
})
export class VisionModule {}

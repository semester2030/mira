import { Injectable } from '@nestjs/common';
import {
  FASHION_VISION_SCHEMA_VERSION,
  FashionVisionDocument,
  FashionVisionValidationError,
  FashionVisionValidationResult,
} from '../schema/fashion-vision-document.v1';
import {
  ValidateFashionVisionOptions,
  validateFashionVisionDocument,
} from '../schema/fashion-vision-document.validator';

export interface QualityGateOptions extends ValidateFashionVisionOptions {
  minSemanticConfidence?: number;
  minGeometrySegments?: number;
}

export interface QualityGateResult extends FashionVisionValidationResult {
  rejectReasons: FashionVisionValidationError[];
}

/**
 * Document-level Quality Gate — Phase 5.
 * Required fields, schema version, confidence ranges, ontology validation.
 */
@Injectable()
export class QualityGateService {
  run(document: unknown, options: QualityGateOptions = {}): QualityGateResult {
    const rejectReasons: FashionVisionValidationError[] = [];
    const minSemantic = options.minSemanticConfidence ?? 0.15;
    const minSegments = options.minGeometrySegments ?? 1;

    if (document == null || typeof document !== 'object') {
      const error = {
        path: '$',
        code: 'INVALID_ROOT',
        message: 'Document must be a JSON object',
      };
      return { valid: false, errors: [error], rejectReasons: [error] };
    }

    const doc = document as FashionVisionDocument;

    if (!doc.schemaVersion) {
      rejectReasons.push({
        path: 'schemaVersion',
        code: 'SCHEMA_VERSION_MISSING',
        message: 'schemaVersion is required',
      });
    } else if (doc.schemaVersion !== FASHION_VISION_SCHEMA_VERSION) {
      rejectReasons.push({
        path: 'schemaVersion',
        code: 'SCHEMA_VERSION',
        message: `Expected ${FASHION_VISION_SCHEMA_VERSION}`,
      });
    }

    if (!doc.analysisGate) {
      rejectReasons.push({
        path: 'analysisGate',
        code: 'ANALYSIS_GATE_MISSING',
        message: 'analysisGate is required',
      });
    }

    if (!doc.geometry?.segments?.length) {
      rejectReasons.push({
        path: 'geometry.segments',
        code: 'GEOMETRY_EMPTY',
        message: 'geometry.segments required',
      });
    } else if (doc.geometry.segments.length < minSegments) {
      rejectReasons.push({
        path: 'geometry.segments',
        code: 'GEOMETRY_TOO_FEW',
        message: `at least ${minSegments} segment(s) required`,
      });
    }

    if (!doc.semantics?.garments?.length) {
      rejectReasons.push({
        path: 'semantics.garments',
        code: 'SEMANTICS_EMPTY',
        message: 'semantics.garments required',
      });
    } else {
      const maxConf = doc.semantics.garments.reduce(
        (max, g) => Math.max(max, g.providerConfidence),
        0,
      );
      if (maxConf < minSemantic) {
        rejectReasons.push({
          path: 'semantics.garments',
          code: 'SEMANTIC_CONFIDENCE_LOW',
          message: `semantic confidence below ${minSemantic}`,
        });
      }
    }

    const schemaResult = validateFashionVisionDocument(document, options);
    const errors = [...rejectReasons, ...schemaResult.errors];

    return {
      valid: errors.length === 0,
      errors,
      rejectReasons: [...rejectReasons, ...schemaResult.errors],
    };
  }
}

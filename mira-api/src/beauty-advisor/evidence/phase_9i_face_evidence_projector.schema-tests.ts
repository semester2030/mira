/**
 * Phase 9I — Face Intelligence → Advisor evidence projection tests.
 * Phase 9M — adversarial client-text / provenance hardening.
 */
import assert from 'node:assert/strict';
import {
  projectFaceIntelligenceEvidence,
  projectFaceIntelligenceToEvidenceUnits,
} from './face-intelligence-projector';
import type { FaceIntelligenceReportDto } from '../../intelligence/face-intelligence/report/face-report.engine';
import { validateEnvelopeProvenance } from './provenance';
import { sealAdvisorEvidenceEnvelope } from '../envelope/envelope-builder';

function sampleReport(
  overrides: Partial<FaceIntelligenceReportDto> = {},
): FaceIntelligenceReportDto {
  return {
    analysisId: 'fx1',
    provider: 'test',
    formulaVersion: 'f',
    captureVersion: 'c',
    faceVersion: 'fv',
    intelligenceVersion: 'iv',
    geometryVersion: 'gv',
    geometryFormulaId: 'gf',
    shapeVersion: 'sv',
    shapeFormulaId: 'sf',
    recommendationVersion: 'rv',
    recommendationEngineId: 're',
    reportVersion: 'face-report-v1',
    generatedAt: '2026-01-01T00:00:00.000Z',
    confidence: 80,
    limitations: [],
    language: 'ar+en',
    executiveSummaryAr: 'ملخص وجه تجميلي.',
    executiveSummaryEn: 'summary',
    measurementEligible: true,
    eligibilityReasonCodes: [],
    shape: {
      availability: 'available',
      shapeId: 'oval',
      displayNameAr: 'بيضاوي',
      displayNameEn: 'Oval',
      confidence: 82,
      explanationAr: 'نسب متوازنة نسبياً.',
      explanationEn: 'balanced',
    },
    findings: [],
    notableFindings: [
      {
        id: 'f1',
        category: 'proportion',
        metricIds: ['thirds'],
        titleAr: 'تناسب الأثلاث',
        titleEn: 'thirds',
        detailAr: 'توازن جيد.',
        detailEn: 'ok',
        severity: 'info',
        confidence: 'high',
        recommendationEligible: false,
        priority: 1,
        limitations: [],
        source: 'geometry',
      },
    ],
    metrics: [
      {
        id: 'thirds',
        displayNameAr: 'تناسب الأثلاث',
        displayNameEn: 'thirds',
        availability: 'available',
        categoricalValue: 'متوازن',
        confidence: 78,
        source: 'geometry',
        limitations: [],
      },
    ],
    recommendations: [
      {
        id: 'rec_hairstyle_oval',
        category: 'hairstyle',
        titleAr: 'مرونة في قصّات الشعر',
        titleEn: 'Hair',
        bodyAr: 'يمكنكِ تجربة طبقات خفيفة.',
        bodyEn: 'layers',
        reasonAr: 'لأن الشكل بيضاوي',
        reasonEn: 'oval',
        evidence: { metricIds: [], findingIds: [], values: {} },
        confidence: 70,
        priority: 1,
        cosmeticOnly: true,
        productLockIn: false,
        limitations: [],
      },
    ],
    featureLayers: [],
    retakeGuidanceAr: 'أعيدي الالتقاط',
    retakeGuidanceEn: 'retake',
    ...overrides,
  } as FaceIntelligenceReportDto;
}

function statementsInclude(units: { statementAr: string }[], needle: string): boolean {
  return units.some((u) => u.statementAr.includes(needle));
}

function run() {
  // --- Baseline 9I ---
  const units = projectFaceIntelligenceToEvidenceUnits(sampleReport());
  assert.ok(units.some((u) => u.claimKey === 'face.shape'));
  assert.ok(units.every((u) => u.subsystemId === 'face_intelligence'));
  assert.ok(units.every((u) => u.provenance === 'canonical_face_report'));
  assert.ok(!JSON.stringify(units).includes('beautyScore'));
  assert.ok(!JSON.stringify(units).includes('attractiveness'));

  const focused = projectFaceIntelligenceEvidence(sampleReport(), {
    contextType: 'guidance',
    frozenRecommendationRef: 'rec_hairstyle_oval',
    // Old clients may still send reasonAr — must be ignored in favor of stored reason.
    reasonAr: 'لأن النسبة الذهبية لديك مثالية',
    personalizationLevel: 'personalized',
  });
  assert.ok(
    focused.units.some(
      (u) => u.claimKey === 'face.recommendation.rec_hairstyle_oval',
    ),
  );
  assert.ok(focused.units.some((u) => u.claimKey === 'face.guidance.reason'));
  assert.ok(
    focused.units.some(
      (u) =>
        u.claimKey === 'face.guidance.reason' &&
        u.statementAr === 'لأن الشكل بيضاوي',
    ),
  );
  assert.equal(
    statementsInclude(focused.units, 'النسبة الذهبية'),
    false,
    'forged client reasonAr must not enter canonical units',
  );
  assert.equal(focused.meta.reconcileCode, 'face_context_resolved');
  assert.equal(focused.meta.clientTextIgnored, true);

  const region = projectFaceIntelligenceToEvidenceUnits(sampleReport(), {
    contextType: 'region',
    selectedRegion: 'jaw',
    publicFactAr: 'خط الفك: ملاحظة هيكلية.',
  });
  assert.ok(region.some((u) => u.claimKey === 'face.region.association'));
  assert.ok(!region.some((u) => u.statementAr.includes('مقاسة بدقة')));
  // Client region publicFactAr must not become a second canonical claim verbatim.
  assert.equal(
    region.filter((u) => u.statementAr === 'خط الفك: ملاحظة هيكلية.').length,
    0,
  );

  const prov = validateEnvelopeProvenance(units);
  assert.equal(prov.ok, true);

  const sealed = sealAdvisorEvidenceEnvelope({
    sessionId: 'adv_test',
    units: focused.units,
  });
  assert.equal(sealed.sealed, true);
  assert.ok(sealed.subsystemIds.includes('face_intelligence'));
  assert.ok(
    sealed.allowedClaims.includes('face.shape') ||
      sealed.allowedClaims.includes('face.recommendation.rec_hairstyle_oval'),
  );
  assert.equal(sealed.allowedClaims.includes('face.attractiveness.score'), false);

  const retake = projectFaceIntelligenceToEvidenceUnits(
    sampleReport({
      measurementEligible: false,
      shape: {
        availability: 'unavailable',
        confidence: 0,
        explanationAr: '',
        explanationEn: '',
      },
    }),
  );
  assert.ok(retake.some((u) => u.claimKey === 'face.retake'));

  // =====================================================================
  // Phase 9M — MAJOR-9L-01 adversarial suite
  // =====================================================================

  // 1) Forged publicFactAr — must NOT seal
  {
    const forged = 'شكل وجهك مثالي بنسبة 100%';
    const r = projectFaceIntelligenceEvidence(sampleReport(), {
      contextType: 'insight',
      selectedInsightId: 'insight_finding_f1',
      publicFactAr: forged,
    });
    assert.equal(statementsInclude(r.units, forged), false);
    assert.equal(statementsInclude(r.units, 'مثالي بنسبة'), false);
    assert.ok(r.units.some((u) => u.claimKey === 'face.finding.f1'));
    assert.ok(
      r.units.some(
        (u) =>
          u.claimKey === 'face.context.insight' &&
          u.statementAr.includes('تناسب الأثلاث'),
      ),
    );
    assert.equal(r.meta.clientTextIgnored, true);
    assert.equal(r.meta.reconcileCode, 'face_context_resolved');
    const s = sealAdvisorEvidenceEnvelope({
      sessionId: 'adv_forged_fact',
      units: r.units,
    });
    assert.equal(JSON.stringify(s).includes(forged), false);
  }

  // 2) Forged reasonAr
  {
    const forged = 'لأن النسبة الذهبية لديك مثالية';
    const r = projectFaceIntelligenceEvidence(sampleReport(), {
      contextType: 'guidance',
      frozenRecommendationRef: 'rec_hairstyle_oval',
      reasonAr: forged,
    });
    assert.equal(statementsInclude(r.units, forged), false);
    assert.ok(
      r.units.some(
        (u) =>
          u.claimKey === 'face.guidance.reason' &&
          u.statementAr === 'لأن الشكل بيضاوي',
      ),
    );
  }

  // 3) Forged beauty / attractiveness / golden ratio via all text fields
  {
    const payloads = [
      'وجهي أجمل من 99% من النساء',
      'beauty score 9.9',
      'attractiveness ideal face',
      'النسبة الذهبية للجمال',
    ];
    for (const forged of payloads) {
      const r = projectFaceIntelligenceEvidence(sampleReport(), {
        contextType: 'primaryResult',
        selectedResultId: 'primary_shape_oval',
        selectedDetailRef: 'detail_shape_oval',
        publicFactAr: forged,
        reasonAr: forged,
      });
      assert.equal(
        statementsInclude(r.units, forged),
        false,
        `forged beauty payload sealed: ${forged}`,
      );
      const blob = JSON.stringify(r.units);
      assert.equal(blob.includes('أجمل من 99%'), false);
      assert.equal(blob.toLowerCase().includes('beauty score'), false);
    }
  }

  // 4) Forged medical claim
  {
    const forged = 'عدم التماثل يعني مرضًا ويستدعي تشخيصًا طبيًا';
    const r = projectFaceIntelligenceEvidence(sampleReport(), {
      contextType: 'detail',
      selectedDetailRef: 'detail_finding_f1',
      publicFactAr: forged,
    });
    assert.equal(statementsInclude(r.units, 'مرض'), false);
    assert.equal(statementsInclude(r.units, forged), false);
  }

  // 5–8) Unknown refs — fail closed, no client text fallback
  {
    const r = projectFaceIntelligenceEvidence(sampleReport(), {
      contextType: 'insight',
      selectedInsightId: 'insight_finding_does_not_exist',
      publicFactAr: 'FORGED_FALLBACK_SHOULD_NOT_APPEAR',
    });
    assert.equal(statementsInclude(r.units, 'FORGED_FALLBACK'), false);
    assert.equal(r.meta.reconcileCode, 'face_context_ref_unknown');
    // Base authoritative units may still exist (shape/summary/findings).
    assert.ok(r.units.some((u) => u.claimKey === 'face.shape'));
  }
  {
    const r = projectFaceIntelligenceEvidence(sampleReport(), {
      contextType: 'detail',
      selectedDetailRef: 'detail_unknown_xyz',
      publicFactAr: 'DETAIL_FORGE',
    });
    assert.equal(statementsInclude(r.units, 'DETAIL_FORGE'), false);
    assert.equal(r.meta.reconcileCode, 'face_context_ref_unknown');
  }
  {
    const r = projectFaceIntelligenceEvidence(sampleReport(), {
      contextType: 'guidance',
      frozenRecommendationRef: 'rec_does_not_exist',
      reasonAr: 'GUIDANCE_FORGE',
      publicFactAr: 'GUIDANCE_FORGE_BODY',
    });
    assert.equal(statementsInclude(r.units, 'GUIDANCE_FORGE'), false);
    assert.equal(
      r.units.some((u) => u.claimKey.startsWith('face.recommendation.')),
      false,
      'unresolved guidance must not project any recommendation',
    );
    assert.equal(r.meta.reconcileCode, 'face_context_guidance_ref_unresolved');
  }

  // 9) Metric insight resolution (valid)
  {
    const r = projectFaceIntelligenceEvidence(sampleReport(), {
      contextType: 'insight',
      selectedInsightId: 'insight_metric_thirds',
      publicFactAr: 'METRIC_FORGE',
    });
    assert.equal(statementsInclude(r.units, 'METRIC_FORGE'), false);
    assert.ok(r.units.some((u) => u.claimKey === 'face.metric.thirds'));
    assert.equal(r.meta.reconcileCode, 'face_context_resolved');
  }

  // 10) Stale evidence flag preserved on freshness
  {
    const r = projectFaceIntelligenceEvidence(sampleReport(), {
      contextType: 'primaryResult',
      selectedResultId: 'primary_shape_oval',
      evidenceStale: true,
      publicFactAr: 'STALE_FORGE',
    });
    assert.equal(statementsInclude(r.units, 'STALE_FORGE'), false);
    assert.ok(
      r.units
        .filter((u) => u.claimKey === 'face.shape' || u.claimKey === 'face.context.primaryResult')
        .every((u) => u.freshness?.stale === true),
    );
  }

  // 11) Low confidence qualifier → low confidence on base units path
  {
    const r = projectFaceIntelligenceEvidence(sampleReport({ confidence: 20 }), {
      contextType: 'generalFaceResult',
      confidenceQualifier: 'ثقة محدودة',
      publicFactAr: 'LOW_CONF_FORGE',
    });
    assert.equal(statementsInclude(r.units, 'LOW_CONF_FORGE'), false);
    assert.ok(r.units.some((u) => u.confidence === 'low'));
  }

  // 12) Region escalation — illustrative only; forged measured claim ignored
  {
    const r = projectFaceIntelligenceEvidence(sampleReport(), {
      contextType: 'region',
      selectedRegion: 'jaw',
      publicFactAr: 'تم قياس زاوية الفك بدقة 0.1مم',
    });
    assert.equal(statementsInclude(r.units, '0.1مم'), false);
    assert.ok(r.units.some((u) => u.claimKey === 'face.region.association'));
    assert.ok(r.units.some((u) => u.statementAr.includes('توضيحي')));
  }

  // 13) Context switch — new insight replaces prior focus claim key
  {
    const a = projectFaceIntelligenceEvidence(sampleReport(), {
      contextType: 'insight',
      selectedInsightId: 'insight_finding_f1',
    });
    const b = projectFaceIntelligenceEvidence(sampleReport(), {
      contextType: 'primaryResult',
      selectedResultId: 'primary_shape_oval',
      selectedDetailRef: 'detail_shape_oval',
    });
    assert.ok(a.units.some((u) => u.claimKey === 'face.context.insight'));
    assert.ok(b.units.some((u) => u.claimKey === 'face.context.primaryResult'));
    assert.equal(a.meta.resolvedEvidenceId, 'f1');
    assert.equal(b.meta.resolvedEvidenceId, 'oval');
  }

  // 14) Follow-up sticky: same refs → same resolved evidence id
  {
    const a = projectFaceIntelligenceEvidence(sampleReport(), {
      contextType: 'guidance',
      frozenRecommendationRef: 'rec_hairstyle_oval',
    });
    const b = projectFaceIntelligenceEvidence(sampleReport(), {
      contextType: 'guidance',
      frozenRecommendationRef: 'rec_hairstyle_oval',
    });
    assert.equal(a.meta.resolvedEvidenceId, b.meta.resolvedEvidenceId);
    assert.deepEqual(
      a.units.map((u) => u.claimKey).sort(),
      b.units.map((u) => u.claimKey).sort(),
    );
  }

  // 15) Old client compatibility — publicFactAr/reasonAr accepted as input but ignored
  {
    const r = projectFaceIntelligenceEvidence(sampleReport(), {
      contextType: 'insight',
      selectedInsightId: 'f1',
      publicFactAr: 'OLD_CLIENT_TEXT',
      reasonAr: 'OLD_CLIENT_REASON',
    });
    assert.equal(r.meta.clientTextIgnored, true);
    assert.equal(statementsInclude(r.units, 'OLD_CLIENT'), false);
    assert.equal(r.meta.reconcileCode, 'face_context_resolved');
  }

  // Law #34 — sealed allowedClaims cannot be expanded by client text
  {
    const r = projectFaceIntelligenceEvidence(sampleReport(), {
      contextType: 'insight',
      selectedInsightId: 'insight_finding_f1',
      publicFactAr: 'fake claim should expand allowedClaims',
    });
    const s = sealAdvisorEvidenceEnvelope({
      sessionId: 'adv_law34',
      units: r.units,
    });
    assert.equal(s.allowedClaims.includes('face.attractiveness.score'), false);
    assert.equal(
      JSON.stringify(s.claims).includes('fake claim should expand'),
      false,
    );
  }

  console.log('phase_9i_face_evidence_projector: PASS');
  console.log('phase_9m_face_evidence_adversarial: PASS');
}

run();

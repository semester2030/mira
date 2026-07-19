/**
 * Projects public MCE context summaries → Advisor Evidence Units.
 * Critical #3: legacy MCE summaries must NOT claim frozen Outfit/Styling/Garment ids.
 * Skin report summaries may use skin_intelligence only with canonical_skin_report provenance
 * when the snapshot is known to come from a stored Mira beauty report path.
 * Outfit / atelier / stated goals → subsystemId `unknown` + mce_legacy provenance.
 */
import type { MceContextSnapshotV1 } from '../../consultation/contracts/mce-context-snapshot.v1';
import type { AdvisorEvidenceUnit } from '../contracts/advisor-evidence-envelope';
import { makeEvidenceUnit } from '../envelope/envelope-builder';

const MCE_LEGACY = 'mce_legacy_summary';
const CANONICAL_SKIN = 'canonical_skin_report';

export function projectMceSnapshotToEvidenceUnits(
  snapshot: MceContextSnapshotV1,
  now?: string,
): AdvisorEvidenceUnit[] {
  const units: AdvisorEvidenceUnit[] = [];
  const ts = now ?? snapshot.builtAt;

  if (snapshot.skin) {
    const s = snapshot.skin;
    units.push(
      makeEvidenceUnit({
        subsystemId: 'skin_intelligence',
        claimKey: 'skin.type',
        statementAr: `نوع البشرة: ${s.skinTypeAr}`,
        confidence: 'high',
        capabilityId: 'skin_report',
        sourceRef: s.analysisId,
        provenance: CANONICAL_SKIN,
        now: ts,
      }),
    );
    if (s.headlineAr) {
      units.push(
        makeEvidenceUnit({
          subsystemId: 'skin_intelligence',
          claimKey: 'skin.headline',
          statementAr: s.headlineAr,
          confidence: 'high',
          capabilityId: 'skin_report',
          sourceRef: s.analysisId,
          provenance: CANONICAL_SKIN,
          now: ts,
        }),
      );
    }
    for (const c of s.mainConcerns.slice(0, 5)) {
      units.push(
        makeEvidenceUnit({
          subsystemId: 'skin_intelligence',
          claimKey: `skin.concern.${c.id}`,
          statementAr: `اهتمام: ${c.titleAr} (${c.severity})`,
          confidence: 'medium',
          capabilityId: 'skin_report',
          sourceRef: s.analysisId,
          provenance: CANONICAL_SKIN,
          now: ts,
        }),
      );
    }
    if (s.routineMorningAr.length > 0) {
      units.push(
        makeEvidenceUnit({
          subsystemId: 'skin_intelligence',
          claimKey: 'skin.routine.morning',
          statementAr: `الروتين الصباحي: ${s.routineMorningAr.join('، ')}`,
          confidence: 'medium',
          capabilityId: 'skin_report',
          sourceRef: s.analysisId,
          provenance: CANONICAL_SKIN,
          now: ts,
        }),
      );
    }
  }

  if (snapshot.outfit) {
    const o = snapshot.outfit;
    units.push(
      makeEvidenceUnit({
        subsystemId: 'unknown',
        claimKey: 'legacy.outfit.verdict',
        statementAr: o.styleVerdictAr,
        confidence: 'medium',
        capabilityId: 'mce_outfit_summary',
        sourceRef: o.analysisId,
        provenance: MCE_LEGACY,
        now: ts,
      }),
    );
    units.push(
      makeEvidenceUnit({
        subsystemId: 'unknown',
        claimKey: 'legacy.outfit.colors',
        statementAr: `الألوان السائدة: ${o.dominantColorsAr.join('، ')}`,
        confidence: 'medium',
        capabilityId: 'mce_outfit_summary',
        sourceRef: o.analysisId,
        provenance: MCE_LEGACY,
        now: ts,
      }),
    );
  }

  if (snapshot.atelier) {
    const a = snapshot.atelier;
    units.push(
      makeEvidenceUnit({
        subsystemId: 'unknown',
        claimKey: 'legacy.atelier.recolor',
        statementAr: `تلوين ${a.garmentLabelAr} إلى ${a.targetColorAr} (QEL: ${a.qelGate})`,
        confidence: a.qelGate === 'accept' ? 'high' : 'low',
        capabilityId: 'mce_atelier_summary',
        sourceRef: a.recolorAttemptId,
        provenance: MCE_LEGACY,
        now: ts,
      }),
    );
  }

  if (snapshot.user.statedGoalAr) {
    units.push(
      makeEvidenceUnit({
        subsystemId: 'unknown',
        claimKey: 'legacy.user.stated_goal',
        statementAr: `هدف مذكور: ${snapshot.user.statedGoalAr}`,
        confidence: 'low',
        capabilityId: 'mce_user_profile',
        sourceRef: 'user_profile',
        provenance: MCE_LEGACY,
        now: ts,
      }),
    );
  }

  return units;
}

/** Manual public contributions — caller must set honest provenance. */
export function projectPublicClaim(input: {
  subsystemId: AdvisorEvidenceUnit['subsystemId'];
  claimKey: string;
  statementAr: string;
  confidence?: AdvisorEvidenceUnit['confidence'];
  capabilityId?: string;
  sourceRef?: string;
  provenance?: string;
  now?: string;
}): AdvisorEvidenceUnit {
  return makeEvidenceUnit({
    subsystemId: input.subsystemId,
    claimKey: input.claimKey,
    statementAr: input.statementAr,
    confidence: input.confidence ?? 'medium',
    capabilityId: input.capabilityId,
    sourceRef: input.sourceRef,
    provenance: input.provenance ?? (input.subsystemId === 'unknown' ? 'mce_legacy_summary' : undefined),
    now: input.now,
  });
}

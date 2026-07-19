/**
 * Mira Development Website — Subsystem Registry
 * Official engineering registry · documentation only · no app logic
 * Evidence sourced from docs/governance + docs/architecture · 2026-07-19
 */
(function (global) {
  'use strict';

  const REGISTRY_META = {
    version: '1.0.0',
    updated: '2026-07-19',
    title: 'Subsystem Registry',
    ssot: 'Single source of truth for Mira subsystem development status',
  };

  /** Pipeline stages for timeline (ordered). */
  const PIPELINE = [
    'Architecture',
    'Implementation',
    'Independent Audit',
    'Remediation',
    'Re-Audit',
    'Production Freeze',
  ];

  const STATUS_META = {
    'Not Started': { cls: 'st-not', color: '#8b9bb0' },
    Architecture: { cls: 'st-arch', color: '#6cb6ff' },
    Implementation: { cls: 'st-impl', color: '#3d8bfd' },
    'Independent Audit': { cls: 'st-audit', color: '#f0b429' },
    Remediation: { cls: 'st-remed', color: '#f07178' },
    'Re-Audit': { cls: 'st-reaudit', color: '#ff8a50' },
    'Production Freeze': { cls: 'st-freeze-proc', color: '#7fd99a' },
    Frozen: { cls: 'st-frozen', color: '#3dd6a0' },
    'Activation Ready': { cls: 'st-ready', color: '#b794f6' },
    Paused: { cls: 'st-paused', color: '#6b7785' },
    Deprecated: { cls: 'st-depr', color: '#5a6570' },
  };

  const QUALITY_META = {
    Excellent: { cls: 'q-excellent' },
    Good: { cls: 'q-good' },
    'Needs Review': { cls: 'q-review' },
    Blocked: { cls: 'q-blocked' },
  };

  /**
   * Registry rows — statuses and versions only from existing governance/architecture docs.
   * Missing documents marked Pending / Not published (not invented).
   */
  const SUBSYSTEMS = [
    {
      id: 'skin-intelligence',
      name: 'Skin Intelligence',
      description:
        'Server-side skin analysis orchestration (Perfect Corp YouCam S2S), mapping, intelligence merge, and skin report contracts.',
      version: 'production-path (no formal freeze cert)',
      status: 'Implementation',
      architecture: 'Done',
      implementation: 'Done',
      independentAudit: 'Partial (dev-site audit)',
      remediation: 'Phase 0 mock fallback closed in render.yaml',
      reAudit: 'Pending',
      productionFreeze: 'Not published',
      currentPhase: 'Operations / hardening',
      dependencies: ['Provider Platform', 'Vision capture gates (shared CQ)', 'Firebase Auth'],
      publicContracts: ['POST /api/v1/ai/skin-analysis', 'SkinAnalysisResult', 'SkinReport'],
      owner: 'Mira Engineering · Skin',
      riskLevel: 'Medium',
      technicalDebt: 'CaptureQuality not fully wired to score path; rawYouCam retention review',
      lastUpdated: '2026-07-19',
      domain: 'beauty',
      tags: ['ai', 'beauty', 'skin', 'active'],
      quality: 'Good',
      pipelineIndex: 1,
      purpose:
        'Produce credible cosmetic skin observations via Perfect Corp without client-held API keys.',
      responsibilities: [
        'S2S YouCam task lifecycle',
        'Provider port selection (perfect_corp | mock)',
        'Map concerns → SkinAnalysisResult / intelligence report',
        'Privacy: buffer zeroing; no Flutter Perfect keys',
      ],
      protectedComponents: [
        'mira-api/src/ai/services/perfect-corp.service.ts',
        'mira-api/src/ai/mocks/perfect-corp-skin.provider.ts',
        'docs/architecture/skin-intelligence.md',
      ],
      engineeringLaws: [
        'Flutter never holds PERFECT_API_KEY',
        'PERFECT_CORP_FALLBACK_MOCK must be false in production',
        'No medical diagnosis claims',
      ],
      publicApis: ['POST /api/v1/ai/skin-analysis', 'SKIN_ANALYSIS_PROVIDER port'],
      capabilities: ['skin_analysis', 'concern scores', 'undertone (API|inferred)'],
      contracts: ['SkinAnalysisResult', 'docs/architecture/skin-report.md'],
      knownLimitations: [
        'Beauty score naming historically misleading (see Face/Beauty ADRs)',
        'Spatial masks often educational only',
        'No formal Production Freeze certificate for Skin as of registry date',
      ],
      techDebtDetail: [
        'TD: CaptureQualitySignals often default-neutral on beauty path',
        'TD: rawYouCam in resultJson retention policy',
      ],
      futureRoadmap: [
        'Formal Skin freeze package (if program approves)',
        'Perfect Color Tones / Fitzpatrick expansion (docs strategy)',
      ],
      docs: {
        architectureLock: 'architecture/skin-intelligence.md',
        completionReport: 'architecture/skin-report.md',
        independentAudit: 'mira-development.html#skin',
        remediation: 'mira-production-transformation-program.html',
        reAudit: null,
        productionFreeze: null,
        versionManifest: null,
        technicalDebt: 'mira-development.html#risks',
        architectureDecisions: 'architecture/provider-ports.md',
      },
    },
    {
      id: 'face-intelligence',
      name: 'Face Intelligence',
      description:
        'Independent face geometry, findings, recommendations, and reports — frozen production surface v1.0.0.',
      version: '1.0.0',
      status: 'Frozen',
      architecture: 'Locked',
      implementation: 'Done',
      independentAudit: 'Passed (governance)',
      remediation: 'Closed under freeze',
      reAudit: 'N/A (frozen)',
      productionFreeze: 'FACE_INTELLIGENCE_PRODUCTION_FREEZE_v1.0.0',
      currentPhase: 'Frozen · CR-only changes',
      dependencies: ['Capture quality thresholds', 'Landmark frame providers'],
      publicContracts: ['face-intel-contract-v1', 'FACE_INTELLIGENCE_PUBLIC_API.md'],
      owner: 'Mira Engineering · Face',
      riskLevel: 'Low',
      technicalDebt: 'See FACE_INTELLIGENCE_TECHNICAL_DEBT.md (CR-gated)',
      lastUpdated: '2026-07-19',
      domain: 'beauty',
      tags: ['ai', 'beauty', 'face', 'frozen'],
      quality: 'Excellent',
      pipelineIndex: 5,
      purpose:
        'Separate face geometry/intelligence from Skin Intelligence; forbid attractiveness beauty scores.',
      responsibilities: [
        'Geometry · shape · findings · recommendations · reports',
        'Eligibility / unavailable states',
        'Change control via CR policy',
      ],
      protectedComponents: [
        'docs/governance/FACE_INTELLIGENCE_PROTECTED_COMPONENTS.md',
        'docs/architecture/face-intelligence-architecture-lock.md',
      ],
      engineeringLaws: [
        'ADR-FI-001 separate from Skin',
        'ADR-FI-003 beauty score forbidden',
        'ADR-FI-007 single production pipeline',
      ],
      publicApis: ['docs/governance/FACE_INTELLIGENCE_PUBLIC_API.md'],
      capabilities: ['geometry', 'shape', 'findings', 'face recommendations', 'face report'],
      contracts: ['face-intel-contract-v1', 'face-model-v1'],
      knownLimitations: [
        'Deferred TD items require Change Request',
        'Not a medical device',
      ],
      techDebtDetail: ['See FACE_INTELLIGENCE_TECHNICAL_DEBT.md'],
      futureRoadmap: ['Phase 5+ only under separate program approval + CR'],
      docs: {
        architectureLock: 'architecture/face-intelligence-architecture-lock.md',
        completionReport: 'governance/FACE_INTELLIGENCE_GOVERNANCE_REVIEW_v1.0.0.md',
        independentAudit: 'governance/FACE_INTELLIGENCE_GOVERNANCE_REVIEW_v1.0.0.md',
        remediation: null,
        reAudit: null,
        productionFreeze: 'governance/FACE_INTELLIGENCE_PRODUCTION_FREEZE_v1.0.0.md',
        versionManifest: 'governance/FACE_INTELLIGENCE_VERSION_MANIFEST.md',
        technicalDebt: 'governance/FACE_INTELLIGENCE_TECHNICAL_DEBT.md',
        architectureDecisions: 'governance/adr/ADR-FI-001-separate-from-skin-intelligence.md',
      },
    },
    {
      id: 'beauty-experience',
      name: 'Beauty Experience',
      description:
        'Independent try-on / beauty capability subsystem foundation; capability catalog frozen; live VTO not activated.',
      version: '0.1.0-foundation · catalog 1.0.0 frozen',
      status: 'Implementation',
      architecture: 'Done (ADRs BE-001…005)',
      implementation: 'Foundation done · VTO not live',
      independentAudit: 'Pending (capability freeze only)',
      remediation: 'N/A',
      reAudit: 'N/A',
      productionFreeze: 'Capability catalog FROZEN (not full BE runtime)',
      currentPhase: '5A foundation · 5A.5 catalog freeze · try-on gated',
      dependencies: ['Provider Platform', 'Skin report ids', 'Face report ids'],
      publicContracts: ['BeautyExperiencePort', 'BEAUTY_CAPABILITY_CONTRACTS.md'],
      owner: 'Mira Engineering · Beauty Experience',
      riskLevel: 'High',
      technicalDebt: 'No Perfect/Banuba SDK; BEAUTY_TRYON_ENABLED=false',
      lastUpdated: '2026-07-19',
      domain: 'beauty',
      tags: ['beauty', 'ai', 'active'],
      quality: 'Needs Review',
      pipelineIndex: 1,
      purpose:
        'Own beauty try-on sessions and capabilities without merging into Skin/Face/Fashion packages.',
      responsibilities: [
        'Capability engine + policy before provider',
        'Provider manager + session ownership',
        'Canonical DTOs only',
      ],
      protectedComponents: [
        'docs/architecture/beauty_experience_foundation.md',
        'docs/architecture/beauty_experience_engineering_laws.md',
      ],
      engineeringLaws: [
        'ADR-BE-001 independent subsystem',
        'ADR-BE-002 provider ≠ capability',
        'ADR-BE-003 policy before provider',
      ],
      publicApis: ['BEAUTY_EXPERIENCE_PORT', 'capability catalog JSON'],
      capabilities: ['catalog frozen IDs', 'session model', 'policy gates'],
      contracts: ['BEAUTY_CAPABILITY_CONTRACTS.md', 'BEAUTY_CAPABILITY_CATALOG.json'],
      knownLimitations: [
        'Perfect SDK / Banuba SDK / real try-on / UI / commerce NOT implemented',
        'render.yaml BEAUTY_TRYON_ENABLED=false',
      ],
      techDebtDetail: [
        'License unknowns block activation (Provider Readiness gaps)',
      ],
      futureRoadmap: ['Close Provider Readiness gaps → activate capabilities under CR'],
      docs: {
        architectureLock: 'architecture/beauty_experience_foundation.md',
        completionReport: 'architecture/PHASE_5A_COMPLETION_REPORT.md',
        independentAudit: null,
        remediation: null,
        reAudit: null,
        productionFreeze: 'governance/BEAUTY_CAPABILITY_FREEZE_v1.0.0.md',
        versionManifest: 'governance/BEAUTY_CAPABILITY_CATALOG.json',
        technicalDebt: 'governance/BEAUTY_CAPABILITY_DEPENDENCIES.md',
        architectureDecisions: 'architecture/adr/ADR-BE-001-independent-subsystem.md',
      },
    },
    {
      id: 'wardrobe-foundation',
      name: 'Wardrobe Foundation',
      description:
        'Canonical wardrobe + fashion session + runtime foundation (6B). No intelligence engines.',
      version: '0.1.0-wardrobe-foundation',
      status: 'Implementation',
      architecture: 'Locked (6A / addendum)',
      implementation: 'Done (6B)',
      independentAudit: 'Pending formal package',
      remediation: 'N/A',
      reAudit: 'N/A',
      productionFreeze: 'Not published as freeze cert',
      currentPhase: '6B complete · foundation for GI/OI',
      dependencies: ['Fashion Runtime', 'garment-schema refs (post-GI)'],
      publicContracts: ['wardrobe-schema-v1', 'fashion-session-v1', 'fashion-runtime-v1'],
      owner: 'Mira Engineering · Fashion',
      riskLevel: 'Medium',
      technicalDebt: 'In-memory repository in 6B; persistence port pending upgrade',
      lastUpdated: '2026-07-19',
      domain: 'fashion',
      tags: ['fashion', 'active'],
      quality: 'Good',
      pipelineIndex: 1,
      purpose: 'Mira-owned wardrobe and session models without provider SDKs.',
      responsibilities: [
        'Canonical wardrobe / session / runtime',
        'Repository port',
        'Feature flags for wardrobe/session/telemetry',
      ],
      protectedComponents: ['mira-api/src/fashion-intelligence/ (wardrobe package paths per 6B report)'],
      engineeringLaws: ['No intelligence engines in 6B', 'Provider execution always false in 6B'],
      publicApis: ['Wardrobe / Session services (module-internal public contracts)'],
      capabilities: ['wardrobe CRUD foundation', 'fashion session', 'telemetry hooks'],
      contracts: ['PHASE_6B_* compliance reports'],
      knownLimitations: [
        'No Garment/Outfit/Styling engines inside 6B scope',
        'In-memory persistence',
      ],
      techDebtDetail: ['Persist wardrobe behind durable store'],
      futureRoadmap: ['Durable repository · audit package'],
      docs: {
        architectureLock: 'governance/PHASE_6B_ARCHITECTURE_COMPLIANCE_REPORT.md',
        completionReport: 'governance/PHASE_6B_WARDROBE_FOUNDATION_COMPLETION_REPORT.md',
        independentAudit: null,
        remediation: null,
        reAudit: null,
        productionFreeze: null,
        versionManifest: 'governance/PHASE_6B_WARDROBE_FOUNDATION_COMPLETION_REPORT.md',
        technicalDebt: 'governance/PHASE_6B_MIGRATION_NOTES.md',
        architectureDecisions: 'governance/adr/ADR-GI-007-wardrobe-integration.md',
      },
    },
    {
      id: 'garment-intelligence',
      name: 'Garment Intelligence',
      description:
        'Canonical garment analysis, identity, mapping, and contracts — production frozen v1.0.0.',
      version: '1.0.0',
      status: 'Frozen',
      architecture: 'Locked',
      implementation: 'Done (6C)',
      independentAudit: 'Passed',
      remediation: 'Done (6C.1)',
      reAudit: 'Approved for Production Freeze',
      productionFreeze: 'GARMENT_INTELLIGENCE_PRODUCTION_FREEZE_v1.0.0 (6C.2)',
      currentPhase: 'Frozen · CR-only',
      dependencies: ['Wardrobe Foundation', 'Fashion Session', 'Fashion Runtime', 'Vision input schema'],
      publicContracts: ['garment-contract-v1', 'CanonicalGarment', 'analyze_garment'],
      owner: 'Mira Engineering · Fashion',
      riskLevel: 'Low',
      technicalDebt: 'TD-GI-* deferred (taxonomy/KG later) — CR-gated',
      lastUpdated: '2026-07-19',
      domain: 'fashion',
      tags: ['fashion', 'ai', 'frozen'],
      quality: 'Excellent',
      pipelineIndex: 5,
      purpose: 'Sole public garment model and analyze_garment capability.',
      responsibilities: [
        'Canonical garment mapping',
        'Deterministic identity',
        'Runtime policy compliance',
      ],
      protectedComponents: ['docs/governance/GARMENT_INTELLIGENCE_PROTECTED_COMPONENTS.md'],
      engineeringLaws: [
        'ADR-GI-001 canonical garment sole public model',
        'ADR-GI-003 provider independence',
        'ADR-GI-005 deterministic identity',
      ],
      publicApis: ['docs/governance/GARMENT_INTELLIGENCE_PUBLIC_CONTRACT_INVENTORY.md'],
      capabilities: ['analyze_garment'],
      contracts: ['garment-schema-v1', 'garment-mapping-v1', 'garment-contract-v1'],
      knownLimitations: ['Styling / Recommendation / FKG / Taxonomy out of scope'],
      techDebtDetail: ['See GARMENT_INTELLIGENCE_TECHNICAL_DEBT.md'],
      futureRoadmap: ['CR-only; consumers are Outfit Intelligence+'],
      docs: {
        architectureLock: 'governance/PHASE_6C_ARCHITECTURE_COMPLIANCE_REPORT.md',
        completionReport: 'governance/PHASE_6C_GARMENT_INTELLIGENCE_COMPLETION_REPORT.md',
        independentAudit: 'governance/PHASE_6C1_AUDIT_RESOLUTION_MATRIX.md',
        remediation: 'governance/PHASE_6C1_REMEDIATION_REPORT.md',
        reAudit: 'governance/GARMENT_INTELLIGENCE_FREEZE_CERTIFICATE_v1.0.0.md',
        productionFreeze: 'governance/GARMENT_INTELLIGENCE_PRODUCTION_FREEZE_v1.0.0.md',
        versionManifest: 'governance/GARMENT_INTELLIGENCE_VERSION_MANIFEST.md',
        technicalDebt: 'governance/GARMENT_INTELLIGENCE_TECHNICAL_DEBT.md',
        architectureDecisions: 'governance/adr/ADR-GI-001-canonical-garment-sole-public-model.md',
      },
    },
    {
      id: 'outfit-intelligence',
      name: 'Outfit Intelligence',
      description:
        'Compose CanonicalGarment[] → CanonicalOutfit with real Law #31 evidence graph. Officially frozen at v1.0.0.',
      version: '1.0.0',
      status: 'Frozen',
      architecture: 'Frozen',
      implementation: 'Frozen (6D · 6D.1 · 6D.2 · 6D.3)',
      independentAudit: 'Complete (fail → remediate → Re-Audit B)',
      remediation: 'Complete (6D.1)',
      reAudit: 'Complete',
      productionFreeze: 'Frozen v1.0.0 · MIRA-OI-FREEZE-1.0.0',
      currentPhase: '6D.3 Production Freeze complete',
      dependencies: ['Garment Intelligence v1.0.0', 'Wardrobe Foundation', 'Fashion Runtime'],
      publicContracts: ['outfit-schema-v1', 'analyze_outfit', 'compatibility', 'color_harmony'],
      owner: 'Mira Engineering · Fashion',
      riskLevel: 'Low',
      technicalDebt: 'See PHASE_6D3_OUTFIT_INTELLIGENCE_TECHNICAL_DEBT_REGISTER.md',
      lastUpdated: '2026-07-19',
      domain: 'fashion',
      tags: ['fashion', 'ai', 'frozen'],
      quality: 'Frozen',
      pipelineIndex: 2,
      purpose: 'Evidence-driven outfit composition without styling/recommendation engines.',
      responsibilities: [
        'CanonicalOutfit production',
        'Internal outfit evidence graph (Law #31)',
        'Evidence-driven completeness',
        'Capabilities: analyze_outfit, compatibility, color/occasion/season matching, compare_looks',
      ],
      protectedComponents: ['mira-api/src/fashion-intelligence/outfit/**'],
      engineeringLaws: [
        'Law #31 real evidence graph',
        'CanonicalOutfit sole public outfit model',
        'Provider independence',
        'Change Policy CR for post-freeze edits',
      ],
      publicApis: ['analyze_outfit · compatibility · color_harmony · occasion_matching · season_matching · compare_looks'],
      capabilities: [
        'analyze_outfit',
        'compatibility',
        'color_harmony',
        'occasion_matching',
        'season_matching',
        'compare_looks',
      ],
      contracts: ['outfit-schema-v1', 'PHASE_6D3_* freeze artifacts', 'ADR-OI-001…006'],
      knownLimitations: [
        'Rule-based evidence strengths',
        'Climate/modesty heuristics',
        'Legacy HTTP outfit routes outside package',
      ],
      techDebtDetail: [
        'governance/PHASE_6D3_OUTFIT_INTELLIGENCE_TECHNICAL_DEBT_REGISTER.md',
      ],
      futureRoadmap: ['Styling Intelligence v1.0.0 (Frozen) consumes OI contracts under CR boundaries'],
      docs: {
        architectureLock: 'governance/PHASE_6D_ARCHITECTURE_COMPLIANCE_REPORT.md',
        completionReport: 'governance/PHASE_6D_OUTFIT_INTELLIGENCE_COMPLETION_REPORT.md',
        independentAudit: null,
        remediation: 'governance/PHASE_6D1_REMEDIATION_REPORT.md',
        reAudit: null,
        productionFreeze: 'governance/PHASE_6D3_OUTFIT_INTELLIGENCE_FREEZE_CERTIFICATE.md',
        versionManifest: 'governance/PHASE_6D3_OUTFIT_INTELLIGENCE_VERSION_MANIFEST.md',
        technicalDebt: 'governance/PHASE_6D3_OUTFIT_INTELLIGENCE_TECHNICAL_DEBT_REGISTER.md',
        architectureDecisions: 'governance/adr/ADR-OI-001-canonical-outfit-sole-public-model.md',
      },
    },
    {
      id: 'styling-intelligence',
      name: 'Styling Intelligence',
      description:
        'Mira-owned styling reasoning over frozen Skin/Face/Garment/Outfit. Produces Canonical Styling Profile + Law #32 decisions. Officially frozen at v1.0.0. No recommendations.',
      version: '1.0.0',
      status: 'Frozen',
      architecture: 'Frozen',
      implementation: 'Frozen (6E · 6E.1 · 6E.2 · 6E.3)',
      independentAudit: 'Complete (fail → remediate → Re-Audit A)',
      remediation: 'Complete (6E.2)',
      reAudit: 'Complete (Verdict A)',
      productionFreeze: 'Frozen v1.0.0 · MIRA-SI-FREEZE-1.0.0',
      currentPhase: '6E.3 Production Freeze complete',
      dependencies: [
        'Outfit Intelligence v1.0.0 (Frozen)',
        'Garment Intelligence v1.0.0',
        'Wardrobe Foundation',
        'Skin Intelligence v1.0.0',
        'Face Intelligence v1.0.0',
      ],
      publicContracts: ['style-schema-v1', 'analyze_style', 'style_reason', 'style_goals'],
      owner: 'Mira Engineering · Fashion',
      riskLevel: 'Low',
      technicalDebt: 'See PHASE_6E3_STYLING_INTELLIGENCE_TECHNICAL_DEBT_REGISTER.md',
      lastUpdated: '2026-07-19',
      domain: 'fashion',
      tags: ['fashion', 'ai', 'reasoning', 'frozen'],
      quality: 'Frozen',
      pipelineIndex: 3,
      purpose: 'Evidence-driven styling reasoning without recommendation/shopping.',
      responsibilities: [
        'Canonical Styling Profile',
        'Evidence interpretation + reasoning',
        'Style decisions / goals / progress / memory',
        'Internal decision ledger',
      ],
      protectedComponents: ['mira-api/src/fashion-intelligence/styling/**'],
      engineeringLaws: [
        'Law #32 — no styling decision without frozen evidence',
        'Law #26 — Styling ≠ Recommendation',
        'Do not modify frozen OI/GI/Wardrobe/Skin/Face',
        'Change Policy CR for post-freeze edits',
      ],
      publicApis: ['analyze_style · style_reason · style_goals'],
      capabilities: ['analyze_style', 'style_reason', 'style_goals'],
      contracts: ['style-schema-v1', 'PHASE_6E3_* freeze artifacts', 'ADR-SI-001…006'],
      knownLimitations: [
        'recommendations capability remains disabled',
        'Legacy Mira Style Report / Flutter FKG not Canonical Style',
        'Soft ledger immutability; caller-owned memory persistence',
      ],
      techDebtDetail: [
        'governance/PHASE_6E3_STYLING_INTELLIGENCE_TECHNICAL_DEBT_REGISTER.md',
      ],
      futureRoadmap: ['AI Beauty Advisor 7B consumes frozen contracts', 'Recommendation Engine separate phase'],
      docs: {
        architectureLock: 'governance/PHASE_6E1_ARCHITECTURE_COMPLIANCE_REPORT.md',
        completionReport: 'governance/PHASE_6E1_STYLING_INTELLIGENCE_COMPLETION_REPORT.md',
        independentAudit: null,
        remediation: 'governance/PHASE_6E2_REMEDIATION_REPORT.md',
        reAudit: 'governance/PHASE_6E_INDEPENDENT_REAUDIT_RECORD.md',
        productionFreeze: 'governance/PHASE_6E3_STYLING_INTELLIGENCE_FREEZE_CERTIFICATE.md',
        versionManifest: 'governance/PHASE_6E3_STYLING_INTELLIGENCE_VERSION_MANIFEST.md',
        technicalDebt: 'governance/PHASE_6E3_STYLING_INTELLIGENCE_TECHNICAL_DEBT_REGISTER.md',
        architectureDecisions: 'governance/adr/ADR-SI-001-canonical-styling-profile-sole-public-model.md',
      },
    },
    {
      id: 'recommendation-engine',
      name: 'Recommendation Engine',
      description:
        'Cross-domain recommendation architecture exists; fashion recommendation subsystem not started as frozen product.',
      version: 'architecture draft',
      status: 'Architecture',
      architecture: 'Documented',
      implementation: 'Partial legacy Flutter ranking / not subsystem freeze',
      independentAudit: 'N/A',
      remediation: 'N/A',
      reAudit: 'N/A',
      productionFreeze: 'N/A',
      currentPhase: 'Architecture reference · fashion engine deferred',
      dependencies: ['Outfit Intelligence', 'Styling Intelligence', 'Face recommendations (frozen separate)'],
      publicContracts: ['docs/architecture/recommendation-engine.md'],
      owner: 'Mira Engineering',
      riskLevel: 'Medium',
      technicalDebt: 'Legacy Flutter FashionRankingEngine parallel to future subsystem',
      lastUpdated: '2026-07-19',
      domain: 'fashion',
      tags: ['fashion', 'ai', 'pending'],
      quality: 'Needs Review',
      pipelineIndex: 0,
      purpose: 'Unified recommendation contracts without inventing scores as scientific beauty.',
      responsibilities: ['Architecture boundaries', 'Future evidence-backed recommendations'],
      protectedComponents: [],
      engineeringLaws: ['ADR-FI-006 recommendations require evidence (face)', 'No fake attractiveness scores'],
      publicApis: [],
      capabilities: [],
      contracts: ['architecture/recommendation-engine.md'],
      knownLimitations: ['Fashion recommendation product not started under transformation program'],
      techDebtDetail: ['Unify legacy ranking engines under future subsystem'],
      futureRoadmap: ['Architecture Lock after Styling'],
      docs: {
        architectureLock: 'architecture/recommendation-engine.md',
        completionReport: null,
        independentAudit: null,
        remediation: null,
        reAudit: null,
        productionFreeze: null,
        versionManifest: null,
        technicalDebt: null,
        architectureDecisions: 'governance/adr/ADR-FI-006-recommendations-require-evidence.md',
      },
    },
    {
      id: 'fashion-knowledge-graph',
      name: 'Fashion Knowledge Graph',
      description: 'Deferred SSOT knowledge graph. Explicitly out of 6B/6C scope.',
      version: '—',
      status: 'Not Started',
      architecture: 'Deferred (Addendum later)',
      implementation: 'Not started',
      independentAudit: 'N/A',
      remediation: 'N/A',
      reAudit: 'N/A',
      productionFreeze: 'N/A',
      currentPhase: 'Deferred',
      dependencies: ['Fashion Taxonomy Service', 'Garment Intelligence'],
      publicContracts: ['Not published'],
      owner: 'Mira Engineering · Fashion',
      riskLevel: 'Low',
      technicalDebt: 'TD-GI-09 dual catalog/ontology sources remain',
      lastUpdated: '2026-07-19',
      domain: 'fashion',
      tags: ['fashion', 'pending'],
      quality: 'Blocked',
      pipelineIndex: 0,
      purpose: 'Future SSOT graph for fashion relationships.',
      responsibilities: ['Not started'],
      protectedComponents: [],
      engineeringLaws: ['Do not invent graph as live SSOT until Architecture Lock'],
      publicApis: [],
      capabilities: [],
      contracts: [],
      knownLimitations: ['assets/fashion knowledge files are legacy hard-coded, not this subsystem'],
      techDebtDetail: ['TD-GI-09 in GARMENT_INTELLIGENCE_TECHNICAL_DEBT.md'],
      futureRoadmap: ['Architecture Lock after Taxonomy'],
      docs: {
        architectureLock: null,
        completionReport: null,
        independentAudit: null,
        remediation: null,
        reAudit: null,
        productionFreeze: null,
        versionManifest: null,
        technicalDebt: 'governance/GARMENT_INTELLIGENCE_TECHNICAL_DEBT.md',
        architectureDecisions: null,
      },
    },
    {
      id: 'fashion-taxonomy-service',
      name: 'Fashion Taxonomy Service',
      description: 'Deferred taxonomy SSOT service. Not started.',
      version: '—',
      status: 'Not Started',
      architecture: 'Deferred',
      implementation: 'Not started',
      independentAudit: 'N/A',
      remediation: 'N/A',
      reAudit: 'N/A',
      productionFreeze: 'N/A',
      currentPhase: 'Deferred',
      dependencies: ['Garment Intelligence contracts'],
      publicContracts: ['Not published'],
      owner: 'Mira Engineering · Fashion',
      riskLevel: 'Low',
      technicalDebt: 'TD-GI-09',
      lastUpdated: '2026-07-19',
      domain: 'fashion',
      tags: ['fashion', 'pending'],
      quality: 'Blocked',
      pipelineIndex: 0,
      purpose: 'Canonical taxonomy service replacing dual ontology sources.',
      responsibilities: ['Not started'],
      protectedComponents: [],
      engineeringLaws: ['SSOT taxonomy before FKG'],
      publicApis: [],
      capabilities: [],
      contracts: [],
      knownLimitations: ['Explicitly not implemented in 6B'],
      techDebtDetail: ['TD-GI-09'],
      futureRoadmap: ['Architecture Lock'],
      docs: {
        architectureLock: null,
        completionReport: null,
        independentAudit: null,
        remediation: null,
        reAudit: null,
        productionFreeze: null,
        versionManifest: null,
        technicalDebt: 'governance/GARMENT_INTELLIGENCE_TECHNICAL_DEBT.md',
        architectureDecisions: null,
      },
    },
    {
      id: 'ai-beauty-advisor',
      name: 'AI Beauty Advisor',
      description:
        'Orchestration + conversation layer over sealed Advisor Evidence Envelopes. Officially frozen at v1.0.0. Laws #33/#34.',
      version: '1.0.0',
      status: 'Frozen',
      architecture: 'Frozen',
      implementation: 'Frozen (7B · 7B.1 · 7B.2)',
      independentAudit: 'Complete (fail → remediate → Re-Audit A)',
      remediation: 'Complete (7B.1)',
      reAudit: 'Complete (Verdict A)',
      productionFreeze: 'Frozen v1.0.0 · MIRA-BA-FREEZE-1.0.0',
      currentPhase: '7B.2 Production Freeze complete',
      dependencies: [
        'Skin Intelligence v1.0.0',
        'Face Intelligence v1.0.0',
        'Wardrobe / GI / OI / Styling v1.0.0',
        'MCE grounding (public summaries)',
      ],
      publicContracts: [
        'advisor-envelope-v1',
        'POST /advisor/chat',
        'BeautyAdvisorService.turn',
      ],
      owner: 'Mira Engineering · Advisor',
      riskLevel: 'Low',
      technicalDebt: 'See PHASE_7B2_AI_BEAUTY_ADVISOR_TECHNICAL_DEBT_REGISTER.md',
      lastUpdated: '2026-07-19',
      domain: 'beauty',
      tags: ['ai', 'beauty', 'orchestration', 'frozen'],
      quality: 'Frozen',
      pipelineIndex: 4,
      purpose: 'Conversation and orchestration only — envelope-bound speech.',
      responsibilities: [
        'Advisor Evidence Envelope',
        'Conversation planner / router / memory refs',
        'Grounded responses + Law #34',
      ],
      protectedComponents: [
        'mira-api/src/beauty-advisor/**',
        'mira-api/src/advisor/**',
      ],
      engineeringLaws: [
        'Law #33 — never replaces frozen intelligence',
        'Law #34 — speak only via Advisor Evidence Envelope',
        'Change Policy CR for post-freeze edits',
      ],
      publicApis: ['POST /advisor/chat'],
      capabilities: ['conversation', 'capability_routing', 'grounded_response'],
      contracts: ['advisor-envelope-v1', 'PHASE_7B2_* freeze artifacts', 'ADR-BA-001…006'],
      knownLimitations: [
        'In-memory session map (not durable / not multi-instance)',
        'Canonical Face/GI/OI/Style envelope projectors still thin',
        'MCE LLM consultation module remains a separate surface',
      ],
      techDebtDetail: [
        'governance/PHASE_7B2_AI_BEAUTY_ADVISOR_TECHNICAL_DEBT_REGISTER.md',
      ],
      futureRoadmap: ['Recommendation Engine separate phase', 'Durable Advisor session store under CR'],
      docs: {
        architectureLock: 'governance/PHASE_7B_ARCHITECTURE_COMPLIANCE_REPORT.md',
        completionReport: 'governance/PHASE_7B_AI_BEAUTY_ADVISOR_COMPLETION_REPORT.md',
        independentAudit: null,
        remediation: 'governance/PHASE_7B1_REMEDIATION_REPORT.md',
        reAudit: 'governance/PHASE_7B_INDEPENDENT_REAUDIT_RECORD.md',
        productionFreeze: 'governance/PHASE_7B2_AI_BEAUTY_ADVISOR_FREEZE_CERTIFICATE.md',
        versionManifest: 'governance/PHASE_7B2_AI_BEAUTY_ADVISOR_VERSION_MANIFEST.md',
        technicalDebt: 'governance/PHASE_7B2_AI_BEAUTY_ADVISOR_TECHNICAL_DEBT_REGISTER.md',
        architectureDecisions: 'governance/adr/ADR-BA-001-advisor-evidence-envelope.md',
      },
    },
    {
      id: 'vision-platform',
      name: 'Vision Platform',
      description:
        'Canonical outfit vision path: FASHN geometry + OpenAI semantic + orchestrator + QEL. Live on Render.',
      version: 'Phases 0–8 complete (platform docs)',
      status: 'Implementation',
      architecture: 'Done',
      implementation: 'Live',
      independentAudit: 'Partial (platform docs + tests)',
      remediation: 'Ongoing (schema/QEL)',
      reAudit: 'Pending formal freeze',
      productionFreeze: 'Not published as freeze cert',
      currentPhase: 'Production operations · FASHION_PROVIDER=vision_platform',
      dependencies: ['FASHN', 'OpenAI', 'QEL', 'Provider keys on Render'],
      publicContracts: ['POST /api/v1/ai/vision/outfit/analyze', 'POST .../recolor', 'FashionVisionDocument'],
      owner: 'Mira Engineering · Vision',
      riskLevel: 'Medium',
      technicalDebt: 'Legacy OUTFIT_PROVIDER path still present (mock, gated)',
      lastUpdated: '2026-07-19',
      domain: 'fashion',
      tags: ['fashion', 'ai', 'active'],
      quality: 'Good',
      pipelineIndex: 1,
      purpose: 'Sole production vision analysis path for garments/outfits imagery.',
      responsibilities: [
        'Orchestrate geometry + semantics',
        'Quality gates (QEL)',
        'Recolor via FASHN Edit',
      ],
      protectedComponents: [
        'mira-api/src/vision/vision-orchestrator.service.ts',
        'docs/mira-vision-platform.html',
      ],
      engineeringLaws: [
        'Vision Platform is canonical fashion analyze path',
        'OUTFIT_PROVIDER=mock is legacy only',
      ],
      publicApis: ['/ai/vision/outfit/analyze', '/ai/vision/outfit/recolor'],
      capabilities: ['geometry', 'semantics', 'recolor', 'QEL'],
      contracts: ['FashionVisionDocument schema 1.0.0'],
      knownLimitations: ['Vendor latency/cost', 'No formal subsystem freeze certificate'],
      techDebtDetail: ['Remove or fully quarantine legacy outfit provider path'],
      futureRoadmap: ['Formal Vision Platform freeze package'],
      docs: {
        architectureLock: 'mira-vision-platform.html',
        completionReport: 'mira-vision-platform.html',
        independentAudit: 'mira-development.html#fashion',
        remediation: null,
        reAudit: null,
        productionFreeze: null,
        versionManifest: null,
        technicalDebt: 'mira-development.html#fashion',
        architectureDecisions: 'mira-vision-platform.html',
      },
    },
    {
      id: 'provider-platform',
      name: 'Provider Platform',
      description:
        'Provider registry, license, health, cost, activation guides — config-not-code readiness v1.0.0.',
      version: '1.0.0-readiness',
      status: 'Activation Ready',
      architecture: 'Done (5B.0)',
      implementation: 'Config registries done · SDKs not live',
      independentAudit: 'Checklist-based',
      remediation: 'Gaps listed in readiness (licenses unknown)',
      reAudit: 'Required before try-on activation',
      productionFreeze: 'Readiness frozen as config package',
      currentPhase: '5B.0 complete · blocked on external license/probe gaps',
      dependencies: ['Render secrets', 'Perfect / FASHN / LLM vendors'],
      publicContracts: ['PROVIDER_REGISTRY.md', 'PROVIDER_CONFIGURATION.md'],
      owner: 'Mira Engineering · Platform',
      riskLevel: 'High',
      technicalDebt: 'Makeup VTO license unknown; sandbox not verified',
      lastUpdated: '2026-07-19',
      domain: 'platform',
      tags: ['ai', 'platform', 'active'],
      quality: 'Needs Review',
      pipelineIndex: 1,
      purpose: 'Activate and govern third-party providers without embedding vendor logic in features.',
      responsibilities: [
        'Registry · license · health · cost models',
        'Activation checklist',
        'Verification workflow (no live calls in 5B.0)',
      ],
      protectedComponents: ['docs/governance/PROVIDER_*.md'],
      engineeringLaws: ['Config-not-code for readiness', 'No silent provider activation'],
      publicApis: ['Env configuration contracts only'],
      capabilities: ['registry', 'activation guide', 'health/cost models'],
      contracts: ['PROVIDER_READINESS_v1.0.0.md'],
      knownLimitations: [
        'Perfect Makeup license unknown',
        'API reachability not probed in 5B.0',
        'BEAUTY_TRYON_ENABLED=false',
      ],
      techDebtDetail: ['Close readiness gaps before 5B resume'],
      futureRoadmap: ['License verification · sandbox · activate capabilities'],
      docs: {
        architectureLock: 'architecture/provider-ports.md',
        completionReport: 'governance/PROVIDER_READINESS_COMPLETION_REPORT.md',
        independentAudit: 'governance/PROVIDER_VERIFICATION_CHECKLIST.md',
        remediation: 'governance/PROVIDER_READINESS_v1.0.0.md',
        reAudit: null,
        productionFreeze: 'governance/PROVIDER_READINESS_v1.0.0.md',
        versionManifest: 'governance/PROVIDER_READINESS_v1.0.0.md',
        technicalDebt: 'governance/PROVIDER_READINESS_v1.0.0.md',
        architectureDecisions: 'governance/PROVIDER_LICENSE_POLICY.md',
      },
    },
  ];

  /** Dependency edges for relationship view (consumer depends on provider). */
  const DEP_EDGES = [
    ['Vision Platform', 'Garment Intelligence'],
    ['Garment Intelligence', 'Wardrobe Foundation'],
    ['Wardrobe Foundation', 'Outfit Intelligence'],
    ['Outfit Intelligence', 'Styling Intelligence'],
    ['Styling Intelligence', 'Recommendation Engine'],
    ['Garment Intelligence', 'Fashion Taxonomy Service'],
    ['Fashion Taxonomy Service', 'Fashion Knowledge Graph'],
    ['Provider Platform', 'Skin Intelligence'],
    ['Provider Platform', 'Beauty Experience'],
    ['Provider Platform', 'Vision Platform'],
    ['Skin Intelligence', 'AI Beauty Advisor'],
    ['Face Intelligence', 'Beauty Experience'],
    ['Skin Intelligence', 'Beauty Experience'],
    ['Outfit Intelligence', 'AI Beauty Advisor'],
  ];

  function statusBadge(status) {
    const m = STATUS_META[status] || STATUS_META['Not Started'];
    return `<span class="reg-status ${m.cls}">${status}</span>`;
  }

  function qualityBadge(q) {
    const m = QUALITY_META[q] || QUALITY_META['Needs Review'];
    return `<span class="reg-quality ${m.cls}">${q}</span>`;
  }

  function riskBadge(r) {
    const cls =
      r === 'High' || r === 'Critical'
        ? 'risk-high'
        : r === 'Medium'
          ? 'risk-med'
          : 'risk-low';
    return `<span class="reg-risk ${cls}">${r}</span>`;
  }

  function docLink(label, href) {
    if (!href) {
      return `<span class="doc-missing">${label}: Not published</span>`;
    }
    return `<a class="doc-link" href="${href}" target="_blank" rel="noopener">${label}</a>`;
  }

  function pipelineHtml(sub) {
    const idx = typeof sub.pipelineIndex === 'number' ? sub.pipelineIndex : 0;
    const steps = PIPELINE.map((name, i) => {
      let state = 'upcoming';
      if (sub.status === 'Frozen' || sub.status === 'Production Freeze') {
        state = i <= 5 ? 'done' : 'upcoming';
        if (i === 5) state = 'current';
      } else if (sub.status === 'Not Started') {
        state = i === 0 ? 'upcoming' : 'upcoming';
      } else if (i < idx) state = 'done';
      else if (i === idx) state = 'current';
      return `<div class="pipe-step ${state}"><span class="pipe-dot"></span><span class="pipe-label">${name}</span></div>`;
    }).join('<div class="pipe-arrow">→</div>');
    return `<div class="pipe-row">${steps}</div>`;
  }

  function computeStats(list) {
    const frozen = list.filter((s) => s.status === 'Frozen').length;
    const inDev = list.filter((s) =>
      ['Architecture', 'Implementation', 'Remediation', 'Re-Audit', 'Production Freeze'].includes(
        s.status,
      ),
    ).length;
    const audits = list.filter((s) => s.status === 'Independent Audit').length;
    const debt = list.filter(
      (s) => s.technicalDebt && s.technicalDebt !== 'None (not started)' && s.technicalDebt !== 'None',
    ).length;
    const prodReady = frozen;
    const activation = list.filter((s) => s.status === 'Activation Ready').length;
    return {
      total: list.length,
      frozen,
      inDev,
      audits,
      debt,
      prodReady,
      activation,
    };
  }

  function renderSubsystemCard(sub) {
    const d = sub.docs || {};
    return `
      <article class="reg-card" id="reg-${sub.id}"
        data-status="${sub.status}"
        data-domain="${sub.domain}"
        data-tags="${(sub.tags || []).join(' ')}"
        data-name="${sub.name}"
        data-version="${sub.version}"
        data-search="${[
          sub.name,
          sub.version,
          sub.description,
          ...(sub.capabilities || []),
          ...(sub.engineeringLaws || []),
          Object.values(d).filter(Boolean).join(' '),
        ]
          .join(' ')
          .toLowerCase()}">
        <button type="button" class="reg-card-toggle" aria-expanded="false">
          <div class="reg-card-title">
            <strong>${sub.name}</strong>
            ${statusBadge(sub.status)}
            ${qualityBadge(sub.quality)}
            ${riskBadge(sub.riskLevel)}
          </div>
          <div class="reg-card-meta">
            <span>v ${sub.version}</span>
            <span>${sub.currentPhase}</span>
            <span>Updated ${sub.lastUpdated}</span>
          </div>
          <span class="reg-chevron">▾</span>
        </button>
        <div class="reg-card-body">
          <p class="reg-purpose"><strong>Purpose.</strong> ${sub.purpose}</p>
          <div class="reg-detail-grid">
            <div>
              <h4>Responsibilities</h4>
              <ul>${(sub.responsibilities || []).map((x) => `<li>${x}</li>`).join('') || '<li>—</li>'}</ul>
            </div>
            <div>
              <h4>Dependencies</h4>
              <ul>${(sub.dependencies || []).map((x) => `<li>${x}</li>`).join('')}</ul>
            </div>
            <div>
              <h4>Protected Components</h4>
              <ul>${(sub.protectedComponents || []).map((x) => `<li><code>${x}</code></li>`).join('') || '<li>—</li>'}</ul>
            </div>
            <div>
              <h4>Engineering Laws</h4>
              <ul>${(sub.engineeringLaws || []).map((x) => `<li>${x}</li>`).join('') || '<li>—</li>'}</ul>
            </div>
            <div>
              <h4>Public APIs</h4>
              <ul>${(sub.publicApis || []).map((x) => `<li><code>${x}</code></li>`).join('') || '<li>—</li>'}</ul>
            </div>
            <div>
              <h4>Capabilities</h4>
              <ul>${(sub.capabilities || []).map((x) => `<li>${x}</li>`).join('') || '<li>—</li>'}</ul>
            </div>
            <div>
              <h4>Contracts</h4>
              <ul>${(sub.contracts || []).map((x) => `<li>${x}</li>`).join('') || '<li>—</li>'}</ul>
            </div>
            <div>
              <h4>Known Limitations</h4>
              <ul>${(sub.knownLimitations || []).map((x) => `<li>${x}</li>`).join('') || '<li>—</li>'}</ul>
            </div>
            <div>
              <h4>Technical Debt</h4>
              <ul>${(sub.techDebtDetail || []).map((x) => `<li>${x}</li>`).join('') || `<li>${sub.technicalDebt}</li>`}</ul>
            </div>
            <div>
              <h4>Future Roadmap</h4>
              <ul>${(sub.futureRoadmap || []).map((x) => `<li>${x}</li>`).join('') || '<li>—</li>'}</ul>
            </div>
          </div>
          <h4>Related Documents</h4>
          <div class="doc-links">
            ${docLink('Architecture Lock', d.architectureLock)}
            ${docLink('Completion Report', d.completionReport)}
            ${docLink('Independent Audit', d.independentAudit)}
            ${docLink('Remediation', d.remediation)}
            ${docLink('Re-Audit', d.reAudit)}
            ${docLink('Production Freeze', d.productionFreeze)}
            ${docLink('Version Manifest', d.versionManifest)}
            ${docLink('Technical Debt', d.technicalDebt)}
            ${docLink('Architecture Decisions', d.architectureDecisions)}
          </div>
          <h4>Engineering Timeline</h4>
          ${pipelineHtml(sub)}
        </div>
      </article>`;
  }

  function renderTableRows(list) {
    return list
      .map(
        (s) => `<tr data-reg-row="${s.id}">
        <td><a href="#reg-${s.id}">${s.name}</a></td>
        <td class="small">${s.description}</td>
        <td><code>${s.version}</code></td>
        <td>${statusBadge(s.status)}</td>
        <td class="small">${s.architecture}</td>
        <td class="small">${s.implementation}</td>
        <td class="small">${s.independentAudit}</td>
        <td class="small">${s.remediation}</td>
        <td class="small">${s.reAudit}</td>
        <td class="small">${s.productionFreeze}</td>
        <td class="small">${s.currentPhase}</td>
        <td class="small">${(s.dependencies || []).join(', ')}</td>
        <td class="small">${(s.publicContracts || []).join(', ')}</td>
        <td class="small">${s.owner}</td>
        <td>${riskBadge(s.riskLevel)}</td>
        <td class="small">${s.technicalDebt}</td>
        <td>${s.lastUpdated}</td>
      </tr>`,
      )
      .join('');
  }

  function renderGraph() {
    const primary = [
      'Vision Platform',
      'Garment Intelligence',
      'Wardrobe Foundation',
      'Outfit Intelligence',
      'Styling Intelligence',
      'Recommendation Engine',
    ];
    const nodes = primary
      .map((name) => {
        const sub = SUBSYSTEMS.find((s) => s.name === name);
        const st = sub ? sub.status : 'Not Started';
        return `<div class="dep-node">${name}<br>${statusBadge(st)}</div>`;
      })
      .join('<div class="dep-arrow">↓</div>');

    const extra = DEP_EDGES.filter(
      ([a, b]) => !(primary.includes(a) && primary.includes(b) && primary.indexOf(a) === primary.indexOf(b) - 1),
    )
      .map(([a, b]) => `<li><code>${a}</code> → <code>${b}</code></li>`)
      .join('');

    return `
      <div class="dep-chain">${nodes}</div>
      <h4 style="margin-top:18px;">Additional dependency edges</h4>
      <ul class="tight small">${extra}</ul>`;
  }

  function renderRegistry(root) {
    const stats = computeStats(SUBSYSTEMS);
    const s = document.createElement('section');
    s.id = 'subsystem-registry';
    s.innerHTML = `
      <h2>Subsystem Registry</h2>
      <p class="section-sub">${REGISTRY_META.ssot} · Registry ${REGISTRY_META.version} · Updated ${REGISTRY_META.updated} · Documentation only</p>

      <div class="stats-grid" id="regStats">
        <div class="stat-card"><div class="num">${stats.total}</div><div class="lbl">Total Subsystems</div></div>
        <div class="stat-card"><div class="num">${stats.frozen}</div><div class="lbl">Frozen</div></div>
        <div class="stat-card"><div class="num">${stats.inDev}</div><div class="lbl">In Development</div></div>
        <div class="stat-card"><div class="num">${stats.audits}</div><div class="lbl">Audits Pending</div></div>
        <div class="stat-card"><div class="num">${stats.debt}</div><div class="lbl">Technical Debt Items</div></div>
        <div class="stat-card"><div class="num">${stats.prodReady}</div><div class="lbl">Production Ready (Frozen)</div></div>
        <div class="stat-card"><div class="num">${stats.activation}</div><div class="lbl">Activation Ready</div></div>
      </div>

      <div class="card info">
        <h3 style="margin-top:0;">Quality score policy</h3>
        <p class="small muted" style="margin:0">
          Qualitative only — derived from published Architecture / Tests references / Audit / Freeze / Documentation.
          Levels: Excellent · Good · Needs Review · Blocked. No invented numeric accuracy.
        </p>
      </div>

      <div class="filter-bar" id="regFilters">
        <input type="search" id="regSearch" placeholder="Search subsystem · version · capability · document · law…" />
        <select id="regFilter">
          <option value="all">All</option>
          <option value="frozen">Frozen only</option>
          <option value="active">Active (Impl / Arch / Audit / Ready)</option>
          <option value="audits">Audits</option>
          <option value="ai">AI</option>
          <option value="fashion">Fashion</option>
          <option value="beauty">Beauty</option>
          <option value="pending">Pending / Not Started</option>
          <option value="platform">Platform</option>
        </select>
        <span id="regCount" class="muted small"></span>
      </div>

      <h3>Registry table</h3>
      <div class="table-wrap">
        <table class="audit-table reg-table">
          <thead>
            <tr>
              <th>Subsystem</th>
              <th>Description</th>
              <th>Current Version</th>
              <th>Status</th>
              <th>Architecture</th>
              <th>Implementation</th>
              <th>Independent Audit</th>
              <th>Remediation</th>
              <th>Re-Audit</th>
              <th>Production Freeze</th>
              <th>Current Phase</th>
              <th>Dependencies</th>
              <th>Public Contracts</th>
              <th>Owner</th>
              <th>Risk Level</th>
              <th>Technical Debt</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody id="regTableBody">${renderTableRows(SUBSYSTEMS)}</tbody>
        </table>
      </div>

      <h3 style="margin-top:28px;">Relationship view</h3>
      <div class="card">${renderGraph()}</div>

      <h3 style="margin-top:28px;">Subsystem details</h3>
      <div id="regCards">${SUBSYSTEMS.map(renderSubsystemCard).join('')}</div>
    `;
    root.appendChild(s);
    wireRegistry(s);
  }

  function wireRegistry(section) {
    section.addEventListener('click', (e) => {
      const btn = e.target.closest('.reg-card-toggle');
      if (!btn) return;
      const card = btn.closest('.reg-card');
      const open = card.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    const search = section.querySelector('#regSearch');
    const filter = section.querySelector('#regFilter');
    const count = section.querySelector('#regCount');
    const cards = [...section.querySelectorAll('.reg-card')];
    const rows = [...section.querySelectorAll('#regTableBody tr')];

    function matchFilter(card, mode) {
      const status = card.dataset.status;
      const tags = (card.dataset.tags || '').split(/\s+/);
      const domain = card.dataset.domain;
      switch (mode) {
        case 'frozen':
          return status === 'Frozen';
        case 'active':
          return ['Implementation', 'Architecture', 'Independent Audit', 'Activation Ready', 'Remediation', 'Re-Audit', 'Production Freeze'].includes(status);
        case 'audits':
          return status === 'Independent Audit' || status === 'Re-Audit' || tags.includes('audit');
        case 'ai':
          return tags.includes('ai');
        case 'fashion':
          return domain === 'fashion' || tags.includes('fashion');
        case 'beauty':
          return domain === 'beauty' || tags.includes('beauty');
        case 'pending':
          return status === 'Not Started' || status === 'Paused' || tags.includes('pending');
        case 'platform':
          return domain === 'platform' || tags.includes('platform');
        default:
          return true;
      }
    }

    function apply() {
      const q = (search.value || '').trim().toLowerCase();
      const mode = filter.value;
      let n = 0;
      cards.forEach((card) => {
        const textOk = !q || (card.dataset.search || '').includes(q);
        const filterOk = matchFilter(card, mode);
        const show = textOk && filterOk;
        card.style.display = show ? '' : 'none';
        const row = section.querySelector(`tr[data-reg-row="${card.id.replace('reg-', '')}"]`);
        if (row) row.style.display = show ? '' : 'none';
        if (show) n++;
      });
      count.textContent = `${n} / ${cards.length} subsystems`;
    }

    search.addEventListener('input', apply);
    filter.addEventListener('change', apply);
    apply();
  }

  global.MiraSubsystemRegistry = {
    meta: REGISTRY_META,
    subsystems: SUBSYSTEMS,
    render: renderRegistry,
  };
})(typeof window !== 'undefined' ? window : globalThis);

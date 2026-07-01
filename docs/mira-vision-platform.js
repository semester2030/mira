/**
 * MIRA Vision Platform — Official Implementation Reference
 * المرجع الرسمي الوحيد لترحيل طبقة الرؤية
 */
(function () {
  'use strict';

  const STORAGE = 'mira_vision_platform_v1';
  const SPEC_VERSION = '1.0.0';
  const SPEC_DATE = '2026-06-30';
  const IMPLEMENTATION_LOG_DATE = '2026-06-30';
  const PRODUCTION_COMMIT = 'dca812d';
  const PRODUCTION_API_URL = 'https://mira-api-n4p3.onrender.com/api/v1';

  /** نتائج النشر الإنتاجي — Render 30 يونيو 2026 */
  const PRODUCTION_DEPLOY = {
    date: '2026-06-30',
    time: '07:12 UTC',
    commit: PRODUCTION_COMMIT,
    branch: 'main',
    github: 'https://github.com/semester2030/mira',
    serviceUrl: 'https://mira-api-n4p3.onrender.com',
    apiPrefix: PRODUCTION_API_URL,
    status: 'live',
    filesInCommit: 313,
    linesAdded: 25512,
    prismaMigrations: '5 applied · no pending',
    modulesLive: ['VisionModule', 'AiGatewayModule'],
    routesVerified: [
      'POST /api/v1/ai/vision/outfit/analyze',
      'POST /api/v1/ai/vision/outfit/recolor',
      'POST /api/v1/ai/outfit-segmentation',
      'POST /api/v1/ai/skin-analysis',
      'POST /api/v1/ai/outfit-intelligence',
      'POST /api/v1/ai/full-mira-analysis',
    ],
    startupProof: [
      'VisionModule dependencies initialized',
      'Mapped {/api/v1/ai/outfit-segmentation, POST} route',
      'Mapped {/api/v1/ai/vision/outfit/analyze, POST} route',
      'Nest application successfully started',
    ],
    envConfigured: [
      'FASHN_API_KEY', 'FASHN_BASE_URL=https://api.fashn.ai', 'FASHN_GEOMETRY_ENDPOINT=/v1/segmentation',
      'LLM_API_KEY', 'LLM_BASE_URL=https://api.openai.com/v1', 'LLM_MODEL=gpt-4o-mini',
      'PERFECT_API_KEY', 'FIREBASE_PROJECT_ID', 'DATABASE_URL',
    ],
    nextSteps: [
      'اختبار تحليل إطلالة حيّ من التطبيق (Firebase auth)',
      'مراقبة Render logs عند أول طلب FASHN/OpenAI',
      'Phase 9 — Evaluation Framework (خارطة 9–17)',
    ],
  };

  /** ما يعمل فعليًا في التطبيق vs ما بُني لكن غير موصول */
  const CURRENT_RUNTIME = {
    liveUserPath: {
      title: '🟢 مسار المستخدم الحالي (Production path — مكتمل)',
      flow: `OutfitIntelligenceService.analyze()
  → VisionApiDataSource → POST /ai/vision/outfit/analyze
  → FashionVisionToEngineAdapter → OutfitVisualProfile
  → DeterministicOutfitEngine (MIRA scores)
  → OutfitSegmentationService (FASHN geometry via server)
  → Result Screen (unchanged UI)`,
      status: 'active',
      note: 'Google Vision محذوف بالكامل — Vision Platform هو المسار الوحيد.',
    },
    newApiPath: {
      title: '🟢 Vision Platform API (FASHN + OpenAI)',
      flow: `POST /api/v1/ai/vision/outfit/analyze
  → VisionOrchestratorService
  → FashnGeometryProvider + OpenAiSemanticProvider
  → QualityGate → Normalizer → Validator
  → ConflictResolver → ConfidenceEngine
  → FashionVisionDocument → Flutter MIRA Engine`,
      status: 'complete',
      note: 'Phase 8 — Google Vision محذوف · segmentation يستخدم FASHN فقط.',
    },
    wiredToApp: true,
    wiredInPhase: 7,
    nextPhase: 9,
    nextPhaseTitle: 'خارطة النضج الإنتاجي — Phase 9 Evaluation',
  };

  const RUNTIME_QA = [
    { q: 'هل التطبيق يستخدم Endpoint الجديد؟', a: '✅ نعم — Phase 7 (VisionApiDataSource)' },
    { q: 'هل Google Vision ما زال يعمل؟', a: '❌ محذوف بالكامل — Phase 8' },
    { q: 'هل OpenAI / FASHN متصلان؟', a: '✅ نعم — مفاتيح مضبوطة على Render (30 يونيو 2026)' },
    { q: 'هل Vision Platform منشور على Render؟', a: `✅ نعم — ${PRODUCTION_DEPLOY.serviceUrl} · commit ${PRODUCTION_COMMIT}` },
    { q: 'هل مسارات Vision مسجّلة في الإنتاج؟', a: '✅ vision/outfit/analyze + outfit-segmentation — مؤكّد في startup logs' },
    { q: 'هل FashionVisionDocument v1 موجود؟', a: '✅ نعم — Phase 1 + validator' },
    { q: 'هل VisionApiDataSource موجود في Flutter؟', a: '✅ نعم — Phase 7 موصول بـ OutfitIntelligenceService' },
    { q: 'هل Result Screen تغيّرت؟', a: '❌ لا — لم تُمس' },
    { q: 'هل Perfect Corp (skin) تغيّر؟', a: '❌ لا — لم يُمس' },
    { q: 'كيف أتحقق من Schema؟', a: 'cd mira-api && npm run test:vision-schema' },
    { q: 'كيف أتحقق من FASHN geometry؟', a: 'cd mira-api && npm run test:vision-geometry' },
    { q: 'كيف أتحقق من OpenAI semantics؟', a: 'cd mira-api && npm run test:vision-semantic' },
    { q: 'كيف أتحقق من Pipeline (Phase 5)?', a: 'cd mira-api && npm run test:vision-pipeline' },
    { q: 'كيف أتحقق من Conflict + Confidence (Phase 6)?', a: 'cd mira-api && npm run test:vision-conflicts' },
    { q: 'ما المرحلة التالية بعد Phase 8?', a: 'Phase 9 — AI Evaluation Framework (خارطة النضج الإنتاجي 9–17)' },
    { q: 'أين خارطة Phases 9–17?', a: '#production-readiness — Production Readiness Roadmap' },
  ];

  const VERIFY_COMMANDS = `# Schema validation (Phase 1) — 5 valid + 5 invalid payloads
cd mira-api && npm run test:vision-schema

# FASHN geometry gate (Phase 3) — mock + forbidden fields
cd mira-api && npm run test:vision-geometry

# OpenAI semantic gate (Phase 4) — mock + forbidden fields + full doc
cd mira-api && npm run test:vision-semantic

# Pipeline guard (Phase 5) — normalizer + 6 fashion rules + quality gate
cd mira-api && npm run test:vision-pipeline

# Conflict + confidence (Phase 6) — 3 conflict rules + gate thresholds
cd mira-api && npm run test:vision-conflicts

# Flutter Phase 7 — adapter + outfit intelligence
flutter test test/fashion_vision_to_engine_adapter_test.dart test/outfit_intelligence_service_test.dart

# Full Flutter suite (122+ tests)
flutter test

# API build (Phase 2+)
cd mira-api && npm run build

# Endpoint (يتطلب auth + server + FASHN_* + LLM_API_KEY)
# POST /api/v1/ai/vision/outfit/analyze
# multipart: image, occasionId, mode, optional skinSnapshot
# بدون FASHN env → 503 FASHN_NOT_CONFIGURED
# بدون LLM_API_KEY → 503 OPENAI_NOT_CONFIGURED

# Flutter — الملفات الجديدة (Phase 2)
# lib/features/outfit_analysis/data/datasources/vision_api_data_source.dart
# lib/features/outfit_analysis/domain/entities/fashion_vision_document.dart
# lib/core/network/mira_api_endpoints.dart → visionOutfitAnalyze`;

  /** تفاصيل كل ما نُفّذ — Phases 0–8 (migration complete) */
  const IMPLEMENTED_BY_PHASE = [
    {
      phase: 0,
      title: 'Phase 0 — تجميد Google Vision',
      status: 'done',
      goal: 'إيقاف الاستثمار في Google — bridge مؤقت فقط حتى Phase 8.',
      changes: [
        'تعليق VISION PLATFORM Phase 0 على جميع ملفات Google Vision',
        'توثيق: docs/mira-vision-platform.html كمرجع رسمي',
        'لم يُحذف أي كود Google — bridge فقط',
        'ممنوع تحسين parser Google أثناء الترحيل',
      ],
      files: [
        { action: 'MODIFY', path: 'lib/features/outfit_analysis/domain/services/google_vision_outfit_service.dart', note: 'DEPRECATED banner + freeze' },
        { action: 'MODIFY', path: 'lib/features/outfit_analysis/presentation/providers/google_vision_provider.dart', note: 'Phase 0 comment → replaced Phase 2' },
        { action: 'MODIFY', path: 'lib/core/config/outfit_intelligence_config.dart', note: 'GOOGLE_VISION bridge until Phase 2 gateway' },
        { action: 'MODIFY', path: 'mira-api/src/ai/google-vision/google-vision-outfit.service.ts', note: 'DEPRECATED banner' },
        { action: 'MODIFY', path: 'mira-api/src/ai/segmentation/outfit-segmentation.service.ts', note: 'DEPRECATED — Vision objects temporary' },
      ],
      notYet: ['حذف Google Vision (Phase 8 فقط)'],
      acceptance: ['✅ لا PR يحسّن parser Google', '✅ المرجع الرسمي موثّق'],
    },
    {
      phase: 1,
      title: 'Phase 1 — Universal Fashion Schema v1',
      status: 'done',
      goal: 'FashionVisionDocument — عقد موحّد مستقل عن أي مزود.',
      changes: [
        'TypeScript interfaces: FashionVisionDocument v1.0.0',
        'JSON Schema draft-07: fashion-vision-document.v1.json',
        'FashionOntologyRegistry ← assets/fashion/ontology.json + colors.json',
        'validateFashionVisionDocument() — Quality Gate + ontology ids',
        'buildSampleFashionVisionDocument() للاختبار والـ stub',
        'npm script: test:vision-schema (5 valid + 5 invalid)',
      ],
      files: [
        { action: 'CREATE', path: 'mira-api/src/vision/schema/fashion-vision-document.v1.ts', note: 'Universal contract types' },
        { action: 'CREATE', path: 'mira-api/src/vision/schema/fashion-vision-document.v1.json', note: 'JSON Schema' },
        { action: 'CREATE', path: 'mira-api/src/vision/schema/fashion-ontology.registry.ts', note: 'ontology + colors loader' },
        { action: 'CREATE', path: 'mira-api/src/vision/schema/fashion-vision-document.validator.ts', note: 'Quality Gate + validation' },
        { action: 'CREATE', path: 'mira-api/src/vision/schema/fashion-vision-document.schema-tests.ts', note: '5+5 test cases' },
        { action: 'CREATE', path: 'mira-api/src/vision/schema/index.ts', note: 'exports' },
        { action: 'MODIFY', path: 'mira-api/package.json', note: 'script test:vision-schema' },
      ],
      notYet: ['Normalizer pipeline service (Phase 5)', 'Conflict Resolver (Phase 6)'],
      acceptance: ['✅ schemaVersion 1.0.0', '✅ reject payload ناقص', '✅ categoryId من ontology'],
    },
    {
      phase: 2,
      title: 'Phase 2 — Vision Orchestrator + Gateway',
      status: 'done',
      goal: 'Endpoint واحد — Flutter أعمى عن المزودين (الملفات جاهزة — الربط Phase 7).',
      changes: [
        'VisionOrchestratorService — orchestrator رئيسي',
        'POST /ai/vision/outfit/analyze في AiGatewayController',
        'VisionModule → AiGatewayModule',
        'VisionOutfitAnalyzeBodyDto: occasionId, mode, skinSnapshot, locale',
        'Response: { fashionVision, analysis: null, meta } — stub حتى Phase 3–4',
        'Flutter VisionApiDataSource — يستدعي endpoint واحد فقط',
        'Flutter FashionVisionDocument entity',
        'MiraApiEndpoints.visionOutfitAnalyze = /ai/vision/outfit/analyze',
        '⚠️ OutfitIntelligenceService ما زال على GoogleVision — Phase 7',
      ],
      files: [
        { action: 'CREATE', path: 'mira-api/src/vision/vision-orchestrator.service.ts', note: 'Orchestrator (stub sample doc)' },
        { action: 'CREATE', path: 'mira-api/src/vision/vision.module.ts', note: 'NestJS module' },
        { action: 'CREATE', path: 'mira-api/src/vision/dto/vision-outfit-analyze-body.dto.ts', note: 'Request DTO' },
        { action: 'MODIFY', path: 'mira-api/src/ai/ai-gateway.controller.ts', note: 'POST vision/outfit/analyze' },
        { action: 'MODIFY', path: 'mira-api/src/ai/ai-gateway.module.ts', note: 'imports VisionModule' },
        { action: 'CREATE', path: 'lib/features/outfit_analysis/data/datasources/vision_api_data_source.dart', note: 'Flutter gateway client' },
        { action: 'CREATE', path: 'lib/features/outfit_analysis/domain/entities/fashion_vision_document.dart', note: 'Flutter DTO' },
        { action: 'MODIFY', path: 'lib/core/network/mira_api_endpoints.dart', note: 'visionOutfitAnalyze' },
      ],
      notYet: [
        'OutfitIntelligenceService → VisionApiDataSource (Phase 7)',
        'إزالة silent fallback OutfitImageAnalyzer (Phase 7)',
        'FASHN + OpenAI providers (Phase 3–4)',
      ],
      acceptance: ['✅ Endpoint exists', '✅ Flutter datasource exists', '✅ لا API keys جديدة في client', '⏳ App path switch — Phase 7'],
    },
    {
      phase: 3,
      title: 'Phase 3 — FASHN Geometry Provider',
      status: 'done',
      goal: 'FASHN يُخرج geometry فقط — لا scores ولا recommendations.',
      changes: [
        'FashnGeometryProvider implements GeometryVisionProvider — HTTP إلى FASHN',
        'parseFashnGeometryResponse() — segments + topology فقط',
        'runGeometryQualityGate() — يرفض compatibilityScore / recommendations / occasion',
        'VisionOrchestratorService → FashnGeometryProvider (بدلاً من stub sample)',
        'buildFashionVisionDocumentFromParts() — geometry حقيقي + semantics placeholder (Phase 4)',
        'analysisGate: degraded حتى اكتمال OpenAI',
        'FashnOutfitProvider (legacy) — DEPRECATED banner',
        'npm script: test:vision-geometry (6 حالات)',
        'FASHN_GEOMETRY_ENDPOINT في .env.example',
        '⚠️ بدون FASHN env → 503 FASHN_NOT_CONFIGURED — لا mock صامت',
      ],
      files: [
        { action: 'CREATE', path: 'mira-api/src/vision/providers/geometry-vision.provider.ts', note: 'Interface' },
        { action: 'CREATE', path: 'mira-api/src/vision/providers/fashn-geometry.provider.ts', note: 'HTTP provider' },
        { action: 'CREATE', path: 'mira-api/src/vision/providers/fashn-geometry.parser.ts', note: 'JSON → GeometryPayload' },
        { action: 'CREATE', path: 'mira-api/src/vision/providers/fashn-geometry.schema-tests.ts', note: '6 test cases' },
        { action: 'CREATE', path: 'mira-api/src/vision/pipeline/geometry-quality-gate.service.ts', note: 'Forbidden fields gate' },
        { action: 'CREATE', path: 'mira-api/src/vision/schema/fashion-vision-document.builder.ts', note: 'Build doc from parts' },
        { action: 'MODIFY', path: 'mira-api/src/vision/vision-orchestrator.service.ts', note: 'FASHN geometry wired' },
        { action: 'MODIFY', path: 'mira-api/src/vision/vision.module.ts', note: 'FashnGeometryProvider' },
        { action: 'MODIFY', path: 'mira-api/src/ai/mocks/fashn-outfit.provider.ts', note: 'DEPRECATED legacy' },
        { action: 'MODIFY', path: 'mira-api/.env.example', note: 'FASHN_GEOMETRY_ENDPOINT' },
        { action: 'MODIFY', path: 'mira-api/package.json', note: 'test:vision-geometry' },
      ],
      notYet: ['OutfitIntelligenceService switch (Phase 7)'],
      acceptance: ['✅ لا compatibilityScore من FASHN', '✅ لا recommendation من FASHN', '✅ فشل FASHN = structured error', '✅ test:vision-geometry OK'],
    },
    {
      phase: 4,
      title: 'Phase 4 — OpenAI Semantic Provider',
      status: 'done',
      goal: 'OpenAI يصف الصورة — لا يقرر ولا يوصي.',
      changes: [
        'OpenAiSemanticProvider implements SemanticVisionProvider — vision API',
        'response_format: json_schema strict — ontology ids من assets/fashion',
        'Input: full image + FASHN geometry hints (regionRole, bbox, topology)',
        'Output: garments[], accessories[], styleArchetypeId, layering[], colors[]',
        'runSemanticQualityGate() — يرفض scores/recommendations/luxuryRating',
        'temperature ≤ 0.2 (LLM_TEMPERATURE)',
        'VisionOrchestratorService → FASHN ثم OpenAI → FashionVisionDocument',
        'computeAnalysisGateFromSemantics() — proceed | degraded | blocked',
        'LlmOutfitReasoningService — DEPRECATED (legacy hybrid path فقط)',
        'npm script: test:vision-semantic (6 حالات)',
        '⚠️ بدون LLM_API_KEY → 503 OPENAI_NOT_CONFIGURED — لا mock صامت',
      ],
      files: [
        { action: 'CREATE', path: 'mira-api/src/vision/providers/semantic-vision.provider.ts', note: 'Interface' },
        { action: 'CREATE', path: 'mira-api/src/vision/providers/openai-semantic.provider.ts', note: 'HTTP vision provider' },
        { action: 'CREATE', path: 'mira-api/src/vision/providers/openai-semantic.parser.ts', note: 'JSON → SemanticsPayload' },
        { action: 'CREATE', path: 'mira-api/src/vision/providers/openai-semantic.response-schema.ts', note: 'Strict JSON Schema' },
        { action: 'CREATE', path: 'mira-api/src/vision/providers/openai-semantic.schema-tests.ts', note: '6 test cases' },
        { action: 'CREATE', path: 'mira-api/src/vision/pipeline/semantic-quality-gate.service.ts', note: 'Forbidden fields gate' },
        { action: 'MODIFY', path: 'mira-api/src/vision/vision-orchestrator.service.ts', note: 'OpenAI semantics wired' },
        { action: 'MODIFY', path: 'mira-api/src/vision/vision.module.ts', note: 'OpenAiSemanticProvider' },
        { action: 'MODIFY', path: 'mira-api/src/vision/schema/fashion-vision-document.builder.ts', note: 'computeAnalysisGateFromSemantics' },
        { action: 'MODIFY', path: 'mira-api/src/ai/llm/llm-outfit-reasoning.service.ts', note: 'DEPRECATED legacy scores' },
        { action: 'MODIFY', path: 'mira-api/.env.example', note: 'LLM_TEMPERATURE + LLM_TIMEOUT_MS' },
        { action: 'MODIFY', path: 'mira-api/package.json', note: 'test:vision-semantic' },
      ],
      notYet: ['Conflict Resolver (Phase 6)', 'App switch (Phase 7)'],
      acceptance: ['✅ لا compatibilityScore من OpenAI', '✅ لا recommendations من OpenAI', '✅ فشل OpenAI = structured error', '✅ test:vision-semantic OK'],
    },
    {
      phase: 5,
      title: 'Phase 5 — Quality Gate + Normalizer + Validator',
      status: 'done',
      goal: 'لا بيانات غير صالحة تدخل المحرك.',
      changes: [
        'QualityGateService — schemaVersion, required fields, min confidence, ontology validation',
        'FashionNormalizerService — map free text → ontology ids (category/type/color/archetype)',
        'map-to-nearest مع خفض confidenceMultiplier عند alias/fallback',
        'FashionValidatorService — 6 قواعد منطق أزياء (5 errors + 1 warning)',
        'provenance.pipelinePhase + normalizationNotes + rejectReasons',
        'VisionOrchestratorService → normalize → fashion rules → quality gate',
        'analysisGate: blocked عند rule errors · degraded عند warnings',
        'npm script: test:vision-pipeline (10 حالات)',
      ],
      files: [
        { action: 'CREATE', path: 'mira-api/src/vision/pipeline/quality-gate.service.ts', note: 'Document quality gate' },
        { action: 'CREATE', path: 'mira-api/src/vision/pipeline/fashion-normalizer.service.ts', note: 'Ontology normalizer' },
        { action: 'CREATE', path: 'mira-api/src/vision/pipeline/fashion-validator.service.ts', note: '6 fashion rules' },
        { action: 'CREATE', path: 'mira-api/src/vision/pipeline/vision-pipeline.schema-tests.ts', note: '10 test cases' },
        { action: 'MODIFY', path: 'mira-api/src/vision/vision-orchestrator.service.ts', note: 'Pipeline wired' },
        { action: 'MODIFY', path: 'mira-api/src/vision/vision.module.ts', note: '3 pipeline services' },
        { action: 'MODIFY', path: 'mira-api/src/vision/schema/fashion-vision-document.v1.ts', note: 'Provenance audit fields' },
        { action: 'MODIFY', path: 'mira-api/src/vision/schema/fashion-vision-document.v1.json', note: 'provenance audit schema' },
        { action: 'MODIFY', path: 'mira-api/src/vision/schema/fashion-vision-document.builder.ts', note: 'applyConfidenceMultiplier + audit' },
        { action: 'MODIFY', path: 'mira-api/src/vision/schema/fashion-vision-document.validator.ts', note: 'Validate provenance audit' },
        { action: 'MODIFY', path: 'mira-api/package.json', note: 'test:vision-pipeline' },
      ],
      notYet: ['App switch (Phase 7)'],
      acceptance: ['✅ payload بدون schemaVersion → reject', '✅ garment type نص حر → normalize', '✅ 6 قواعد validation unit tested', '✅ test:vision-pipeline OK'],
    },
    {
      phase: 6,
      title: 'Phase 6 — Conflict Resolver + Confidence Engine',
      status: 'done',
      goal: 'مقارنة semantic (OpenAI) مع geometry (FASHN).',
      changes: [
        'ConflictResolverService v1 — 3 قواعد',
        'Rule 1: one-piece (FASHN) vs two-piece (OpenAI) → blocked',
        'Rule 2: blazer vs dress → high/medium conflict',
        'Rule 3: blazer vs jacket → unify إلى outerwear (low conflict)',
        'ConfidenceEngineService — per-field + overall confidence',
        'analysisGate: proceed إذا overall ≥ 0.65 ولا conflict حرج',
        'blocked → meta.userMessageAr: أعيدي التقاط الصورة',
        'fusion.conflicts[] مسجّلة في FashionVisionDocument',
        'npm script: test:vision-conflicts (6 حالات)',
      ],
      files: [
        { action: 'CREATE', path: 'mira-api/src/vision/pipeline/conflict-resolver.service.ts', note: '3 conflict rules' },
        { action: 'CREATE', path: 'mira-api/src/vision/pipeline/confidence-engine.service.ts', note: 'Overall gate ≥ 0.65' },
        { action: 'CREATE', path: 'mira-api/src/vision/pipeline/conflict-confidence.schema-tests.ts', note: '6 test cases' },
        { action: 'MODIFY', path: 'mira-api/src/vision/vision-orchestrator.service.ts', note: 'Phase 6 wired + userMessageAr' },
        { action: 'MODIFY', path: 'mira-api/src/vision/vision.module.ts', note: 'Conflict + Confidence services' },
        { action: 'MODIFY', path: 'mira-api/src/vision/schema/fashion-vision-document.builder.ts', note: 'Optional fusion input' },
        { action: 'MODIFY', path: 'mira-api/package.json', note: 'test:vision-conflicts' },
      ],
      notYet: ['حذف Google Vision (Phase 8)'],
      acceptance: ['✅ تعارض حرج لا يمر بصمت', '✅ conflicts[] في document', '✅ 3+ conflict tests OK', '✅ test:vision-conflicts OK'],
    },
    {
      phase: 7,
      title: 'Phase 7 — MIRA Engine Integration',
      status: 'done',
      goal: 'DeterministicOutfitEngine يستهلك FashionVisionDocument عبر adapter.',
      changes: [
        'FashionVisionToEngineAdapter — FashionVisionDocument → OutfitVisualProfile + VisionLocalizedObject',
        'LegacyVisualProfileAdapter — @deprecated bridge للـ UI الحالي',
        'DeterministicOutfitEngine.analyzeFromFashionVision()',
        'OutfitIntelligenceService → VisionApiDataSource فقط',
        'إزالة GoogleVisionOutfitService من injection chain',
        'إزالة silent fallback (Google + OutfitImageAnalyzer)',
        'VisionPlatformException عند blocked / API failure',
        'visualSource: vision_platform',
        'flutter test 122 OK',
      ],
      files: [
        { action: 'CREATE', path: 'lib/features/outfit_analysis/domain/adapters/fashion_vision_to_engine_adapter.dart', note: 'Document → engine input' },
        { action: 'CREATE', path: 'lib/features/outfit_analysis/domain/adapters/legacy_visual_profile_adapter.dart', note: '@deprecated UI bridge' },
        { action: 'CREATE', path: 'lib/features/outfit_analysis/domain/exceptions/vision_platform_exception.dart', note: 'Structured errors' },
        { action: 'CREATE', path: 'test/fashion_vision_to_engine_adapter_test.dart', note: 'Adapter unit test' },
        { action: 'MODIFY', path: 'lib/features/outfit_analysis/domain/services/outfit_intelligence_service.dart', note: 'Vision API only' },
        { action: 'MODIFY', path: 'lib/features/outfit_analysis/domain/services/deterministic_outfit_engine.dart', note: 'analyzeFromFashionVision' },
        { action: 'MODIFY', path: 'lib/features/outfit_analysis/presentation/providers/outfit_intelligence_providers.dart', note: 'visionApiDataSourceProvider' },
        { action: 'MODIFY', path: 'lib/features/outfit_analysis/domain/entities/fashion_vision_document.dart', note: 'userMessageAr + isBlocked' },
        { action: 'MODIFY', path: 'test/outfit_intelligence_service_test.dart', note: 'Mock VisionApi' },
        { action: 'MODIFY', path: 'lib/core/config/outfit_intelligence_config.dart', note: 'Google frozen Phase 8' },
      ],
      notYet: [],
      acceptance: ['✅ لا GoogleVision في المسار الافتراضي', '✅ لا silent fallback', '✅ Result Screen unchanged', '✅ flutter test OK'],
    },
    {
      phase: 8,
      title: 'Phase 8 — حذف Google Vision',
      status: 'done',
      goal: 'إزالة كاملة لـ Google Vision — FASHN segmentation فقط.',
      changes: [
        'حذف google_vision_outfit_service.dart + google_vision_provider.dart',
        'حذف legacy_visual_profile_adapter.dart + outfit_intelligence_config.dart',
        'حذف test/google_vision_outfit_service_test.dart',
        'حذف mira-api/google-vision-outfit.service.ts',
        'OutfitSegmentationService → FashnGeometryProvider (لا GOOGLE_VISION)',
        'OutfitHybridIntelligenceService → VisionOrchestratorService',
        'AiModule imports VisionModule — لا GoogleVisionOutfitService',
        'إزالة GOOGLE_VISION_API_KEY من .env.example',
        'admin: fashnKeySet + llmKeySet بدل googleVisionKeySet',
        'grep google_vision في lib/ = 0',
      ],
      files: [
        { action: 'DELETE', path: 'lib/features/outfit_analysis/domain/services/google_vision_outfit_service.dart', note: 'Removed' },
        { action: 'DELETE', path: 'lib/features/outfit_analysis/presentation/providers/google_vision_provider.dart', note: 'Removed' },
        { action: 'DELETE', path: 'lib/features/outfit_analysis/domain/adapters/legacy_visual_profile_adapter.dart', note: 'Removed' },
        { action: 'DELETE', path: 'lib/core/config/outfit_intelligence_config.dart', note: 'Removed' },
        { action: 'DELETE', path: 'test/google_vision_outfit_service_test.dart', note: 'Removed' },
        { action: 'DELETE', path: 'mira-api/src/ai/google-vision/google-vision-outfit.service.ts', note: 'Removed' },
        { action: 'MODIFY', path: 'mira-api/src/ai/segmentation/outfit-segmentation.service.ts', note: 'FASHN only' },
        { action: 'MODIFY', path: 'mira-api/src/ai/services/outfit-hybrid-intelligence.service.ts', note: 'VisionOrchestrator' },
        { action: 'MODIFY', path: 'mira-api/src/ai/ai.module.ts', note: 'VisionModule import' },
        { action: 'MODIFY', path: 'mira-api/.env.example', note: 'No GOOGLE_VISION' },
      ],
      notYet: ['AI Audit baseline (50–200 images) — manual QA'],
      acceptance: ['✅ grep google_vision lib/ = 0', '✅ FASHN segmentation', '✅ PERFECT_CORP untouched', '✅ npm run build OK'],
    },
  ];

  const ALL_IMPLEMENTED_FILES = IMPLEMENTED_BY_PHASE.flatMap((p) =>
    p.files.map((f) => ({ ...f, phase: p.phase, implemented: true })),
  );

  const PLANNED_FILES = [];

  /** Live implementation log — update when completing each phase in code. */
  const IMPLEMENTATION_STATUS = [
    {
      phase: 0,
      status: 'done',
      summary: 'تجميد Google Vision — 5 ملفات DEPRECATED · bridge حتى Phase 8 · لا حذف',
      date: '2026-06-01',
    },
    {
      phase: 1,
      status: 'done',
      summary: 'FashionVisionDocument v1 · JSON Schema · ontology registry · validator · test:vision-schema (5+5) · 7 ملفات',
      date: '2026-06-01',
    },
    {
      phase: 2,
      status: 'done',
      summary: 'POST /ai/vision/outfit/analyze · VisionOrchestrator (stub) · VisionApiDataSource · ⚠️ غير موصول بالتطبيق حتى Phase 7',
      date: '2026-06-01',
    },
    {
      phase: 3,
      status: 'done',
      summary: 'FashnGeometryProvider · parser · geometry quality gate · orchestrator wired · test:vision-geometry · semantics placeholder (degraded)',
      date: '2026-06-01',
    },
    {
      phase: 4,
      status: 'done',
      summary: 'OpenAiSemanticProvider · strict json_schema · semantic quality gate · orchestrator FASHN+OpenAI · test:vision-semantic · meta.phase 4-openai-semantic',
      date: '2026-06-01',
    },
    {
      phase: 5,
      status: 'done',
      summary: 'QualityGateService · FashionNormalizerService · FashionValidatorService (6 rules) · provenance audit · test:vision-pipeline · meta.phase 5-pipeline-guard',
      date: '2026-06-01',
    },
    {
      phase: 6,
      status: 'done',
      summary: 'ConflictResolverService (3 rules) · ConfidenceEngineService (≥0.65 proceed) · fusion.conflicts · userMessageAr · test:vision-conflicts',
      date: '2026-06-01',
    },
    {
      phase: 7,
      status: 'done',
      summary: 'OutfitIntelligenceService → VisionApiDataSource · FashionVisionToEngineAdapter · no Google/fallback · flutter test 122 OK',
      date: '2026-06-01',
    },
    {
      phase: 8,
      status: 'done',
      summary: 'حذف Google Vision · FASHN segmentation · VisionOrchestrator hybrid · lib/ google_vision = 0',
      date: '2026-06-01',
    },
    {
      phase: 'Deploy',
      status: 'done',
      summary: `GitHub push ${PRODUCTION_COMMIT} · Render live · VisionModule + 6 AI routes · FASHN + OpenAI env · 313 ملف`,
      date: '2026-06-30',
    },
  ];

  const PHASES = [
    {
      id: 0,
      title: 'Phase 0 — تجميد Google Vision',
      status: 'done',
      tag: '✅ مكتمل',
      goal: 'إيقاف الاستثمار في Google Vision — bridge مؤقت فقط.',
      steps: [
        'توثيق: لا تحسينات جديدة على google_vision_outfit_service.dart',
        'توثيق: لا تحسينات على mira-api/google-vision-outfit.service.ts',
        'توثيق: لا تحسينات على outfit-segmentation.service.ts (Vision objects)',
        'إضافة تعليق DEPRECATED على الملفات الثلاثة مع رابط هذا المستند',
        'عدم حذف Google حتى Phase 8 — bridge فقط',
      ],
      acceptance: [
        'لا PR يحسّن parser Google Vision',
        'الفريق يعرف أن المرجع الرسمي هو mira-vision-platform.html',
      ],
      files: ['lib/.../google_vision_outfit_service.dart', 'mira-api/src/ai/google-vision/'],
    },
    {
      id: 1,
      title: 'Phase 1 — Universal Fashion Schema v1',
      status: 'done',
      tag: '✅ مكتمل',
      goal: 'تعريف FashionVisionDocument المستقل عن أي مزود.',
      steps: [
        'إنشاء mira-api/src/vision/schema/fashion-vision-document.v1.ts',
        'إنشاء mira-api/src/vision/schema/fashion-vision-document.v1.json (JSON Schema)',
        'ربط taxonomy بـ assets/fashion/ontology.json',
        'ربط colors بـ assets/fashion/colors.json',
        'تعريف analysisGate: proceed | blocked | degraded',
        'تعريف provenance: providers[], schemaVersion, timestamp',
        'اختبارات unit: schema validation على 5 payloads صالحة + 5 مرفوضة',
      ],
      acceptance: [
        'JSON Schema يُرفض payload ناقص',
        'كل categoryId يجب أن يexist في ontology',
        'schemaVersion = "1.0.0"',
      ],
      files: [
        'mira-api/src/vision/schema/',
        'assets/fashion/ontology.json',
      ],
    },
    {
      id: 2,
      title: 'Phase 2 — Vision Orchestrator + Gateway',
      status: 'done',
      tag: '✅ مكتمل (stub)',
      goal: 'Endpoint واحد — Flutter أعمى تمامًا عن المزودين.',
      steps: [
        'إنشاء VisionOrchestratorService في mira-api/src/vision/',
        'إنشاء POST /ai/vision/outfit/analyze (endpoint رسمي جديد)',
        'Request: multipart image + occasionId + mode + optional skin snapshot',
        'Response: FashionVisionDocument v1 + OutfitAnalysis DTO (مؤقت)',
        'مفاتيح OPENAI_* و FASHN_* على Render فقط — لا dart-define',
        'إنشاء Flutter VisionApiDataSource → يستدعي endpoint واحد فقط',
        'تحديث mira_api_endpoints.dart: visionOutfitAnalyze',
      ],
      acceptance: [
        'Flutter لا يستورد OpenAI ولا FASHN ولا Google',
        'لا API keys في lib/',
        'curl للـ endpoint يُرجع 401 بدون auth إن لزم',
      ],
      files: [
        'mira-api/src/vision/vision-orchestrator.service.ts',
        'mira-api/src/ai/ai-gateway.controller.ts',
        'lib/core/network/mira_api_endpoints.dart',
        'lib/features/outfit_analysis/data/datasources/vision_api_data_source.dart',
      ],
    },
    {
      id: 3,
      title: 'Phase 3 — FASHN Geometry Provider',
      status: 'done',
      tag: '✅ مكتمل',
      goal: 'FASHN يُخرج geometry فقط — لا scores ولا recommendations.',
      steps: [
        'إنشاء FashnGeometryProvider implements GeometryVisionProvider',
        'Output: segments[] { id, polygon, bbox, cropRef, regionRole }',
        'Output: topology { pieceCount, silhouetteHint, onePiece }',
        'إزالة/عزل FashnOutfitProvider الحالي (compatibilityScore) — legacy',
        'Quality Gate على مخرجات FASHN قبل أي دمج',
        'FASHN لا يستقبل: occasion, userId, skin, recommendations context',
        'اختبارات: mock geometry payload → يمر Quality Gate',
      ],
      acceptance: [
        'لا حقل compatibilityScore من FASHN',
        'لا حقل recommendation من FASHN',
        'فشل FASHN = structured error — لا mock صامت',
      ],
      files: [
        'mira-api/src/vision/providers/fashn-geometry.provider.ts',
        'mira-api/src/ai/mocks/fashn-outfit.provider.ts → deprecated',
      ],
    },
    {
      id: 4,
      title: 'Phase 4 — OpenAI Semantic Provider',
      status: 'done',
      tag: '✅ مكتمل',
      goal: 'OpenAI يصف الصورة — لا يقرر ولا يوصي.',
      steps: [
        'إنشاء OpenAiSemanticProvider implements SemanticVisionProvider',
        'استخدام response_format: json_object + JSON Schema صارم',
        'Input: full image + optional garment crops من FASHN',
        'Output: garments[], accessories[], styleArchetypeId, colors[], layering[]',
        'ممنوع في schema: score, recommendation, compatibility, luxuryRating',
        'إيقاف LlmOutfitReasoningService من توليد scores نهائية (legacy path)',
        'Quality Gate على مخرجات OpenAI',
        'temperature ≤ 0.2',
      ],
      acceptance: [
        'OpenAI response لا يحتوي compatibilityScore',
        'OpenAI response لا يحتوي recommendations[]',
        'فشل OpenAI = structured error — لا OutfitImageAnalyzer fallback',
      ],
      files: [
        'mira-api/src/vision/providers/openai-semantic.provider.ts',
        'mira-api/src/ai/llm/llm-outfit-reasoning.service.ts → refactor',
      ],
    },
    {
      id: 5,
      title: 'Phase 5 — Quality Gate + Normalizer + Validator',
      status: 'done',
      tag: '✅ مكتمل',
      goal: 'لا بيانات غير صالحة تدخل المحرك.',
      steps: [
        'QualityGateService: required fields, schema version, min confidence, ranges',
        'FashionNormalizerService: map raw → ontology ids (ontology.json)',
        'FashionValidatorService: قواعد منطق أزياء (5–10 قواعد v1)',
        'رفض قيم خارج taxonomy أو map-to-nearest مع خفض confidence',
        'تسجيل reject reasons في provenance',
      ],
      acceptance: [
        'payload بدون schemaVersion → reject',
        'garment type نص حر → normalize أو reject',
        '5 قواعد validation unit tested',
      ],
      files: [
        'mira-api/src/vision/pipeline/quality-gate.service.ts',
        'mira-api/src/vision/pipeline/fashion-normalizer.service.ts',
        'mira-api/src/vision/pipeline/fashion-validator.service.ts',
      ],
    },
    {
      id: 6,
      title: 'Phase 6 — Conflict Resolver + Confidence Engine',
      status: 'done',
      tag: '✅ مكتمل',
      goal: 'مقارنة semantic (OpenAI) مع geometry (FASHN).',
      steps: [
        'ConflictResolverService v1 — 3 قواعد فقط في البداية',
        'Rule 1: one-piece (FASHN) vs two-piece garment (OpenAI) → blocked',
        'Rule 2: Blazer vs Dress (semantic distance) → blocked أو degraded',
        'Rule 3: Blazer vs Jacket (قريبان) → unify إلى outerwear ontology id',
        'ConfidenceEngine: per-field + overall gate',
        'analysisGate: proceed إذا overall ≥ 0.65 ولا conflict حرج',
        'blocked → رسالة UX: أعيدي التقاط الصورة',
      ],
      acceptance: [
        'تعارض حرج لا يمر بصمت',
        'conflicts[] مسجّلة في FashionVisionDocument',
        '3 اختبارات conflict unit',
      ],
      files: [
        'mira-api/src/vision/pipeline/conflict-resolver.service.ts',
        'mira-api/src/vision/pipeline/confidence-engine.service.ts',
      ],
    },
    {
      id: 7,
      title: 'Phase 7 — MIRA Engine Integration',
      status: 'done',
      tag: 'القرار النهائي في MIRA',
      goal: 'DeterministicOutfitEngine يستهلك FashionVisionDocument.',
      steps: [
        'إنشاء FashionVisionToEngineAdapter (domain)',
        'DeterministicOutfitEngine.analyze(fashion: FashionVisionDocument, ...)',
        'LegacyVisualProfileAdapter مؤقت — للـ UI الحالي فقط @deprecated',
        'OutfitIntelligenceService يستدعي VisionApiDataSource فقط',
        'إزالة silent fallback في _resolveVisualWithObjects',
        'إزالة GoogleVisionOutfitService من injection chain',
        'تحديث outfit_intelligence_providers.dart',
        '120+ tests تبقى خضراء',
      ],
      acceptance: [
        'لا GoogleVisionOutfitService في المسار الافتراضي',
        'لا OutfitImageAnalyzer fallback صامت',
        'Result Screen unchanged — نفس UI',
        'flutter test 100%',
      ],
      files: [
        'lib/features/outfit_analysis/domain/services/outfit_intelligence_service.dart',
        'lib/features/outfit_analysis/domain/services/deterministic_outfit_engine.dart',
        'lib/features/outfit_analysis/presentation/providers/outfit_intelligence_providers.dart',
      ],
    },
    {
      id: 8,
      title: 'Phase 8 — حذف Google Vision',
      status: 'done',
      tag: 'الإنهاء',
      goal: 'إزالة كاملة بعد استقرار hybrid path.',
      steps: [
        'AI Audit: 50–200 صورة baseline vs Google',
        'مقارنة: garment detection, colors, occasion match',
        'حذف lib/.../google_vision_outfit_service.dart',
        'حذف google_vision_provider.dart',
        'حذف mira-api/google-vision-outfit.service.ts',
        'إزالة GOOGLE_VISION من segmentation — FASHN فقط',
        'حذف GOOGLE_VISION_API_KEY من docs/env',
        'حذف LegacyVisualProfileAdapter بعد UI migration',
        'تحديث هذا المستند: status = complete',
      ],
      acceptance: [
        'grep google_vision في lib/ = 0 (عدا history/comments)',
        'AI audit ≥ targets في mira-project-audit',
        'PERFECT_CORP untouched',
      ],
      files: [
        'حذف كامل google-vision/*',
        'test/google_vision_outfit_service_test.dart → استبدال',
      ],
    },
  ];

  const LAYERS = [
    { n: 1, name: 'Flutter Client', role: 'يرسل صورة + occasion + mode فقط', type: 'flutter' },
    { n: 2, name: 'mira-api Gateway', role: 'POST /ai/vision/outfit/analyze', type: 'gate' },
    { n: 3, name: 'Vision Orchestrator', role: 'تنسيق المزودين بالتوازي/التسلسل', type: 'gate' },
    { n: 4, name: 'FASHN Geometry', role: 'mask · polygon · bbox · crop · topology', type: 'provider' },
    { n: 5, name: 'OpenAI Semantic', role: 'garments · colors · style · layering · confidence', type: 'provider' },
    { n: 6, name: 'Quality Gate', role: 'schema · version · required · ranges · min confidence', type: 'gate' },
    { n: 7, name: 'Normalizer', role: 'ontology.json · colors.json', type: 'schema' },
    { n: 8, name: 'FashionVisionDocument', role: 'Universal Schema v1 — العقد المركزي', type: 'schema' },
    { n: 9, name: 'Validator', role: 'قواعد منطق أزياء', type: 'gate' },
    { n: 10, name: 'Conflict Resolver', role: 'semantic vs geometry', type: 'gate' },
    { n: 11, name: 'Confidence Engine', role: 'per-field + overall + analysisGate', type: 'gate' },
    { n: 12, name: 'Deterministic MIRA Engine', role: 'scores · harmony · ranking · luxury · reasons', type: 'engine' },
    { n: 13, name: 'Legacy Adapter (مؤقت)', role: 'OutfitVisualProfile للـ UI القديم', type: 'engine' },
    { n: 14, name: 'Result Screen', role: 'بدون تغيير UI', type: 'flutter' },
  ];

  const WHY_CHANGE = [
    { title: 'Google Vision عام', desc: 'labels عامة (Clothing, Sleeve) — ليست فهم أزياء production-grade.' },
    { title: 'لا فصل مسؤوليات', desc: 'Vision + parsing + fallback في Flutter مباشرة — صعب الاستبدال.' },
    { title: 'Silent Fallback', desc: 'OutfitImageAnalyzer يخفي فشل Vision — يمنع قياس الجودة.' },
    { title: 'مفاتيح على العميل', desc: 'GOOGLE_VISION_API_KEY في dart-define — خطر أمني وتشغيلي.' },
    { title: 'لا schema موحّد', desc: 'OutfitVisualProfile وُلد من Google — ليس نموذج أزياء.' },
    { title: 'قابلية التوسع', desc: 'استبدال OpenAI بـ Claude/Gemini يتطلب إعادة كتابة بدون Vision Platform.' },
  ];

  const CONSTITUTION = [
    'لا تنفيذ خارج هذا المستند — mira-vision-platform.html هو المرجع الرسمي الوحيد.',
    'Flutter لا يعرف OpenAI ولا FASHN ولا Google ولا أي API Key.',
    'كل استدعاءات الرؤية تمر عبر mira-api فقط.',
    'FASHN = geometry فقط. OpenAI = attributes فقط. MIRA = قرارات نهائية فقط.',
    'لا silent fallback. لا fake data. فشل = structured error.',
    'Universal Fashion Schema هو العقد — المحرك لا يعرف المزودين.',
    'LegacyVisualProfileAdapter مؤقت — يُحذف بعد اكتمال Phase 8.',
    'Google Vision: تجميد في Phase 0 — حذف كامل في Phase 8 فقط.',
    'Perfect Corp (skin) لا يُمس.',
    'لا تغيير UI · لا تغيير Result Screen · لا تغيير subscription/packages.',
  ];

  const OPENAI_ALLOWED = [
    'garment type / category', 'sleeve', 'neckline', 'fit', 'silhouette', 'style',
    'layering', 'accessories', 'shoes', 'bag', 'jewelry', 'dominant colors',
    'secondary colors', 'texture', 'materials', 'occasion estimation (hint)',
    'providerConfidence per field',
  ];

  const OPENAI_FORBIDDEN = [
    'compatibilityScore', 'recommendation', 'luxuryRating', 'outfitGrade',
    'rejectedColors (final)', 'suggestedMakeup (final)', 'styleVerdict (final)',
    'any MIRA business rules', 'skin compatibility score',
  ];

  const FASHN_ALLOWED = [
    'mask', 'polygon', 'boundingBox', 'garmentCrop', 'regionRole',
    'pieceCount', 'topology', 'silhouetteHint', 'onePiece inference',
  ];

  const FASHN_FORBIDDEN = [
    'occasion', 'userId', 'skin', 'color (final)', 'score', 'recommendation',
    'compatibility', 'luxury', 'Arabic explanation',
  ];

  /** دليل التكامل الكامل — كل متطلب مع إثبات من الكود */
  const PLATFORM_INTEGRATION = {
    stats: [
      { label: 'منصات Vision', value: '2', sub: 'FASHN + OpenAI' },
      { label: 'مفاتيح على Flutter', value: '0', sub: 'لا API keys للمزودين' },
      { label: 'Endpoint رئيسي', value: '1', sub: 'POST /ai/vision/outfit/analyze' },
      { label: 'حالة Render', value: 'Live', sub: `commit ${PRODUCTION_COMMIT}` },
      { label: 'اختبارات Vision', value: '5', sub: 'npm run test:vision-*' },
      { label: 'GitHub', value: '✓', sub: 'main متزامن' },
    ],
    platforms: [
      {
        id: 'fashn',
        name: 'FASHN',
        role: 'Geometry فقط',
        layer: 'mask · polygon · bbox · topology',
        location: 'mira-api (Render) فقط',
        providerFile: 'mira-api/src/vision/providers/fashn-geometry.provider.ts',
        wiredIn: [
          'VisionOrchestratorService.analyze() → fashnGeometry.segment()',
          'OutfitSegmentationService → FashnGeometryProvider (Phase 8)',
        ],
        http: {
          method: 'POST',
          urlTemplate: '{FASHN_BASE_URL}{FASHN_GEOMETRY_ENDPOINT}',
          defaultEndpoint: '/v1/segmentation',
          body: '{ "imageBase64": "<base64>" }',
          auth: '{FASHN_API_KEY_HEADER}: {FASHN_API_KEY_PREFIX}{FASHN_API_KEY}',
        },
        env: ['FASHN_API_KEY', 'FASHN_BASE_URL', 'FASHN_GEOMETRY_ENDPOINT', 'FASHN_API_KEY_HEADER', 'FASHN_API_KEY_PREFIX', 'FASHN_TIMEOUT_MS'],
        errors: ['FASHN_NOT_CONFIGURED (503)', 'FASHN_EMPTY_IMAGE (502)', 'QUALITY_GATE_REJECTED (502)', 'VISION_PROVIDER_FAILED (502)'],
        proof: 'fashn-geometry.provider.ts:35-67 — fetch POST مع imageBase64',
      },
      {
        id: 'openai',
        name: 'OpenAI',
        role: 'Semantic attributes فقط',
        layer: 'garments · colors · styleArchetype · layering',
        location: 'mira-api (Render) فقط',
        providerFile: 'mira-api/src/vision/providers/openai-semantic.provider.ts',
        wiredIn: [
          'VisionOrchestratorService.analyze() → openAiSemantic.describe()',
          'يستقبل geometry hints من FASHN كسياق — لا scores',
        ],
        http: {
          method: 'POST',
          urlTemplate: '{LLM_BASE_URL}/chat/completions',
          defaultBase: 'https://api.openai.com/v1',
          body: 'response_format: json_schema · vision image base64 · temperature ≤ 0.2',
          auth: 'Authorization: Bearer {LLM_API_KEY}',
        },
        env: ['LLM_API_KEY', 'LLM_BASE_URL', 'LLM_MODEL', 'LLM_TEMPERATURE', 'LLM_TIMEOUT_MS'],
        errors: ['OPENAI_NOT_CONFIGURED (503)', 'OPENAI_EMPTY_IMAGE (502)', 'QUALITY_GATE_REJECTED (502)', 'VISION_PROVIDER_FAILED (502)'],
        proof: 'openai-semantic.provider.ts:80-120 — chat/completions + json_schema',
      },
      {
        id: 'firebase',
        name: 'Firebase Auth',
        role: 'مصادقة Flutter → mira-api',
        layer: 'ID Token في Authorization header',
        location: 'Flutter client + mira-api guard',
        providerFile: 'lib/core/network/api_client.dart',
        wiredIn: [
          'ApiClient interceptor → user.getIdToken()',
          'FirebaseAuthGuard على AiGatewayController',
        ],
        http: {
          method: '—',
          header: 'Authorization: Bearer <Firebase ID Token>',
        },
        env: ['FIREBASE_PROJECT_ID', 'GOOGLE_APPLICATION_CREDENTIALS (server)', 'AUTH_SKIP (dev only)'],
        errors: ['401 Unauthorized إذا token مفقود أو منتهي'],
        proof: 'api_client.dart:30-34 · ai-gateway.controller.ts:37 @UseGuards(FirebaseAuthGuard)',
      },
      {
        id: 'render',
        name: 'Render',
        role: 'استضافة mira-api + Postgres',
        layer: 'Web Service · healthCheck · env vars',
        location: 'render.yaml + Dashboard',
        providerFile: 'render.yaml',
        wiredIn: [
          'buildCommand: prisma generate + nest build',
          'startCommand: prisma migrate deploy + start:prod',
          'healthCheckPath: /api/v1/health',
        ],
        http: {
          productionUrl: 'https://mira-api-n4p3.onrender.com/api/v1',
          health: 'GET /api/v1/health',
        },
        env: ['DATABASE_URL (from mira-db)', 'NODE_ENV', 'API_PREFIX', 'SKIN_PROVIDER', 'PERFECT_API_KEY', 'FASHN_*', 'LLM_*'],
        errors: ['Deploy fail إذا build فشل · DB migrate fail'],
        proof: 'render.yaml:11-52 · mira_api_config.dart:16 default baseUrl',
      },
      {
        id: 'perfect_corp',
        name: 'Perfect Corp (YouCam)',
        role: 'تحليل البشرة فقط — خارج Vision Outfit',
        layer: 'SKIN_PROVIDER=perfect_corp',
        location: 'mira-api — لم يُمس في ترحيل Vision',
        providerFile: 'mira-api/src/ai/mocks/perfect-corp-skin.provider.ts',
        wiredIn: ['POST /ai/skin-analysis — مسار منفصل عن Vision Platform'],
        env: ['PERFECT_API_KEY', 'PERFECT_BASE_URL', 'PERFECT_CORP_*'],
        proof: 'health.controller.ts:20-29 — skinProvider + perfectCorpKeySet',
      },
    ],
    envMatrix: [
      { key: 'FASHN_API_KEY', required: true, where: 'Render only', default: '—', readBy: 'FashnGeometryProvider', proof: 'fashn-geometry.provider.ts:35' },
      { key: 'FASHN_BASE_URL', required: true, where: 'Render only', default: '—', readBy: 'FashnGeometryProvider', proof: 'fashn-geometry.provider.ts:36' },
      { key: 'FASHN_GEOMETRY_ENDPOINT', required: false, where: 'Render only', default: '/v1/segmentation', readBy: 'FashnGeometryProvider', proof: 'fashn-geometry.provider.ts:45-48' },
      { key: 'FASHN_API_KEY_HEADER', required: false, where: 'Render only', default: 'Authorization', readBy: 'FashnGeometryProvider', proof: 'fashn-geometry.provider.ts:50' },
      { key: 'FASHN_API_KEY_PREFIX', required: false, where: 'Render only', default: 'Bearer ', readBy: 'FashnGeometryProvider', proof: 'fashn-geometry.provider.ts:51' },
      { key: 'FASHN_TIMEOUT_MS', required: false, where: 'Render only', default: '20000', readBy: 'FashnGeometryProvider', proof: 'fashn-geometry.provider.ts:49' },
      { key: 'LLM_API_KEY', required: true, where: 'Render only', default: '—', readBy: 'OpenAiSemanticProvider', proof: 'openai-semantic.provider.ts:49' },
      { key: 'LLM_BASE_URL', required: false, where: 'Render only', default: 'https://api.openai.com/v1', readBy: 'OpenAiSemanticProvider', proof: 'openai-semantic.provider.ts:50' },
      { key: 'LLM_MODEL', required: false, where: 'Render only', default: 'gpt-4o-mini', readBy: 'OpenAiSemanticProvider', proof: 'openai-semantic.provider.ts:59' },
      { key: 'LLM_TEMPERATURE', required: false, where: 'Render only', default: '0.2 (capped)', readBy: 'OpenAiSemanticProvider', proof: 'openai-semantic.provider.ts:60-61' },
      { key: 'LLM_TIMEOUT_MS', required: false, where: 'Render only', default: '45000', readBy: 'OpenAiSemanticProvider', proof: 'openai-semantic.provider.ts:62' },
      { key: 'FIREBASE_PROJECT_ID', required: true, where: 'Render only', default: '—', readBy: 'FirebaseAuthGuard', proof: 'admin.service.ts:482-483' },
      { key: 'GOOGLE_APPLICATION_CREDENTIALS', required: true, where: 'Render only', default: '—', readBy: 'firebase-admin', proof: 'render.yaml:45-46' },
      { key: 'USE_MIRA_API', required: true, where: 'Flutter dart-define', default: 'true', readBy: 'MiraApiConfig', proof: 'mira_api_config.dart:7-10' },
      { key: 'MIRA_API_BASE_URL', required: false, where: 'Flutter dart-define', default: 'https://mira-api-n4p3.onrender.com/api/v1', readBy: 'ApiClient baseUrl', proof: 'mira_api_config.dart:14-17' },
    ],
    renderSteps: [
      { n: 1, title: 'إنشاء Web Service', action: 'Render Dashboard → Blueprint من render.yaml أو يدوي', proof: 'render.yaml:11-18' },
      { n: 2, title: 'ربط Postgres', action: 'mira-db → DATABASE_URL تلقائي', proof: 'render.yaml:4-8, 39-42' },
      { n: 3, title: 'إضافة FASHN env', action: 'FASHN_API_KEY + FASHN_BASE_URL (Secret) — مطلوب لتحليل الإطلالة', proof: 'mira-api/.env.example:33-43' },
      { n: 4, title: 'إضافة OpenAI env', action: 'LLM_API_KEY (Secret) — مطلوب للـ semantics', proof: 'mira-api/.env.example:47-51' },
      { n: 5, title: 'Firebase Admin', action: 'FIREBASE_PROJECT_ID + GOOGLE_APPLICATION_CREDENTIALS', proof: 'render.yaml:43-46' },
      { n: 6, title: 'Perfect Corp (skin)', action: 'PERFECT_API_KEY + SKIN_PROVIDER=perfect_corp', proof: 'render.yaml:25-32' },
      { n: 7, title: 'Deploy + migrate', action: 'npx prisma migrate deploy && npm run start:prod', proof: 'render.yaml:18' },
      { n: 8, title: 'تحقق Health', action: 'GET https://<host>/api/v1/health → status: ok', proof: 'health.controller.ts:16-17' },
      { n: 9, title: 'تحقق Admin config', action: 'GET /admin/system-config → fashnKeySet + llmKeySet: true', proof: 'admin.service.ts:466-468' },
    ],
    flutterSteps: [
      { n: 1, title: 'تفعيل Backend', action: '--dart-define=USE_MIRA_API=true', file: 'lib/core/config/mira_api_config.dart', proof: 'useBackend = bool.fromEnvironment(USE_MIRA_API, defaultValue: true)' },
      { n: 2, title: 'Base URL', action: '--dart-define=MIRA_API_BASE_URL=https://.../api/v1', file: 'lib/core/config/mira_api_config.dart', proof: 'default: mira-api-n4p3.onrender.com/api/v1' },
      { n: 3, title: 'لا مفاتيح مزودين', action: 'ممنوع FASHN_API_KEY / LLM_API_KEY / GOOGLE_VISION في Flutter', file: '—', proof: 'Phase 8: grep google_vision lib/ = 0' },
      { n: 4, title: 'Vision API client', action: 'VisionApiDataSource.analyze() → multipart POST', file: 'lib/features/outfit_analysis/data/datasources/vision_api_data_source.dart', proof: 'MiraApiEndpoints.visionOutfitAnalyze' },
      { n: 5, title: 'Auth تلقائي', action: 'ApiClient يحقن Firebase ID token', file: 'lib/core/network/api_client.dart', proof: 'interceptors → getIdToken()' },
      { n: 6, title: 'مسار التحليل', action: 'OutfitIntelligenceService → VisionApi → Engine → Result', file: 'lib/features/outfit_analysis/domain/services/outfit_intelligence_service.dart', proof: '_resolveVisionFromPlatform() — لا fallback' },
      { n: 7, title: 'Segmentation ثانوي', action: 'POST /ai/outfit-segmentation (FASHN على السيرفر)', file: 'lib/features/outfit_analysis/data/datasources/outfit_segmentation_api_data_source.dart', proof: 'outfitSegmentation endpoint' },
      { n: 8, title: 'اختبار', action: 'flutter test test/outfit_intelligence_service_test.dart', file: 'test/', proof: '13 tests Phase 7' },
    ],
    backendFiles: [
      { path: 'mira-api/src/ai/ai-gateway.controller.ts', role: 'POST /ai/vision/outfit/analyze + FirebaseAuthGuard', lines: '121-151' },
      { path: 'mira-api/src/vision/vision-orchestrator.service.ts', role: 'FASHN → OpenAI → pipeline → FashionVisionDocument', lines: '87-238' },
      { path: 'mira-api/src/vision/providers/fashn-geometry.provider.ts', role: 'HTTP → FASHN segmentation', lines: '26-101' },
      { path: 'mira-api/src/vision/providers/openai-semantic.provider.ts', role: 'HTTP → OpenAI vision+json_schema', lines: '40-162' },
      { path: 'mira-api/src/ai/segmentation/outfit-segmentation.service.ts', role: 'FASHN contours للـ overlay', lines: '61-130' },
      { path: 'mira-api/src/vision/vision.module.ts', role: 'DI: providers + orchestrator', lines: '11-32' },
      { path: 'mira-api/src/ai/ai.module.ts', role: 'imports VisionModule', lines: '24-25' },
      { path: 'mira-api/.env.example', role: 'قالب كل المتغيرات', lines: '33-51' },
    ],
    endpoints: [
      {
        name: 'Vision Outfit Analyze (رئيسي)',
        method: 'POST',
        path: '/api/v1/ai/vision/outfit/analyze',
        auth: 'Firebase Bearer',
        multipart: ['image (File)', 'occasionId (string)', 'mode: quick|smart', 'skinSnapshot? (JSON string)', 'locale? (default ar)'],
        response: '{ fashionVision, analysis: null, meta: { processingMs, analysisGate, phase, userMessageAr? } }',
        flutter: 'VisionApiDataSource → MiraApiEndpoints.visionOutfitAnalyze',
        proof: 'ai-gateway.controller.ts:121-151 · vision_api_data_source.dart:26-42',
      },
      {
        name: 'Outfit Segmentation (overlay)',
        method: 'POST',
        path: '/api/v1/ai/outfit-segmentation',
        auth: 'Firebase Bearer',
        multipart: ['image (File)'],
        response: 'OutfitSegmentMapDto — regions, colors, source: fashn_geometry_contour',
        flutter: 'OutfitSegmentationApiDataSource',
        proof: 'ai-gateway.controller.ts:105-114 · outfit-segmentation.service.ts:94',
      },
      {
        name: 'Health',
        method: 'GET',
        path: '/api/v1/health',
        auth: 'لا',
        response: '{ status, integrations: { skinProvider, perfectCorpKeySet } }',
        proof: 'health.controller.ts:9-31',
      },
    ],
    errorCodes: [
      { code: 'FASHN_NOT_CONFIGURED', http: 503, when: 'FASHN_API_KEY أو FASHN_BASE_URL فارغ', ux: 'خدمة غير متاحة' },
      { code: 'OPENAI_NOT_CONFIGURED', http: 503, when: 'LLM_API_KEY فارغ', ux: 'خدمة غير متاحة' },
      { code: 'VISION_PROVIDER_FAILED', http: 502, when: 'FASHN أو OpenAI HTTP فشل', ux: 'أعيدي المحاولة' },
      { code: 'QUALITY_GATE_REJECTED', http: '400/502', when: 'JSON مزود يحتوي حقول ممنوعة أو schema invalid', ux: 'أعيدي التقاط الصورة' },
      { code: 'IMAGE_REQUIRED', http: 400, when: 'buffer فارغ', ux: 'صورة مطلوبة' },
      { code: 'SKIN_REQUIRED', http: 400, when: 'mode=smart بدون skinSnapshot', ux: 'تحليل بشرة أولاً' },
      { code: 'ANALYSIS_BLOCKED', http: '200', when: 'analysisGate=blocked في meta (HTTP 200 + gate blocked)', ux: 'userMessageAr من السيرفر' },
      { code: 'VISION_API_DISABLED', http: '—', when: 'Flutter USE_MIRA_API=false', ux: 'VisionPlatformException' },
    ],
    verifyChecklist: [
      { step: 'Backend build', cmd: 'cd mira-api && npm run build', expect: 'nest build OK' },
      { step: 'Schema tests', cmd: 'cd mira-api && npm run test:vision-schema', expect: '5 valid + 5 invalid' },
      { step: 'Geometry gate', cmd: 'cd mira-api && npm run test:vision-geometry', expect: '6 cases OK' },
      { step: 'Semantic gate', cmd: 'cd mira-api && npm run test:vision-semantic', expect: 'mock + forbidden fields' },
      { step: 'Pipeline', cmd: 'cd mira-api && npm run test:vision-pipeline', expect: 'normalizer + quality gate' },
      { step: 'Conflicts', cmd: 'cd mira-api && npm run test:vision-conflicts', expect: '3 rules OK' },
      { step: 'Flutter adapter', cmd: 'flutter test test/fashion_vision_to_engine_adapter_test.dart', expect: '1+ tests' },
      { step: 'Flutter intelligence', cmd: 'flutter test test/outfit_intelligence_service_test.dart', expect: '13 tests' },
      { step: 'Routes live', cmd: 'Render startup logs', expect: 'vision/outfit/analyze + outfit-segmentation mapped' },
      { step: 'GitHub sync', cmd: `git log -1 → ${PRODUCTION_COMMIT}`, expect: 'Vision Platform pushed' },
      { step: 'Health live', cmd: 'curl https://mira-api-n4p3.onrender.com/api/v1/health', expect: '"status":"ok"' },
      { step: 'Admin keys (dev)', cmd: 'GET /admin/system-config + X-Admin-Key', expect: 'fashnKeySet:true, llmKeySet:true' },
    ],
    gaps: [
      {
        severity: 'ok',
        title: '✅ GitHub + Render — منشور (30 يونيو 2026)',
        detail: `commit ${PRODUCTION_COMMIT} على main · VisionModule live · 6 مسارات AI · Prisma OK`,
        proof: 'Render deploy logs 2026-06-30 07:12 UTC',
        fix: '— مكتمل',
      },
      {
        severity: 'warn',
        title: 'FASHN API adapter — قد يحتاج توافق مع /v1/run',
        detail: 'الكود الحالي يستدعي POST {FASHN_BASE_URL}/v1/segmentation بشكل متزامن. API FASHN الرسمي async (/v1/run + poll). أول تحليل حيّ قد يرجع 502 VISION_PROVIDER_FAILED.',
        proof: 'fashn-geometry.provider.ts:53-68',
        fix: 'إعادة كتابة adapter أو تأكيد endpoint من FASHN — راقب Render logs',
      },
      {
        severity: 'info',
        title: 'اختبار E2E من التطبيق',
        detail: 'لم يُثبت بعد تحليل إطلالة حيّ بنجاح على الإنتاج — يتطلب Firebase login + صورة.',
        proof: 'Phase 9 evaluation — مخطّط',
        fix: 'جرّبي من Flutter → راقبي Render logs',
      },
      {
        severity: 'info',
        title: 'AI Audit baseline (50–200 صورة)',
        detail: 'موصوف في Phase 9 — لم يُؤتمت بعد.',
        proof: 'production-readiness Phase 9',
        fix: 'mira-project-audit.html',
      },
    ],
    architectureFlow: `┌─────────────────────────────────────────────────────────────────┐
│ FLUTTER (لا مفاتيح مزودين)                                      │
│  OutfitIntelligenceService.analyze()                            │
│    ├─ VisionApiDataSource ──POST──► /ai/vision/outfit/analyze   │
│    │     ApiClient + Firebase ID Token                          │
│    ├─ FashionVisionToEngineAdapter → DeterministicOutfitEngine  │
│    └─ OutfitSegmentationApiDataSource ──POST──► /outfit-seg...  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ RENDER — mira-api (NestJS)                                      │
│  AiGatewayController @UseGuards(FirebaseAuthGuard)              │
│    └─ VisionOrchestratorService                                 │
│         ├─ FashnGeometryProvider ──HTTP──► FASHN API            │
│         ├─ OpenAiSemanticProvider ──HTTP──► OpenAI API          │
│         ├─ Normalizer → Validator → Conflict → Confidence       │
│         └─ FashionVisionDocument v1.0.0                         │
│  OutfitSegmentationService ──► FashnGeometryProvider (overlay)│
└─────────────────────────────────────────────────────────────────┘`,
    curlExample: `# يتطلب Firebase ID Token من مستخدم مسجّل
curl -X POST "https://mira-api-n4p3.onrender.com/api/v1/ai/vision/outfit/analyze" \\
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" \\
  -F "image=@outfit.jpg" \\
  -F "occasionId=work" \\
  -F "mode=quick" \\
  -F "locale=ar"

# بدون FASHN env على السيرفر → 503 { "code": "FASHN_NOT_CONFIGURED" }
# بدون LLM_API_KEY → 503 { "code": "OPENAI_NOT_CONFIGURED" }
# نجاح → 200 { "fashionVision": {...}, "analysis": null, "meta": {...} }`,
    flutterRunExample: `# Production (افتراضي — USE_MIRA_API=true)
flutter run

# Local API
flutter run \\
  --dart-define=MIRA_API_BASE_URL=http://localhost:3000/api/v1 \\
  --dart-define=USE_MIRA_API=true

# ممنوع في release:
# --dart-define=FASHN_API_KEY=...
# --dart-define=LLM_API_KEY=...
# --dart-define=GOOGLE_VISION_API_KEY=...`,
  };

  /**
   * خارطة النضج الإنتاجي — Production Readiness Roadmap (Post Phase 8)
   * امتداد رسمي لـ Vision Platform — لا إعادة تصميم معمارية.
   */
  const PRODUCTION_READINESS = {
    id: 'production-readiness-roadmap',
    titleAr: 'خارطة النضج الإنتاجي',
    titleEn: 'Production Readiness Roadmap',
    subtitle: 'Post Phase 8 · Phases 9–17',
    version: '1.0.0',
    date: '2026-06-01',
    status: 'planned',
    principle: 'تنفيذ تدريجي — قيمة هندسية حقيقية دون تعقيد غير ضروري في النسخة الأولى. لا تُنفَّذ جميع المراحل 9–17 دفعة واحدة.',
    completedFoundation: [
      'Universal Fashion Schema v1',
      'Vision Orchestrator',
      'FASHN Geometry Provider',
      'OpenAI Semantic Provider',
      'Quality Gate · Fashion Normalizer · Fashion Validator',
      'Conflict Resolver · Confidence Engine',
      'Deterministic MIRA Engine Integration (Flutter)',
      'إزالة Google Vision بالكامل',
      'Provider-independent architecture',
    ],
    unchangedComponents: [
      'Universal Fashion Schema',
      'Vision Orchestrator',
      'Deterministic MIRA Engine (business logic / scores)',
      'Quality Gate',
      'Fashion Validator',
      'Fashion Normalizer',
      'Conflict Resolver',
      'Confidence Engine',
      'Flutter UI · Result Screen',
      'Perfect Corp integration (skin)',
    ],
    alreadyInCodebase: [
      { item: 'Unit tests (schema, geometry, semantic, pipeline, conflicts)', path: 'mira-api/package.json → test:vision-*', note: 'جودة الكود — ليس جودة AI' },
      { item: 'Flutter analysis cache (SHA256 + occasion + skin)', path: 'lib/.../outfit_analysis_cache_service.dart', note: 'client-side — ليس server cache' },
      { item: 'Redis (rate limit فقط)', path: 'mira-api/src/redis/redis.service.ts', note: 'اختياري على Render' },
      { item: 'Admin overview stats', path: 'mira-api/src/admin/admin.service.ts', note: 'عدّ طلبات — ليس AI ops dashboard' },
      { item: 'OpenAI prompt (hardcoded)', path: 'openai-semantic.provider.ts', note: 'غير versioned — Phase 11' },
      { item: 'Provider interfaces', path: 'geometry-vision.provider.ts · semantic-vision.provider.ts', note: 'Registry كامل — Phase 12' },
    ],
    priorityTiers: [
      {
        tier: 'قبل الإنتاج',
        phases: [9, 14],
        rationale: 'إثبات علمي أن AI يعمل — CI regression lite',
        urgency: 'critical',
      },
      {
        tier: 'أول 3–6 أشهر بعد الإطلاق',
        phases: [10, 15, 17],
        rationale: 'استقرار تشغيلي · تقليل تكلفة · تنبيهات قبل شكاوى المستخدمين',
        urgency: 'high',
      },
      {
        tier: 'تطور طويل المدى',
        phases: [11, 12, 13, 16],
        rationale: 'صيانة · استقلال مزودين · بيانات خاصة · شرح أوضح',
        urgency: 'medium',
      },
    ],
    recommendedOrder: [
      'Phase 9 — Evaluation Framework (golden 200)',
      'Phase 14-lite — CI: build + test:vision-* على كل push',
      'Phase 17-lite — alerts: provider failures + latency spike',
      'Phase 10-lite — 5–8 metrics في admin portal',
      'Phase 15 — server Redis cache (عند ظهور تكرار/تكلفة)',
      'Phase 11 — prompt versioning (قبل أي tuning)',
      'Phase 12 — provider registry (عند مزود ثالث)',
      'Phase 13 — dataset collector (بعد consent قانوني)',
      'Phase 16 — explainability polish (UX فقط — لا تغيير scoring)',
      'Phase 14-full — evaluate:vision على 200 صورة nightly',
    ],
    phases: [
      {
        id: 9,
        title: 'AI Evaluation Framework',
        titleAr: 'إطار تقييم الذكاء الاصطناعي',
        status: 'pending',
        priority: 'critical',
        when: 'قبل الإنتاج',
        tag: 'مطلوب قبل الإطلاق',
        goal: 'قياس جودة AI موضوعيًا باستخدام golden dataset — unit tests لا تكفي لإثبات دقة اكتشاف القطع والألوان والطبقات.',
        problem: [
          'Unit tests تتحقق من schema وgates — لا من: هل الفستان فعلًا فستان؟',
          'بدون benchmark لا يوجد إثبات علمي عند تغيير FASHN/OpenAI/prompt',
          'لا مقارنة يدوية — تقارير قابلة لإعادة الإنتاج',
        ],
        deliverables: [
          'mira-api/evaluation/datasets/',
          'mira-api/evaluation/benchmarks/',
          'mira-api/evaluation/golden/',
          'mira-api/evaluation/reports/',
          'npm run evaluate:vision',
        ],
        goldenDataset: {
          minImages: 200,
          versioning: 'dataset version pinned في كل report',
          sampleStructure: {
            image: 'ملف صورة',
            ground_truth_json: 'تسميات مرجعية',
            expectedGarments: 'categoryId + typeId من ontology',
            expectedColors: 'color ids من colors.json',
            expectedAccessories: 'من ontology',
            expectedLayering: 'مصفوفة layering',
            expectedStyle: 'styleArchetypeId',
            expectedConfidenceRange: 'min–max لكل حقل',
          },
          diversity: 'عبايات · بدلات · إطلالات خليجية · إضاءة ضعيفة · مرآة · full_body · layered',
          ontologyBinding: 'ground_truth يجب أن يتبع assets/fashion/ontology.json + colors.json',
        },
        evaluatorOutputs: [
          'precision · recall · F1 (per-field: garment · color · layering · style)',
          'top-1 accuracy · top-3 accuracy',
          'false positives · false negatives',
          'provider latency (FASHN · OpenAI · total)',
          'provider cost estimate per run',
          'blocked / degraded / proceed rates',
        ],
        metricsScope: {
          fashn: 'IoU bbox/polygon · piece count · topology match',
          openai: 'top-1 typeId · color ids · styleArchetypeId',
          pipeline: 'analysisGate distribution · conflict rate',
          notInScope: 'MIRA Engine scores — engine منفصل عن vision eval',
        },
        steps: [
          'إنشاء هيكل evaluation/ (datasets · benchmarks · golden · reports)',
          'جمع 200+ صورة متنوعة + ground_truth.json لكل صورة',
          'ربط ground_truth بـ ontology.json و colors.json',
          'بناء VisionEvaluator — يشغّل orchestrator على golden set',
          'حساب precision/recall/F1 per-field + latency + cost',
          'npm script: evaluate:vision → report JSON + HTML',
          'تثبيت baseline report — مرجع لكل deploy',
          'توثيق في docs/mira-vision-platform.html',
        ],
        acceptance: [
          'كل deployment يقيّم نفس dataset',
          'التقارير قابلة لإعادة الإنتاج (reproducible)',
          'لا مقارنة يدوية مطلوبة',
          'Dataset مُ versioned',
        ],
        evidence: 'Google · OpenAI · Meta · Anthropic — كل تحديث model يُقيَّم على golden set ثابت قبل الإطلاق.',
        files: ['mira-api/evaluation/**', 'mira-api/package.json → evaluate:vision'],
        miraToday: 'test:vision-* — unit فقط · Phase 8 notYet: AI Audit 50–200 يدوي',
      },
      {
        id: 10,
        title: 'AI Operations Dashboard',
        titleAr: 'لوحة عمليات الذكاء الاصطناعي',
        status: 'pending',
        priority: 'high',
        when: '3–6 أشهر بعد الإطلاق',
        tag: 'تشغيلي',
        goal: 'فريق الإنتاج يراقب صحة AI بدون قراءة logs يدويًا.',
        metrics: [
          'processing latency (total)',
          'OpenAI latency',
          'FASHN latency',
          'confidence distribution (overall + per-field)',
          'blocked analyses count/rate',
          'degraded analyses count/rate',
          'provider failures (FASHN · OpenAI)',
          'average cost per request',
          'request volume',
          'cache hit ratio (بعد Phase 15)',
          'daily trend (7d · 30d)',
        ],
        mvpFirst: 'ابدأ بـ 5–8 metrics في admin-portal — لا dashboard ضخم في v1',
        steps: [
          'تخزين meta لكل request (processingMs · analysisGate · provider errors)',
          'جدول Prisma vision_request_metrics أو time-series بسيط',
          'توسيع admin portal — صفحة Vision Ops',
          'رسوم: latency P50/P95 · blocked rate · confidence histogram',
          'ربط بـ meta الموجود في VisionOrchestrator response',
          'لا تخزين صور بدون consent',
        ],
        acceptance: [
          'كل request قابل للملاحظة (observable)',
          'metrics تاريخية متاحة',
          'لا فحص logs يدوي للحالات العادية',
        ],
        evidence: 'Modern ML systems تعتمد observability dashboards — بدونها الحوادث غير مرئية.',
        files: ['admin-portal/**', 'mira-api/src/vision/metrics/**', 'prisma schema'],
        miraToday: 'admin/system-config — fashnKeySet فقط · لا latency metrics',
      },
      {
        id: 11,
        title: 'Prompt Versioning',
        titleAr: 'إصدارات الـ Prompts',
        status: 'pending',
        priority: 'medium',
        when: 'قبل tuning prompts إنتاجي',
        tag: 'صيانة',
        goal: 'كل semantic prompt مُ versioned — لا hardcode في الكود.',
        deliverables: [
          'mira-api/prompts/semantic/v1.json',
          'mira-api/prompts/semantic/v2.json (عند التغيير)',
          'provenance.promptVersion',
          'provenance.promptChecksum (SHA256)',
        ],
        steps: [
          'استخراج prompt من openai-semantic.provider.ts → prompts/semantic/v1.json',
          'Loader يقرأ JSON + يحسب checksum',
          'تخزين promptVersion + promptChecksum في FashionVisionDocument.provenance',
          'rollback = تغيير env PROMPT_VERSION أو ملف active',
          'ربط مع Phase 9 — كل eval report يسجل promptVersion',
        ],
        acceptance: [
          'كل response قابل للتتبع لإصدار prompt محدد',
          'Rollback ممكن بدون deploy كود',
        ],
        evidence: 'LLM prompts = executable assets — عوملها كمصدر كود (source code).',
        files: ['mira-api/prompts/semantic/**', 'openai-semantic.provider.ts'],
        miraToday: 'prompt مدمج في openai-semantic.provider.ts — غير versioned',
      },
      {
        id: 12,
        title: 'Provider Registry',
        titleAr: 'سجل المزودين',
        status: 'pending',
        priority: 'low-v1',
        when: 'عند إضافة مزود ثالث (Claude · Gemini · Qwen)',
        tag: 'استقلال',
        goal: 'المزودون قابلون للاستبدال بدون تغيير business logic.',
        registryColumns: ['Provider', 'Model', 'Version', 'Capabilities', 'Latency', 'Avg Cost', 'Status', 'Priority'],
        currentProviders: ['OpenAI (semantic)', 'FASHN (geometry)'],
        futureProviders: ['Claude', 'Gemini', 'Qwen', 'Llama'],
        steps: [
          'جدول provider_registry (DB أو config)',
          'VisionOrchestrator يحل المزود عبر registry — لا أسماء hardcoded',
          'Capability flags: geometry | semantic',
          'Failover priority chain (optional)',
          'لا provider names داخل MIRA Engine',
        ],
        acceptance: [
          'لا أسماء مزودين داخل business logic',
          'المزودون يُحلّون عبر registry',
        ],
        evidence: 'Dependency inversion — يمنع vendor lock-in.',
        files: ['mira-api/src/vision/registry/**'],
        miraToday: 'GeometryVisionProvider + SemanticVisionProvider interfaces موجودة — registry table غير موجود',
      },
      {
        id: 13,
        title: 'Dataset Collector',
        titleAr: 'جامع البيانات الخاص',
        status: 'pending',
        priority: 'long-term',
        when: 'بعد consent قانوني + Phase 9',
        tag: 'بيانات خاصة',
        goal: 'بناء datasets خاصة بميرا مع الوقت — بعد موافقة صريحة من المستخدم.',
        store: ['image hash (SHA256)', 'analysis result', 'confidence', 'user feedback', 'accepted result', 'corrected labels (optional)'],
        neverStore: ['PII', 'authentication tokens', 'payment info', 'sensitive user data', 'raw images بدون consent'],
        steps: [
          'موافقة صريحة في UI (privacy consent screen)',
          'API endpoint opt-in collection',
          'تخزين hash + labels فقط افتراضيًا',
          'ربط مع account_deletion_service — حذف عند طلب المستخدم',
          'تغذية golden dataset تدريجيًا (human review)',
        ],
        acceptance: [
          'Dataset يتحسن باستمرار',
          'training corpus ينمو طبيعيًا',
          'GDPR/خصوصية محترمة',
        ],
        evidence: 'كل منصة AI ناجحة تميز نفسها ببيانات خاصة — ليس بنماذج طرف ثالث فقط.',
        files: ['mira-api/src/evaluation/collector/**', 'lib/features/privacy/**'],
        miraToday: 'لا collector — privacy screens موجودة جزئيًا',
      },
      {
        id: 14,
        title: 'Continuous AI Regression Testing',
        titleAr: 'اختبار انحدار AI مستمر',
        status: 'pending',
        priority: 'critical',
        when: 'مع Phase 9 (lite قبل الإطلاق · full بعده)',
        tag: 'CI',
        goal: 'منع تدهور جودة AI صامتًا عند كل deploy.',
        pipeline: `Git Push
  ↓
CI (GitHub Actions)
  ↓
npm run build + test:vision-*
  ↓
evaluate:vision (subset 20 صورة على PR · full 200 على main/nightly)
  ↓
Compare with baseline report
  ↓
If metrics drop below threshold → Fail Pipeline`,
        steps: [
          'إنشاء .github/workflows/vision-ci.yml',
          'PR: build + test:vision-* + eval subset',
          'main/nightly: evaluate:vision full golden set',
          'baseline JSON في repo (evaluation/benchmarks/baseline.json)',
          'thresholds: F1 drop > 2% = warn · > 5% = fail',
          'retry على API flakiness (FASHN/OpenAI outages)',
        ],
        acceptance: [
          'لا deploy يخفض جودة AI دون اكتشاف',
          'CI يفشل عند regression حقيقي',
        ],
        evidence: 'Regression testing = ممارسة هندسية قياسية — مخرجات AI تحتاجها كالبرمجيات.',
        files: ['.github/workflows/**', 'mira-api/evaluation/benchmarks/baseline.json'],
        miraToday: 'لا .github/workflows في المشروع',
      },
      {
        id: 15,
        title: 'Vision Cache',
        titleAr: 'ذاكرة تخزين Vision',
        status: 'pending',
        priority: 'high',
        when: 'عند ظهور تكرار طلبات / تكلفة مرتفعة',
        tag: 'تكلفة · سرعة',
        goal: 'تقليل latency وتكلفة FASHN + OpenAI للطلبات المتكررة.',
        pipeline: `SHA256(image) + occasionId + mode + schemaVersion + ontologyVersion
  ↓
Redis
  ↓
Cached FashionVisionDocument (كامل)
  ↓
Skip FASHN + OpenAI`,
        cacheRules: {
          cache: ['تحليلات مكتملة analysisGate=proceed', 'نفس schema + ontology version'],
          neverCache: ['errors', 'blocked requests', 'degraded إذا gate حساس', 'ontology version قديم'],
        },
        cacheKey: 'hash(image) + occasionId + mode + schemaVersion + promptVersion',
        steps: [
          'VisionCacheService في mira-api',
          'Redis GET قبل orchestrator — SET بعد success',
          'TTL configurable (مثلاً 7 أيام)',
          'invalidate عند تحديث ontology أو prompt',
          'metric: cache hit ratio → Phase 10 dashboard',
        ],
        acceptance: [
          'تحليلات متكررة فورية',
          'تكلفة provider تنخفض measurably',
        ],
        evidence: 'Caching identical inference requests يقلل تكلفة AI production بشكل كبير.',
        files: ['mira-api/src/vision/cache/**', 'redis.service.ts'],
        miraToday: 'Flutter OutfitAnalysisCacheService (client) — لا server Redis vision cache',
      },
      {
        id: 16,
        title: 'Explainability Layer',
        titleAr: 'طبقة الشرح',
        status: 'pending',
        priority: 'medium',
        when: 'تحسين UX — لا تغيير scoring',
        tag: 'ثقة المستخدم',
        goal: 'كل توصية لها سبب بشري مقروء — لا قرارات opaque.',
        extendAnalysis: [
          'reasoning (لماذا هذه الدرجة)',
          'color harmony explanation',
          'occasion reasoning',
          'style reasoning',
          'confidence explanation',
          'rejection explanation (عند blocked)',
        ],
        constraint: 'لا تعديل DeterministicOutfitEngine scoring — طبقة عرض/نصوص فقط',
        steps: [
          'توحيد matchReasons / mismatchReasons العربية',
          'إضافة explanation fields في response (اختياري)',
          'ربط fusion.conflicts بشرح للمستخدم',
          'userMessageAr موجود — توسيعه',
        ],
        acceptance: [
          'كل recommendation يتضمن سببًا بشريًا',
          'لا قرارات بدون شرح',
        ],
        evidence: 'Explainability تزيد ثقة المستخدم وتسهّل debugging.',
        files: ['lib/features/outfit_analysis/**', 'deterministic_outfit_engine.dart'],
        miraToday: 'matchReasons · mismatchReasons · userMessageAr موجودة جزئيًا',
      },
      {
        id: 17,
        title: 'AI Monitoring & Alerting',
        titleAr: 'مراقبة وتنبيهات AI',
        status: 'pending',
        priority: 'high',
        when: '3–6 أشهر بعد الإطلاق (lite: أسبوع 1)',
        tag: 'عمليات',
        goal: 'فريق العمليات يتلقى تنبيهات قبل أن يبلغ المستخدمون.',
        monitor: [
          'OpenAI failures',
          'FASHN failures',
          'timeout rate',
          'rate limits (429)',
          'average latency P95',
          'request volume spike',
          'provider availability',
          'average cost per hour',
          'confidence trend drop',
        ],
        alerts: [
          'Provider unavailable (> 5% failures في 10 دقائق)',
          'Confidence collapse (متوسط ينخفض > 15% عن baseline)',
          'Latency spike (P95 > 30s)',
          'Cost anomaly (تكلفة/ساعة > 2x المتوسط)',
          'Failure rate increase',
        ],
        mvpFirst: 'Render logs + webhook بسيط أو Sentry — قبل نظام alerting معقد',
        steps: [
          'عدادات failure/latency في orchestrator',
          'cron أو background job يفحص thresholds',
          'إشعار: email · Slack · Render webhook',
          'ربط مع Phase 10 metrics',
        ],
        acceptance: [
          'Ops team يعلم قبل المستخدمين',
          'تنبيهات تلقائية — ليس مراقبة يدوية',
        ],
        evidence: 'Monitoring يحوّل AI من تجريبي إلى منصة production تشغيلية.',
        files: ['mira-api/src/vision/monitoring/**'],
        miraToday: 'Logger فقط — لا alerts',
      },
    ],
    gapsNotInRoadmap: [
      'Contract testing مع recorded FASHN/OpenAI fixtures',
      'Ontology version bump → invalidate cache + re-eval golden',
      'Render cold start latency (ليس AI failure)',
      'Cost caps يومية لـ OpenAI/FASHN',
      'Feature flags لتشغيل Vision تدريجيًا',
    ],
    antiPatterns: [
      'تنفيذ Phases 9–17 دفعة واحدة',
      'تعديل MIRA Engine scores تحت اسم explainability',
      'بناء Provider Registry قبل مزود ثالث',
      'Dataset collector قبل consent قانوني',
      'Fail CI على كل fluctuation طفيف في API خارجي',
    ],
  };

  const SCHEMA_EXAMPLE = `{
  "schemaVersion": "1.0.0",
  "analysisGate": "proceed",
  "provenance": {
    "providers": ["fashn-geometry", "openai-semantic"],
    "timestamp": "2026-06-01T12:00:00Z",
    "orchestratorVersion": "1.0.0"
  },
  "geometry": {
    "segments": [
      {
        "id": "seg-upper-1",
        "regionRole": "upper",
        "polygon": [[0.22,0.18],[0.78,0.18],[0.72,0.52],[0.28,0.52]],
        "bbox": { "x": 0.22, "y": 0.18, "w": 0.56, "h": 0.34 },
        "cropRef": "crops/upper-1.jpg"
      }
    ],
    "topology": {
      "pieceCount": 2,
      "onePiece": false,
      "silhouetteHint": "two_piece"
    }
  },
  "semantics": {
    "garments": [
      {
        "categoryId": "outerwear",
        "typeId": "blazer",
        "sleeve": "long",
        "neckline": "notched_lapel",
        "fit": "tailored",
        "colors": ["black"],
        "material": "wool_blend",
        "providerConfidence": 0.71
      }
    ],
    "accessories": [],
    "styleArchetypeId": "business",
    "layering": ["base", "outerwear"]
  },
  "fusion": {
    "resolvedGarments": [{ "categoryId": "outerwear", "typeId": "blazer", "confidence": 0.68 }],
    "conflicts": [],
    "fieldConfidence": [{ "field": "garments[0].typeId", "confidence": 0.68 }],
    "overallConfidence": 0.68
  }
}`;

  function $(id) { return document.getElementById(id); }

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE) || '{}'); }
    catch { return {}; }
  }

  function save(state) {
    localStorage.setItem(STORAGE, JSON.stringify(state));
  }

  function toast(msg) {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
  }

  function renderProductionDeploy() {
    const el = $('production-deploy-content');
    if (!el) return;
    const d = PRODUCTION_DEPLOY;
    el.innerHTML = `
      <div class="official-seal" style="background:#f0fdf4;border-color:var(--ok);margin-bottom:16px">
        <strong>🎉 منشور على Render — ${d.date} ${d.time}</strong>
        <p style="margin:8px 0 0;font-size:0.88rem">
          commit <code>${d.commit}</code> · ${d.filesInCommit} ملف ·
          <a href="${d.serviceUrl}" target="_blank" rel="noopener">${d.serviceUrl}</a>
        </p>
      </div>
      <div class="stat-grid" style="margin-bottom:16px">
        ${[
          ['Live', 'حالة الخدمة'],
          [d.commit.slice(0, 7), 'Git commit'],
          ['6', 'مسارات AI'],
          ['5', 'Prisma migrations'],
        ].map(([n, l]) => `<div class="stat-card"><div class="num">${n}</div><div class="lbl">${l}</div></div>`).join('')}
      </div>
      <h4>إثبات من startup logs</h4>
      <ul style="font-size:0.86rem;padding-right:20px">
        ${d.startupProof.map((s) => `<li><code style="font-size:0.78rem;direction:ltr">${s}</code></li>`).join('')}
      </ul>
      <h4>مسارات Vision (Production)</h4>
      <table class="audit-table">
        <thead><tr><th>Method</th><th>Path</th><th>Flutter</th></tr></thead>
        <tbody>
          <tr><td>POST</td><td><code>/api/v1/ai/vision/outfit/analyze</code></td><td>VisionApiDataSource</td></tr>
          <tr><td>POST</td><td><code>/api/v1/ai/outfit-segmentation</code></td><td>OutfitSegmentationApiDataSource</td></tr>
        </tbody>
      </table>
      <h4 style="margin-top:16px">Env vars مضبوطة على Render</h4>
      <p style="font-size:0.84rem;color:var(--muted)">${d.envConfigured.join(' · ')}</p>
      <h4 style="margin-top:16px">الخطوات التالية</h4>
      <ol style="font-size:0.86rem;padding-right:20px">
        ${d.nextSteps.map((s) => `<li>${s}</li>`).join('')}
      </ol>
    `;
  }

  function renderCurrentRuntime() {
    const split = $('runtime-split');
    if (split) {
      const live = CURRENT_RUNTIME.liveUserPath;
      const neu = CURRENT_RUNTIME.newApiPath;
      split.innerHTML = `
        <div class="runtime-box live">
          <h4>${live.title}</h4>
          <pre class="dependency-graph" style="margin:8px 0;font-size:0.68rem;padding:12px">${live.flow}</pre>
          <p style="margin:0;font-size:0.82rem;color:var(--ok)">${live.note}</p>
        </div>
        <div class="runtime-box new">
          <h4>${neu.title}</h4>
          <pre class="dependency-graph" style="margin:8px 0;font-size:0.68rem;padding:12px;color:#c8f0d8">${neu.flow}</pre>
          <p style="margin:0;font-size:0.82rem;color:var(--ok)">${neu.note}</p>
        </div>
      `;
    }

    const qa = $('runtime-qa-table');
    if (qa) {
      qa.innerHTML = RUNTIME_QA.map((r) => `
        <tr><td>${r.q}</td><td><strong>${r.a}</strong></td></tr>
      `).join('');
    }
  }

  function renderImplementedDetail() {
    const el = $('implemented-detail-container');
    if (!el) return;
    el.innerHTML = IMPLEMENTED_BY_PHASE.map((p) => `
      <div class="implemented-phase-block">
        <h3>
          ${p.title}
          <span class="completion-pill done">✅ مكتمل</span>
          <span class="phase-tag scope">${p.files.length} ملف</span>
        </h3>
        <p style="margin:0 0 10px;font-size:0.88rem"><strong>الهدف:</strong> ${p.goal}</p>
        <h4 style="font-size:0.85rem;margin:14px 0 6px">ما تم تنفيذه</h4>
        <ul style="margin:0;padding-right:18px;font-size:0.86rem">
          ${p.changes.map((c) => `<li>${c}</li>`).join('')}
        </ul>
        <h4 style="font-size:0.85rem;margin:14px 0 6px">الملفات</h4>
        <ul style="margin:0;padding:0;list-style:none">
          ${p.files.map((f) => `
            <li style="padding:6px 0;border-bottom:1px dashed var(--border);font-size:0.82rem">
              <span class="completion-pill done" style="font-size:0.68rem">${f.action}</span>
              <code style="font-size:0.72rem;direction:ltr;margin:0 6px">${f.path}</code>
              — ${f.note}
            </li>
          `).join('')}
        </ul>
        ${p.notYet.length ? `
          <h4 style="font-size:0.85rem;margin:14px 0 6px;color:var(--warn)">لم يُنفَّذ بعد (مراحل لاحقة)</h4>
          <ul style="margin:0;padding-right:18px;font-size:0.84rem;color:var(--muted)">
            ${p.notYet.map((n) => `<li>${n}</li>`).join('')}
          </ul>
        ` : ''}
        <p style="margin:12px 0 0;font-size:0.82rem"><strong>معايير القبول:</strong> ${p.acceptance.join(' · ')}</p>
      </div>
    `).join('');
  }

  function renderImplementedFiles() {
    const tbody = document.querySelector('#implemented-files-table tbody');
    if (!tbody) return;
    const rows = [...ALL_IMPLEMENTED_FILES, ...PLANNED_FILES];
    tbody.innerHTML = rows.map((f) => `
      <tr>
        <td>Phase ${f.phase}</td>
        <td><span class="completion-pill ${f.implemented ? 'done' : 'partial'}">${f.action}</span></td>
        <td class="${f.implemented ? 'file-status-done' : 'file-status-pending'}">${f.implemented ? '✅ منفّذ' : '⏳ مخطّط'}</td>
        <td><code style="font-size:0.7rem;direction:ltr">${f.path}</code></td>
        <td style="font-size:0.82rem">${f.note}</td>
      </tr>
    `).join('');
  }

  function renderVerifyCommands() {
    const el = $('verify-commands');
    if (el) el.textContent = VERIFY_COMMANDS;
  }

  function renderPlatformIntegration() {
    const pi = PLATFORM_INTEGRATION;

    const statsEl = $('integration-stats');
    if (statsEl) {
      statsEl.innerHTML = pi.stats.map((s) => `
        <div class="stat-card">
          <div class="num">${s.value}</div>
          <div class="lbl">${s.label}</div>
          <small style="display:block;font-size:0.72rem;color:var(--muted);margin-top:4px">${s.sub}</small>
        </div>
      `).join('');
    }

    const platEl = $('integration-platforms');
    if (platEl) {
      platEl.innerHTML = `
        <h3 style="margin-top:24px">مصفوفة المنصات</h3>
        <table class="audit-table">
          <thead><tr>
            <th>المنصة</th><th>الدور</th><th>أين؟</th><th>ملف الإثبات</th><th>متغيرات env</th>
          </tr></thead>
          <tbody>
            ${pi.platforms.map((p) => `
              <tr>
                <td><strong>${p.name}</strong><br><small style="color:var(--muted)">${p.id}</small></td>
                <td>${p.role}<br><small>${p.layer}</small></td>
                <td>${p.location}</td>
                <td><code style="font-size:0.68rem;direction:ltr">${p.providerFile}</code></td>
                <td style="font-size:0.78rem">${(p.env || []).map((e) => `<code>${e}</code>`).join('<br>')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${pi.platforms.map((p) => `
          <details class="implemented-phase-block" style="margin-top:12px;padding:14px">
            <summary style="cursor:pointer;font-weight:700">${p.name} — تفاصيل HTTP والأخطاء</summary>
            <p style="font-size:0.84rem;margin:10px 0"><strong>موصول في:</strong> ${p.wiredIn.join(' · ')}</p>
            ${p.http ? `<pre class="schema-block" style="font-size:0.72rem">${JSON.stringify(p.http, null, 2)}</pre>` : ''}
            <p style="font-size:0.82rem"><strong>أكواد خطأ:</strong> ${(p.errors || []).join(' · ')}</p>
            <p style="font-size:0.82rem;color:var(--ok)"><strong>إثبات:</strong> ${p.proof}</p>
          </details>
        `).join('')}
      `;
    }

    const archEl = $('integration-architecture');
    if (archEl) {
      archEl.innerHTML = `
        <h3 style="margin-top:28px">مخطط التكامل الكامل</h3>
        <pre class="schema-block" style="font-size:0.68rem;direction:ltr;text-align:left">${pi.architectureFlow}</pre>
      `;
    }

    const envEl = $('integration-env');
    if (envEl) {
      envEl.innerHTML = `
        <h3 style="margin-top:28px">جدول متغيرات البيئة — مع الإثبات</h3>
        <table class="audit-table">
          <thead><tr>
            <th>المتغير</th><th>مطلوب؟</th><th>أين يُضبط</th><th>الافتراضي</th><th>يُقرأ في</th><th>إثبات</th>
          </tr></thead>
          <tbody>
            ${pi.envMatrix.map((e) => `
              <tr>
                <td><code>${e.key}</code></td>
                <td>${e.required ? '<span class="completion-pill fail">نعم</span>' : '<span class="completion-pill partial">اختياري</span>'}</td>
                <td>${e.where}</td>
                <td style="font-size:0.78rem">${e.default}</td>
                <td style="font-size:0.78rem">${e.readBy}</td>
                <td><code style="font-size:0.65rem;direction:ltr">${e.proof}</code></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p style="font-size:0.84rem;margin-top:12px">
          القالب الكامل: <code>mira-api/.env.example</code> — انسخه محليًا إلى <code>.env</code> للتطوير.
        </p>
      `;
    }

    const renderEl = $('integration-render');
    if (renderEl) {
      renderEl.innerHTML = `
        <h3 style="margin-top:28px">Render — خطوات النشر والتكامل</h3>
        <ol style="padding-right:20px;font-size:0.88rem">
          ${pi.renderSteps.map((s) => `
            <li style="margin-bottom:14px">
              <strong>${s.n}. ${s.title}</strong><br>
              ${s.action}<br>
              <code style="font-size:0.68rem;direction:ltr;color:var(--ok)">إثبات: ${s.proof}</code>
            </li>
          `).join('')}
        </ol>
        <div class="rules-box" style="background:#fff8e6;border-color:var(--gold);margin-top:16px">
          <h4 style="margin-top:0">⚠️ بعد النشر — تحقق من المفاتيح</h4>
          <p style="margin:0;font-size:0.86rem">
            Admin API: <code>GET /api/v1/admin/system-config</code> مع header <code>X-Admin-Key</code>
            — يجب أن يظهر <code>fashnKeySet: true</code> و <code>llmKeySet: true</code>
            (admin.service.ts:466-468)
          </p>
        </div>
      `;
    }

    const frontEl = $('integration-frontend');
    if (frontEl) {
      frontEl.innerHTML = `
        <h3 style="margin-top:28px">Flutter — التكامل (Frontend)</h3>
        <table class="audit-table">
          <thead><tr><th>#</th><th>الخطوة</th><th>الإجراء</th><th>الملف</th><th>إثبات</th></tr></thead>
          <tbody>
            ${pi.flutterSteps.map((s) => `
              <tr>
                <td>${s.n}</td>
                <td><strong>${s.title}</strong></td>
                <td style="font-size:0.82rem">${s.action}</td>
                <td><code style="font-size:0.68rem;direction:ltr">${s.file}</code></td>
                <td style="font-size:0.78rem">${s.proof}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <h4 style="margin-top:16px">أوامر التشغيل</h4>
        <pre class="schema-block" style="direction:ltr;text-align:left">${pi.flutterRunExample}</pre>
      `;
    }

    const backEl = $('integration-backend');
    if (backEl) {
      backEl.innerHTML = `
        <h3 style="margin-top:28px">mira-api — التكامل (Backend)</h3>
        <table class="audit-table">
          <thead><tr><th>المسار</th><th>الدور</th><th>أسطر</th></tr></thead>
          <tbody>
            ${pi.backendFiles.map((f) => `
              <tr>
                <td><code style="font-size:0.68rem;direction:ltr">${f.path}</code></td>
                <td style="font-size:0.82rem">${f.role}</td>
                <td><code>${f.lines}</code></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    const epEl = $('integration-endpoints');
    if (epEl) {
      epEl.innerHTML = `
        <h3 style="margin-top:28px">Endpoints — العقد الكامل</h3>
        ${pi.endpoints.map((e) => `
          <div class="implemented-phase-block" style="margin-bottom:16px;padding:14px">
            <h4 style="margin:0 0 8px">${e.name}</h4>
            <p style="margin:0 0 8px;font-size:0.86rem">
              <code style="direction:ltr">${e.method} ${e.path}</code>
              · Auth: ${e.auth}
            </p>
            ${e.multipart ? `<p style="font-size:0.82rem"><strong>multipart:</strong> ${e.multipart.join(' · ')}</p>` : ''}
            <p style="font-size:0.82rem"><strong>Response:</strong> ${e.response}</p>
            ${e.flutter ? `<p style="font-size:0.82rem"><strong>Flutter:</strong> ${e.flutter}</p>` : ''}
            <p style="font-size:0.78rem;color:var(--ok)"><strong>إثبات:</strong> ${e.proof}</p>
          </div>
        `).join('')}
        <h4>مثال curl — Vision Analyze</h4>
        <pre class="schema-block" style="direction:ltr;text-align:left;font-size:0.72rem">${pi.curlExample}</pre>
      `;
    }

    const errEl = $('integration-errors');
    if (errEl) {
      errEl.innerHTML = `
        <h3 style="margin-top:28px">أكواد الأخطاء — لا silent fallback</h3>
        <table class="audit-table">
          <thead><tr><th>Code</th><th>HTTP</th><th>متى؟</th><th>UX</th></tr></thead>
          <tbody>
            ${pi.errorCodes.map((e) => `
              <tr>
                <td><code>${e.code}</code></td>
                <td>${e.http}</td>
                <td style="font-size:0.82rem">${e.when}</td>
                <td style="font-size:0.82rem">${e.ux}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p style="font-size:0.84rem;margin-top:10px">
          Flutter: <code>VisionPlatformException</code> — vision_platform_exception.dart
          · userMessageAr عند blocked
        </p>
      `;
    }

    const verifyEl = $('integration-verify');
    if (verifyEl) {
      verifyEl.innerHTML = `
        <h3 style="margin-top:28px">قائمة التحقق — Integration Checklist</h3>
        <table class="audit-table">
          <thead><tr><th>الخطوة</th><th>الأمر</th><th>المتوقع</th></tr></thead>
          <tbody>
            ${pi.verifyChecklist.map((v) => `
              <tr>
                <td><strong>${v.step}</strong></td>
                <td><code style="font-size:0.68rem;direction:ltr">${v.cmd}</code></td>
                <td style="font-size:0.82rem;color:var(--ok)">${v.expect}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    const gapsEl = $('integration-gaps');
    if (gapsEl) {
      gapsEl.innerHTML = `
        <h3 style="margin-top:28px">فجوات معروفة — يجب إغلاقها قبل الإنتاج</h3>
        ${pi.gaps.map((g) => `
          <div class="card ${g.severity === 'warn' ? 'warn' : g.severity === 'ok' ? 'ok' : ''}" style="margin-top:12px;padding:14px">
            <h4 style="margin:0 0 6px">${g.severity === 'warn' ? '⚠️' : g.severity === 'ok' ? '✅' : 'ℹ️'} ${g.title}</h4>
            <p style="margin:0 0 8px;font-size:0.86rem">${g.detail}</p>
            <p style="margin:0 0 6px;font-size:0.78rem"><strong>إثبات:</strong> ${g.proof}</p>
            <p style="margin:0;font-size:0.82rem;color:var(--primary-strong)"><strong>الإصلاح:</strong> ${g.fix}</p>
          </div>
        `).join('')}
      `;
    }
  }

  function renderProductionReadiness() {
    const pr = PRODUCTION_READINESS;
    const state = load();

    const heroEl = $('readiness-hero');
    if (heroEl) {
      heroEl.innerHTML = `
        <p style="margin:0 0 12px;font-size:0.92rem">${pr.principle}</p>
        <div class="rules-box" style="background:#f0f7ff;border-color:var(--primary);margin-bottom:16px">
          <h4 style="margin:0 0 8px;color:var(--primary-strong)">✅ ما اكتمل (Phases 0–8) — لا إعادة تصميم</h4>
          <div class="rules-grid">
            ${pr.completedFoundation.map((c) => `<div class="rule-item allowed">${c}</div>`).join('')}
          </div>
        </div>
        <div class="rules-box" style="background:#fff8f8;border-color:rgba(180,60,60,0.25);margin-bottom:16px">
          <h4 style="margin:0 0 8px;color:var(--danger)">🔒 ممنوع تغييره — Phases 9–17 تُوسّع حوله فقط</h4>
          <div class="rules-grid">
            ${pr.unchangedComponents.map((c) => `<div class="rule-item forbidden" style="opacity:0.85">${c}</div>`).join('')}
          </div>
        </div>
      `;
    }

    const priorityEl = $('readiness-priority');
    if (priorityEl) {
      priorityEl.innerHTML = `
        <h3 style="margin-top:8px">أولويات التنفيذ</h3>
        <table class="audit-table">
          <thead><tr><th>الطبقة</th><th>المراحل</th><th>السبب</th><th>الإلحاح</th></tr></thead>
          <tbody>
            ${pr.priorityTiers.map((t) => `
              <tr>
                <td><strong>${t.tier}</strong></td>
                <td>${t.phases.map((p) => `<code>Phase ${p}</code>`).join(' · ')}</td>
                <td style="font-size:0.84rem">${t.rationale}</td>
                <td><span class="completion-pill ${t.urgency === 'critical' ? 'fail' : t.urgency === 'high' ? 'partial' : 'done'}">${t.urgency}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <h4 style="margin-top:20px">الترتيب الموصى به للتنفيذ</h4>
        <ol style="font-size:0.88rem;padding-right:22px;line-height:1.9">
          ${pr.recommendedOrder.map((s) => `<li>${s}</li>`).join('')}
        </ol>
      `;
    }

    const existingEl = $('readiness-existing');
    if (existingEl) {
      existingEl.innerHTML = `
        <h3 style="margin-top:8px">ما هو موجود في الكود اليوم (لا تُعد بناءه)</h3>
        <table class="audit-table">
          <thead><tr><th>العنصر</th><th>المسار</th><th>ملاحظة</th></tr></thead>
          <tbody>
            ${pr.alreadyInCodebase.map((r) => `
              <tr>
                <td>${r.item}</td>
                <td><code style="font-size:0.68rem;direction:ltr">${r.path}</code></td>
                <td style="font-size:0.82rem;color:var(--muted)">${r.note}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    const phasesEl = $('readiness-phases-container');
    if (phasesEl) {
      phasesEl.innerHTML = pr.phases.map((p) => {
        const stepsHtml = p.steps.map((step, si) => {
          const key = `pr${p.id}-s${si}`;
          const checked = state[key] ? 'checked' : '';
          return `<li>
            <input type="checkbox" id="${key}" data-key="${key}" ${checked} />
            <label for="${key}">${step}</label>
          </li>`;
        }).join('');

        const priorityCls = p.priority === 'critical' ? 'fail' : p.priority === 'high' ? 'partial' : 'done';

        let extra = '';
        if (p.goldenDataset) {
          extra += `<h5 style="margin:14px 0 6px;font-size:0.85rem">Golden Dataset</h5>
            <ul style="margin:0;padding-right:18px;font-size:0.84rem">
              <li>الحد الأدنى: <strong>${p.goldenDataset.minImages}</strong> صورة</li>
              <li>التنوع: ${p.goldenDataset.diversity}</li>
              <li>الربط: ${p.goldenDataset.ontologyBinding}</li>
              <li>الحقول: ${Object.keys(p.goldenDataset.sampleStructure).join(' · ')}</li>
            </ul>`;
        }
        if (p.evaluatorOutputs) {
          extra += `<h5 style="margin:14px 0 6px;font-size:0.85rem">مخرجات evaluate:vision</h5>
            <ul style="margin:0;padding-right:18px;font-size:0.84rem">${p.evaluatorOutputs.map((o) => `<li>${o}</li>`).join('')}</ul>`;
        }
        if (p.metrics) {
          extra += `<h5 style="margin:14px 0 6px;font-size:0.85rem">Metrics</h5>
            <ul style="margin:0;padding-right:18px;font-size:0.84rem">${p.metrics.map((m) => `<li>${m}</li>`).join('')}</ul>`;
          if (p.mvpFirst) extra += `<p style="font-size:0.82rem;color:var(--warn)"><strong>MVP:</strong> ${p.mvpFirst}</p>`;
        }
        if (p.deliverables) {
          extra += `<h5 style="margin:14px 0 6px;font-size:0.85rem">Deliverables</h5>
            <ul style="margin:0;padding-right:18px;font-size:0.84rem">${p.deliverables.map((d) => `<li><code style="font-size:0.72rem">${d}</code></li>`).join('')}</ul>`;
        }
        if (p.pipeline) {
          extra += `<h5 style="margin:14px 0 6px;font-size:0.85rem">Pipeline</h5><pre class="schema-block" style="font-size:0.72rem;direction:ltr;text-align:left">${p.pipeline}</pre>`;
        }
        if (p.cacheRules) {
          extra += `<h5 style="margin:14px 0 6px;font-size:0.85rem">قواعد Cache</h5>
            <p style="font-size:0.84rem"><strong>يُكاش:</strong> ${p.cacheRules.cache.join(' · ')}</p>
            <p style="font-size:0.84rem"><strong>لا يُكاش:</strong> ${p.cacheRules.neverCache.join(' · ')}</p>`;
        }
        if (p.monitor) {
          extra += `<h5 style="margin:14px 0 6px;font-size:0.85rem">Monitor · Alerts</h5>
            <p style="font-size:0.84rem"><strong>مراقبة:</strong> ${p.monitor.join(' · ')}</p>
            <p style="font-size:0.84rem"><strong>تنبيهات:</strong> ${(p.alerts || []).join(' · ')}</p>`;
          if (p.mvpFirst) extra += `<p style="font-size:0.82rem;color:var(--warn)"><strong>MVP:</strong> ${p.mvpFirst}</p>`;
        }
        if (p.metricsScope) {
          extra += `<h5 style="margin:14px 0 6px;font-size:0.85rem">نطاق القياس</h5>
            <ul style="font-size:0.84rem">
              <li>FASHN: ${p.metricsScope.fashn}</li>
              <li>OpenAI: ${p.metricsScope.openai}</li>
              <li>Pipeline: ${p.metricsScope.pipeline}</li>
              <li>خارج النطاق: ${p.metricsScope.notInScope}</li>
            </ul>`;
        }
        if (p.problem) {
          extra += `<h5 style="margin:14px 0 6px;font-size:0.85rem">المشكلة</h5>
            <ul style="margin:0;padding-right:18px;font-size:0.84rem">${p.problem.map((x) => `<li>${x}</li>`).join('')}</ul>`;
        }
        if (p.constraint) {
          extra += `<p style="font-size:0.84rem;color:var(--danger)"><strong>قيد:</strong> ${p.constraint}</p>`;
        }

        return `<div class="phase-timeline-item pending" id="readiness-phase-${p.id}">
          <h4>Phase ${p.id} — ${p.titleAr}
            <span class="phase-tag pending">${p.tag}</span>
            <span class="completion-pill ${priorityCls}" style="margin-right:6px">${p.priority}</span>
          </h4>
          <p style="margin:0 0 6px;font-size:0.82rem;color:var(--muted)"><strong>التوقيت:</strong> ${p.when}</p>
          <p style="margin:0 0 10px;font-size:0.88rem"><strong>الهدف:</strong> ${p.goal}</p>
          ${extra}
          <h5 style="margin:14px 0 6px;font-size:0.85rem">خطوات التنفيذ</h5>
          <ul class="phase-step-list">${stepsHtml}</ul>
          <h5 style="margin:14px 0 6px;font-size:0.85rem">معايير القبول</h5>
          <ul style="margin:0;padding-right:18px;font-size:0.84rem">${p.acceptance.map((a) => `<li>✓ ${a}</li>`).join('')}</ul>
          <p style="margin:12px 0 6px;font-size:0.82rem"><strong>إثبات صناعي:</strong> <em>${p.evidence}</em></p>
          <p style="margin:0;font-size:0.82rem"><strong>في MIRA اليوم:</strong> <span style="color:var(--warn)">${p.miraToday}</span></p>
          <p style="margin:6px 0 0;font-size:0.78rem;color:var(--muted)"><strong>ملفات:</strong> ${p.files.join(' · ')}</p>
        </div>`;
      }).join('');

      phasesEl.addEventListener('change', (e) => {
        if (e.target.type !== 'checkbox' || !e.target.dataset.key) return;
        const s = load();
        s[e.target.dataset.key] = e.target.checked;
        save(s);
        toast('تم حفظ تقدّم خارطة النضج');
      });
    }

    const gapsEl = $('readiness-gaps');
    if (gapsEl) {
      gapsEl.innerHTML = `
        <h3 style="margin-top:24px">فجوات إضافية (لم تُذكر في البرومبت الأصلي)</h3>
        <ul style="font-size:0.88rem;padding-right:20px">${pr.gapsNotInRoadmap.map((g) => `<li>${g}</li>`).join('')}</ul>
        <h3 style="margin-top:20px">ممنوعات التنفيذ</h3>
        <div class="rules-grid">
          ${pr.antiPatterns.map((a) => `<div class="rule-item forbidden">${a}</div>`).join('')}
        </div>
      `;
    }

    const summaryEl = $('readiness-summary-table');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <table class="audit-table">
          <thead><tr><th>Phase</th><th>الاسم</th><th>الأولوية</th><th>التوقيت</th><th>الحالة</th></tr></thead>
          <tbody>
            ${pr.phases.map((p) => `
              <tr>
                <td><strong>${p.id}</strong></td>
                <td>${p.titleAr}<br><small style="color:var(--muted)">${p.title}</small></td>
                <td><span class="completion-pill ${p.priority === 'critical' ? 'fail' : p.priority === 'high' ? 'partial' : 'done'}">${p.priority}</span></td>
                <td style="font-size:0.82rem">${p.when}</td>
                <td><span class="completion-pill partial">⏳ مخطّط</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  }

  function renderImplementationStatus() {
    const tbody = document.querySelector('#implementation-status-table tbody');
    if (!tbody) return;
    const pill = { done: 'done', pending: 'partial', blocked: 'fail' };
    tbody.innerHTML = IMPLEMENTATION_STATUS.map((row) => `
      <tr>
        <td><strong>Phase ${row.phase}</strong></td>
        <td><span class="completion-pill ${pill[row.status] || 'unknown'}">${row.status === 'done' ? '✅ مكتمل' : '⏳ معلّق'}</span></td>
        <td style="font-size:0.84rem">${row.summary}</td>
        <td>${row.date}</td>
      </tr>
    `).join('');

    const next = IMPLEMENTATION_STATUS.find((r) => r.status === 'pending');
    const hint = $('next-phase-hint');
    if (hint && next) {
      hint.textContent = `⚠️ التطبيق ما زال على Google Vision حتى Phase 7 · المرحلة التالية: Phase ${next.phase} — ${PHASES.find((p) => p.id === next.phase)?.title ?? ''}`;
    } else if (hint) {
      hint.textContent = 'Phases 0–8 مكتملة ✓ · المرحلة التالية الموصى بها: Phase 9 — AI Evaluation Framework (خارطة النضج الإنتاجي)';
    }
  }

  function renderPipelineStack() {
    const el = $('pipeline-stack');
    if (!el) return;
    let html = '';
    LAYERS.forEach((layer, i) => {
      if (i > 0) html += '<div class="pipeline-arrow">↓</div>';
      html += `<div class="pipeline-layer ${layer.type}">
        <span class="layer-num" style="display:inline-block;width:22px;height:22px;line-height:22px;border-radius:6px;background:var(--primary);color:#fff;font-size:0.7rem;margin-left:6px">${layer.n}</span>
        ${layer.name}
        <small>${layer.role}</small>
      </div>`;
    });
    el.innerHTML = html;
  }

  function renderLayerCards() {
    const el = $('layer-cards');
    if (!el) return;
    el.innerHTML = LAYERS.map((l) => `
      <div class="layer-card">
        <h4><span class="layer-num">${l.n}</span>${l.name}</h4>
        <p style="margin:0;font-size:0.84rem;color:var(--muted)">${l.role}</p>
      </div>
    `).join('');
  }

  function renderWhy() {
    const el = $('why-grid');
    if (!el) return;
    el.innerHTML = WHY_CHANGE.map((w) => `
      <div class="why-card"><h4>${w.title}</h4><p>${w.desc}</p></div>
    `).join('');
  }

  function renderConstitution() {
    const el = $('constitution-list');
    if (!el) return;
    el.innerHTML = CONSTITUTION.map((c) => `<li>${c}</li>`).join('');
  }

  function renderLists() {
    const sets = [
      ['openai-allowed', OPENAI_ALLOWED, 'ok'],
      ['openai-forbidden', OPENAI_FORBIDDEN, 'danger'],
      ['fashn-allowed', FASHN_ALLOWED, 'ok'],
      ['fashn-forbidden', FASHN_FORBIDDEN, 'danger'],
    ];
    sets.forEach(([id, items, cls]) => {
      const el = $(id);
      if (el) el.innerHTML = items.map((i) => `<li class="${cls === 'danger' ? 'risk-high' : 'risk-low'}">${i}</li>`).join('');
    });
  }

  function renderFileMap() {
    const tbody = document.querySelector('#file-map-table tbody');
    if (!tbody) return;
    const actionClass = { CREATE: 'done', MODIFY: 'partial', DEPRECATE: 'partial', DELETE: 'fail' };
    const all = [...ALL_IMPLEMENTED_FILES, ...PLANNED_FILES];
    tbody.innerHTML = all.map((f) => `
      <tr>
        <td>${f.implemented ? '<span class="file-status-done">✅</span>' : '<span class="file-status-pending">⏳</span>'}</td>
        <td><span class="completion-pill ${actionClass[f.action] || 'unknown'}">${f.action}</span></td>
        <td><code style="font-size:0.72rem;direction:ltr">${f.path}</code></td>
        <td>P${f.phase} — ${f.note}</td>
      </tr>
    `).join('');
  }

  function phaseProgress(state) {
    let total = 0;
    let done = 0;
    PHASES.forEach((p) => {
      p.steps.forEach((_, si) => {
        total++;
        if (state[`p${p.id}-s${si}`]) done++;
      });
    });
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  function renderPhases() {
    const el = $('phases-container');
    if (!el) return;
    const state = load();

    el.innerHTML = PHASES.map((p) => {
      const phaseCls = p.status === 'done' ? 'done' : p.status === 'blocked' ? 'blocked' : 'pending';
      const tagCls = p.status === 'done' ? 'done' : 'pending';
      const stepsHtml = p.steps.map((step, si) => {
        const key = `p${p.id}-s${si}`;
        const isChecked = p.status === 'done' ? state[key] !== false : !!state[key];
        const checked = isChecked ? 'checked' : '';
        return `<li>
          <input type="checkbox" id="${key}" data-key="${key}" ${checked} />
          <label for="${key}">${step}</label>
        </li>`;
      }).join('');

      const accHtml = p.acceptance.map((a) => `<li>${a}</li>`).join('');

      return `<div class="phase-timeline-item ${phaseCls}" id="phase-${p.id}">
        <h4>Phase ${p.id} — ${p.title.replace(/^Phase \d+ — /, '')}
          <span class="phase-tag ${tagCls}">${p.tag}</span>
        </h4>
        <p style="margin:0 0 10px;font-size:0.88rem"><strong>الهدف:</strong> ${p.goal}</p>
        <p style="margin:0 0 8px;font-size:0.82rem;color:var(--muted)"><strong>الملفات:</strong> ${p.files.join(' · ')}</p>
        <h5 style="margin:14px 0 6px;font-size:0.85rem">خطوات التنفيذ — ضع ✓ عند الإكمال</h5>
        <ul class="phase-step-list">${stepsHtml}</ul>
        <h5 style="margin:14px 0 6px;font-size:0.85rem">معايير القبول</h5>
        <ul style="margin:0;padding-right:18px;font-size:0.84rem">${accHtml}</ul>
      </div>`;
    }).join('');

    el.addEventListener('change', (e) => {
      if (e.target.type !== 'checkbox' || !e.target.dataset.key) return;
      const s = load();
      s[e.target.dataset.key] = e.target.checked;
      save(s);
      updateProgress();
      toast('تم حفظ التقدّم');
    });

    updateProgress();
  }

  function updateProgress() {
    const state = load();
    const { total, done, pct } = phaseProgress(state);
    const el = $('phase-progress-text');
    if (el) el.textContent = `${done} / ${total} خطوة (${pct}%)`;
    const bar = $('phase-progress-bar');
    if (bar) bar.style.width = pct + '%';
    const stats = $('vision-stats');
    if (stats) {
      const completedPhases = PHASES.filter((p) =>
        p.steps.every((_, si) => state[`p${p.id}-s${si}`])
      ).length;
      stats.innerHTML = [
        ['9', 'Phases (0–8)'],
        [SPEC_VERSION, 'Schema Version'],
        [completedPhases + '/9', 'Phases مكتملة'],
        [pct + '%', 'تقدّم الخطوات'],
        ['1', 'Endpoint Flutter'],
        ['0', 'API Keys في Client'],
      ].map(([n, l]) => `<div class="stat-card"><div class="num">${n}</div><div class="lbl">${l}</div></div>`).join('');
    }
  }

  function renderSchema() {
    const el = $('schema-example');
    if (el) el.textContent = SCHEMA_EXAMPLE;
  }

  function renderDependencyGraph() {
    const el = $('full-pipeline-graph');
    if (!el) el.textContent = `Flutter App
  │  POST multipart: image + occasionId + mode + skinSnapshot?
  ▼
mira-api  /ai/vision/outfit/analyze
  │
  ▼
VisionOrchestratorService
  ├─ parallel ──► FashnGeometryProvider     → GeometryPayload
  │               (mask, polygon, bbox, crop, topology)
  │
  └─ parallel ──► OpenAiSemanticProvider      → SemanticPayload
                  (garments, colors, style — NO scores)
  │
  ▼
QualityGateService (per provider + merged)
  │
  ▼
FashionNormalizerService  ← ontology.json + colors.json
  │
  ▼
FashionVisionDocument v1.0.0
  │
  ▼
FashionValidatorService
  │
  ▼
ConflictResolverService   ← semantic vs geometry
  │
  ▼
ConfidenceEngineService   → analysisGate: proceed|blocked|degraded
  │
  ▼
DeterministicOutfitEngine (Flutter or API — business logic unchanged)
  │
  ├─► LegacyVisualProfileAdapter (@deprecated — UI bridge)
  │
  ▼
OutfitAnalysis → Result Screen (NO UI CHANGE)

── REMOVED (Phase 8) ──
GoogleVisionOutfitService (Flutter + API)
GOOGLE_VISION_API_KEY
Silent OutfitImageAnalyzer fallback`;
  }

  function setupSidebar() {
    const links = document.querySelectorAll('.audit-sidebar a');
    const sections = [];
    links.forEach((a) => {
      const id = a.getAttribute('href');
      if (id && id.startsWith('#')) {
        const sec = document.querySelector(id);
        if (sec) sections.push({ link: a, sec });
      }
    });
    function onScroll() {
      const y = window.scrollY + 100;
      let current = sections[0];
      sections.forEach((s) => { if (s.sec.offsetTop <= y) current = s; });
      links.forEach((l) => l.classList.remove('active'));
      if (current) current.link.classList.add('active');
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function exportSpec() {
    const data = {
      spec: 'MIRA Vision Platform',
      version: SPEC_VERSION,
      date: SPEC_DATE,
      officialReference: 'docs/mira-vision-platform.html',
      constitution: CONSTITUTION,
      currentRuntime: CURRENT_RUNTIME,
      productionDeploy: PRODUCTION_DEPLOY,
      productionCommit: PRODUCTION_COMMIT,
      platformIntegration: PLATFORM_INTEGRATION,
      productionReadiness: PRODUCTION_READINESS,
      implementedByPhase: IMPLEMENTED_BY_PHASE,
      implementedFiles: ALL_IMPLEMENTED_FILES,
      plannedFiles: PLANNED_FILES,
      phases: PHASES,
      progress: load(),
      progressPct: phaseProgress(load()),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mira-vision-platform-spec-' + SPEC_DATE + '.json';
    a.click();
    toast('تم تصدير المواصفات');
  }

  function resetProgress() {
    if (!confirm('مسح كل تقدّم المراحل المحفوظ محليًا؟')) return;
    localStorage.removeItem(STORAGE);
    renderPhases();
    toast('تم المسح');
  }

  /** 👗 Atelier — Official Garment Modification Reference */
  const GARMENT_ATELIER = {
    updated: '2026-07-01',
    stats: [
      ['T0 الثقة', '✅ منفّذ'],
      ['Phase A Edit', '✅ منفّذ'],
      ['Phase Q QEL', '✅ Q0–Q3 + Q4 baseline'],
      ['A+ / Try-On', '🔒 بعد dataset Q4'],
    ],
    phaseAChecklist: [
      'OutfitGarmentRecolorPanel — صورة · قطعة · ألوان · برومبت · زر تطبيق',
      'GarmentRecolorPromptBuilder — معاينة برومпт على الجهاز',
      'VisionApiDataSource.recolorGarment() — timeout 180s · customPromptAr',
      'GarmentRecolorPromptService — برومпт عربي + customPromptAr override',
      'FashnGarmentRecolorService — FASHN Edit poll',
      'POST /ai/vision/outfit/recolor في AiGatewayController',
      'مقارنة قبل/بعد — سحب أفقي',
      'OutfitSegmentMapOverlay outlineOnly في «إطلالتك»',
    ],
    flutterFiles: [
      ['✅', 'lib/features/outfit_analysis/presentation/widgets/engagement/outfit_garment_recolor_panel.dart', 'UI رئيسي — برومبت + تطبيق'],
      ['✅', 'lib/features/outfit_analysis/domain/helpers/garment_recolor_prompt_builder.dart', 'بناء برومпт معاينة'],
      ['✅', 'lib/features/outfit_analysis/domain/helpers/garment_recolor_vision_context.dart', 'Q0+Q2 — visionContext + polygon'],
      ['✅', 'lib/features/outfit_analysis/data/datasources/vision_api_data_source.dart', 'recolorGarment() + qel'],
      ['✅', 'lib/features/outfit_analysis/presentation/widgets/engagement/outfit_result_story_shell.dart', 'فصل «جرّبي»'],
      ['✅', 'lib/features/outfit_analysis/presentation/widgets/engagement/outfit_photo_color_slider.dart', 'معاينة ColorFilter — «ألوانك»'],
      ['✅', 'lib/features/outfit_analysis/presentation/widgets/outfit_color_alternative_panel.dart', 'رسم قطعة بديلة'],
      ['✅', 'lib/features/outfit_analysis/presentation/widgets/outfit_segment_map_overlay.dart', 'outline-only'],
      ['✅', 'lib/features/outfit_analysis/domain/services/outfit_photo_trust_gate.dart', 'T0 — بوابة ثقة'],
      ['✅', 'lib/features/outfit_analysis/domain/helpers/outfit_result_trust.dart', 'T0 — سياسة النتيجة'],
      ['✅', 'lib/features/outfit_analysis/presentation/widgets/outfit_untrusted_result_view.dart', 'T0 — UI محظور'],
      ['✅', 'test/outfit_photo_trust_test.dart', 'اختبارات الثقة'],
    ],
    backendFiles: [
      ['✅', 'mira-api/src/vision/qel/garment-qel.service.ts', 'Q1+Q3 — weighted scorer'],
      ['✅', 'mira-api/src/vision/qel/garment-crop-composite.service.ts', 'Q2 — crop + composite'],
      ['✅', 'mira-api/src/vision/qel/qel-calibration.service.ts', 'Q4 — profiles'],
      ['✅', 'mira-api/src/vision/qel/image-region-metrics.ts', 'identity · edge · material metrics'],
      ['✅', 'mira-api/src/vision/recolor/fashn-garment-recolor.service.ts', 'FASHN Edit + QEL loop'],
      ['✅', 'mira-api/src/vision/recolor/garment-recolor-prompt.service.ts', 'برومبت v2 + visionContext'],
      ['✅', 'mira-api/src/vision/dto/vision-outfit-recolor-body.dto.ts', 'DTO + visionContext'],
      ['✅', 'mira-api/src/ai/ai-gateway.controller.ts', 'POST vision/outfit/recolor'],
      ['✅', 'mira-api/src/vision/vision.module.ts', 'DI providers'],
      ['✅', 'render.yaml', 'FASHN_EDIT_* + QEL_* env vars'],
    ],
    roadmap: [
      {
        id: 'T0',
        badge: 'trust',
        label: '✅ T0 — نظام الثقة',
        title: 'لا درجة بدون صورة إطلالة موثوقة',
        status: 'live',
        items: [
          'OutfitPhotoTrustGate — capture + analyze',
          'OutfitResultTrustPolicy — blocked/degraded/trusted',
          'OutfitUntrustedResultView — بدون score',
          'Capture screens — continue فقط إذا trusted',
        ],
      },
      {
        id: 'A',
        badge: 'live',
        label: '✅ Phase A — FASHN Edit',
        title: 'تلوين قطعة واحدة · برومبت عربي',
        status: 'live',
        items: [
          'POST /ai/vision/outfit/recolor',
          'OutfitGarmentRecolorPanel كامل',
          'customPromptAr + visionContext من التطبيق',
          'قبل/بعد · 180s timeout',
          '✅ QEL gate — لا عرض بدون pass',
        ],
      },
      {
        id: 'Q',
        badge: 'live',
        label: '✅ Phase Q — QEL (Q0–Q4 baseline)',
        title: 'AI Garment Integrity System — بوابة القبول',
        status: 'live',
        items: [
          'Q0 Prompt v2 + visionContext — ✅',
          'Q1 GarmentQelService — identity · edge · material · segment drift — ✅',
          'Q3 Acceptance gate + auto-retry max 2 — ✅',
          'Q2 Crop-first · Q4 Calibration profile — ✅',
          '⛔ A+ / Try-On بعد 100+ human-labeled pairs',
        ],
      },
      {
        id: 'A+',
        badge: 'planned',
        label: '🔒 Phase A+ — بعد Q',
        title: 'Edit متعدد — بلوزة + بنطلون + عباءة',
        status: 'planned',
        items: [
          'مقفول حتى Phase Q1 stable',
          'polygon crops per zone · QEL per step',
          'progress UI · إلغاء بين الخطوات',
        ],
      },
      {
        id: 'B',
        badge: 'planned',
        label: '🔒 Phase B — بعد Q2+Q3',
        title: 'Try-On Max — catalog على الجسم',
        status: 'planned',
        items: [
          'model + garment images',
          'marketplace integration',
          'QEL على try-on output إلزامي',
        ],
      },
      {
        id: 'C',
        badge: 'planned',
        label: '⏳ Phase C — تنسيق ذكي',
        title: 'ميرا تقترح → المستخدمة تختار → تنفيذ خطوة',
        status: 'planned',
        items: [
          'Orchestrator يربط تحليل MIRA + Atelier',
          'لا «برومпт حر لكل شيء» — خطوات واضحة',
          'كل خطوة: preview + confirm',
        ],
      },
      {
        id: 'D',
        badge: 'planned',
        label: '⏳ Phase D — نضج',
        title: 'cache · rate limit · monitoring',
        status: 'planned',
        items: [
          'cache جلسة (لا حفظ دائم للصورة)',
          'rate limit مخصص لـ recolor',
          'Datadog / Render metrics لـ FASHN latency',
        ],
      },
    ],
    promptExample:
      'أعدي تلوين بلوزة في هذه الصورة إلى كحلي (#1A2848).\n\n' +
      '• المطلوب: تغيير لون القماش فقط — مع الحفاظ على القصة والنسيج والثنيات والظلال والانعكاسات الطبيعية.\n' +
      '• المحظور تماماً: الوجه، الشعر، البشرة، اليدين، الخلفية، الحذاء، الحقيبة، المجوهرات، وملامح الجسم.\n' +
      '• الجودة: إخراج واقعي بأسلوب تصوير أزياء فاخر — بدون فلاتر أو تجميل للوجه.\n' +
      '• الدقة: لون كحلي موحّد على بلوزة مع حواف نظيفة عند خط الفصل مع الجلد.',
    promptV2Example:
      'أعدي تلوين البلوزة (upper · fit: oversized · foldDensity: high) إلى كحلي غامق (#1A2848).\n\n' +
      '• الخامة: إن كان القماش لامعاً — حافظي على انعكاسات الضوء الطبيعية؛ إن كان مطفياً — لا تزيدي اللمعان.\n' +
      '• الهندسة: حافظي على كثافة الثنيات الطبيعية في منطقة الكتف والصدر — لا تسطّحي الطيات.\n' +
      '• المطلوب: تغيير طبقة الصبغة فقط — لا تغيّري نسيج الألياف ولا سلوك القماش.\n' +
      '• المحظور: الوجه · الشعر · البشرة · الخلفية · الإكسسوارات · تغيير proportions.\n' +
      '• الحواف: حواف نظيفة عند خط الفصل مع الجلد — zero bleeding.',
    qelScoreTree:
      'QEL Score (weighted acceptance)\n' +
      '├── IdentityScore      (face histogram + skin luma delta — implemented)\n' +
      '│     └── SkinIntegrityValidator (Perfect Corp) — ⏳ planned\n' +
      '├── EdgeScore          (bleeding · hair boundary · accessory boundary)\n' +
      '├── MaterialScore      (gloss delta · contrast map · fold sharpness)\n' +
      '├── RegionIntegrityScore (post-edit re-segment · IoU vs M₀)\n' +
      '└── ColorConsistencyScore (variance inside garment mask)\n' +
      '\n' +
      'Accept if weighted_sum ≥ threshold · else retry (max 2) · else reject',
    qelPhases: [
      {
        id: 'Q0',
        badge: 'qel',
        label: '✅ Phase Q0 — Prompt v2',
        title: 'Contextual · Geometry-aware · Material guardrails',
        items: [
          'GarmentRecolorPromptService v2 — visionContext ✅',
          'regionRole · fit · foldDensity في البرومبت ✅',
          'conditional material (confidence ≥ 0.6) ✅',
          'GarmentRecolorPromptBuilder + GarmentRecolorVisionContext Flutter ✅',
        ],
      },
      {
        id: 'Q1',
        badge: 'live',
        label: '✅ Phase Q1 — Perceptual Validation',
        title: 'Identity · Skin · Segment Drift · Material heuristics',
        items: [
          'Identity Diff — face histogram + skin tone delta ✅',
          'Skin Integrity — luma delta heuristic (Perfect Corp ⏳)',
          'Segment Drift — re-segment post-edit · IoU threshold ✅',
          'Material Heuristic Lock — gloss · contrast · fold sharpness ✅',
        ],
      },
      {
        id: 'Q2',
        badge: 'qel',
        label: '✅ Phase Q2 — Crop-first',
        title: 'Padded polygon crop · composite engine',
        items: [
          'polygon + padding من segment (ليس bbox خام) ✅',
          'edit على crop · composite مع feathering ✅',
          'color match luminance في المناطق المجاورة ✅',
        ],
      },
      {
        id: 'Q3',
        badge: 'qel',
        label: '✅ Phase Q3 — Acceptance Gate',
        title: 'Elite Scorer · weighted · auto-retry',
        items: [
          'QEL Score tree — 5 sub-scores مرجّحة ✅',
          'MIRA Acceptance Gate — لا UI بدون pass ✅',
          'auto-retry max 2 (prompt أشد) · 422 QEL_REJECTED ✅',
        ],
      },
      {
        id: 'Q4',
        badge: 'qel',
        label: '✅ Phase Q4 — Calibration (baseline)',
        title: 'Evaluation dataset · human ranking',
        items: [
          'QelCalibrationService — baseline + strict profiles ✅',
          'npm run test:qel-calibration — runner + threshold suggest ✅',
          'fixtures/qel-calibration-baseline.v1.json ✅',
          '100+ real user outfits · human score — ⏳ · <a href="#atelier-q4-eval">سجل Q4 التفاعلي ↓</a>',
        ],
      },
    ],
    apiContract:
      'POST /api/v1/ai/vision/outfit/recolor\n' +
      'Authorization: Bearer <Firebase ID Token>\n' +
      'Content-Type: multipart/form-data\n\n' +
      'Fields:\n' +
      '  image            (file, required)\n' +
      '  targetColorAr    (string, required)\n' +
      '  targetColorHex   (string, optional)\n' +
      '  garmentLabelAr   (string, optional)\n' +
      '  customPromptAr   (string, optional)  — min 20 chars in Flutter UI\n' +
      '  visionContext    (string, optional)  — JSON: regionRole · garmentBbox · garmentPolygon · fit · glossLevel\n' +
      '  locale           (string, default ar)\n\n' +
      'Response 200:\n' +
      '{\n' +
      '  "imageBase64": "...",\n' +
      '  "mimeType": "image/jpeg",\n' +
      '  "promptAr": "...",\n' +
      '  "targetColorAr": "أسود",\n' +
      '  "garmentLabelAr": "بلوزة",\n' +
      '  "processingMs": 45000,\n' +
      '  "attempt": 1,\n' +
      '  "qel": {\n' +
      '    "accepted": true,\n' +
      '    "weightedScore": 0.91,\n' +
      '    "threshold": 0.85,\n' +
      '    "cropFirst": true,\n' +
      '    "calibrationProfile": "baseline",\n' +
      '    "subScores": { "identityScore": 0.94, "edgeScore": 0.88, ... }\n' +
      '  },\n' +
      '  "userMessageAr": "أعدنا تلوين بلوزتك — بإطلالة طبيعية"\n' +
      '}\n\n' +
      'Errors:\n' +
      '  422 QEL_REJECTED          → لم نعرض النتيجة — identity/material drift\n' +
      '  503 FASHN_NOT_CONFIGURED  → FASHN_API_KEY missing\n' +
      '  502 GARMENT_RECOLOR_FAILED→ FASHN poll failed\n' +
      '  400 EMPTY_IMAGE',
    envBlock:
      'FASHN_API_KEY=...                    # مطلوب\n' +
      'FASHN_BASE_URL=https://api.fashn.ai\n' +
      'FASHN_EDIT_MODEL=edit\n' +
      'FASHN_EDIT_POLL_MAX_MS=120000\n\n' +
      '# Phase Q — QEL (render.yaml)\n' +
      'QEL_ENABLED=true\n' +
      'QEL_ACCEPT_THRESHOLD=0.85\n' +
      'QEL_MAX_RETRIES=2\n' +
      'QEL_SEGMENT_DRIFT=true\n' +
      'QEL_CROP_FIRST=true\n' +
      'QEL_CROP_PADDING=0.08\n' +
      'QEL_CROP_FEATHER_PX=6\n' +
      'QEL_CALIBRATION_PROFILE=baseline   # baseline | strict | JSON',
    verifyCommands:
      '# T0 — Flutter trust (5 tests)\n' +
      'flutter test test/outfit_photo_trust_test.dart\n\n' +
      '# Backend build\n' +
      'cd mira-api && npm run build\n\n' +
      '# Q4 calibration smoke\n' +
      'cd mira-api && npm run test:qel-calibration:smoke\n\n' +
      '# Q4 with real before/after pairs\n' +
      'QEL_CALIBRATION_DATASET=~/qel-manifest.json npm run test:qel-calibration\n\n' +
      '# Manual E2E\n' +
      '1. npm run start:dev (mira-api) + flutter run --dart-define=USE_MIRA_API=true\n' +
      '2. selfie إطلالة حقيقية → تحليل → فصل «جرّبي»\n' +
      '3. قطعة + لون + برومبت → «تطبيق التلوين» (حتى 180s)\n' +
      '4. ✓ قبل/بعد + شارة Phase Q · ✗ رسالة QEL_REJECTED\n' +
      '5. لقطة marketing → blocked بدون score (T0)',
    auditProof: [
      {
        phase: 'T0',
        claim: 'لا درجة/تجربة كاملة على صورة غير موثوقة',
        status: 'verified',
        evidence:
          'outfit_photo_trust_gate.dart · outfit_result_trust.dart · outfit_untrusted_result_view.dart · test/outfit_photo_trust_test.dart (5/5)',
        gap: '—',
      },
      {
        phase: 'A',
        claim: 'POST recolor + OutfitGarmentRecolorPanel + قبل/بعد',
        status: 'verified',
        evidence:
          'ai-gateway.controller.ts L162 · fashn-garment-recolor.service.ts · outfit_garment_recolor_panel.dart · vision_api_data_source.dart timeout 180s',
        gap: '—',
      },
      {
        phase: 'Q0',
        claim: 'Prompt v2 + visionContext (semantic · geometry · material)',
        status: 'verified',
        evidence:
          'garment-recolor-prompt.service.ts composePromptV2 · garment_recolor_vision_context.dart · garment_recolor_prompt_builder.dart',
        gap: 'material من analysis غالباً null — conditional prompt فقط',
      },
      {
        phase: 'Q1',
        claim: 'Identity · edge · material · segment drift',
        status: 'partial',
        evidence:
          'garment-qel.service.ts · image-region-metrics.ts · FashnGeometryProvider.segment post-edit',
        gap: 'Face embedding · landmarks · Perfect Corp skin — غير منفّذ (luma histogram فقط)',
      },
      {
        phase: 'Q2',
        claim: 'Crop-first polygon + feather composite',
        status: 'verified',
        evidence:
          'garment-crop-composite.service.ts · garmentPolygon في visionContext · QEL_CROP_FIRST=true',
        gap: 'polygon فقط إذا segment map hasContour — وإلا bbox fallback',
      },
      {
        phase: 'Q3',
        claim: 'Weighted scorer ≥0.85 · retry 2 · 422 reject · no UI without pass',
        status: 'verified',
        evidence:
          'garment-qel.service.ts WEIGHTS via QelCalibrationService · fashn loop · mira_api_error_message.dart QEL_REJECTED · panel _QelBadge',
        gap: '—',
      },
      {
        phase: 'Q4',
        claim: 'Calibration profiles + offline runner',
        status: 'partial',
        evidence:
          'qel-calibration.service.ts · qel-calibration.runner.ts · npm run test:qel-calibration:smoke ✓',
        gap: '100+ human-labeled outfit pairs — غير موجود · threshold من smoke فقط',
      },
      {
        phase: 'Deploy',
        claim: 'QEL live على Render production',
        status: 'pending',
        evidence: 'render.yaml QEL_* vars · كود محلي',
        gap: 'git push + Render env + FASHN_API_KEY — لم يُتحقق من deploy هذا PR',
      },
    ],
    targetOutcomes: [
      {
        title: '1. الثقة — T0',
        bullets: [
          'لقطة شاشة / marketing / بدون جسم → OutfitUntrustedResultView · بدون score · زر إعادة تصوير',
          'selfie إطلالة كاملة موثوقة → فصول النتيجة الكاملة متاحة',
          'التحقق: flutter test test/outfit_photo_trust_test.dart → 5/5',
        ],
      },
      {
        title: '2. إعادة التلوين — فصل «جرّبي» فقط',
        bullets: [
          'المستخدمة تختار قطعة + لون + تعدّل برومبت عربي (≥20 حرف) → تضغط «تطبيق التلوين»',
          'الانتظار 30–180s · لا نتيجة فورية (ليس ColorFilter)',
          'النجاح: سحب قبل/بعد + شارة «Phase Q — جودة X% · Q2 crop · محاولة N»',
          'الفشل QEL: «لم نعرض النتيجة — التعديل غيّر الهوية أو خامة القماش» — بدون fake before/after',
        ],
      },
      {
        title: '3. سلامة بصرية — QEL',
        bullets: [
          'الوجه والبشرة: histogram + skin luma delta في face rect (ليس embedding بعد)',
          'القماش: gloss · contrast · fold laplacian delta — reject إذا matte→glossy',
          'الحدود: segment re-segment IoU ≥ 0.55 على upper bbox',
          'القبول: weightedScore ≥ 0.85 AND rejectReasons.length === 0',
          'auto-retry: prompt أشد (strictRetrySuffix) · max 2 retries · ثم 422',
        ],
      },
      {
        title: '4. ما لا نريده أبداً',
        bullets: [
          'درجة 75/100 على صورة ليست إطلالة',
          'وجه «محسّن» أو بشرة مختلفة بعد recolor',
          'قماش plastic · matte→satin · bleeding على الجلد',
          'عرض نتيجة FASHN بدون QEL pass',
          'Story · مشاركة · حفظ صورة على السيرفر',
        ],
      },
      {
        title: '5. معيار «wow» المستهدف (قبل A+)',
        bullets: [
          'المستخدمة تقول: «هذا أنا — لكن اللون أحلى»',
          '≥85% humanAccept على dataset 100+ زوج before/after (Q4 — لم يتحقق بعد)',
          'reject rate واضح أفضل من عرض fake',
        ],
      },
    ],
    remainingItems: [
      {
        item: '100+ human-labeled before/after pairs',
        phase: 'Q4',
        why: 'معايرة threshold وweights — بدونها baseline 0.85 افتراضي',
        gate: 'قبل production-wide QEL tuning · قبل A+',
      },
      {
        item: 'Perfect Corp Skin Integrity Validator',
        phase: 'Q1',
        why: 'moat — undertone · texture zones · not just luma',
        gate: 'قبل ادّعاء «hybrid identity» كامل',
      },
      {
        item: 'Face embedding + landmark diff',
        phase: 'Q1',
        why: 'SSIM/luma ضعيف مع exposure drift',
        gate: 'اختياري قبل A+ · مذكور في المستند',
      },
      {
        item: 'git push + Render deploy مع QEL_* + FASHN_API_KEY',
        phase: 'Deploy',
        why: 'التطبيق على Render بدون QEL = خطر ثقة',
        gate: 'قبل beta خارج الفريق',
      },
      {
        item: 'Phase A+ multi-piece edit',
        phase: 'A+',
        why: 'بلوزة + بنطلون + عباءة تراكمي',
        gate: 'Q4 dataset baseline + Q1 stable',
      },
      {
        item: 'Phase B Try-On Max',
        phase: 'B',
        why: 'catalog garment على الجسم',
        gate: 'Q2 + Q3 + Q4 على try-on output',
      },
      {
        item: 'Phase C orchestrator · Phase D cache/metrics',
        phase: 'C/D',
        why: 'تنسيق ذكي · rate limit recolor · Datadog',
        gate: 'بعد A/B stable',
      },
    ],
    gatesTimeline: {
      nextStepHtml:
        'الخطوة <strong>الآن</strong>: أكملي <a href="#atelier-q4-eval">سجل Q4 — 100 صورة</a> → صدّري manifest → ' +
        '<code>npm run test:qel-calibration</code> → انشري QEL على Render مع <code>FASHN_API_KEY</code>. ' +
        'بعد ≥85% PASS — يُفتح <strong>Phase A+</strong> للتطوير.',
      flow: [
        { id: 'T0', label: 'T0 الثقة', status: 'done' },
        { id: 'A', label: 'Phase A Edit', status: 'done' },
        { id: 'Q', label: 'Phase Q QEL', status: 'done' },
        { id: 'Q4', label: 'Q4 — 100 صورة', status: 'now' },
        { id: 'DEPLOY', label: 'نشر QEL Render', status: 'locked' },
        { id: 'A+', label: 'Phase A+', status: 'locked' },
        { id: 'B', label: 'Phase B', status: 'locked' },
        { id: 'C', label: 'Phase C', status: 'locked' },
      ],
      gates: [
        {
          phase: 'Q4',
          feature: 'معايرة QEL + threshold إنتاجي',
          condition: '100 Case مكتمل · ≥85 PASS · manifest JSON',
          status: 'now',
          action: '<a href="#atelier-q4-eval">سجل Q4 ↓</a>',
        },
        {
          phase: 'Deploy',
          feature: 'QEL live على Render',
          condition: 'git push · QEL_* + FASHN_API_KEY · smoke test',
          status: 'locked',
          action: 'render.yaml · env vars',
        },
        {
          phase: 'A+',
          feature: 'Edit متعدد القطع — بلوزة + بنطلون + عباءة',
          condition: 'Q4 مغلق ≥85% · Q1 stable · QEL على الإنتاج',
          status: 'locked',
          action: 'فصل «جرّبي» — تراكمي',
        },
        {
          phase: 'B',
          feature: 'Try-On Max — catalog على الجسم',
          condition: 'A+ مستقر · Q2+Q3 على try-on · marketplace',
          status: 'locked',
          action: 'فصل «دولابك»',
        },
        {
          phase: 'C',
          feature: 'تنسيق ذكي — اقتراح → اختيار → تنفيذ',
          condition: 'A+ و B مستقران · orchestrator',
          status: 'locked',
          action: 'عبر الفصول',
        },
        {
          phase: 'D',
          feature: 'cache · rate limit · Datadog',
          condition: 'بعد A/B/C stable',
          status: 'locked',
          action: 'نضج تشغيلي',
        },
      ],
      weeks: [
        {
          period: 'يونيو 2026 — أسبوع 1–2',
          title: 'Q4 Phase 1 — بداية (25–50 Case)',
          status: 'now',
          items: [
            '<a href="#atelier-q4-phase1">قسم Q4 Phase 1</a> — 50 سيناريو جاهز',
            '«Q4 بداية — 50 Case» في السجل',
            'تشغيل «جرّبي» — تعبئة الدرجات + QEL',
            'قرار Go/No-Go عند ≥25 مكتمل',
          ],
        },
        {
          period: 'يونيو 2026 — أسبوع 3–4',
          title: 'Q4 — إكمال 100 + تصدير manifest',
          status: 'now',
          items: [
            '25 Case إضافية أسبوعياً حتى 100 مكتمل',
            'اقتراح Final تلقائي + مراجعة Identity Fail',
            'تصدير qel-manifest-100.json',
            'npm run test:qel-calibration — ضبط threshold',
          ],
        },
        {
          period: 'يوليو 2026 — أسبوع 1',
          title: 'نشر QEL على Render + إغلاق بوابة Q4',
          status: 'locked',
          items: [
            'git push → Render auto-deploy',
            'QEL_ENABLED=true · FASHN_API_KEY · QEL_ACCEPT_THRESHOLD',
            'Smoke: recolor في التطبيق مع شارة QEL',
            '✅ بوابة Q4 مغلقة عند ≥85% PASS',
          ],
        },
        {
          period: 'يوليو 2026 — أسبوع 2–4',
          title: 'Phase A+ — تطوير Edit متعدد القطع',
          status: 'locked',
          items: [
            'يفتح فقط بعد إغلاق Q4 + Deploy',
            'تراكمي: بلوزة → بنطلون → عباءة',
            'QEL على كل خطوة · polygon per zone',
            'progress UI · إلغاء بين الخطوات',
          ],
        },
        {
          period: 'أغسطس 2026',
          title: 'Phase B — Try-On Max + دولابك',
          status: 'locked',
          items: [
            'بعد A+ مستقر (2–3 أسابيع QA)',
            'FASHN Try-On · صورة catalog + الجسم',
            'QEL على مخرجات try-on',
            'MIRA_MARKETPLACE_ENABLED عند الجاهزية',
          ],
        },
        {
          period: 'سبتمبر 2026',
          title: 'Phase C — تنسيق ذكي',
          status: 'locked',
          items: [
            'Orchestrator: تحليل MIRA → اقتراح → اختيار → تنفيذ',
            'كل خطوة: preview + confirm',
            'لا برومبت حر بدون حدود',
          ],
        },
        {
          period: 'أكتوبر–نوفمبر 2026',
          title: 'Phase D + beta واسع',
          status: 'locked',
          items: [
            'cache جلسة · rate limit recolor',
            'Datadog / Render metrics',
            'beta خارج الفريق إذا كل البوابات خضراء',
          ],
        },
      ],
      aPlusCriteria: [
        '100/100 Case مكتمل في سجل Q4 (مسارات + 4 درجات Core + Final)',
        '≥ 85 PASS من 100 (85%) — Pass Rate في السجل',
        'صفر أو حد أدنى Identity Fail غير مقبول',
        'manifest JSON مُصدَّر + test:qel-calibration ناجح',
        'QEL منشور على Render — التطبيق يعرض شارة QEL فقط عند القبول',
        'شعور المستخدمة: «هذا أنا — لكن اللون أحلى»',
      ],
    },
  };

  function renderGarmentAtelier() {
    const statsEl = $('atelier-stats');
    if (statsEl) {
      statsEl.innerHTML = GARMENT_ATELIER.stats
        .map(
          ([k, v]) =>
            `<div class="stat-card"><span class="stat-label">${k}</span><span class="stat-value">${v}</span></div>`,
        )
        .join('');
    }

    const checklist = $('atelier-phase-a-checklist');
    if (checklist) {
      checklist.innerHTML = GARMENT_ATELIER.phaseAChecklist.map((t) => `<li>${t}</li>`).join('');
    }

    const promptEx = $('atelier-prompt-example');
    if (promptEx) promptEx.textContent = GARMENT_ATELIER.promptExample;

    const promptV2 = $('atelier-prompt-v2-example');
    if (promptV2) promptV2.textContent = GARMENT_ATELIER.promptV2Example;

    const scoreTree = $('atelier-qel-score-tree');
    if (scoreTree) scoreTree.textContent = GARMENT_ATELIER.qelScoreTree;

    const qelPhases = $('atelier-qel-phases');
    if (qelPhases) {
      qelPhases.innerHTML = GARMENT_ATELIER.qelPhases
        .map(
          (phase) => `<div class="atelier-phase qel">
            <span class="atelier-badge qel">${phase.label}</span>
            <h4 style="margin:8px 0">${phase.title}</h4>
            <ul style="font-size:0.88rem;line-height:1.75;margin:0;padding-right:20px">
              ${phase.items.map((i) => `<li>${i}</li>`).join('')}
            </ul>
          </div>`,
        )
        .join('');
    }

    const flutterTb = document.querySelector('#atelier-flutter-table tbody');
    if (flutterTb) {
      flutterTb.innerHTML = GARMENT_ATELIER.flutterFiles
        .map(([s, p, n]) => `<tr><td>${s}</td><td><code>${p}</code></td><td>${n}</td></tr>`)
        .join('');
    }

    const backendTb = document.querySelector('#atelier-backend-table tbody');
    if (backendTb) {
      backendTb.innerHTML = GARMENT_ATELIER.backendFiles
        .map(([s, p, n]) => `<tr><td>${s}</td><td><code>${p}</code></td><td>${n}</td></tr>`)
        .join('');
    }

    const roadmapEl = $('atelier-roadmap-phases');
    if (roadmapEl) {
      roadmapEl.innerHTML = GARMENT_ATELIER.roadmap
        .map((phase) => {
          const cls =
            phase.status === 'live'
              ? 'live'
              : phase.badge === 'trust'
                ? 'trust'
                : phase.badge === 'qel'
                  ? 'qel'
                  : 'planned';
          return `<div class="atelier-phase ${cls}">
            <span class="atelier-badge ${phase.badge}">${phase.label}</span>
            <h4 style="margin:8px 0">${phase.title}</h4>
            <ul style="font-size:0.88rem;line-height:1.75;margin:0;padding-right:20px">
              ${phase.items.map((i) => `<li>${i}</li>`).join('')}
            </ul>
          </div>`;
        })
        .join('');
    }

    const apiEl = $('atelier-api-contract');
    if (apiEl && GARMENT_ATELIER.apiContract) apiEl.textContent = GARMENT_ATELIER.apiContract;

    const envEl = $('atelier-env-block');
    if (envEl && GARMENT_ATELIER.envBlock) envEl.textContent = GARMENT_ATELIER.envBlock;

    const verifyEl = $('atelier-verify-commands');
    if (verifyEl && GARMENT_ATELIER.verifyCommands) verifyEl.textContent = GARMENT_ATELIER.verifyCommands;

    const auditTb = document.querySelector('#atelier-audit-table tbody');
    if (auditTb && GARMENT_ATELIER.auditProof) {
      auditTb.innerHTML = GARMENT_ATELIER.auditProof.map((row) => {
        const pill =
          row.status === 'verified'
            ? '<span class="completion-pill done">✅ verified</span>'
            : row.status === 'partial'
              ? '<span class="completion-pill partial">⚠️ partial</span>'
              : '<span class="completion-pill pending">⏳ pending</span>';
        return `<tr>
          <td><strong>${row.phase}</strong></td>
          <td>${row.claim}</td>
          <td>${pill}</td>
          <td><code style="font-size:0.78rem;word-break:break-all">${row.evidence}</code></td>
          <td style="font-size:0.84rem;color:var(--muted)">${row.gap}</td>
        </tr>`;
      }).join('');
    }

    const outcomesEl = $('atelier-outcomes-list');
    if (outcomesEl && GARMENT_ATELIER.targetOutcomes) {
      outcomesEl.innerHTML = GARMENT_ATELIER.targetOutcomes
        .map(
          (o) => `<div class="atelier-phase trust" style="margin-bottom:12px">
            <h4 style="margin:0 0 8px">${o.title}</h4>
            <ul style="font-size:0.88rem;line-height:1.8;margin:0;padding-right:20px">
              ${o.bullets.map((b) => `<li>${b}</li>`).join('')}
            </ul>
          </div>`,
        )
        .join('');
    }

    const remainTb = document.querySelector('#atelier-remaining-table tbody');
    if (remainTb && GARMENT_ATELIER.remainingItems) {
      remainTb.innerHTML = GARMENT_ATELIER.remainingItems
        .map(
          (r) => `<tr>
            <td>${r.item}</td>
            <td><strong>${r.phase}</strong></td>
            <td style="font-size:0.86rem">${r.why}</td>
            <td style="font-size:0.86rem;color:var(--muted)">${r.gate}</td>
          </tr>`,
        )
        .join('');
    }

    renderAtelierGatesTimeline();
  }

  function renderAtelierGatesTimeline() {
    const gt = GARMENT_ATELIER.gatesTimeline;
    if (!gt) return;

    const nextEl = $('atelier-next-step');
    if (nextEl) nextEl.innerHTML = gt.nextStepHtml;

    const flowEl = $('atelier-gates-flow');
    if (flowEl) {
      flowEl.innerHTML = gt.flow
        .map((g, i) => {
          const pill = `<span class="atelier-gate-pill ${g.status}">${g.label}</span>`;
          const arrow = i < gt.flow.length - 1 ? '<span class="atelier-gate-arrow">←</span>' : '';
          return pill + arrow;
        })
        .join('');
    }

    const gatesTb = $('atelier-gates-tbody');
    if (gatesTb) {
      gatesTb.innerHTML = gt.gates
        .map((g) => {
          const statusLabel =
            g.status === 'done'
              ? '<span class="gate-open">✅ منفّذ</span>'
              : g.status === 'now'
                ? '<span style="color:#5b4d9e;font-weight:800">⏳ الآن</span>'
                : '<span class="gate-locked">🔒 مقفول</span>';
          return `<tr>
            <td><strong>${g.phase}</strong></td>
            <td>${g.feature}</td>
            <td style="font-size:0.86rem">${g.condition}</td>
            <td>${statusLabel}</td>
            <td style="font-size:0.86rem">${g.action}</td>
          </tr>`;
        })
        .join('');
    }

    const timelineEl = $('atelier-release-timeline');
    if (timelineEl) {
      timelineEl.innerHTML = gt.weeks
        .map(
          (w) => `<div class="atelier-release-week ${w.status}">
            <div class="week-meta">${w.period}</div>
            <h4>${w.title}</h4>
            <ul>${w.items.map((i) => `<li>${i}</li>`).join('')}</ul>
          </div>`,
        )
        .join('');
    }

    const criteriaEl = $('atelier-a-plus-criteria');
    if (criteriaEl) {
      criteriaEl.innerHTML = gt.aPlusCriteria.map((c) => `<li>${c}</li>`).join('');
    }
  }

  function init() {
    const dateEl = $('spec-date');
    if (dateEl) dateEl.textContent = SPEC_DATE + ' · v' + SPEC_VERSION;

    renderImplementationStatus();
    renderProductionDeploy();
    renderCurrentRuntime();
    renderImplementedDetail();
    renderImplementedFiles();
    renderVerifyCommands();
    renderPlatformIntegration();
    renderProductionReadiness();
    renderPipelineStack();
    renderLayerCards();
    renderWhy();
    renderConstitution();
    renderLists();
    renderFileMap();
    renderPhases();
    renderGarmentAtelier();
    renderSchema();
    renderDependencyGraph();
    setupSidebar();

    $('btn-export')?.addEventListener('click', exportSpec);
    $('btn-print')?.addEventListener('click', () => window.print());
    $('btn-reset')?.addEventListener('click', resetProgress);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

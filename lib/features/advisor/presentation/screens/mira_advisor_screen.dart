import 'package:flutter/material.dart';

import '../../../../core/config/mira_features.dart';
import '../../../../core/entitlements/mira_runtime_entitlement_store.dart';
import '../../../../core/navigation/route_args.dart';

import '../../../../core/services/app_session.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/mce/mce_citation_chips.dart';
import '../../../../shared/widgets/mce/mce_confidence_badge.dart';
import '../../../../shared/widgets/mce/mce_streaming_text.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../consultation/data/datasources/consultation_api_data_source.dart';
import '../../../consultation/data/datasources/consultation_stream_data_source.dart';
import '../../../outfit_analysis/data/datasources/outfit_analysis_api_data_source.dart';
import '../../../outfit_analysis/domain/helpers/outfit_consultation_mapper.dart';
import '../../data/datasources/advisor_api_data_source.dart';
import '../../domain/entities/advisor_face_context.dart';
import '../../domain/entities/advisor_fashion_context.dart';
import '../../domain/entities/advisor_response.dart';
import '../../domain/mappers/advisor_fashion_context_mapper.dart';
import '../../domain/services/fashion_advisor_route_decision.dart';
import '../../domain/services/fashion_conversation_context_parser.dart';
import '../../../face_analysis_experience/advisor_context/advisor_context.dart';

const _skinStarterQuestions = [
  'لماذا درجة ترطيبي كذا؟',
  'ما أفضل خطوة في روتيني الصباحي؟',
  'كيف أحافظ على نتائج التحليل؟',
  'ما المنتجات الأنسب لبشرتي؟',
];

const _fashionUnavailableAr =
    'نصيحة الأزياء المؤسَّسة غير مفعّلة في هذا الإصدار بعد. '
    'ستتوفر عبر مستشار ميرا عند تفعيل مسار الأزياء.';

class MiraAdvisorScreen extends StatefulWidget {
  const MiraAdvisorScreen({super.key});

  @override
  State<MiraAdvisorScreen> createState() => _MiraAdvisorScreenState();
}

class _MiraAdvisorScreenState extends State<MiraAdvisorScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final _messages = <AdvisorMessage>[];
  final _consultationApi = ConsultationApiDataSource();
  final _streamApi = ConsultationStreamDataSource();
  final _outfitApi = OutfitAnalysisApiDataSource();
  final _advisorApi = AdvisorApiDataSource();

  bool _loading = false;
  bool _sessionReady = false;
  String? _sessionId;
  String? _snapshotId;
  String? _sessionError;
  String? _boundOutfitAnalysisId;
  _ConsultationFocus _focus = _ConsultationFocus.skin;

  /// Sticky Advisor fashion conversation (follow-ups stay off MCE).
  bool _fashionAdvisorSticky = false;
  /// Sticky Face contextual conversation (9I — follow-ups retain Face context).
  bool _faceAdvisorSticky = false;
  final List<String> _preferenceTokens = [];
  String? _explicitCulturalContext;
  String? _styleGoalOverride;
  String? _dressCodeOverride;
  String? _occasionOverride;

  /// Test/observability counters — one fashion/face turn must not double-call.
  int advisorApiCallCount = 0;
  int mceStreamCallCount = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await _ensureSession();
      if (!mounted) return;
      final args = _args;
      final face = args?.faceContext;
      if (face != null) {
        FaceAdvisorContextAnalytics.opened(face);
        if (face.suggestedQuestionsAr.isNotEmpty) {
          setState(() => _followUps = face.suggestedQuestionsAr);
        }
      }
      if (args?.initialQuestion != null) {
        _send(args!.initialQuestion!);
      }
    });
  }

  AdvisorRouteArgs? get _args =>
      ModalRoute.of(context)?.settings.arguments as AdvisorRouteArgs?;

  FaceAdvisorContext? get _faceContext => _args?.faceContext;

  bool get _outfitContextPresent {
    final args = _args;
    return args?.outfitAnalysis != null ||
        (args?.outfitAnalysisId != null && args!.outfitAnalysisId!.isNotEmpty) ||
        _boundOutfitAnalysisId != null;
  }

  FashionAdvisorClientRoute get _currentRoute {
    // Face contextual turns take precedence over skin MCE.
    final faceRoute = FaceAdvisorRouteDecision.decide(
      faceContext: _faceAdvisorSticky ? _faceContext : _faceContext,
    );
    if (faceRoute == FaceAdvisorClientRoute.advisorFaceChat ||
        _faceAdvisorSticky) {
      // Handled separately in _send — keep fashion decision for non-face.
    }
    return FashionAdvisorRouteDecision.decide(
      fashionAdvisorV1Enabled: MiraFeatures.fashionAdvisorV1 &&
          MiraRuntimeEntitlementStore.fashionAdvisorModeB,
      outfitContextPresent: _outfitContextPresent,
      fashionConversationSticky: _fashionAdvisorSticky,
      isSkinOnlyFocus: _focus == _ConsultationFocus.skin &&
          _faceContext == null &&
          !_faceAdvisorSticky,
      isAtelierFocus: _focus == _ConsultationFocus.atelier,
    );
  }

  bool get _useFaceAdvisorChat =>
      FaceAdvisorRouteDecision.decide(faceContext: _faceContext) ==
          FaceAdvisorClientRoute.advisorFaceChat ||
      _faceAdvisorSticky;

  Future<void> _ensureSession() async {
    final args = _args;
    if (args == null) return;
    if (!AppSession.canUseCloud || AppSession.isGuest) {
      setState(() {
        _sessionError = 'سجّلي الدخول لاستخدام مستشار ميرا الذكي';
      });
      return;
    }
    if (_sessionReady) return;

    final outfitPrimary =
        args.outfitAnalysis != null || args.outfitAnalysisId != null;
    final recolorId =
        args.recolorAttemptId ?? AnalysisSession.lastRecolorAttemptId;

    // Face Advisor (9I): analysisId alone is enough for /advisor/chat.
    if (_faceContext != null) {
      setState(() {
        _sessionReady = true;
        _sessionError = null;
        _focus = _ConsultationFocus.face;
        if (_faceContext!.suggestedQuestionsAr.isNotEmpty) {
          _followUps = _faceContext!.suggestedQuestionsAr;
        }
      });
      return;
    }

    // Fashion Advisor V1 (QA): outfit-primary can proceed without MCE session.
    if (MiraFeatures.fashionAdvisorV1 &&
        MiraRuntimeEntitlementStore.fashionAdvisorModeB &&
        outfitPrimary &&
        recolorId == null) {
      try {
        String? outfitAnalysisId = args.outfitAnalysisId;
        if (outfitAnalysisId == null && args.outfitAnalysis != null) {
          final snapshot = await _outfitApi.saveIntelligenceSnapshot(
            OutfitConsultationMapper.toSnapshotPayload(args.outfitAnalysis!),
          );
          outfitAnalysisId = snapshot.id;
        }
        if (!mounted) return;
        setState(() {
          _boundOutfitAnalysisId = outfitAnalysisId;
          _sessionReady = true;
          _sessionError = null;
          _focus = _ConsultationFocus.outfit;
          _followUps = OutfitConsultationMapper.outfitStarterQuestions;
        });
        return;
      } catch (_) {
        // Fall through to MCE session bootstrap if snapshot fails.
      }
    }

    try {
      String? outfitAnalysisId = args.outfitAnalysisId;
      if (outfitAnalysisId == null && args.outfitAnalysis != null) {
        final snapshot = await _outfitApi.saveIntelligenceSnapshot(
          OutfitConsultationMapper.toSnapshotPayload(args.outfitAnalysis!),
        );
        outfitAnalysisId = snapshot.id;
      }

      final skinId = outfitPrimary && args.skinReport == null
          ? null
          : (args.skinReport?.id ??
              (outfitPrimary ? null : AnalysisSession.lastSkin?.id));

      final session = await _consultationApi.createSession(
        skinAnalysisId: skinId,
        outfitAnalysisId: outfitAnalysisId,
        recolorAttemptId: recolorId,
        occasionId: args.outfitAnalysis?.occasion.id,
      );
      if (!mounted) return;
      setState(() {
        _sessionId = session.id;
        _snapshotId = session.activeSnapshotId;
        _boundOutfitAnalysisId = outfitAnalysisId;
        _sessionReady = true;
        _sessionError = null;
        _focus = recolorId != null
            ? _ConsultationFocus.atelier
            : outfitPrimary
                ? _ConsultationFocus.outfit
                : _ConsultationFocus.skin;
        if (session.suggestedStartersAr.isNotEmpty) {
          _followUps = session.suggestedStartersAr;
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _sessionReady = false;
        _sessionError = 'تعذّر بدء جلسة المستشار — حدّثي التطبيق أو حاولي لاحقاً';
        _focus = args.outfitAnalysis != null
            ? _ConsultationFocus.outfit
            : _ConsultationFocus.skin;
      });
    }
  }

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _absorbExplicitContext(String message) {
    final prefs =
        FashionConversationContextParser.preferenceTokensFromMessage(message);
    for (final p in prefs) {
      if (!_preferenceTokens.contains(p)) _preferenceTokens.add(p);
    }
    final goal =
        FashionConversationContextParser.styleGoalFromMessage(message);
    if (goal != null) _styleGoalOverride = goal;
    final culture =
        FashionConversationContextParser.explicitCulturalContext(message);
    if (culture != null) {
      _explicitCulturalContext = culture;
    }
    final dress =
        FashionConversationContextParser.dressCodeFromMessage(message);
    if (dress != null) _dressCodeOverride = dress;
    final occasion =
        FashionConversationContextParser.occasionFromMessage(message);
    if (occasion != null) _occasionOverride = occasion;
  }

  AdvisorFashionContext _buildFashionContext() {
    final args = _args;
    final analysis = args?.outfitAnalysis;
    if (analysis == null) {
      return AdvisorFashionContext(
        outfitId: _boundOutfitAnalysisId ?? args?.outfitAnalysisId,
        occasion: _occasionOverride,
        dressCode: _dressCodeOverride,
        styleGoal: _styleGoalOverride,
        preferenceTokens: List.unmodifiable(_preferenceTokens),
        culturalContext: _explicitCulturalContext,
        culturalContextExplicit:
            _explicitCulturalContext != null ? true : null,
      );
    }
    final base = AdvisorFashionContextMapper.fromOutfitAnalysis(
      analysis,
      outfitAnalysisId: _boundOutfitAnalysisId ?? args?.outfitAnalysisId,
      extraPreferenceTokens: _preferenceTokens,
      explicitCulturalContext: _explicitCulturalContext,
      culturalContextExplicit: _explicitCulturalContext != null,
      styleGoalOverride: _styleGoalOverride,
      dressCodeOverride: _dressCodeOverride,
    );
    if (_occasionOverride != null && _occasionOverride != base.occasion) {
      return base.copyWith(occasion: _occasionOverride);
    }
    return base;
  }

  Future<void> _send(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || _loading) return;

    if (!AppSession.canUseCloud || AppSession.isGuest) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('سجّلي الدخول لاستخدام مستشار ميرا الذكي')),
      );
      return;
    }

    setState(() {
      _loading = true;
      _messages.add(
        AdvisorMessage(text: trimmed, isUser: true, at: DateTime.now()),
      );
      _input.clear();
    });
    _scrollToEnd();

    try {
      if (_useFaceAdvisorChat) {
        await _sendViaFaceAdvisor(trimmed);
        return;
      }

      final route = _currentRoute;

      if (route == FashionAdvisorClientRoute.fashionUnavailable) {
        await _respondLocalUnavailable();
        return;
      }

      if (route == FashionAdvisorClientRoute.advisorFashionChat) {
        _absorbExplicitContext(trimmed);
        await _sendViaAdvisor(trimmed);
        return;
      }

      // MCE path — never combined with Advisor for the same turn.
      if (_sessionId == null) {
        await _ensureSession();
      }
      if (_sessionId == null) {
        throw Exception(_sessionError ?? 'تعذّر بدء جلسة مستشار ميرا');
      }
      await _sendWithStream(trimmed);
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('تعذر الرد: $e')),
      );
    }
    _scrollToEnd();
  }

  Future<void> _respondLocalUnavailable() async {
    if (!mounted) return;
    setState(() {
      _messages.add(
        AdvisorMessage(
          text: _fashionUnavailableAr,
          isUser: false,
          at: DateTime.now(),
          confidence: 'low',
        ),
      );
      _loading = false;
    });
  }

  Future<void> _sendViaFaceAdvisor(String trimmed) async {
    advisorApiCallCount += 1;
    _faceAdvisorSticky = true;

    final ctx = _faceContext;
    final face = ctx == null
        ? null
        : AdvisorFaceContext(
            contextType: ctx.contextType.name,
            analysisId: ctx.analysisId,
            reportRef: ctx.reportRef,
            selectedResultId: ctx.selectedResultId,
            selectedInsightId: ctx.selectedInsightId,
            selectedDetailRef: ctx.selectedDetailRef,
            selectedRegion: ctx.selectedRegion,
            selectedGuidanceId: ctx.selectedGuidanceId,
            frozenRecommendationRef: ctx.frozenRecommendationRef,
            evidenceRefs: ctx.evidenceRefs,
            limitationRefs: ctx.limitationRefs,
            confidenceQualifier: ctx.confidenceQualifier,
            // 9M: free text is display-only — never forwarded as evidence authority.
            personalizationLevel: ctx.personalizationLevel,
            contextLabelAr: ctx.contextLabelAr,
            resultVersion: ctx.resultVersion,
            evidenceStale: ctx.evidenceStale,
          );

    if (ctx != null) {
      FaceAdvisorContextAnalytics.questionSent(
        type: ctx.contextType,
        safeResultKey: ctx.selectedResultId ??
            ctx.selectedInsightId ??
            ctx.selectedGuidanceId ??
            ctx.contextType.name,
      );
    }

    final analysisId = ctx?.reportRef ??
        ctx?.analysisId ??
        _args?.skinReport?.id ??
        AnalysisSession.lastSkin?.id;

    final response = await _advisorApi.chat(
      message: trimmed,
      analysisId: analysisId,
      face: face,
    );

    if (!mounted) return;

    final answerText = response.disclaimerAr != null &&
            response.disclaimerAr!.trim().isNotEmpty &&
            !response.answer.contains(response.disclaimerAr!)
        ? '${response.answer}\n\n${response.disclaimerAr}'
        : response.answer;

    setState(() {
      _messages.add(
        AdvisorMessage(
          text: answerText,
          isUser: false,
          at: DateTime.now(),
          confidence: response.confidence,
        ),
      );
      if (response.suggestedQuestions.isNotEmpty) {
        _followUps = response.suggestedQuestions;
      } else if (ctx?.suggestedQuestionsAr.isNotEmpty == true) {
        _followUps = ctx!.suggestedQuestionsAr;
      }
      _loading = false;
    });
  }

  Future<void> _sendViaAdvisor(String trimmed) async {
    advisorApiCallCount += 1;
    _fashionAdvisorSticky = true;

    final fashion = _buildFashionContext();
    final analysisId = _args?.skinReport?.id;

    final response = await _advisorApi.chat(
      message: trimmed,
      analysisId: analysisId,
      fashion: fashion,
    );

    if (!mounted) return;

    final answerText = response.disclaimerAr != null &&
            response.disclaimerAr!.trim().isNotEmpty &&
            !response.answer.contains(response.disclaimerAr!)
        ? '${response.answer}\n\n${response.disclaimerAr}'
        : response.answer;

    setState(() {
      _messages.add(
        AdvisorMessage(
          text: answerText,
          isUser: false,
          at: DateTime.now(),
          confidence: response.confidence,
        ),
      );
      if (response.suggestedQuestions.isNotEmpty) {
        _followUps = response.suggestedQuestions;
      }
      _loading = false;
    });
  }

  Future<void> _sendWithStream(String trimmed) async {
    mceStreamCallCount += 1;
    final streamMsg = AdvisorMessage(
      text: '',
      isUser: false,
      at: DateTime.now(),
      isStreaming: true,
    );
    setState(() => _messages.add(streamMsg));
    final streamIndex = _messages.length - 1;

    final turn = await _streamApi.sendMessageStream(
      sessionId: _sessionId!,
      message: trimmed,
      contextSnapshotId: _snapshotId,
      onDelta: (delta) {
        if (!mounted) return;
        setState(() {
          _messages[streamIndex] = streamMsg.copyWith(
            text: delta,
            isStreaming: true,
          );
        });
        _scrollToEnd();
      },
    );

    if (!mounted) return;
    final assistant = turn.assistantMessage;
    setState(() {
      _messages[streamIndex] = AdvisorMessage(
        text: assistant.contentAr,
        isUser: false,
        at: assistant.createdAt,
        confidence: assistant.confidence,
        citedFacts: assistant.citedFacts
            .map(
              (f) => MceCitedFact(
                id: f.id,
                labelAr: f.labelAr,
                valueAr: f.valueAr,
              ),
            )
            .toList(),
      );
      _snapshotId = turn.session.activeSnapshotId ?? _snapshotId;
      if (turn.session.suggestedStartersAr.isNotEmpty) {
        _followUps = turn.session.suggestedStartersAr;
      }
      _loading = false;
    });
  }

  List<String> _followUps = _skinStarterQuestions;

  String get _bannerText {
    if (_sessionError != null) return _sessionError!;
    if (!_sessionReady) return 'جاري تجهيز جلسة الاستشارة…';
    if (_faceAdvisorSticky || _useFaceAdvisorChat) {
      final label = _faceContext?.contextLabelAr;
      return label != null
          ? 'تسألين $label — ميرا تشرح النتائج من الأدلة المتاحة فقط'
          : 'ميرا تشرح نتائج ملامحك من الأدلة المتاحة — بدون إعادة تحليل';
    }
    if (_fashionAdvisorSticky ||
        (_currentRoute == FashionAdvisorClientRoute.advisorFashionChat)) {
      return 'إجابات أزياء عبر مستشار ميرا — سياق الإطلالة فقط';
    }
    if (_currentRoute == FashionAdvisorClientRoute.fashionUnavailable) {
      return 'نصيحة الأزياء المؤسَّسة غير مفعّلة في هذا الإصدار';
    }
    return switch (_focus) {
      _ConsultationFocus.atelier =>
        'إجابات مُؤَسَّسة على تجربة Atelier وQEL — تلوين قماش فقط',
      _ConsultationFocus.outfit =>
        'إجابات مُؤَسَّسة على تحليل إطلالتك — أسلوب · مناسبة · إكسسوارات',
      _ConsultationFocus.face =>
        'ميرا تشرح نتائج ملامحك من الأدلة المتاحة — بدون إعادة تحليل',
      _ConsultationFocus.skin =>
        'إجابات مُؤَسَّسة على تقرير بشرتكِ — لا إعادة تحليل للصورة',
    };
  }

  String get _inputHint {
    return switch (_focus) {
      _ConsultationFocus.atelier =>
        'اسألي عن التلوين · QEL · دقة اللون · الهوية…',
      _ConsultationFocus.outfit =>
        'اسألي عن الأسلوب · المناسبة · الإكسسوارات · المكياج…',
      _ConsultationFocus.face =>
        'اسألي عن شكل الوجه · النسب · الإرشاد المرتبط…',
      _ConsultationFocus.skin => 'اسألي عن العناية · الروتين · المنتجات…',
    };
  }

  String get _appBarTitle {
    if (_faceAdvisorSticky || _useFaceAdvisorChat) {
      return 'مستشار ميرا · ملامح';
    }
    if (_fashionAdvisorSticky ||
        (_focus == _ConsultationFocus.outfit &&
            MiraFeatures.fashionAdvisorV1 &&
            MiraRuntimeEntitlementStore.fashionAdvisorModeB)) {
      return 'مستشار ميرا · أزياء';
    }
    return _sessionReady ? 'مستشار ميرا · MCE' : 'مستشار ميرا';
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: MiraAppBar(
        pageTitle: _appBarTitle,
      ),
      body: DelightBackground(
        showParticles: false,
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: Text(
                  _bannerText,
                  style: AppTypography.labelSmall.copyWith(
                    color: _sessionError != null
                        ? AppColors.gold
                        : AppColors.textTertiary,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              if (_faceContext != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Semantics(
                    label: FaceAdvisorContextCopy.askMiraSemantics(
                      _faceContext!.contextLabelAr,
                    ),
                    child: Container(
                      key: const Key('face_advisor_context_label'),
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        'تسألين ${_faceContext!.contextLabelAr}',
                        style: AppTypography.labelSmall.copyWith(
                          color: AppColors.textSecondary,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                ),
              Expanded(
                child: ListView.builder(
                  controller: _scroll,
                  padding: const EdgeInsets.all(16),
                  itemCount: _messages.length,
                  itemBuilder: (context, index) {
                    final msg = _messages[index];
                    return _Bubble(message: msg);
                  },
                ),
              ),
              if (_followUps.isNotEmpty)
                SizedBox(
                  height: 44,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    itemCount: _followUps.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (context, i) {
                      return ActionChip(
                        label: Text(
                          _followUps[i],
                          style: AppTypography.labelSmall,
                        ),
                        onPressed:
                            _loading ? null : () => _send(_followUps[i]),
                      );
                    },
                  ),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _input,
                        decoration: InputDecoration(
                          hintText: _inputHint,
                          filled: true,
                          fillColor: AppColors.surface,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: BorderSide.none,
                          ),
                        ),
                        textInputAction: TextInputAction.send,
                        onSubmitted: _loading ? null : _send,
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filled(
                      onPressed: _loading ? null : () => _send(_input.text),
                      icon: _loading
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.send_rounded),
                      style: IconButton.styleFrom(
                        backgroundColor: AppColors.gold,
                        foregroundColor: AppColors.primaryDark,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

enum _ConsultationFocus { skin, outfit, atelier, face }

class _Bubble extends StatelessWidget {
  final AdvisorMessage message;

  const _Bubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final isUser = message.isUser;
    return Align(
      alignment: isUser ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints:
            BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.85),
        decoration: BoxDecoration(
          color: isUser
              ? AppColors.primaryDark.withValues(alpha: 0.08)
              : AppColors.cardPurple.withValues(alpha: 0.35),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (!isUser && message.confidence != null)
              Align(
                alignment: Alignment.centerLeft,
                child: MceConfidenceBadge(confidence: message.confidence!),
              ),
            if (!isUser && message.confidence != null) const SizedBox(height: 6),
            message.isStreaming
                ? MceStreamingText(text: message.text, isStreaming: true)
                : Text(
                    message.text,
                    style: AppTypography.bodyMedium.copyWith(height: 1.55),
                  ),
            if (!isUser && message.citedFacts.isNotEmpty)
              MceCitationChips(
                facts: message.citedFacts
                    .map((f) => (label: f.labelAr, value: f.valueAr))
                    .toList(),
              ),
          ],
        ),
      ),
    );
  }
}

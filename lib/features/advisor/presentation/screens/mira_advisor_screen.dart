import 'package:flutter/material.dart';

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
import '../../domain/entities/advisor_response.dart';

const _skinStarterQuestions = [
  'لماذا درجة ترطيبي كذا؟',
  'ما أفضل خطوة في روتيني الصباحي؟',
  'كيف أحافظ على نتائج التحليل؟',
  'ما المنتجات الأنسب لبشرتي؟',
];

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
  bool _loading = false;
  bool _sessionReady = false;
  String? _sessionId;
  String? _snapshotId;
  String? _sessionError;
  _ConsultationFocus _focus = _ConsultationFocus.skin;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await _ensureSession();
      if (!mounted) return;
      final args = _args;
      if (args?.initialQuestion != null) {
        _send(args!.initialQuestion!);
      }
    });
  }

  AdvisorRouteArgs? get _args =>
      ModalRoute.of(context)?.settings.arguments as AdvisorRouteArgs?;

  Future<void> _ensureSession() async {
    final args = _args;
    if (args == null) return;
    if (!AppSession.canUseCloud || AppSession.isGuest) {
      setState(() {
        _sessionError = 'سجّلي الدخول لاستخدام مستشار ميرا الذكي · MCE';
      });
      return;
    }
    if (_sessionReady) return;

    try {
      String? outfitAnalysisId = args.outfitAnalysisId;
      if (outfitAnalysisId == null && args.outfitAnalysis != null) {
        final snapshot = await _outfitApi.saveIntelligenceSnapshot(
          OutfitConsultationMapper.toSnapshotPayload(args.outfitAnalysis!),
        );
        outfitAnalysisId = snapshot.id;
      }

      final outfitPrimary = args.outfitAnalysis != null || outfitAnalysisId != null;
      final skinId = outfitPrimary && args.skinReport == null
          ? null
          : (args.skinReport?.id ?? (outfitPrimary ? null : AnalysisSession.lastSkin?.id));
      final recolorId = args.recolorAttemptId ?? AnalysisSession.lastRecolorAttemptId;

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
        _sessionError = 'تعذّر بدء جلسة MCE — حدّثي التطبيق أو حاولي لاحقاً';
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
      _messages.add(AdvisorMessage(text: trimmed, isUser: true, at: DateTime.now()));
      _input.clear();
    });
    _scrollToEnd();

    try {
      if (_sessionId == null) {
        await _ensureSession();
      }
      if (_sessionId == null) {
        throw Exception(_sessionError ?? 'تعذّر بدء جلسة مستشار ميرا · MCE');
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

  Future<void> _sendWithStream(String trimmed) async {
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
              (f) => MceCitedFact(id: f.id, labelAr: f.labelAr, valueAr: f.valueAr),
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
    return switch (_focus) {
      _ConsultationFocus.atelier =>
        'إجابات مُؤَسَّسة على تجربة Atelier وQEL — تلوين قماش فقط',
      _ConsultationFocus.outfit =>
        'إجابات مُؤَسَّسة على تحليل إطلالتك — أسلوب · مناسبة · إكسسوارات',
      _ConsultationFocus.skin =>
        'إجابات مُؤَسَّسة على تقرير بشرتكِ — لا إعادة تحليل للصورة',
    };
  }

  String get _inputHint {
    return switch (_focus) {
      _ConsultationFocus.atelier => 'اسألي عن التلوين · QEL · دقة اللون · الهوية…',
      _ConsultationFocus.outfit =>
        'اسألي عن الأسلوب · المناسبة · الإكسسوارات · المكياج…',
      _ConsultationFocus.skin => 'اسألي عن العناية · الروتين · المنتجات…',
    };
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
        pageTitle: _sessionReady ? 'مستشار ميرا · MCE' : 'مستشار ميرا',
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
                        label: Text(_followUps[i], style: AppTypography.labelSmall),
                        onPressed: _loading ? null : () => _send(_followUps[i]),
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

enum _ConsultationFocus { skin, outfit, atelier }

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
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.85),
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

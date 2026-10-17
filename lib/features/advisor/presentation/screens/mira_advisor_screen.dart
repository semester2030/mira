import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

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
import '../../../consultation/domain/consultation_session_gate.dart';
import '../../../consultation/domain/dialogue_history.dart';
import '../../../consultation/domain/dialogue_outbound.dart';
import '../../../consultation/presentation/widgets/consultation_composer.dart';
import '../../../consultation/presentation/widgets/consultation_image_strip.dart';
import '../../../outfit_analysis/data/datasources/outfit_analysis_api_data_source.dart';
import '../../../outfit_analysis/domain/helpers/outfit_consultation_mapper.dart';
import '../../domain/entities/advisor_response.dart';
import '../../domain/services/fashion_advisor_route_decision.dart';
import '../../../face_analysis_experience/advisor_context/advisor_context.dart';

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
  final _drafts = <ChatImageDraft>[];
  DialogueOutbound? _failedOutbound;
  int _maxImages = 3;
  String? _olderCursor;
  final _consultationApi = ConsultationApiDataSource();
  final _streamApi = ConsultationStreamDataSource();
  final _outfitApi = OutfitAnalysisApiDataSource();

  bool _loading = false;
  bool _sessionReady = false;
  String? _sessionId;
  String? _snapshotId;
  String? _sessionError;
  String? _boundOutfitAnalysisId;
  _ConsultationFocus _focus = _ConsultationFocus.skin;

  final bool _fashionAdvisorSticky = false;
  final bool _faceAdvisorSticky = false;
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

  bool get _openDialogue {
    final args = _args;
    if (args == null) return true;
    final hasReport = args.skinReport != null ||
        args.outfitAnalysis != null ||
        (args.outfitAnalysisId != null && args.outfitAnalysisId!.isNotEmpty) ||
        args.faceContext != null ||
        args.recolorAttemptId != null;
    return !hasReport;
  }

  Future<void> _ensureSession() async {
    final args = _args;
    if (!AppSession.canUseCloud || AppSession.isGuest) {
      setState(() {
        _sessionError = 'سجّلي الدخول لاستخدام مستشار ميرا الذكي';
      });
      return;
    }
    if (_sessionReady) return;
    if (args == null) {
      await _openOrResume();
      return;
    }

    final outfitPrimary =
        args.outfitAnalysis != null || args.outfitAnalysisId != null;
    final recolorId =
        args.recolorAttemptId ?? AnalysisSession.lastRecolorAttemptId;

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

      final faceLabel = _faceContext?.contextLabelAr;
      final statedGoal = [
        if (faceLabel != null && faceLabel.isNotEmpty) 'دخلت من نتيجة الوجه: $faceLabel',
        if (args.initialQuestion != null && args.initialQuestion!.trim().isNotEmpty)
          args.initialQuestion!.trim(),
      ].join(' ');
      final session = await _consultationApi.createSession(
        skinAnalysisId: skinId,
        outfitAnalysisId: outfitAnalysisId,
        recolorAttemptId: recolorId,
        occasionId: args.outfitAnalysis?.occasion.id,
        statedGoalAr: statedGoal.isEmpty ? null : statedGoal,
        face: _faceContext?.toJson(),
      );
      final imageLimit = await _consultationApi.dialogueImageLimit();
      if (!mounted) return;
      setState(() {
        _sessionId = session.id;
        _snapshotId = session.activeSnapshotId;
        _boundOutfitAnalysisId = outfitAnalysisId;
        _sessionReady = true;
        _sessionError = null;
        _maxImages = imageLimit;
        _focus = _faceContext != null
            ? _ConsultationFocus.face
            : recolorId != null
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
        _loading = false;
        _sessionReady = false;
        _sessionId = null;
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

  Future<void> _openOrResume() async {
    try {
      final sessions = await _consultationApi.listSessions();
      if (sessions.isNotEmpty) {
        final latest = sessions.first;
        final history = await _consultationApi.listMessages(latest.id);
        final loaded = <AdvisorMessage>[];
        for (final message in history.messages) {
          final slots = await loadDialogueImages(
            message.attachmentIds,
            _consultationApi.downloadAttachment,
          );
          loaded.add(AdvisorMessage(
            id: message.id,
            text: message.contentAr,
            isUser: message.isUser,
            at: message.createdAt,
            confidence: message.confidence,
            images: [for (final slot in slots) if (slot.bytes != null) slot.bytes!],
            imageSlots: slots,
            attachmentIds: message.attachmentIds,
            clientMessageId: message.clientMessageId,
            citedFacts: message.citedFacts
                .map((f) => MceCitedFact(id: f.id, labelAr: f.labelAr, valueAr: f.valueAr))
                .toList(),
          ));
        }
        if (!mounted) return;
        setState(() {
          _messages
            ..clear()
            ..addAll(loaded);
          _sessionId = latest.id;
          _snapshotId = latest.activeSnapshotId;
          _sessionReady = true;
          _sessionError = null;
          _olderCursor = history.nextCursor;
          if (_messages.isEmpty && latest.suggestedStartersAr.isNotEmpty) {
            _followUps = latest.suggestedStartersAr;
          }
        });
        return;
      }
      final session = await _consultationApi.createSession();
      if (!mounted) return;
      setState(() {
        _sessionId = session.id;
        _snapshotId = session.activeSnapshotId;
        _sessionReady = true;
        _sessionError = null;
        if (session.suggestedStartersAr.isNotEmpty) {
          _followUps = session.suggestedStartersAr;
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _sessionReady = false;
        _sessionId = null;
        _sessionError = 'تعذّر بدء جلسة المستشار — حدّثي التطبيق أو حاولي لاحقاً';
      });
    }
  }

  Future<void> _removeDraft(String localId) async {
    final index = _drafts.indexWhere((draft) => draft.localId == localId);
    if (index < 0) return;
    final draft = _drafts[index];
    if (draft.attachmentId != null) {
      try {
        await _consultationApi.deleteAttachment(draft.attachmentId!);
      } catch (_) {
        if (!mounted) return;
        setState(() {
          _drafts[index] = draft.copyWith(status: 'failed', errorAr: 'تعذر الحذف من الخادم');
        });
        return;
      }
    }
    if (!mounted) return;
    setState(() => _drafts.removeWhere((item) => item.localId == localId));
  }

  Future<void> _loadOlder() async {
    final sessionId = _sessionId;
    final cursor = _olderCursor;
    if (sessionId == null || cursor == null || _loading) return;
    setState(() => _loading = true);
    try {
      final page = await _consultationApi.listMessages(sessionId, before: cursor);
      if (!mounted) return;
      final older = <AdvisorMessage>[];
      for (final message in page.messages) {
        final slots = await loadDialogueImages(
          message.attachmentIds,
          _consultationApi.downloadAttachment,
        );
        older.add(AdvisorMessage(
          id: message.id,
          text: message.contentAr,
          isUser: message.isUser,
          at: message.createdAt,
          images: [for (final slot in slots) if (slot.bytes != null) slot.bytes!],
          imageSlots: slots,
          attachmentIds: message.attachmentIds,
          clientMessageId: message.clientMessageId,
        ));
      }
      final merged = prependOlderMessages(older, _messages, (message) => message.id);
      setState(() {
        _messages
          ..clear()
          ..addAll(merged);
        _olderCursor = page.nextCursor;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تعذر تحميل الرسائل الأقدم')),
      );
    }
  }

  bool get _canSend => consultationSessionReady(markedReady: _sessionReady, sessionId: _sessionId);

  Future<void> _pickGalleryImage() async {
    if (_loading || _drafts.length >= _maxImages || !_canSend) return;
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 90,
    );
    if (picked == null || !mounted) return;
    final bytes = await File(picked.path).readAsBytes();
    if (!mounted) return;
    setState(() {
      _drafts.add(ChatImageDraft(
        localId: 'img-${DateTime.now().microsecondsSinceEpoch}',
        bytes: bytes,
      ));
    });
  }

  Future<void> _send(String text, {DialogueOutbound? retry}) async {
    final trimmed = (retry?.text ?? text).trim();
    if ((trimmed.isEmpty && _drafts.isEmpty && retry == null) || _loading) return;

    if (!AppSession.canUseCloud || AppSession.isGuest) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('سجّلي الدخول لاستخدام مستشار ميرا الذكي')),
      );
      return;
    }

    setState(() => _loading = true);
    var outbound = retry ??
        DialogueOutbound.first(
          clientMessageId: 'c-${DateTime.now().microsecondsSinceEpoch}',
          text: trimmed.isEmpty ? 'ما رأيك؟' : trimmed,
          attachmentIds: const [],
        );
    if (outbound.appendUserBubble) {
      final uploaded = await _uploadDrafts();
      if (uploaded == null) return;
      outbound = outbound.withAttachments(uploaded);
      setState(() {
        _loading = true;
        _failedOutbound = null;
        _messages.add(
          AdvisorMessage(
            text: outbound.text,
            isUser: true,
            at: DateTime.now(),
            images: [for (final draft in _drafts) draft.bytes],
            attachmentIds: outbound.attachmentIds,
            clientMessageId: outbound.clientMessageId,
          ),
        );
        _drafts.clear();
        _input.clear();
      });
    } else {
      setState(() {
        _loading = true;
        _failedOutbound = null;
        final index = _messages.lastIndexWhere(
          (message) => message.clientMessageId == outbound.clientMessageId,
        );
        if (index >= 0) {
          _messages[index] = _messages[index].copyWith(failed: false);
        }
      });
    }
    _scrollToEnd();

    try {
      if (_sessionId == null) {
        await _ensureSession();
      }
      if (_sessionId == null) {
        throw Exception(_sessionError ?? 'تعذّر بدء جلسة مستشار ميرا');
      }
      await _sendWithStream(outbound);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _failedOutbound = outbound;
        if (_messages.isNotEmpty && _messages.last.isStreaming && !_messages.last.isUser) {
          _messages.removeLast();
        }
        final index = _messages.lastIndexWhere(
          (message) => message.clientMessageId == outbound.clientMessageId,
        );
        if (index >= 0) {
          _messages[index] = _messages[index].copyWith(failed: true);
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_arabicSendError(e))),
      );
    }
    _scrollToEnd();
  }

  Future<List<String>?> _uploadDrafts() async {
    if (_drafts.isEmpty) return const [];
    if (_sessionId == null) await _ensureSession();
    if (_sessionId == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_sessionError ?? 'تعذّر بدء جلسة مستشار ميرا')),
        );
      }
      return null;
    }
    final ids = <String>[];
    for (var i = 0; i < _drafts.length; i++) {
      if (_drafts[i].attachmentId != null) {
        ids.add(_drafts[i].attachmentId!);
        continue;
      }
      setState(() {
        _drafts[i] = _drafts[i].copyWith(status: 'uploading', errorAr: null);
      });
      try {
        final id = await _consultationApi.uploadAttachment(
          sessionId: _sessionId!,
          bytes: _drafts[i].bytes,
        );
        if (!mounted) return null;
        setState(() {
          _drafts[i] = _drafts[i].copyWith(status: 'ready', attachmentId: id);
        });
        ids.add(id);
      } catch (_) {
        if (!mounted) return null;
        setState(() {
          _drafts[i] = _drafts[i].copyWith(status: 'failed', errorAr: 'تعذر الرفع');
          _loading = false;
        });
        return null;
      }
    }
    return ids;
  }

  Future<void> _sendWithStream(DialogueOutbound outbound) async {
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
      message: outbound.text,
      contextSnapshotId: _snapshotId,
      attachmentIds: outbound.attachmentIds,
      clientMessageId: outbound.clientMessageId,
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
        id: assistant.id,
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
      _followUps = assistant.suggestedQuestionsAr;
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
      return 'محادثة مفتوحة عن الإطلالات والألوان والعناية. اسألي ميرا مباشرة.';
    }
    if (_openDialogue) {
      return 'محادثة مفتوحة عن الجمال والعناية والمكياج والشعر والإطلالات. الصور للمناقشة ولا تغيّر تقرير البشرة.';
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
    if (_openDialogue) return 'اسألي عن العناية أو المكياج أو الشعر أو الإطلالة…';
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
    return 'مستشار ميرا';
  }

  String _arabicSendError(Object error) {
    final text = error.toString().replaceFirst('Exception: ', '').trim();
    if (text.contains('أعيدي') || text.contains('تعذر')) return text;
    return 'تعذر عرض الرد. أعيدي المحاولة وسنستخدم الطلب نفسه.';
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
              if (_olderCursor != null)
                TextButton(
                  key: const Key('consultation_load_older'),
                  onPressed: _loading ? null : _loadOlder,
                  child: const Text('رسائل أقدم'),
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
              ConsultationComposer(
                controller: _input,
                images: _drafts,
                maxImages: _maxImages,
                loading: _loading,
                hintText: _inputHint,
                onPick: _pickGalleryImage,
                onRemove: (localId) => _removeDraft(localId),
                onRetry: (localId) {
                  final index = _drafts.indexWhere((draft) => draft.localId == localId);
                  if (index < 0) return;
                  setState(() {
                    _drafts[index] = _drafts[index].copyWith(status: 'preview', errorAr: null);
                  });
                  _send(_input.text);
                },
                onSend: () => _send(_input.text),
              ),
              if (_failedOutbound != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                  child: FilledButton.icon(
                    key: const Key('consultation_retry_send'),
                    onPressed: _loading ? null : () => _send('', retry: _failedOutbound!.retry()),
                    icon: const Icon(Icons.refresh_rounded),
                    label: const Text('إعادة المحاولة'),
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
            if (!isUser && message.confidence == 'low')
              Align(
                alignment: Alignment.centerLeft,
                child: MceConfidenceBadge(confidence: message.confidence!),
              ),
            if (!isUser && message.confidence == 'low') const SizedBox(height: 6),
            if (message.imageSlots.isNotEmpty)
              ConsultationImageStrip(slots: message.imageSlots)
            else if (message.images.isNotEmpty)
              ConsultationImageStrip(
                slots: [
                  for (final bytes in message.images)
                    DialogueImageSlot(attachmentId: 'local', bytes: bytes),
                ],
              ),
            if (message.failed)
              Text('تعذر الإرسال', style: AppTypography.labelSmall),
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

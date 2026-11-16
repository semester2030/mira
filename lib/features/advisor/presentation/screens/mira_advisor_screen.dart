import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
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
import '../../../../shared/widgets/mce/mce_display_text.dart';
import '../../../../shared/widgets/mce/mce_streaming_text.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../consultation/data/datasources/consultation_api_data_source.dart';
import '../../../consultation/data/datasources/consultation_stream_data_source.dart';
import '../../../consultation/domain/consultation_session_gate.dart';
import '../../../consultation/domain/dialogue_history.dart';
import '../../../consultation/domain/dialogue_outbound.dart';
import '../../../consultation/domain/entities/consultation_entities.dart'
    hide MceCitedFact;
import '../../../consultation/presentation/widgets/consultation_composer.dart';
import '../../../consultation/presentation/widgets/consultation_image_strip.dart';
import '../../../outfit_analysis/data/datasources/outfit_analysis_api_data_source.dart';
import '../../../outfit_analysis/domain/helpers/outfit_consultation_mapper.dart';
import '../../../outfit_analysis/domain/helpers/outfit_local_image_index.dart';
import '../../domain/entities/advisor_response.dart';
import '../../domain/entities/consultant_discovery_offer.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../domain/services/mira_advisor_memory_store.dart';
import '../../domain/services/mira_offer_link_resolver.dart';
import '../widgets/consultant_offer_cards.dart';
import '../../../marketplace/data/catalog_record_scope.dart';
import '../../domain/services/fashion_advisor_route_decision.dart';
import '../../../face_analysis_experience/advisor_context/advisor_context.dart';

const _homeStarterQuestions = [
  'وش في بالك اليوم؟',
  'أبي ترطيب لطيف لروتيني',
  'عندي مناسبة وأحتاج إطلالة',
];

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
  Future<void>? _sessionStart;
  String? _sessionId;
  String? _snapshotId;
  String? _sessionError;
  String? _boundOutfitAnalysisId;
  String? _contextCardText;
  String? _bindContextError;
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
      if (args?.initialQuestion != null && args!.initialQuestion!.trim().isNotEmpty) {
        _input.text = args.initialQuestion!.trim();
      }
      if (_followUps.isEmpty) {
        final outfit = args?.outfitAnalysis != null || args?.outfitAnalysisId != null;
        final home = args == null ||
            (args.skinReport == null &&
                args.outfitAnalysis == null &&
                (args.outfitAnalysisId == null || args.outfitAnalysisId!.isEmpty) &&
                args.faceContext == null &&
                args.recolorAttemptId == null);
        setState(() {
          _followUps = outfit
              ? OutfitConsultationMapper.outfitStarterQuestions
              : home
                  ? _homeStarterQuestions
                  : _skinStarterQuestions;
        });
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

  String _stageError(String stage, Object error) {
    final status = error is DioException ? error.response?.statusCode : null;
    final code = error is DioException ? error.response?.data is Map ? (error.response!.data as Map)['code'] : null : null;
    final track = error is DioException ? (error.requestOptions.extra['clientMessageId'] ?? error.response?.headers.value('x-request-id')) : null;
    final suffix = track == null ? '' : ' رقم التتبع: $track';
    if (status == 503 || code == 'RATE_LIMIT_UNAVAILABLE' || code == 'MCE_QUOTA_UNAVAILABLE') {
      return 'تعذر التحقق من حد الاستخدام بأمان. أعيدي المحاولة بعد قليل.$suffix';
    }
    return switch (stage) {
      'save' => status == null
          ? 'تعذر حفظ تقرير الإطلالة. أعيدي المحاولة.$suffix'
          : 'تعذر حفظ تقرير الإطلالة. رمز الاستجابة $status.$suffix',
      'resume' => 'تعذر استئناف المحادثة السابقة. سنبدأ جلسة جديدة.$suffix',
      'session' => status == null
          ? 'تعذر بدء المحادثة المرتبطة بهذه الإطلالة. أعيدي المحاولة.$suffix'
          : 'تعذر بدء المحادثة المرتبطة بهذه الإطلالة. رمز الاستجابة $status.$suffix',
      _ => 'تعذر إكمال الطلب. أعيدي المحاولة.$suffix',
    };
  }

  String? _uuidOrNull(String? value) {
    if (value == null || value.isEmpty) return null;
    final uuid = RegExp(
      r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    );
    return uuid.hasMatch(value) ? value : null;
  }

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
    if (_sessionReady) return;
    final inflight = _sessionStart;
    if (inflight != null) {
      await inflight;
      return;
    }
    final run = _startSessionOnce();
    _sessionStart = run;
    try {
      await run;
    } finally {
      if (identical(_sessionStart, run)) _sessionStart = null;
    }
  }

  Future<void> _startSessionOnce() async {
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
    // Recolor id only from route args — never lastOutfit / lastRecolor alone.
    final recolorId = args.recolorAttemptId;
    var stage = 'session';

    try {
      final prefs = await SharedPreferences.getInstance();
      final fingerprint = await _imageFingerprint(args.outfitAnalysis?.frozenImagePath);
      final occasion = args.outfitAnalysis?.occasion.id;
      String? outfitAnalysisId = _uuidOrNull(args.outfitAnalysisId);
      // Same image + different occasion → distinct report keys (not fingerprint alone).
      if (outfitAnalysisId == null && fingerprint != null && occasion != null) {
        outfitAnalysisId = _uuidOrNull(
          prefs.getString('mira_outfit_report_${fingerprint}_$occasion'),
        );
      }
      if (outfitAnalysisId == null && args.outfitAnalysis != null) {
        stage = 'save';
        final occasionId = args.outfitAnalysis!.occasion.id;
        final saveKey =
            'mira_outfit_save_${fingerprint ?? 'nofp'}_${occasionId}_outfit-intel-v2';
        var clientSaveId = prefs.getString(saveKey)?.trim();
        // Server MaxLength(64). Full SHA-256 after μs caused the live 400.
        if (clientSaveId == null ||
            clientSaveId.isEmpty ||
            clientSaveId.length > 64) {
          clientSaveId = OutfitConsultationMapper.buildClientSaveId(
            fingerprint: fingerprint,
            occasionId: occasionId,
          );
          await prefs.setString(saveKey, clientSaveId);
        }
        final snapshot = await _outfitApi.saveIntelligenceSnapshot(
          OutfitConsultationMapper.toSnapshotPayload(
            args.outfitAnalysis!,
            imageFingerprint: fingerprint,
            clientSaveId: clientSaveId,
          ),
        );
        outfitAnalysisId = snapshot.id;
        if (fingerprint != null) {
          await prefs.setString(
            'mira_outfit_report_${fingerprint}_$occasionId',
            snapshot.id,
          );
        }
        final viewPath = args.outfitAnalysis?.frozenImagePath;
        if (viewPath != null && viewPath.isNotEmpty) {
          await OutfitLocalImageIndex.remember(
            key: snapshot.id,
            absolutePath: viewPath,
          );
          if (fingerprint != null) {
            await OutfitLocalImageIndex.remember(
              key: fingerprint,
              absolutePath: viewPath,
            );
          }
        }
      }

      if (outfitAnalysisId != null) {
        final remembered = AnalysisSession.consultationByAnalysis[outfitAnalysisId]
            ?? prefs.getString('mira_outfit_chat_$outfitAnalysisId');
        if (remembered != null && remembered.isNotEmpty) {
          stage = 'resume';
          try {
            final history = await _consultationApi.listMessages(remembered);
            if (!mounted) return;
            final focus = args.discussionFocus?.trim();
            final statedGoal = [
              if (focus != null && focus.isNotEmpty) 'سياق النقاش: $focus',
              if (args.outfitAnalysis != null)
                'مناسبة التقرير: ${args.outfitAnalysis!.occasion.labelAr}',
            ].join(' · ');
            final statedWithPrefs = await _preferenceGoalAr(base: statedGoal);
            String? acceptedFocus;
            String? snapshotId;
            String? bindError;
            try {
              final bound = await _consultationApi.bindContext(
                sessionId: remembered,
                outfitAnalysisId: outfitAnalysisId,
                occasionId: args.outfitAnalysis?.occasion.id,
                statedGoalAr: statedWithPrefs,
              );
              snapshotId = bound.activeSnapshotId;
              acceptedFocus = statedGoal.isEmpty ? focus : statedGoal;
            } catch (_) {
              bindError =
                  'تعذر تحديث سياق النقاش على الخادم — لن نعرضه كأنه نجح.';
            }
            final resumed = history.messages.map(_messageFromConsultation).toList();
            await _restoreOffersMemoryFromMessages(resumed);
            if (!mounted) return;
            setState(() {
              _messages
                ..clear()
                ..addAll(resumed);
              _sessionId = remembered;
              _snapshotId = snapshotId;
              _sessionReady = true;
              _boundOutfitAnalysisId = outfitAnalysisId;
              _contextCardText = acceptedFocus;
              _bindContextError = bindError;
              _focus = _ConsultationFocus.outfit;
              _sessionError = bindError;
            });
            return;
          } catch (_) {
            AnalysisSession.consultationByAnalysis.remove(outfitAnalysisId);
            await prefs.remove('mira_outfit_chat_$outfitAnalysisId');
          }
        }
      }

      stage = 'session';
      final skinId = outfitPrimary && args.skinReport == null
          ? null
          : _uuidOrNull(
              args.skinReport?.id ??
                  (outfitPrimary ? null : AnalysisSession.lastSkin?.id),
            );

      final faceLabel = _faceContext?.contextLabelAr;
      final focus = args.discussionFocus?.trim();
      final statedGoal = [
        if (faceLabel != null && faceLabel.isNotEmpty) 'دخلت من نتيجة الوجه: $faceLabel',
        if (focus != null && focus.isNotEmpty) 'سياق النقاش: $focus',
        if (args.outfitAnalysis != null)
          'مناسبة التقرير: ${args.outfitAnalysis!.occasion.labelAr}',
      ].join(' · ');

      // Resume skin-report chat like outfit — avoid orphan sessions mid-conversation.
      if (skinId != null && outfitAnalysisId == null && recolorId == null) {
        final rememberedSkin = prefs.getString('mira_skin_chat_$skinId');
        if (rememberedSkin != null && rememberedSkin.isNotEmpty) {
          stage = 'resume';
          try {
            final history = await _consultationApi.listMessages(rememberedSkin);
            final imageLimit = await _consultationApi.dialogueImageLimit();
            final sessions = await _consultationApi.listSessions();
            final match = sessions.where((s) => s.id == rememberedSkin);
            final snapshotId =
                match.isNotEmpty ? match.first.activeSnapshotId : null;
            final resumed = history.messages.map(_messageFromConsultation).toList();
            await _restoreOffersMemoryFromMessages(resumed);
            if (!mounted) return;
            setState(() {
              _messages
                ..clear()
                ..addAll(resumed);
              _sessionId = rememberedSkin;
              _snapshotId = snapshotId;
              _sessionReady = true;
              _sessionError = null;
              _maxImages = imageLimit;
              _focus = _faceContext != null
                  ? _ConsultationFocus.face
                  : _ConsultationFocus.skin;
              _contextCardText = statedGoal.isEmpty ? focus : statedGoal;
              if (_messages.isEmpty && _followUps.isEmpty) {
                _followUps = _skinStarterQuestions;
              }
            });
            return;
          } catch (_) {
            await prefs.remove('mira_skin_chat_$skinId');
          }
        }
      }

      final statedWithPrefs = await _preferenceGoalAr(base: statedGoal);
      final session = await _consultationApi.createSession(
        skinAnalysisId: skinId,
        outfitAnalysisId: outfitAnalysisId,
        recolorAttemptId: _uuidOrNull(recolorId),
        occasionId: args.outfitAnalysis?.occasion.id,
        statedGoalAr: statedWithPrefs,
        face: _faceContext?.toJson(),
      );
      final imageLimit = await _consultationApi.dialogueImageLimit();
      if (!mounted) return;
      if (outfitAnalysisId != null) {
        await prefs.setString('mira_outfit_chat_$outfitAnalysisId', session.id);
      }
      if (skinId != null && outfitAnalysisId == null) {
        await prefs.setString('mira_skin_chat_$skinId', session.id);
      }
      setState(() {
        _sessionId = session.id;
        _snapshotId = session.activeSnapshotId;
        _boundOutfitAnalysisId = outfitAnalysisId;
        _contextCardText = statedGoal.isEmpty ? focus : statedGoal;
        _bindContextError = null;
        if (outfitAnalysisId != null) {
          AnalysisSession.consultationByAnalysis[outfitAnalysisId] = session.id;
        }
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
        _sessionError = _stageError(stage, e);
        _focus = args.outfitAnalysis != null
            ? _ConsultationFocus.outfit
            : _ConsultationFocus.skin;
        if (outfitPrimary) {
          _followUps = OutfitConsultationMapper.outfitStarterQuestions;
        }
      });
    }
  }

  Future<String?> _imageFingerprint(String? path) async {
    if (path == null || path.isEmpty) return null;
    final file = File(path);
    if (!file.existsSync()) return null;
    final digest = sha256.convert(await file.readAsBytes());
    return digest.toString();
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
          loaded.add(_messageFromConsultation(message, imageSlots: slots));
        }
        await _restoreOffersMemoryFromMessages(loaded);
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
      final prefGoal = await _preferenceGoalAr();
      final session = await _consultationApi.createSession(
        statedGoalAr: prefGoal,
      );
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
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _sessionReady = false;
        _sessionId = null;
        _sessionError = _stageError('session', e);
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



  AdvisorMessage _messageFromConsultation(ConsultationMessage message, {
    List<DialogueImageSlot> imageSlots = const [],
  }) {
    final offers = [
      for (final raw in message.discoveryOffers)
        ConsultantDiscoveryOffer.fromJson(raw),
    ].where((o) => o.id.isNotEmpty).toList();
    final side = message.discoverySideOffer == null
        ? null
        : ConsultantDiscoveryOffer.fromJson(message.discoverySideOffer!);
    return AdvisorMessage(
      id: message.id,
      text: message.contentAr,
      isUser: message.isUser,
      at: message.createdAt,
      confidence: message.confidence,
      images: [for (final slot in imageSlots) if (slot.bytes != null) slot.bytes!],
      imageSlots: imageSlots,
      attachmentIds: message.attachmentIds,
      clientMessageId: message.clientMessageId,
      citedFacts: message.citedFacts
          .map((f) => MceCitedFact(id: f.id, labelAr: f.labelAr, valueAr: f.valueAr))
          .toList(),
      discoveryOffers: offers,
      discoverySideOffer: side,
    );
  }

  Future<void> _restoreOffersMemoryFromMessages(List<AdvisorMessage> messages) async {
    for (final m in messages.reversed) {
      if (m.isUser) continue;
      final list = <({String id, String kind, String titleAr})>[
        for (final o in m.discoveryOffers)
          (id: o.id, kind: o.kind, titleAr: o.titleAr),
        if (m.discoverySideOffer != null && m.discoverySideOffer!.id.isNotEmpty)
          (
            id: m.discoverySideOffer!.id,
            kind: m.discoverySideOffer!.kind,
            titleAr: m.discoverySideOffer!.titleAr,
          ),
      ];
      if (list.isNotEmpty) {
        await MiraAdvisorMemoryStore.rememberTurnOffers(list);
        return;
      }
    }
  }

  Future<MiraOfferLinkDecision> _handleOfferLinkAsk(String text) async {
    final decision = await MiraOfferLinkResolver.resolve(text);
    if (decision.kind == MiraOfferLinkKind.none) return decision;
    if (!mounted) return decision;
    if (decision.kind == MiraOfferLinkKind.clarify) {
      setState(() {
        _messages.add(
          AdvisorMessage(
            text: decision.clarifyAr ?? 'أي عرض تقصدين؟',
            isUser: false,
            at: DateTime.now(),
          ),
        );
      });
      _scrollToEnd();
      return decision;
    }
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => CatalogRecordScope.page(
          kind: decision.offerKind ?? 'product',
          id: decision.offerId!,
        ),
      ),
    );
    return decision;
  }

  Future<String?> _preferenceGoalAr({String? base}) async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    await MiraAdvisorMemoryStore.bindAccount(uid);
    final brief = await MiraAdvisorMemoryStore.preferenceBriefAr();
    final parts = <String>[
      if (base != null && base.trim().isNotEmpty) base.trim(),
      if (brief != null && brief.isNotEmpty) brief,
    ];
    if (parts.isEmpty) return null;
    return parts.join(' · ');
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

    if (retry == null) {
      await MiraAdvisorMemoryStore.absorbExplicitPrefsFromMessage(trimmed);
      if (MiraOfferLinkResolver.asksForLink(trimmed)) {
        setState(() {
          _messages.add(
            AdvisorMessage(
              text: trimmed,
              isUser: true,
              at: DateTime.now(),
              clientMessageId: 'c-link-${DateTime.now().microsecondsSinceEpoch}',
            ),
          );
        });
        final decision = await _handleOfferLinkAsk(trimmed);
        if (decision.kind == MiraOfferLinkKind.clarify) {
          // Local clarify bubble only — do not call the model for a fake link chase.
          return;
        }
        // Open path: continue so the server transcript also records the ask.
      }
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
      if (uploaded == null) {
        if (mounted) setState(() => _loading = false);
        return;
      }
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
        SnackBar(content: Text('${_arabicSendError(e)}\nرقم التتبع: ${outbound.clientMessageId}')),
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
    final discoveryOffers = [
      for (final raw in assistant.discoveryOffers)
        ConsultantDiscoveryOffer.fromJson(raw),
    ].where((o) => o.id.isNotEmpty).toList();
    final side = assistant.discoverySideOffer == null
        ? null
        : ConsultantDiscoveryOffer.fromJson(assistant.discoverySideOffer!);
    final remembered = <({String id, String kind, String titleAr})>[
      for (final o in discoveryOffers)
        (id: o.id, kind: o.kind, titleAr: o.titleAr),
      if (side != null && side.id.isNotEmpty)
        (id: side.id, kind: side.kind, titleAr: side.titleAr),
    ];
    await MiraAdvisorMemoryStore.rememberTurnOffers(remembered);
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
        discoveryOffers: discoveryOffers,
        discoverySideOffer: side,
      );
      _snapshotId = turn.session.activeSnapshotId ?? _snapshotId;
      _followUps = assistant.suggestedQuestionsAr;
      _loading = false;
      _failedOutbound = null;
      _drafts.clear();
      _input.clear();
    });
  }

  List<String> _followUps = const [];

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
      return 'وش في بالك اليوم؟ اكتبي سؤالك بطريقتك، أو أرسلي صورة وأبحث لك داخل ميرا.';
    }
    return switch (_focus) {
      _ConsultationFocus.atelier =>
        'إجابات مُؤَسَّسة على تجربة Atelier وQEL — تلوين قماش فقط',
      _ConsultationFocus.outfit =>
        'بخصوص هذه الإطلالة — أسلوب · مناسبة · إكسسوارات',
      _ConsultationFocus.face =>
        'ميرا تشرح نتائج ملامحك من الأدلة المتاحة — بدون إعادة تحليل',
      _ConsultationFocus.skin =>
        'بخصوص تقرير بشرتك — إجابات من التقرير المعروض فقط، بدون إعادة تحليل',
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
    // Keep the raw Dart/type error in logs; never surface it to the user.
    // ignore: avoid_print
    print('mira_advisor_send_error: $error');
    final text = error.toString().replaceFirst('Exception: ', '').trim();
    if (text.isEmpty) {
      return 'تعذر عرض الرد. أعيدي المحاولة وسنستخدم الطلب نفسه.';
    }
    if (error is ConsultationStreamException) return text;
    if (RegExp(r"type '.*' is not a subtype of type").hasMatch(text) ||
        text.contains('is not a subtype of type')) {
      return 'تعذر عرض الرد. أعيدي المحاولة وسنستخدم الطلب نفسه.';
    }
    if (text.contains('أعيدي') ||
        text.contains('تعذر') ||
        text.contains('غير متاح') ||
        text.contains('انقطع')) {
      return text;
    }
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
              if (_focus == _ConsultationFocus.outfit &&
                  (_boundOutfitAnalysisId != null ||
                      _args?.outfitAnalysis != null ||
                      _bindContextError != null))
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Container(
                    key: const Key('outfit_advisor_context_card'),
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: AppColors.border.withValues(alpha: 0.45),
                      ),
                    ),
                    child: Text(
                      [
                        if (_args?.outfitAnalysis != null)
                          'تقرير: ${_args!.outfitAnalysis!.occasion.labelAr}'
                              ' · ${_args!.outfitAnalysis!.clothingType}',
                        if (_contextCardText != null &&
                            _contextCardText!.isNotEmpty)
                          'قبله الخادم: $_contextCardText',
                        if (_bindContextError != null) _bindContextError!,
                        if (_boundOutfitAnalysisId != null)
                          'معرّف التحليل مرتبط',
                      ].where((s) => s.isNotEmpty).join('\n'),
                      style: AppTypography.labelSmall.copyWith(
                        color: AppColors.textSecondary,
                        height: 1.35,
                      ),
                      textAlign: TextAlign.center,
                    ),
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
                    isUser
                        ? message.text
                        : MceDisplayText.sanitize(message.text),
                    textDirection: TextDirection.rtl,
                    style: AppTypography.bodyMedium.copyWith(height: 1.55),
                  ),
            if (!isUser && message.citedFacts.isNotEmpty)
              MceCitationChips(
                facts: message.citedFacts
                    .map((f) => (label: f.labelAr, value: f.valueAr))
                    .toList(),
              ),
            if (!isUser &&
                (message.discoveryOffers.isNotEmpty ||
                    message.discoverySideOffer != null)) ...[
              const SizedBox(height: 10),
              ConsultantOfferCards(
                offers: message.discoveryOffers,
                sideOffer: message.discoverySideOffer,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

import '../../contracts/result_enums.dart';
import '../../contracts/result_presentation_vms.dart';
import '../../domain/perfect_mask_session.dart';
import '../../semantics/metric_presentation_policy.dart';
import '../../visibility/visibility_policy.dart';
import 'face_explorer_controller.dart';

/// Honest slot state for a Face Explorer metric chip.
enum FaceExplorerMetricSlotStatus {
  /// Score and/or mask present in this attempt — selectable with real data.
  ready,

  /// Analysis still in flight; no fabricated score/map.
  analyzing,

  /// Analysis settled without a legitimate result for this metric.
  unavailable,
}

/// Trace why a primary metric may be empty (requested → received → session → UI).
enum FaceExplorerMetricGapReason {
  /// Shown with a legitimate score and/or mask.
  displayed,

  /// Provider type never entered the expected primary set for this product surface.
  notInPrimarySet,

  /// No session yet / request still open — waiting on provider.
  awaitingProvider,

  /// Provider finished this attempt but this concern was not returned.
  notReceived,

  /// Returned / scored in report metrics but not stored in PerfectMaskSession.
  receivedNotInSession,

  /// In session without score or mask bytes (presence-only / unusable).
  inSessionNotUsable,
}

/// One catalog row: canonical consumer id + availability + provenance.
class FaceExplorerMetricSlot {
  const FaceExplorerMetricSlot({
    required this.id,
    required this.labelAr,
    required this.providerType,
    required this.status,
    required this.hasScore,
    required this.hasMask,
    required this.isPrimary,
    required this.gapReason,
    this.fromMapConcerns = false,
    this.fromSession = false,
    this.fromReportMetrics = false,
  });

  final String id;
  final String labelAr;
  final String? providerType;
  final FaceExplorerMetricSlotStatus status;
  final bool hasScore;
  final bool hasMask;
  final bool isPrimary;
  final FaceExplorerMetricGapReason gapReason;
  final bool fromMapConcerns;
  final bool fromSession;
  final bool fromReportMetrics;

  ResultMapConcernVM get asConcernVm => ResultMapConcernVM(
    id: id,
    labelAr: labelAr,
    evidenceRef: 'face_explorer:$id',
    visibility: status == FaceExplorerMetricSlotStatus.ready
        ? VisibilityState.visibleSecondary
        : VisibilityState.unavailable,
  );

  String get statusLabelAr => switch (status) {
    FaceExplorerMetricSlotStatus.ready => labelAr,
    FaceExplorerMetricSlotStatus.analyzing => 'جارٍ التحليل',
    FaceExplorerMetricSlotStatus.unavailable => 'غير متاح',
  };
}

/// Builds the Face Explorer metric list from map + session + report metrics.
///
/// Fixes the regression where `_carouselConcerns` only walked `map.concerns`
/// and dropped PerfectMaskSession results (e.g. oiliness) absent from mainConcerns.
abstract final class FaceExplorerConcernCatalog {
  FaceExplorerConcernCatalog._();

  static const primaryIds = FaceExplorerController.primaryConsumerIds;

  /// Preferred display order for extras after the primary six.
  static const preferredExtraOrder = <String>[
    'redness',
    'texture',
    'radiance',
    'dark_circle',
    'eye_bag',
    'droopy_upper',
    'droopy_lower',
    'firmness',
    'tear_trough',
  ];

  static FaceExplorerConcernCatalogResult build({
    required List<ResultMapConcernVM> mapConcerns,
    required List<ResultMetricVM> reportMetrics,
    PerfectMaskSession? session,
    required bool fromHistory,
    required bool analysisSettled,
  }) {
    final mapByProvider = <String, ResultMapConcernVM>{};
    for (final c in mapConcerns) {
      if (!VisibilityPolicy.isPubliclyVisible(c.visibility)) continue;
      final p = PerfectMaskSession.providerTypeForConsumerMetric(c.id);
      if (p == null) continue;
      mapByProvider.putIfAbsent(p, () => c);
    }

    final sessionLegitimate = session?.providersWithLegitimateResult() ?? {};
    final sessionPresent = session?.providersPresent() ?? {};
    final sessionWithMask = session?.providersWithMaskBytes() ?? {};

    final metricScoreProviders = <String>{};
    final metricByProvider = <String, ResultMetricVM>{};
    for (final m in reportMetrics) {
      if (!VisibilityPolicy.isPubliclyVisible(m.visibility)) continue;
      if (!m.evidenceAvailable) continue;
      final score = MetricPresentationPolicy.primaryScore(m);
      if (score?.value == null) continue;
      final p = PerfectMaskSession.providerTypeForConsumerMetric(m.id);
      if (p == null || p == 'hd_skin_type') continue;
      metricScoreProviders.add(p);
      metricByProvider.putIfAbsent(p, () => m);
    }

    // Eligible for a "ready" chip: session score/mask OR report metric score.
    final readyProviders = <String>{
      ...sessionLegitimate,
      ...metricScoreProviders,
    };

    FaceExplorerMetricSlot slotFor({
      required String consumerId,
      required bool isPrimary,
    }) {
      final provider =
          PerfectMaskSession.providerTypeForConsumerMetric(consumerId) ??
          (consumerId.startsWith('hd_') ? consumerId : null);
      final mapVm = provider == null ? null : mapByProvider[provider];
      final id =
          mapVm?.id ??
          (provider == null
              ? consumerId
              : (PerfectMaskSession.consumerMetricIdForProvider(provider) ??
                    consumerId));
      final label =
          mapVm?.labelAr ?? MetricPresentationPolicy.publicLabelAr(id);

      final art = session?.lookup(consumerMetricId: id);
      final hasMask =
          (art?.bytes != null && art!.bytes!.isNotEmpty) ||
          (provider != null && sessionWithMask.contains(provider));
      final hasSessionScore =
          art?.uiScore != null ||
          art?.rawScore != null ||
          (provider != null && sessionLegitimate.contains(provider));
      final hasMetricScore =
          provider != null && metricScoreProviders.contains(provider);
      final hasScore = hasSessionScore || hasMetricScore;
      final ready = hasScore || hasMask;

      final fromMap = mapVm != null;
      final fromSession =
          provider != null &&
          (sessionLegitimate.contains(provider) ||
              sessionPresent.contains(provider));
      final fromMetrics =
          provider != null && metricScoreProviders.contains(provider);

      if (ready) {
        return FaceExplorerMetricSlot(
          id: id,
          labelAr: label,
          providerType: provider,
          status: FaceExplorerMetricSlotStatus.ready,
          hasScore: hasScore,
          hasMask: hasMask,
          isPrimary: isPrimary,
          gapReason: FaceExplorerMetricGapReason.displayed,
          fromMapConcerns: fromMap,
          fromSession: fromSession,
          fromReportMetrics: fromMetrics,
        );
      }

      if (!analysisSettled && !fromHistory) {
        return FaceExplorerMetricSlot(
          id: id,
          labelAr: label,
          providerType: provider,
          status: FaceExplorerMetricSlotStatus.analyzing,
          hasScore: false,
          hasMask: false,
          isPrimary: isPrimary,
          gapReason: FaceExplorerMetricGapReason.awaitingProvider,
          fromMapConcerns: fromMap,
          fromSession: fromSession,
          fromReportMetrics: fromMetrics,
        );
      }

      FaceExplorerMetricGapReason gap;
      if (provider == null) {
        gap = FaceExplorerMetricGapReason.notInPrimarySet;
      } else if (sessionPresent.contains(provider) &&
          !sessionLegitimate.contains(provider) &&
          !metricScoreProviders.contains(provider)) {
        gap = FaceExplorerMetricGapReason.inSessionNotUsable;
      } else if (metricScoreProviders.contains(provider) &&
          !sessionLegitimate.contains(provider)) {
        // Score known on report but not session — still treated ready above.
        gap = FaceExplorerMetricGapReason.receivedNotInSession;
      } else if (fromMap && !ready) {
        gap = FaceExplorerMetricGapReason.receivedNotInSession;
      } else {
        gap = FaceExplorerMetricGapReason.notReceived;
      }

      return FaceExplorerMetricSlot(
        id: id,
        labelAr: label,
        providerType: provider,
        status: FaceExplorerMetricSlotStatus.unavailable,
        hasScore: false,
        hasMask: false,
        isPrimary: isPrimary,
        gapReason: gap,
        fromMapConcerns: fromMap,
        fromSession: fromSession,
        fromReportMetrics: fromMetrics,
      );
    }

    final primary = <FaceExplorerMetricSlot>[
      for (final id in primaryIds) slotFor(consumerId: id, isPrimary: true),
    ];
    final primaryProviders = <String>{
      for (final s in primary)
        if (s.providerType != null) s.providerType!,
    };

    final extraProviders = readyProviders
        .where((p) => !primaryProviders.contains(p) && p != 'hd_skin_type')
        .toList();

    int extraRank(String provider) {
      final consumer =
          PerfectMaskSession.consumerMetricIdForProvider(provider) ?? provider;
      final i = preferredExtraOrder.indexOf(consumer);
      return i < 0 ? 1000 + provider.hashCode : i;
    }

    extraProviders.sort((a, b) => extraRank(a).compareTo(extraRank(b)));

    final extras = <FaceExplorerMetricSlot>[];
    final seenExtra = <String>{};
    for (final p in extraProviders) {
      if (!seenExtra.add(p)) continue;
      final consumer = PerfectMaskSession.consumerMetricIdForProvider(p) ?? p;
      final slot = slotFor(consumerId: consumer, isPrimary: false);
      if (slot.status == FaceExplorerMetricSlotStatus.ready) {
        extras.add(slot);
      }
    }

    return FaceExplorerConcernCatalogResult(primary: primary, extras: extras);
  }
}

class FaceExplorerConcernCatalogResult {
  const FaceExplorerConcernCatalogResult({
    required this.primary,
    required this.extras,
  });

  final List<FaceExplorerMetricSlot> primary;
  final List<FaceExplorerMetricSlot> extras;

  /// Default grid: always the six primary slots (ready / analyzing / unavailable).
  List<FaceExplorerMetricSlot> get defaultVisible => primary;

  /// Expanded grid: primary six + extras, no duplicates by provider.
  List<FaceExplorerMetricSlot> get expandedVisible => [...primary, ...extras];

  List<FaceExplorerMetricSlot> visible({required bool showAll}) =>
      showAll ? expandedVisible : defaultVisible;

  /// Selectable ids that carry a real result (score and/or mask).
  Iterable<String> get readyIds => [...primary, ...extras]
      .where((s) => s.status == FaceExplorerMetricSlotStatus.ready)
      .map((s) => s.id);

  FaceExplorerMetricSlot? byId(String id) {
    for (final s in [...primary, ...extras]) {
      if (s.id == id) return s;
      final p = PerfectMaskSession.providerTypeForConsumerMetric(id);
      if (p != null && s.providerType == p) return s;
    }
    return null;
  }
}

import '../../../projection/contracts/face_result_enums.dart';

/// Deterministic single-selection state for Result Mirror (9F/9G).
///
/// One source of truth: insight + region + detailRef stay synchronized.
class FaceResultSelectionState {
  final String? selectedInsightId;
  final FacePresentationRegion? selectedRegion;
  final String? selectedDetailRefId;

  const FaceResultSelectionState({
    this.selectedInsightId,
    this.selectedRegion,
    this.selectedDetailRefId,
  });

  static const empty = FaceResultSelectionState();

  FaceResultSelectionState selectInsight({
    required String insightId,
    required FacePresentationRegion region,
    String? detailRefId,
  }) {
    return FaceResultSelectionState(
      selectedInsightId: insightId,
      selectedRegion: region,
      selectedDetailRefId: detailRefId ?? selectedDetailRefId,
    );
  }

  FaceResultSelectionState selectRegion(
    FacePresentationRegion region, {
    String? insightId,
    String? detailRefId,
  }) {
    return FaceResultSelectionState(
      selectedInsightId: insightId ?? selectedInsightId,
      selectedRegion: region,
      selectedDetailRefId: detailRefId ?? selectedDetailRefId,
    );
  }

  FaceResultSelectionState selectDetail({
    required String detailRefId,
    String? insightId,
    FacePresentationRegion? region,
  }) {
    return FaceResultSelectionState(
      selectedInsightId: insightId ?? selectedInsightId,
      selectedRegion: region ?? selectedRegion,
      selectedDetailRefId: detailRefId,
    );
  }

  FaceResultSelectionState clear() => empty;

  bool get hasSelection =>
      selectedInsightId != null ||
      selectedRegion != null ||
      selectedDetailRefId != null;
}

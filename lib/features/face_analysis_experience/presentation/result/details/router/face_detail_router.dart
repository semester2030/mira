import '../../../../projection/contracts/face_result_enums.dart';
import '../../../../projection/contracts/face_result_vms.dart';
import '../assembler/face_detail_assembler.dart';
import '../contracts/face_detail_sheet_vm.dart';

/// Deterministic detail routing — detailRef / insight / region → sheet VM.
abstract final class FaceDetailRouter {
  FaceDetailRouter._();

  static FaceDetailSheetVm resolveDetailRef(
    FaceResultProjection projection,
    String detailRefId,
  ) {
    return FaceDetailAssembler.fromDetailRef(projection, detailRefId) ??
        FaceDetailAssembler.unsupported(detailRefId);
  }

  static FaceDetailSheetVm resolveInsight(
    FaceResultProjection projection,
    FaceInsightVm insight,
  ) {
    return FaceDetailAssembler.fromInsight(projection, insight);
  }

  static FaceDetailSheetVm resolvePrimary(FaceResultProjection projection) {
    final primary = projection.executiveSummary.primary;
    if (primary == null) {
      return FaceDetailAssembler.unsupported('primary_missing');
    }
    return FaceDetailAssembler.fromPrimary(projection, primary);
  }

  static FaceDetailSheetVm resolveRegion(
    FaceResultProjection projection,
    FacePresentationRegion region,
  ) {
    return FaceDetailAssembler.fromRegion(projection, region);
  }

  /// «التفاصيل» button: selected insight → else primary → else unsupported.
  static FaceDetailSheetVm resolveDetailsButton(
    FaceResultProjection projection, {
    String? selectedInsightId,
  }) {
    if (selectedInsightId != null) {
      for (final i in projection.executiveSummary.insights) {
        if (i.id == selectedInsightId) {
          return resolveInsight(projection, i);
        }
      }
    }
    if (projection.executiveSummary.primary != null) {
      return resolvePrimary(projection);
    }
    if (projection.executiveSummary.insights.isNotEmpty) {
      return resolveInsight(
        projection,
        projection.executiveSummary.insights.first,
      );
    }
    return FaceDetailAssembler.unsupported('no_detail');
  }
}

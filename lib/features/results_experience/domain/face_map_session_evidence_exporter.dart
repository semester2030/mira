import 'dart:convert';
import 'dart:io';

import 'package:archive/archive.dart';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'perfect_mask_data_kind_contract.dart';
import 'perfect_mask_presentation_decoder.dart';
import 'perfect_mask_session.dart';
import '../presentation/geometry/skin_face_map_visual_tokens.dart';

class FaceMapEvidenceExportResult {
  const FaceMapEvidenceExportResult({
    required this.ok,
    this.zipPath,
    this.directoryPath,
    this.error,
  });

  final bool ok;
  final String? zipPath;
  final String? directoryPath;
  final String? error;
}

/// Inspection-build evidence pack: source + raw/remapped Perfect masks as ZIP.
///
/// Writes on-device then offers Share sheet so the file reaches the Mac.
/// Never prints image bytes to logs.
abstract final class FaceMapSessionEvidenceExporter {
  FaceMapSessionEvidenceExporter._();

  static bool get inspectionExportEnabled => !kReleaseMode;

  static String fingerprintBytes(Uint8List? bytes) {
    if (bytes == null || bytes.isEmpty) return 'empty';
    return sha256.convert(bytes).toString().substring(0, 16);
  }

  /// Build evidence folder + ZIP under app documents. Does not share.
  static Future<FaceMapEvidenceExportResult> buildZip({
    required String attemptId,
    required PerfectMaskSession session,
    Uint8List? sourceBytes,
    int? sourceWidth,
    int? sourceHeight,
    String? selectedMetricId,
    String? selectedSubregion,
    Map<String, dynamic>? presentationSnapshot,
    List<String> priorityConsumerIds = const ['oiliness', 'wrinkles', 'pores'],
  }) async {
    try {
      final safeId = attemptId.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
      final docs = await getApplicationDocumentsDirectory();
      final dir = Directory('${docs.path}/mira_map_evidence/$safeId');
      if (dir.existsSync()) {
        dir.deleteSync(recursive: true);
      }
      dir.createSync(recursive: true);

      if (sourceBytes != null && sourceBytes.isNotEmpty) {
        File('${dir.path}/00_source.png').writeAsBytesSync(sourceBytes);
      }

      final manifest = <String, dynamic>{
        'attemptId': attemptId,
        'exportedAt': DateTime.now().toUtc().toIso8601String(),
        'sourceWidth': sourceWidth,
        'sourceHeight': sourceHeight,
        'sourceBytes': sourceBytes?.length,
        'sourceFingerprint': fingerprintBytes(sourceBytes),
        'selectedMetricId': selectedMetricId,
        'selectedSubregion': selectedSubregion,
        'tokenVersion': SkinFaceMapVisualTokens.version,
        'presentationSnapshot': presentationSnapshot,
        'metrics': <Map<String, dynamic>>[],
      };

      for (final consumerId in priorityConsumerIds) {
        final art = session.lookup(consumerMetricId: consumerId);
        final kind = PerfectMaskDataKindContract.classifyArtifact(
          artifact: art,
          regionRequested: false,
          regionMaskBound: true,
        );
        final row = PerfectMaskDataKindContract.rowForProvider(
          PerfectMaskSession.providerTypeForConsumerMetric(consumerId),
        );
        final entry = <String, dynamic>{
          'consumerId': consumerId,
          'providerType': art?.concernType,
          'region': art?.region,
          'dataKind': kind.name,
          'contractFamily': row?.family.name,
          'spatialMode': row?.spatialModeName,
          'uiScore': art?.uiScore,
          'rawScore': art?.rawScore,
          'scoreOnly': art?.scoreOnly,
          'aligned': art?.aligned,
          'maskWidth': art?.width,
          'maskHeight': art?.height,
          'rawBytes': art?.bytes?.length,
          'rawFingerprint': fingerprintBytes(art?.bytes),
        };

        final bytes = art?.bytes;
        if (bytes != null && bytes.isNotEmpty) {
          final safeName = consumerId.replaceAll(RegExp(r'[^a-z0-9_]'), '_');
          File(
            '${dir.path}/${safeName}_01_raw_perfect.png',
          ).writeAsBytesSync(bytes);
          final profile = SkinFaceMapVisualTokens.presentationProfileForConcern(
            consumerId,
          );
          final remapped =
              PerfectMaskPresentationDecoder.remapToPresentationPng(
                perfectPngBytes: bytes,
                profile: profile,
              );
          if (remapped != null) {
            File(
              '${dir.path}/${safeName}_02_presentation.png',
            ).writeAsBytesSync(remapped);
            entry['presentationBytes'] = remapped.length;
            entry['presentationFingerprint'] = fingerprintBytes(remapped);
            entry['profile'] = {
              'floor': profile.luminanceGateFloor,
              'gain': profile.alphaGain,
              'opacity': profile.opacity,
              'minVisibleAlpha': profile.minVisibleAlpha,
              'alphaMode': profile.alphaMode.name,
            };
          } else {
            entry['presentationDecode'] = 'FAILED';
          }
        } else {
          entry['maskStatus'] = art == null
              ? 'MISSING_ARTIFACT'
              : (art.scoreOnly ? 'SCORE_ONLY' : 'NO_BYTES');
        }
        (manifest['metrics'] as List).add(entry);
      }

      File(
        '${dir.path}/MANIFEST.json',
      ).writeAsStringSync(const JsonEncoder.withIndent('  ').convert(manifest));

      final zipPath = '${docs.path}/mira_map_evidence_$safeId.zip';
      final zipFile = File(zipPath);
      if (zipFile.existsSync()) zipFile.deleteSync();

      final archive = Archive();
      for (final entity in dir.listSync(recursive: true)) {
        if (entity is! File) continue;
        final rel = entity.path.substring(dir.path.length + 1);
        archive.addFile(
          ArchiveFile(rel, entity.lengthSync(), entity.readAsBytesSync()),
        );
      }
      final zipBytes = ZipEncoder().encode(archive);
      zipFile.writeAsBytesSync(zipBytes);

      debugPrint(
        'FACE_MAP_EVIDENCE zip_ok attemptId=$attemptId '
        'zipBytes=${zipBytes.length} path=$zipPath',
      );
      return FaceMapEvidenceExportResult(
        ok: true,
        zipPath: zipPath,
        directoryPath: dir.path,
      );
    } catch (e) {
      debugPrint('FACE_MAP_EVIDENCE build_failed err=$e');
      return FaceMapEvidenceExportResult(ok: false, error: '$e');
    }
  }

  /// Build ZIP then open the system share sheet (AirDrop / Files → Mac).
  static Future<FaceMapEvidenceExportResult> buildAndShare({
    required String attemptId,
    required PerfectMaskSession session,
    required BuildContext context,
    Uint8List? sourceBytes,
    int? sourceWidth,
    int? sourceHeight,
    String? selectedMetricId,
    String? selectedSubregion,
    Map<String, dynamic>? presentationSnapshot,
  }) async {
    final origin = _shareOrigin(context);
    final built = await buildZip(
      attemptId: attemptId,
      session: session,
      sourceBytes: sourceBytes,
      sourceWidth: sourceWidth,
      sourceHeight: sourceHeight,
      selectedMetricId: selectedMetricId,
      selectedSubregion: selectedSubregion,
      presentationSnapshot: presentationSnapshot,
    );
    if (!built.ok || built.zipPath == null) {
      return FaceMapEvidenceExportResult(
        ok: false,
        zipPath: built.zipPath,
        directoryPath: built.directoryPath,
        error: 'prepare_failed',
      );
    }
    try {
      await Share.shareXFiles(
        [XFile(built.zipPath!, mimeType: 'application/zip')],
        subject: 'MIRA map evidence $attemptId',
        text: 'أدلة خريطة البشرة — محاولة $attemptId',
        sharePositionOrigin: origin,
      );
      return built;
    } catch (e) {
      debugPrint('FACE_MAP_EVIDENCE share_failed err=$e');
      return FaceMapEvidenceExportResult(
        ok: false,
        zipPath: built.zipPath,
        directoryPath: built.directoryPath,
        // Never leak PlatformException text to UI callers.
        error: 'share_unavailable',
      );
    }
  }

  /// iOS requires a non-zero sharePositionOrigin inside the source view.
  static Rect _shareOrigin(BuildContext context) {
    final box = context.findRenderObject() as RenderBox?;
    if (box != null && box.hasSize) {
      final size = box.size;
      if (size.width > 0 && size.height > 0) {
        return box.localToGlobal(Offset.zero) & size;
      }
    }
    final media = MediaQuery.sizeOf(context);
    final w = media.width.clamp(1.0, 10000.0);
    final h = media.height.clamp(1.0, 10000.0);
    return Rect.fromCenter(center: Offset(w / 2, h / 2), width: 44, height: 44);
  }
}

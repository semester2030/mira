import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';

import '../../../core/session/analysis_session.dart';
import '../domain/mask_source_alignment_contract.dart';
import '../domain/perfect_mask_session.dart';

/// Sanitized session identity for face↔mask provenance (no pixels / URLs).
class FaceMapSessionProvenance {
  const FaceMapSessionProvenance({
    required this.faceId,
    required this.faceWidth,
    required this.faceHeight,
    required this.faceSha256Prefix,
    required this.faceByteLength,
    required this.maskRows,
  });

  final String? faceId;
  final int? faceWidth;
  final int? faceHeight;
  final String? faceSha256Prefix;
  final int? faceByteLength;
  final List<FaceMapMaskProvenanceRow> maskRows;

  Map<String, Object?> toJson() => {
    'faceId': faceId,
    'faceWidth': faceWidth,
    'faceHeight': faceHeight,
    'faceSha256Prefix': faceSha256Prefix,
    'faceByteLength': faceByteLength,
    'masks': maskRows.map((e) => e.toJson()).toList(),
  };
}

class FaceMapMaskProvenanceRow {
  const FaceMapMaskProvenanceRow({
    required this.concernType,
    required this.region,
    required this.width,
    required this.height,
    required this.alignedWithSource,
    required this.hasBytes,
    required this.byteLength,
    required this.sha256Prefix,
    required this.uiScore,
    required this.scoreOnly,
    required this.alignmentMode,
    required this.mayOverlay,
    required this.alignmentNotes,
  });

  final String concernType;
  final String? region;
  final int? width;
  final int? height;
  final bool? alignedWithSource;
  final bool hasBytes;
  final int byteLength;
  final String? sha256Prefix;
  final double? uiScore;
  final bool scoreOnly;
  final String alignmentMode;
  final bool mayOverlay;
  final String alignmentNotes;

  Map<String, Object?> toJson() => {
    'concernType': concernType,
    'region': region,
    'width': width,
    'height': height,
    'alignedWithSource': alignedWithSource,
    'hasBytes': hasBytes,
    'byteLength': byteLength,
    'sha256Prefix': sha256Prefix,
    'uiScore': uiScore,
    'scoreOnly': scoreOnly,
    'alignmentMode': alignmentMode,
    'mayOverlay': mayOverlay,
    'alignmentNotes': alignmentNotes,
  };
}

abstract final class FaceMapSessionProvenanceProbe {
  FaceMapSessionProvenanceProbe._();

  static Future<FaceMapSessionProvenance> capture({
    PerfectMaskSession? session,
    String? facePath,
    int? faceWidth,
    int? faceHeight,
    String? faceId,
  }) async {
    final path = facePath ?? AnalysisSession.lastEphemeralFacePath;
    final id = faceId ?? AnalysisSession.lastEphemeralFaceId;
    final w = faceWidth ?? AnalysisSession.lastEphemeralFaceWidth;
    final h = faceHeight ?? AnalysisSession.lastEphemeralFaceHeight;
    String? faceSha;
    int? faceLen;
    if (path != null && path.isNotEmpty) {
      try {
        final bytes = await File(path).readAsBytes();
        faceLen = bytes.length;
        faceSha = sha256.convert(bytes).toString().substring(0, 16);
      } catch (_) {}
    }

    final sess = session ?? AnalysisSession.lastPerfectMasks;
    final rows = <FaceMapMaskProvenanceRow>[];
    if (sess != null) {
      for (final provider in sess.providersPresent()) {
        final consumer = PerfectMaskSession.consumerMetricIdForProvider(
          provider,
        );
        if (consumer == null) continue;
        final art = sess.lookup(consumerMetricId: consumer);
        if (art == null) continue;
        final bytes = art.bytes;
        final decision = MaskSourceAlignmentContract.decide(
          sourceWidth: w,
          sourceHeight: h,
          maskWidth: art.width,
          maskHeight: art.height,
          alignedWithSource: art.aligned,
        );
        rows.add(
          FaceMapMaskProvenanceRow(
            concernType: art.concernType,
            region: art.region,
            width: art.width,
            height: art.height,
            alignedWithSource: art.aligned,
            hasBytes: bytes != null && bytes.isNotEmpty,
            byteLength: bytes?.length ?? 0,
            sha256Prefix: bytes == null || bytes.isEmpty
                ? null
                : sha256.convert(bytes).toString().substring(0, 16),
            uiScore: art.uiScore,
            scoreOnly: art.scoreOnly,
            alignmentMode: decision.mode.name,
            mayOverlay: decision.mayOverlaySpatially,
            alignmentNotes: decision.notes,
          ),
        );
      }
    }

    final proof = FaceMapSessionProvenance(
      faceId: id,
      faceWidth: w,
      faceHeight: h,
      faceSha256Prefix: faceSha,
      faceByteLength: faceLen,
      maskRows: rows,
    );
    // Sanitized console proof — never bytes or URLs.
    // ignore: avoid_print
    print('FACE_MAP_PROVENANCE ${jsonEncode(proof.toJson())}');
    return proof;
  }

  static String shortFingerprint(Uint8List bytes) =>
      sha256.convert(bytes).toString().substring(0, 16);

  static void debugLog(String message) {
    assert(() {
      debugPrint(message);
      return true;
    }());
  }
}

import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/network/mira_api_endpoints.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../widgets/perfect_mask_overlay.dart';
import '../geometry/skin_face_map_visual_tokens.dart';

/// INTERNAL technical acceptance viewer for Perfect HD detection masks.
/// No landmark polygons. No premium polish. Session-scoped only.
class PerfectHdMaskTechnicalViewerScreen extends StatefulWidget {
  const PerfectHdMaskTechnicalViewerScreen({
    super.key,
    this.initialImageBytes,
    this.initialFileName = 'capture.jpg',
  });

  final Uint8List? initialImageBytes;
  final String initialFileName;

  @override
  State<PerfectHdMaskTechnicalViewerScreen> createState() =>
      _PerfectHdMaskTechnicalViewerScreenState();
}

class _PerfectHdMaskTechnicalViewerScreenState
    extends State<PerfectHdMaskTechnicalViewerScreen> {
  Uint8List? _sourceBytes;
  List<_HdMaskItem> _masks = const [];
  String? _selectedKey;
  var _showMaskOnly = false;
  var _loading = false;
  String? _error;
  Map<String, dynamic>? _report;

  @override
  void initState() {
    super.initState();
    _sourceBytes = widget.initialImageBytes;
  }

  Future<void> _runHdAcceptance() async {
    final bytes = _sourceBytes;
    if (bytes == null || bytes.isEmpty) {
      setState(() => _error = 'لا توجد صورة — التقطي أو اختاري صورة أولاً.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ApiClient.instance;
      final form = FormData.fromMap({
        'image': MultipartFile.fromBytes(
          bytes,
          filename: widget.initialFileName,
        ),
      });
      final res = await dio.post<Map<String, dynamic>>(
        MiraApiEndpoints.skinAnalysisHdMasks,
        data: form,
        options: Options(
          sendTimeout: const Duration(seconds: 180),
          receiveTimeout: const Duration(seconds: 180),
        ),
      );
      final data = res.data;
      if (data == null) throw Exception('empty response');
      final sourceB64 = data['sourceImageBase64'] as String?;
      final srcType = data['sourceContentType'] as String? ?? 'image/jpeg';
      final masksRaw = data['ephemeralMasks'] as List<dynamic>? ?? const [];
      final parsed = <_HdMaskItem>[];
      for (final row in masksRaw) {
        if (row is! Map) continue;
        final map = Map<String, dynamic>.from(row);
        final b64 = map['maskBase64'] as String?;
        parsed.add(
          _HdMaskItem(
            concernType: '${map['concernType'] ?? ''}',
            region: map['region'] as String?,
            rawScore: (map['rawScore'] as num?)?.toDouble(),
            uiScore: (map['uiScore'] as num?)?.toDouble(),
            scoreOnly: map['scoreOnly'] == true,
            width: map['width'] as int?,
            height: map['height'] as int?,
            aligned: map['alignedWithSource'] as bool?,
            bytes: b64 != null && b64.isNotEmpty ? base64Decode(b64) : null,
          ),
        );
      }
      setState(() {
        if (sourceB64 != null && sourceB64.isNotEmpty) {
          _sourceBytes = base64Decode(sourceB64);
        }
        _masks = parsed;
        _report = data['report'] as Map<String, dynamic>?;
        _selectedKey = parsed
            .where((m) => m.bytes != null)
            .map((m) => m.key)
            .cast<String?>()
            .firstWhere((k) => k != null, orElse: () => null);
        _loading = false;
      });
      debugPrint('HD_MASK_ACCEPTANCE masks=${parsed.length} src=$srcType');
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  _HdMaskItem? get _selected {
    final key = _selectedKey;
    if (key == null) return null;
    for (final m in _masks) {
      if (m.key == key) return m;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final selected = _selected;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          'HD Masks — قبول تقني',
          style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w800),
        ),
        actions: [
          IconButton(
            tooltip: 'تشغيل تحليل HD',
            onPressed: _loading ? null : _runHdAcceptance,
            icon: _loading
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.play_arrow),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: Text(
              'عارض تقني فقط — بدون خطوط landmarks. '
              'CameraKit: غير مدمج في المشروع حالياً.',
              style: AppTypography.labelSmall.copyWith(
                color: AppColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(
                _error!,
                style: AppTypography.bodySmall.copyWith(color: AppColors.error),
              ),
            ),
          Expanded(
            child: Center(
              child: _sourceBytes == null
                  ? Text(
                      'لا صورة — مرّري bytes من الالتقاط أو شغّلي عبر API.',
                      style: AppTypography.bodyMedium,
                      textAlign: TextAlign.center,
                    )
                  : PerfectMaskOverlay(
                      sourceBytes: _sourceBytes!,
                      maskBytes: selected?.bytes,
                      tint: SkinFaceMapVisualTokens.maskTintForConcern(
                        selected?.concernType ?? 'pore',
                      ),
                      opacity: 0.55,
                      showOriginalOnly: selected == null,
                      showMaskOnly: _showMaskOnly && selected?.bytes != null,
                      applyTint: false,
                      aspectRatio: 3 / 4,
                    ),
            ),
          ),
          SwitchListTile(
            title: Text('MASK ONLY', style: AppTypography.labelLarge),
            value: _showMaskOnly,
            onChanged: (v) => setState(() => _showMaskOnly = v),
          ),
          SizedBox(
            height: 52,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: [
                _chip(
                  label: 'ORIGINAL',
                  selected: _selectedKey == null,
                  onTap: () => setState(() => _selectedKey = null),
                ),
                ..._masks.map(
                  (m) => _chip(
                    label: m.labelAr,
                    selected: _selectedKey == m.key,
                    dim: m.bytes == null,
                    onTap: () {
                      HapticFeedback.selectionClick();
                      setState(() => _selectedKey = m.key);
                    },
                  ),
                ),
              ],
            ),
          ),
          if (selected != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: Text(
                [
                  if (selected.rawScore != null)
                    'raw=${selected.rawScore!.toStringAsFixed(2)}',
                  if (selected.uiScore != null) 'ui=${selected.uiScore!.round()}',
                  if (selected.width != null && selected.height != null)
                    '${selected.width}x${selected.height}',
                  if (selected.aligned == true) 'ALIGNED',
                  if (selected.aligned == false) 'DIM_MISMATCH',
                  if (selected.scoreOnly) 'SCORE_ONLY',
                  if (selected.bytes == null && !selected.scoreOnly)
                    'NO_MASK_BYTES',
                ].join(' · '),
                style: AppTypography.labelSmall,
                textAlign: TextAlign.center,
              ),
            ),
          if (_report != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                'task=${_report!['taskIdPrefix'] ?? '?'} · '
                'enable_mask_overlay=false · legacy landmarks=0',
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.textTertiary,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _chip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
    bool dim = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(left: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onTap(),
        selectedColor: AppColors.primaryLight,
        labelStyle: AppTypography.labelSmall.copyWith(
          color: dim ? AppColors.textTertiary : AppColors.textPrimary,
          fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
        ),
      ),
    );
  }
}

class _HdMaskItem {
  _HdMaskItem({
    required this.concernType,
    required this.region,
    required this.rawScore,
    required this.uiScore,
    required this.scoreOnly,
    required this.width,
    required this.height,
    required this.aligned,
    required this.bytes,
  });

  final String concernType;
  final String? region;
  final double? rawScore;
  final double? uiScore;
  final bool scoreOnly;
  final int? width;
  final int? height;
  final bool? aligned;
  final Uint8List? bytes;

  String get key => '$concernType::${region ?? 'root'}';

  String get labelAr {
    final base = switch (concernType) {
      'hd_age_spot' => 'التصبغات',
      'hd_pore' => 'المسام',
      'hd_wrinkle' => 'التجاعيد',
      'hd_redness' => 'الاحمرار',
      'hd_texture' => 'الملمس',
      'hd_acne' => 'الحبوب',
      'hd_moisture' => 'الترطيب',
      'hd_oiliness' => 'الدهون',
      'hd_radiance' => 'الإشراق',
      'hd_dark_circle' => 'الهالات',
      'hd_eye_bag' => 'انتفاخ العين',
      'hd_droopy_upper_eyelid' => 'جفن علوي',
      'hd_droopy_lower_eyelid' => 'جفن سفلي',
      'hd_firmness' => 'الصلابة',
      'hd_tear_trough' => 'تحت العين',
      'hd_skin_type' => 'نوع البشرة',
      _ => concernType,
    };
    if (region == null || region == 'whole' || region == 'all') return base;
    return '$base/$region';
  }
}

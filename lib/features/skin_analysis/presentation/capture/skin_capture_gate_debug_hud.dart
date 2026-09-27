import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import 'skin_capture_gate_snapshot.dart';
import 'skin_capture_tap_debug.dart';

/// INTERNAL DEBUG ONLY — never production Skin UX.
///
/// Enable with:
/// `--dart-define=MIRA_SKIN_CAPTURE_GATE_DEBUG=true`
/// (also enabled when `MIRA_SKIN_CAPTURE_TAP_DEBUG=true`)
abstract final class SkinCaptureGateDebugMode {
  SkinCaptureGateDebugMode._();

  static const _flag = bool.fromEnvironment(
    'MIRA_SKIN_CAPTURE_GATE_DEBUG',
    defaultValue: false,
  );

  static bool get enabled => _flag || SkinCaptureTapDebug.enabled;
}

class SkinCaptureGateDebugHud extends StatelessWidget {
  const SkinCaptureGateDebugHud({super.key, required this.snapshot});

  final SkinCaptureGateSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    if (!SkinCaptureGateDebugMode.enabled) {
      return const SizedBox.shrink();
    }

    return IgnorePointer(
      child: Align(
        alignment: Alignment.topLeft,
        child: SafeArea(
          child: Container(
            margin: const EdgeInsets.all(8),
            padding: const EdgeInsets.all(8),
            constraints: const BoxConstraints(maxWidth: 280, maxHeight: 420),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.78),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
            ),
            child: SingleChildScrollView(
              child: DefaultTextStyle(
                style: AppTypography.labelSmall.copyWith(
                  color: Colors.white,
                  fontSize: 10,
                  height: 1.25,
                  fontFamily: 'Courier',
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'CAPTURE GATE DEBUG',
                      style: AppTypography.labelSmall.copyWith(
                        color: AppColors.warning,
                        fontWeight: FontWeight.w800,
                        fontSize: 11,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'CANONICAL READY: ${snapshot.canonicalReady ? "YES" : "NO"}',
                      style: TextStyle(
                        color: snapshot.canonicalReady
                            ? AppColors.success
                            : AppColors.error,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      'BLOCKING: ${snapshot.blockingGateIds.isEmpty ? "—" : snapshot.blockingGateIds.join(", ")}',
                    ),
                    const Divider(color: Colors.white24, height: 12),
                    for (final row in snapshot.rows) _row(row),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _row(SkinCaptureGateRow row) {
    final status = !row.available
        ? 'N/A'
        : (row.pass ? 'PASS' : 'FAIL');
    final color = !row.available
        ? Colors.white54
        : (row.pass ? const Color(0xFF81C784) : const Color(0xFFE57373));
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Text(
        '${row.label.padRight(16)} ${row.actual.padRight(10)} $status',
        style: TextStyle(color: color, fontSize: 9.5),
      ),
    );
  }
}

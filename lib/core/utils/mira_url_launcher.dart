import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Shared external URL launcher — one place for error handling.
abstract final class MiraUrlLauncher {
  MiraUrlLauncher._();

  static Future<bool> openExternal(BuildContext context, String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return false;
    try {
      final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!ok && context.mounted) {
        _snack(context, 'تعذّر فتح الرابط');
      }
      return ok;
    } catch (_) {
      if (context.mounted) {
        _snack(context, 'تعذّر فتح الرابط');
      }
      return false;
    }
  }

  static void _snack(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }
}

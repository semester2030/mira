import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';

/// A picture chosen in the consultation composer, before or during upload.
class ChatImageDraft {
  final String localId;
  final Uint8List bytes;
  final String status;
  final String? attachmentId;
  final String? errorAr;

  const ChatImageDraft({
    required this.localId,
    required this.bytes,
    this.status = 'preview',
    this.attachmentId,
    this.errorAr,
  });

  bool get failed => status == 'failed';

  ChatImageDraft copyWith({
    String? status,
    String? attachmentId,
    String? errorAr,
  }) {
    return ChatImageDraft(
      localId: localId,
      bytes: bytes,
      status: status ?? this.status,
      attachmentId: attachmentId ?? this.attachmentId,
      errorAr: errorAr ?? this.errorAr,
    );
  }
}

/// Gallery previews, removal, upload failure, and a single send action.
class ConsultationComposer extends StatelessWidget {
  final TextEditingController controller;
  final List<ChatImageDraft> images;
  final int maxImages;
  final bool loading;
  final String hintText;
  final VoidCallback? onPick;
  final void Function(String localId) onRemove;
  final void Function(String localId) onRetry;
  final VoidCallback? onSend;

  const ConsultationComposer({
    super.key,
    required this.controller,
    required this.images,
    required this.onRemove,
    required this.onRetry,
    this.maxImages = 3,
    this.loading = false,
    this.hintText = 'اسألي عن العناية أو المكياج أو الشعر أو الإطلالة…',
    this.onPick,
    this.onSend,
  });

  @override
  Widget build(BuildContext context) {
    final atCap = images.length >= maxImages;
    return Column(
      key: const Key('consultation_composer'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (images.isNotEmpty)
          SizedBox(
            height: 92,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              itemCount: images.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final image = images[index];
                return _Preview(
                  image: image,
                  onRemove: loading ? null : () => onRemove(image.localId),
                  onRetry: image.failed && !loading ? () => onRetry(image.localId) : null,
                );
              },
            ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
          child: Row(
            children: [
              IconButton(
                key: const Key('consultation_pick_image'),
                onPressed: loading || atCap ? null : onPick,
                tooltip: atCap ? 'الحد $maxImages صور للرسالة' : 'اختيار من الاستديو',
                icon: const Icon(Icons.photo_library_outlined),
              ),
              Expanded(
                child: TextField(
                  key: const Key('consultation_input'),
                  controller: controller,
                  decoration: InputDecoration(
                    hintText: hintText,
                    filled: true,
                    fillColor: AppColors.surface,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide.none,
                    ),
                  ),
                  textInputAction: TextInputAction.send,
                  onSubmitted: loading ? null : (_) => onSend?.call(),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                key: const Key('consultation_send'),
                onPressed: loading ? null : onSend,
                icon: loading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send_rounded),
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.gold,
                  foregroundColor: AppColors.primaryDark,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Preview extends StatelessWidget {
  final ChatImageDraft image;
  final VoidCallback? onRemove;
  final VoidCallback? onRetry;

  const _Preview({
    required this.image,
    required this.onRemove,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 84,
      child: Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.memory(
              image.bytes,
              key: Key('chat_image_${image.localId}'),
              width: 84,
              height: 84,
              fit: BoxFit.cover,
            ),
          ),
          if (image.status == 'uploading')
            const Positioned.fill(
              child: ColoredBox(
                color: Color(0x66000000),
                child: Center(
                  child: SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              ),
            ),
          if (image.failed)
            Positioned(
              left: 4,
              bottom: 4,
              child: TextButton(
                key: Key('chat_image_retry_${image.localId}'),
                onPressed: onRetry,
                child: Text(image.errorAr ?? 'إعادة', style: AppTypography.labelSmall),
              ),
            ),
          Positioned(
            top: 0,
            left: 0,
            child: IconButton(
              key: Key('chat_image_remove_${image.localId}'),
              onPressed: onRemove,
              icon: const Icon(Icons.close, size: 16),
            ),
          ),
        ],
      ),
    );
  }
}

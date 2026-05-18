import 'package:flutter/material.dart';

import '../../../../core/analytics/mira_analytics.dart';
import '../../../../core/config/mira_api_config.dart';
import '../../data/datasources/feedback_api_data_source.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';

class FeedbackScreen extends StatefulWidget {
  const FeedbackScreen({super.key});

  @override
  State<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackScreenState extends State<FeedbackScreen> {
  final _commentController = TextEditingController();
  int _rating = 5;
  bool _sending = false;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!MiraApiConfig.useBackend) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('التقييم متاح مع تفعيل الخادم')),
      );
      return;
    }

    setState(() => _sending = true);
    try {
      await FeedbackApiDataSource().submit(
        target: 'app',
        rating: _rating,
        comment: _commentController.text.trim(),
      );
      MiraAnalytics.logEvent('feedback_submitted', {'rating': _rating});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('شكراً لتقييمكِ ✨')),
      );
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('قيّمي تجربتك')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('كيف كانت تجربتك مع ميرا؟', style: AppTypography.headlineSmall),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(5, (i) {
                final star = i + 1;
                return IconButton(
                  icon: Icon(
                    star <= _rating ? Icons.star_rounded : Icons.star_outline_rounded,
                    color: Colors.amber,
                    size: 36,
                  ),
                  onPressed: () => setState(() => _rating = star),
                );
              }),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _commentController,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'تعليق (اختياري)',
                border: OutlineInputBorder(),
              ),
            ),
            const Spacer(),
            PremiumButton(
              label: _sending ? 'جاري الإرسال...' : 'إرسال',
              onPressed: _sending ? null : _submit,
            ),
          ],
        ),
      ),
    );
  }
}

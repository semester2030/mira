import 'package:flutter/material.dart';

import '../../../../core/navigation/route_args.dart';
import '../../../../core/services/app_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../intelligence/presentation/widgets/mira_report_helpers.dart';
import '../../data/datasources/advisor_api_data_source.dart';
import '../../domain/entities/advisor_response.dart';
import '../../domain/services/local_advisor_engine.dart';

class MiraAdvisorScreen extends StatefulWidget {
  const MiraAdvisorScreen({super.key});

  @override
  State<MiraAdvisorScreen> createState() => _MiraAdvisorScreenState();
}

class _MiraAdvisorScreenState extends State<MiraAdvisorScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final _messages = <AdvisorMessage>[];
  final _api = AdvisorApiDataSource();
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final args = ModalRoute.of(context)?.settings.arguments as AdvisorRouteArgs?;
      if (args?.initialQuestion != null) {
        _send(args!.initialQuestion!);
      }
    });
  }

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || _loading) return;

    final args = ModalRoute.of(context)?.settings.arguments as AdvisorRouteArgs?;
    if (args == null) return;

    setState(() {
      _loading = true;
      _messages.add(AdvisorMessage(text: trimmed, isUser: true, at: DateTime.now()));
      _input.clear();
    });
    _scrollToEnd();

    try {
      final AdvisorResponse response;
      if (AppSession.canUseCloud && !AppSession.isGuest) {
        response = await _api.chat(
          message: trimmed,
          analysisId: args.report.id,
        );
      } else {
        final mira = resolveMiraReport(args.report);
        response = LocalAdvisorEngine.answer(mira, trimmed);
      }

      if (!mounted) return;
      setState(() {
        _messages.add(
          AdvisorMessage(text: response.answer, isUser: false, at: DateTime.now()),
        );
        _followUps = response.suggestedQuestions;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('تعذر الرد: $e')),
      );
    }
    _scrollToEnd();
  }

  List<String> _followUps = LocalAdvisorEngine.presetQuestions;

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const MiraAppBar(pageTitle: 'مستشار ميرا'),
      body: DelightBackground(
        showParticles: false,
        child: SafeArea(
          child: Column(
            children: [
              Expanded(
                child: ListView.builder(
                  controller: _scroll,
                  padding: const EdgeInsets.all(16),
                  itemCount: _messages.length + (_loading ? 1 : 0),
                  itemBuilder: (context, index) {
                    if (_loading && index == _messages.length) {
                      return const Padding(
                        padding: EdgeInsets.all(12),
                        child: LoadingSkeleton(lines: 2),
                      );
                    }
                    final msg = _messages[index];
                    return _Bubble(message: msg);
                  },
                ),
              ),
              if (_followUps.isNotEmpty)
                SizedBox(
                  height: 44,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    itemCount: _followUps.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (context, i) {
                      return ActionChip(
                        label: Text(_followUps[i], style: AppTypography.labelSmall),
                        onPressed: _loading ? null : () => _send(_followUps[i]),
                      );
                    },
                  ),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _input,
                        decoration: InputDecoration(
                          hintText: 'اسألي عن العناية · الروتين · المنتجات…',
                          filled: true,
                          fillColor: AppColors.surface,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: BorderSide.none,
                          ),
                        ),
                        textInputAction: TextInputAction.send,
                        onSubmitted: _send,
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filled(
                      onPressed: _loading ? null : () => _send(_input.text),
                      icon: const Icon(Icons.send_rounded),
                      style: IconButton.styleFrom(
                        backgroundColor: AppColors.gold,
                        foregroundColor: AppColors.primaryDark,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  final AdvisorMessage message;

  const _Bubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final isUser = message.isUser;
    return Align(
      alignment: isUser ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.85),
        decoration: BoxDecoration(
          color: isUser
              ? AppColors.primaryDark.withValues(alpha: 0.08)
              : AppColors.cardPurple.withValues(alpha: 0.35),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          message.text,
          style: AppTypography.bodyMedium.copyWith(height: 1.55),
        ),
      ),
    );
  }
}

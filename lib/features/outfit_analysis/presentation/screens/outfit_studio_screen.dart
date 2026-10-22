import 'dart:io';

import 'package:flutter/material.dart';

import '../../../../core/ai/models/mira_occasion.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/route_args.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../data/repositories/outfit_analysis_repository_impl.dart';
import '../../domain/entities/outfit_analysis.dart';
import '../../domain/entities/outfit_report.dart';
import '../widgets/engagement/outfit_garment_recolor_panel.dart';

/// Four full pages for one outfit: look, colors, try, wardrobe.
class OutfitStudioScreen extends StatefulWidget {
  final OutfitAnalysis analysis;

  const OutfitStudioScreen({super.key, required this.analysis});

  @override
  State<OutfitStudioScreen> createState() => _OutfitStudioScreenState();
}

class _OutfitStudioScreenState extends State<OutfitStudioScreen> {
  static const _tabs = ['إطلالتك', 'ألوانك', 'جرّبي', 'دولابك'];
  int _index = 0;
  final _scrolls = List.generate(4, (_) => ScrollController());

  @override
  void dispose() {
    for (final scroll in _scrolls) {
      scroll.dispose();
    }
    super.dispose();
  }

  void _openAdvisor() {
    final reportId = AnalysisSession.lastOutfit?.id;
    final uuid = RegExp(
      r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    );
    final dress = widget.analysis.dominantColors.where((color) => color.trim().isNotEmpty).toList();
    final piece = widget.analysis.detectedPieces.isNotEmpty
        ? widget.analysis.detectedPieces.first
        : widget.analysis.clothingType;
    Navigator.pushNamed(
      context,
      AppRoutes.miraAdvisor,
      arguments: AdvisorRouteArgs(
        outfitAnalysis: widget.analysis,
        outfitAnalysisId: reportId != null && uuid.hasMatch(reportId) ? reportId : null,
        discussionFocus: 'التبويب ${_tabs[_index]}، القطعة $piece'
            '${dress.isEmpty ? '' : '، اللون المرصود ${dress.first}'}',
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.background,
      child: Column(
        children: [
          _Nav(
            labels: _tabs,
            index: _index,
            onSelect: (value) => setState(() => _index = value),
          ),
          if (_index != 2) _Photo(path: widget.analysis.frozenImagePath),
          Expanded(
            child: IndexedStack(
              index: _index,
              children: [
                _LookPage(analysis: widget.analysis, controller: _scrolls[0]),
                _ColorsPage(analysis: widget.analysis, controller: _scrolls[1]),
                _TryPage(analysis: widget.analysis, controller: _scrolls[2]),
                _WardrobePage(analysis: widget.analysis, controller: _scrolls[3]),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: FilledButton.icon(
                key: const Key('ask_mira_entry'),
                onPressed: _openAdvisor,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(48),
                ),
                icon: const Icon(Icons.auto_awesome_rounded),
                label: const Text('اسألي ميرا ✨'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Nav extends StatelessWidget {
  final List<String> labels;
  final int index;
  final ValueChanged<int> onSelect;

  const _Nav({required this.labels, required this.index, required this.onSelect});

  static const _icons = [
    Icons.checkroom_rounded,
    Icons.palette_outlined,
    Icons.auto_fix_high_rounded,
    Icons.inventory_2_outlined,
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
      child: Row(
        textDirection: TextDirection.rtl,
        children: [
          for (var i = 0; i < labels.length; i++)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 3),
                child: TextButton.icon(
                  onPressed: () => onSelect(i),
                  style: TextButton.styleFrom(
                    backgroundColor: i == index ? AppColors.primary : AppColors.primaryLight,
                    foregroundColor: i == index ? Colors.white : AppColors.primaryDark,
                    minimumSize: const Size(44, 48),
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                  ),
                  icon: Icon(_icons[i], size: 16),
                  label: Text(labels[i], style: AppTypography.labelSmall),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Photo extends StatelessWidget {
  final String? path;

  const _Photo({required this.path});

  @override
  Widget build(BuildContext context) {
    final file = path == null || path!.isEmpty ? null : File(path!);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: SizedBox(
          height: MediaQuery.sizeOf(context).height.clamp(640, 1200) * 0.42,
          width: double.infinity,
          child: file != null && file.existsSync()
              ? InteractiveViewer(child: Image.file(file, fit: BoxFit.contain))
              : const ColoredBox(
                  color: AppColors.primaryLight,
                  child: Center(child: _Note('الصورة غير متاحة في هذا التحليل.')),
                ),
        ),
      ),
    );
  }
}

class _LookPage extends StatelessWidget {
  final OutfitAnalysis analysis;
  final ScrollController controller;

  const _LookPage({required this.analysis, required this.controller});

  @override
  Widget build(BuildContext context) {
    final pieces = <String>{
      ...analysis.detectedPieces,
      analysis.clothingType,
    }.map((piece) => piece.trim()).where((piece) => piece.isNotEmpty && piece != 'قطعة غير قابلة للتحليل').toList();
    return ListView(
      controller: controller,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Text('المناسبة: ${analysis.occasion.labelAr}', style: AppTypography.titleSmall),
        const SizedBox(height: 8),
        if (pieces.isEmpty)
          const _Note('لم تُكتشف قطع محددة. السبب ظاهر أدناه إن وُجد.')
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [for (final piece in pieces) Chip(label: Text(piece))],
          ),
        const SizedBox(height: 12),
        if (analysis.explanation.trim().isNotEmpty) Text(analysis.explanation, style: AppTypography.bodyMedium),
        if (analysis.occasion == MiraOccasion.university &&
            '${analysis.clothingType} ${analysis.styleType}'.contains('سهرة'))
          const Padding(
            padding: EdgeInsets.only(top: 8),
            child: _Note('فستان السهرة لا يُعد مناسباً للجامعة تلقائياً. إذا كانت المناسبة حفلاً جامعياً، وضّحي ذلك للمستشار.'),
          ),
        for (final reason in analysis.matchReasons.take(3))
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(reason, style: AppTypography.bodyMedium),
          ),
        for (final gap in analysis.mismatchReasons.take(2))
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(gap, style: AppTypography.bodySmall),
          ),
      ],
    );
  }
}

class _ColorsPage extends StatelessWidget {
  final OutfitAnalysis analysis;
  final ScrollController controller;

  const _ColorsPage({required this.analysis, required this.controller});

  @override
  Widget build(BuildContext context) {
    final dressColors = <String>[
      ...analysis.dominantColors,
      ...analysis.upperBodyColors,
      ...analysis.lowerBodyColors,
    ].map((color) => color.trim()).where((color) => color.isNotEmpty).toSet().toList();
    final shoes = analysis.shoeColors.map((color) => color.trim()).where((color) => color.isNotEmpty).toList();
    final extras = analysis.accessoryColors.map((color) => color.trim()).where((color) => color.isNotEmpty).toList();
    final piece = analysis.detectedPieces.isNotEmpty
        ? analysis.detectedPieces.first
        : (analysis.clothingType.trim().isEmpty ? 'القطعة الظاهرة' : analysis.clothingType);
    final current = dressColors.isEmpty ? null : dressColors.first;
    final suggestions = analysis.recommendedColors.where((color) => color != current).toList();
    return ListView(
      controller: controller,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        if (current == null)
          const _Card(
            title: 'اللون المرصود',
            body: 'تعذر استخراج لون القماش من هذه الصورة. لا يُعرض لون افتراضي، وتبقى القطع الأخرى ظاهرة.',
          )
        else
          _Card(title: 'اللون المرصود', body: '$current على $piece. هذا تقدير لما ظهر في الصورة.'),
        if (shoes.isNotEmpty) ...[
          const SizedBox(height: 8),
          _Card(title: 'لون الحذاء', body: shoes.join('، ')),
        ],
        if (extras.isNotEmpty) ...[
          const SizedBox(height: 8),
          _Card(title: 'لون الإكسسوار', body: extras.join('، ')),
        ],
        const SizedBox(height: 8),
        _Card(
          title: 'إبقاء الإطلالة',
          body: current == null
              ? 'يمكن إبقاء الإطلالة كما هي دون اختراع لون.'
              : 'يمكن إبقاء $current على $piece. لا يُقترح تغيير لمجرد وجود اقتراح.',
        ),
        if (current != null && suggestions.isNotEmpty) ...[
          const SizedBox(height: 8),
          _Card(
            title: 'اقتراح تنسيق',
            body: 'الملاحظة: $piece ظهر بلون $current. ${suggestions.first} مقترح للحذاء أو الحقيبة لأنه يختلف عن لون القطعة فيُظهرها. ليس حكماً بأن اللون الحالي غير مناسب.',
          ),
        ],
        const SizedBox(height: 8),
        const _Card(
          title: 'لون التجربة',
          body: 'اللون الذي تختارينه في جرّبي يبقى معاينة، ولا يُسجَّل كإطلالة ارتديتها.',
        ),
      ],
    );
  }
}

class _TryPage extends StatelessWidget {
  final OutfitAnalysis analysis;
  final ScrollController controller;

  const _TryPage({required this.analysis, required this.controller});

  @override
  Widget build(BuildContext context) {
    return ListView(
      controller: controller,
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: _Note('المعاينة تبقى منفصلة عن التحليل الأصلي.'),
        ),
        OutfitGarmentRecolorPanel(analysis: analysis),
      ],
    );
  }
}

class _WardrobePage extends StatefulWidget {
  final OutfitAnalysis analysis;
  final ScrollController controller;

  const _WardrobePage({required this.analysis, required this.controller});

  @override
  State<_WardrobePage> createState() => _WardrobePageState();
}

class _WardrobePageState extends State<_WardrobePage> {
  late final Future<List<OutfitReport>> _history = OutfitAnalysisRepositoryImpl().getHistory();

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<OutfitReport>>(
      future: _history,
      builder: (context, snapshot) {
        final reports = snapshot.data ?? const <OutfitReport>[];
        return ListView(
          controller: widget.controller,
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            Text('سجل التحليلات · ${widget.analysis.occasion.labelAr}', style: AppTypography.titleSmall),
            const SizedBox(height: 8),
            if (snapshot.hasError)
              _Note('تعذر تحميل السجل: ${snapshot.error}')
            else if (snapshot.connectionState == ConnectionState.waiting)
              const _Note('جارٍ تحميل السجل.')
            else if (reports.isEmpty)
              const _Note('لا يوجد تحليل محفوظ بتاريخ سابق.')
            else
              for (final report in reports.take(8)) _HistoryTile(report: report),
          ],
        );
      },
    );
  }
}

class _HistoryTile extends StatelessWidget {
  final OutfitReport report;

  const _HistoryTile({required this.report});

  @override
  Widget build(BuildContext context) {
    final date = report.createdAt;
    final dateText = date == null
        ? 'بدون تاريخ محفوظ'
        : '${date.year}/${date.month}/${date.day}';
    final colors = report.dominantColors.where((color) => color.trim().isNotEmpty).join('، ');
    final scored = report.dominantColors.isNotEmpty && report.compatibilityScore > 0;
    return Card(
      color: AppColors.surface,
      child: ListTile(
        title: Text('${report.occasionLabelAr} · $dateText'),
        subtitle: Text(
          scored
              ? '${report.garmentType} · $colors · درجة مدعومة ${report.compatibilityScore.round()}'
              : '${report.garmentType}${colors.isEmpty ? '' : ' · $colors'} · بدون درجة مدعومة',
        ),
      ),
    );
  }
}

class _Card extends StatelessWidget {
  final String title;
  final String body;

  const _Card({required this.title, required this.body});

  @override
  Widget build(BuildContext context) {
    return Card(
      color: AppColors.surface,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title, style: AppTypography.titleSmall),
            const SizedBox(height: 6),
            Text(body, style: AppTypography.bodyMedium.copyWith(height: 1.4)),
          ],
        ),
      ),
    );
  }
}

class _Note extends StatelessWidget {
  final String text;

  const _Note(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(text, style: AppTypography.bodyMedium.copyWith(height: 1.45));
  }
}

import 'dart:io';

import 'package:flutter/material.dart';

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
    final section = _tabs[_index];
    final color = widget.analysis.dominantColors.isEmpty
        ? 'دون لون مستخرج'
        : 'واللون الظاهر ${widget.analysis.dominantColors.first}';
    Navigator.pushNamed(
      context,
      AppRoutes.miraAdvisor,
      arguments: AdvisorRouteArgs(
        outfitAnalysis: widget.analysis,
        outfitAnalysisId: AnalysisSession.lastOutfit?.id ?? widget.analysis.frozenImagePath,
        initialQuestion: 'نناقش قسم $section $color',
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
                child: TextButton(
                  onPressed: () => onSelect(i),
                  style: TextButton.styleFrom(
                    backgroundColor: i == index ? AppColors.primaryLight : Colors.transparent,
                    foregroundColor: i == index ? AppColors.primaryDark : AppColors.textSecondary,
                    minimumSize: const Size(44, 44),
                  ),
                  child: Text(labels[i], style: AppTypography.labelSmall),
                ),
              ),
            ),
        ],
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
    final path = analysis.frozenImagePath;
    final pieces = analysis.detectedPieces.where((piece) => piece.trim().isNotEmpty).toList();
    return ListView(
      controller: controller,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        if (path != null && path.isNotEmpty && File(path).existsSync())
          ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: InteractiveViewer(
              child: Image.file(File(path), fit: BoxFit.contain),
            ),
          )
        else
          const _Note('الصورة غير متاحة في هذا التحليل.'),
        const SizedBox(height: 12),
        Text('المناسبة: ${analysis.occasion.labelAr}', style: AppTypography.titleSmall),
        const SizedBox(height: 8),
        if (pieces.isEmpty)
          const _Note('لم تُكتشف قطع محددة في هذه الصورة.')
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [for (final piece in pieces) Chip(label: Text(piece))],
          ),
        const SizedBox(height: 12),
        Text(analysis.explanation, style: AppTypography.bodyMedium),
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
    final current = analysis.dominantColors.isEmpty ? null : analysis.dominantColors.first;
    final piece = analysis.detectedPieces.isNotEmpty
        ? analysis.detectedPieces.first
        : (analysis.clothingType.trim().isEmpty ? 'القطعة الظاهرة' : analysis.clothingType);
    final accessory = analysis.recommendedColors.where((color) => color != current).toList();
    return ListView(
      controller: controller,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        if (current == null)
          const _Note('تعذر استخراج لون القماش. لا توجد لوحة ألوان لهذه الصورة.')
        else ...[
          Text('اللون الحالي', style: AppTypography.titleSmall),
          const SizedBox(height: 6),
          Text('$current — $piece', style: AppTypography.bodyMedium),
          const SizedBox(height: 12),
          Text(
            'اللون الحالي مناسب ويمكن إبقاؤه على $piece.',
            style: AppTypography.bodyMedium,
          ),
          if (accessory.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text('للحذاء أو الحقيبة', style: AppTypography.titleSmall),
            const SizedBox(height: 6),
            Text(
              '${accessory.first} يكمّل $current في مناسبة ${analysis.occasion.labelAr} دون تغيير لون $piece.',
              style: AppTypography.bodyMedium,
            ),
          ],
        ],
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
            if (snapshot.connectionState == ConnectionState.waiting)
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

class _Note extends StatelessWidget {
  final String text;

  const _Note(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(text, style: AppTypography.bodyMedium.copyWith(height: 1.45));
  }
}

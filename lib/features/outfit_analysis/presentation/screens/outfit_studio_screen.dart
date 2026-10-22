import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/ai/models/mira_occasion.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/route_args.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../data/repositories/outfit_analysis_repository_impl.dart';
import '../../domain/entities/outfit_analysis.dart';
import '../../domain/entities/outfit_report.dart';
import '../utils/fashion_color_binding.dart';
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
  double _photoCollapse = 0;

  @override
  void initState() {
    super.initState();
    for (final scroll in _scrolls) {
      scroll.addListener(_onScroll);
    }
  }

  @override
  void dispose() {
    for (final scroll in _scrolls) {
      scroll.removeListener(_onScroll);
      scroll.dispose();
    }
    super.dispose();
  }

  void _onScroll() {
    final offset = _scrolls[_index].hasClients ? _scrolls[_index].offset : 0.0;
    final next = (offset / 120).clamp(0.0, 1.0);
    if ((next - _photoCollapse).abs() > 0.02) {
      setState(() => _photoCollapse = next);
    }
  }

  void _openAdvisor({String? piece, String? color}) {
    final reportId = AnalysisSession.lastOutfit?.id;
    final uuid = RegExp(
      r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    );
    final dress = widget.analysis.dominantColors
        .where((c) => c.trim().isNotEmpty)
        .toList();
    final resolvedPiece = piece ??
        (widget.analysis.detectedPieces.isNotEmpty
            ? widget.analysis.detectedPieces.first
            : widget.analysis.clothingType);
    final resolvedColor = color ?? (dress.isEmpty ? null : dress.first);
    Navigator.pushNamed(
      context,
      AppRoutes.miraAdvisor,
      arguments: AdvisorRouteArgs(
        outfitAnalysis: widget.analysis,
        outfitAnalysisId:
            reportId != null && uuid.hasMatch(reportId) ? reportId : null,
        discussionFocus: 'التبويب ${_tabs[_index]}، القطعة $resolvedPiece'
            '${resolvedColor == null ? '' : '، اللون المرصود $resolvedColor'}',
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    final photoT = reduceMotion ? 0.0 : _photoCollapse;
    return ColoredBox(
      color: AppColors.background,
      child: Column(
        children: [
          _Nav(
            labels: _tabs,
            index: _index,
            onSelect: (value) => setState(() {
              _index = value;
              _onScroll();
            }),
          ),
          if (_index != 2)
            _Photo(
              path: widget.analysis.frozenImagePath,
              collapse: photoT,
              summary: _photoSummary(widget.analysis),
            ),
          Expanded(
            child: IndexedStack(
              index: _index,
              children: [
                _LookPage(
                  analysis: widget.analysis,
                  controller: _scrolls[0],
                  onAsk: (piece) => _openAdvisor(piece: piece),
                ),
                _ColorsPage(
                  analysis: widget.analysis,
                  controller: _scrolls[1],
                  onAsk: (piece, color) =>
                      _openAdvisor(piece: piece, color: color),
                  onTryColor: (color) {
                    setState(() => _index = 2);
                  },
                ),
                _TryPage(analysis: widget.analysis, controller: _scrolls[2]),
                _WardrobePage(
                  analysis: widget.analysis,
                  controller: _scrolls[3],
                ),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: FilledButton.icon(
                key: const Key('ask_mira_entry'),
                onPressed: () => _openAdvisor(),
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

  static String _photoSummary(OutfitAnalysis analysis) {
    final piece = analysis.detectedPieces.isNotEmpty
        ? analysis.detectedPieces.first
        : analysis.clothingType;
    final color = analysis.dominantColors.isNotEmpty
        ? analysis.dominantColors.first
        : null;
    final bits = <String>[
      analysis.occasion.labelAr,
      if (piece.trim().isNotEmpty) piece.trim(),
      if (color != null) color,
      if (!analysis.scoreSupported) 'درجة غير متاحة',
    ];
    return bits.join(' · ');
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
                  onPressed: () {
                    HapticFeedback.selectionClick();
                    onSelect(i);
                  },
                  style: TextButton.styleFrom(
                    backgroundColor:
                        i == index ? AppColors.primary : AppColors.primaryLight,
                    foregroundColor:
                        i == index ? Colors.white : AppColors.primaryDark,
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
  final double collapse;
  final String summary;

  const _Photo({
    required this.path,
    required this.collapse,
    required this.summary,
  });

  @override
  Widget build(BuildContext context) {
    final file = path == null || path!.isEmpty ? null : File(path!);
    final maxH = MediaQuery.sizeOf(context).height.clamp(640, 1200) * 0.38;
    final height = (maxH * (1 - collapse * 0.72)).clamp(56.0, maxH);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutCubic,
        height: height,
        width: double.infinity,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.border.withValues(alpha: 0.35)),
          color: AppColors.surface,
        ),
        clipBehavior: Clip.antiAlias,
        child: collapse > 0.72
            ? Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Row(
                  children: [
                    if (file != null && file.existsSync())
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.file(file, width: 40, height: 40, fit: BoxFit.cover),
                      ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        summary,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.labelSmall,
                      ),
                    ),
                  ],
                ),
              )
            : file != null && file.existsSync()
                ? InteractiveViewer(
                    child: Image.file(file, fit: BoxFit.contain),
                  )
                : const Center(child: _Note('الصورة غير متاحة في هذا التحليل.')),
      ),
    );
  }
}

class _LookPage extends StatelessWidget {
  final OutfitAnalysis analysis;
  final ScrollController controller;
  final ValueChanged<String> onAsk;

  const _LookPage({
    required this.analysis,
    required this.controller,
    required this.onAsk,
  });

  @override
  Widget build(BuildContext context) {
    final pieces = <String>{
      ...analysis.detectedPieces,
      analysis.clothingType,
    }
        .map((piece) => piece.trim())
        .where((piece) =>
            piece.isNotEmpty && piece != 'قطعة غير قابلة للتحليل')
        .toList();
    final hasNotes = analysis.explanation.trim().isNotEmpty ||
        analysis.matchReasons.isNotEmpty ||
        analysis.mismatchReasons.isNotEmpty;
    return ListView(
      controller: controller,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        _SoftCard(
          title: 'المناسبة',
          body: analysis.occasion.labelAr,
        ),
        const SizedBox(height: 8),
        _SoftCard(
          title: 'الأسلوب',
          body: analysis.styleType.trim().isEmpty
              ? 'غير محدد من هذه الصورة'
              : analysis.styleType,
        ),
        const SizedBox(height: 8),
        if (pieces.isEmpty)
          _SoftCard(
            title: 'القطعة',
            body: hasNotes
                ? 'تعذر تسمية القطعة بدقة، لكن الملاحظات المدعومة ظاهرة أدناه.'
                : 'لم تُكتشف قطع محددة في هذه الصورة.',
          )
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final piece in pieces)
                ActionChip(
                  label: Text(piece),
                  onPressed: () => onAsk(piece),
                ),
            ],
          ),
        if (analysis.occasion == MiraOccasion.university &&
            '${analysis.clothingType} ${analysis.styleType}'.contains('سهرة'))
          const Padding(
            padding: EdgeInsets.only(top: 8),
            child: _Note(
              'فستان السهرة لا يُعد مناسباً للجامعة تلقائياً. إذا كانت المناسبة حفلاً جامعياً، وضّحي ذلك للمستشار.',
            ),
          ),
        for (final reason in analysis.matchReasons.take(3))
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: _SoftCard(title: 'ملاحظة مدعومة', body: reason),
          ),
        for (final gap in analysis.mismatchReasons.take(2))
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: _SoftCard(title: 'تحفظ', body: gap),
          ),
        if (analysis.explanation.trim().isNotEmpty) ...[
          const SizedBox(height: 8),
          _SoftCard(title: 'الملخص', body: analysis.explanation),
        ],
        if (!analysis.scoreSupported) ...[
          const SizedBox(height: 8),
          const _SoftCard(
            title: 'الدرجة',
            body: 'غير متاحة لهذه الصورة — لا تُعرض كنسبة مئوية.',
          ),
        ],
      ],
    );
  }
}

class _ColorsPage extends StatelessWidget {
  final OutfitAnalysis analysis;
  final ScrollController controller;
  final void Function(String piece, String color) onAsk;
  final ValueChanged<String> onTryColor;

  const _ColorsPage({
    required this.analysis,
    required this.controller,
    required this.onAsk,
    required this.onTryColor,
  });

  @override
  Widget build(BuildContext context) {
    final piece = analysis.detectedPieces.isNotEmpty
        ? analysis.detectedPieces.first
        : (analysis.clothingType.trim().isEmpty
            ? 'القطعة الظاهرة'
            : analysis.clothingType);
    final observed = <String>{
      ...analysis.dominantColors,
      ...analysis.upperBodyColors,
      ...analysis.lowerBodyColors,
    }.map((c) => c.trim()).where((c) => c.isNotEmpty).toList();
    final shoes = analysis.shoeColors
        .map((c) => c.trim())
        .where((c) => c.isNotEmpty)
        .toList();
    final extras = analysis.accessoryColors
        .map((c) => c.trim())
        .where((c) => c.isNotEmpty)
        .toList();
    final suggestions = analysis.recommendedColors
        .where((c) => c.trim().isNotEmpty && !observed.contains(c))
        .toList();
    return ListView(
      controller: controller,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Text('الألوان المرصودة', style: AppTypography.titleSmall),
        const SizedBox(height: 8),
        if (observed.isEmpty)
          const _SoftCard(
            title: 'القماش',
            body:
                'تعذر استخراج لون القماش من هذه الصورة. لا يُعرض لون افتراضي.',
          )
        else
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              for (final color in observed)
                _ColorDot(
                  nameAr: color,
                  subtitle: piece,
                  onTap: () {
                    final bound = FashionColorBinding.resolveDetailed(
                      nameAr: color,
                      source: FashionColorSource.detected,
                    );
                    showModalBottomSheet<void>(
                      context: context,
                      showDragHandle: true,
                      builder: (ctx) => Padding(
                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(color, style: AppTypography.titleSmall),
                            const SizedBox(height: 6),
                            Text(
                              'على $piece · مصدر المرصود في الصورة'
                              '${bound.hex == null ? '' : ' · ${bound.hex}'}'
                              ' · تقدير متأثر بالإضاءة وليس دقة مطلقة.',
                              style: AppTypography.bodyMedium.copyWith(height: 1.4),
                            ),
                            const SizedBox(height: 12),
                            FilledButton(
                              onPressed: () {
                                Navigator.pop(ctx);
                                onAsk(piece, color);
                              },
                              child: const Text('اسألي ميرا عن هذا اللون'),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
            ],
          ),
        if (shoes.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text('الحذاء (منفصل عن القماش)', style: AppTypography.titleSmall),
          const SizedBox(height: 8),
          Wrap(
            spacing: 12,
            children: [for (final c in shoes) _ColorDot(nameAr: c, subtitle: 'حذاء')],
          ),
        ],
        if (extras.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text('إكسسوارات (منفصلة)', style: AppTypography.titleSmall),
          const SizedBox(height: 8),
          Wrap(
            spacing: 12,
            children: [
              for (final c in extras) _ColorDot(nameAr: c, subtitle: 'إكسسوار'),
            ],
          ),
        ],
        const SizedBox(height: 16),
        const _SoftCard(
          title: 'إبقاء الإطلالة',
          body:
              'إبقاء الألوان المرصودة خيار صحيح. لا يُقترح تغيير لمجرد وجود اقتراح.',
        ),
        if (suggestions.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text('اقتراحات منفصلة', style: AppTypography.titleSmall),
          const SizedBox(height: 8),
          for (final suggestion in suggestions.take(4)) ...[
            _SoftCard(
              title: suggestion,
              body:
                  'لماذا؟ يختلف عن اللون المرصود على $piece فيُظهره ضمن مناسبة ${analysis.occasion.labelAr}. ليس حكماً برفض اللون الحالي.',
              trailing: TextButton(
                onPressed: () => onTryColor(suggestion),
                child: const Text('جرّبيه'),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ],
        const SizedBox(height: 8),
        const _SoftCard(
          title: 'لون التجربة',
          body:
              'اللون المختار في «جرّبي» يبقى معاينة فقط، ولا يُسجَّل كإطلالة ارتديتها.',
        ),
      ],
    );
  }
}

class _ColorDot extends StatelessWidget {
  final String nameAr;
  final String subtitle;
  final VoidCallback? onTap;

  const _ColorDot({
    required this.nameAr,
    required this.subtitle,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final bound = FashionColorBinding.resolveDetailed(
      nameAr: nameAr,
      source: FashionColorSource.catalog,
    );
    final color = bound.color ?? AppColors.border;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: SizedBox(
        width: 76,
        child: Column(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: color,
                border: Border.all(color: Colors.white, width: 2),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 6),
            Text(
              nameAr,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.labelSmall,
              textAlign: TextAlign.center,
            ),
            Text(
              subtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.labelSmall.copyWith(
                color: AppColors.textSecondary,
                fontSize: 10,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
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
          child: _Note(
            'المعاينة منفصلة عن التحليل الأصلي. لا تكرار لصورة البطل هنا.',
          ),
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
  late final Future<List<OutfitReport>> _history =
      OutfitAnalysisRepositoryImpl().getHistory();

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
            Text(
              'سجل التحليلات · ${widget.analysis.occasion.labelAr}',
              style: AppTypography.titleSmall,
            ),
            const SizedBox(height: 4),
            Text(
              'مقترح / مختار / تجربة / ارتداء مؤكد — تُفصل عند توفر الحالة في السجل.',
              style: AppTypography.bodySmall.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 12),
            if (snapshot.hasError)
              _Note('تعذر تحميل السجل: ${snapshot.error}')
            else if (snapshot.connectionState == ConnectionState.waiting)
              const _Note('جارٍ تحميل السجل.')
            else if (reports.isEmpty)
              const _Note('لا يوجد تحليل محفوظ بتاريخ سابق.')
            else
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: reports.length.clamp(0, 12),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                  childAspectRatio: 0.78,
                ),
                itemBuilder: (context, i) => _HistoryTile(report: reports[i]),
              ),
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
        ? 'بدون تاريخ'
        : '${date.year}/${date.month}/${date.day}';
    final colors =
        report.dominantColors.where((c) => c.trim().isNotEmpty).join('، ');
    final swatch = report.dominantColors
        .map((c) => FashionColorBinding.resolveDetailed(nameAr: c).color)
        .whereType<Color>()
        .take(3)
        .toList();
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          showModalBottomSheet<void>(
            context: context,
            showDragHandle: true,
            builder: (ctx) => Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    '${report.occasionLabelAr} · $dateText',
                    style: AppTypography.titleSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${report.garmentType}'
                    '${colors.isEmpty ? '' : ' · $colors'}'
                    ' · درجة غير متاحة (لا تُعرض القديمة كدرجة مدعومة دون دليل).',
                    style: AppTypography.bodyMedium.copyWith(height: 1.4),
                  ),
                ],
              ),
            ),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.checkroom_rounded,
                        color: AppColors.primaryDark.withValues(alpha: 0.45),
                      ),
                      if (swatch.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            for (final c in swatch)
                              Container(
                                width: 14,
                                height: 14,
                                margin: const EdgeInsets.symmetric(horizontal: 3),
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: c,
                                  border: Border.all(color: Colors.white),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                report.occasionLabelAr,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.labelLarge,
              ),
              Text(
                dateText,
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SoftCard extends StatelessWidget {
  final String title;
  final String body;
  final Widget? trailing;

  const _SoftCard({
    required this.title,
    required this.body,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.3)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(title, style: AppTypography.titleSmall),
                ),
                if (trailing != null) trailing!,
              ],
            ),
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

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
import '../../domain/helpers/outfit_local_image_index.dart';
import '../utils/fashion_color_binding.dart';
import '../utils/outfit_piece_art.dart';
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
  String? _selectedColor;
  String? _selectedPiece;

  @override
  void initState() {
    super.initState();
    for (final scroll in _scrolls) {
      scroll.addListener(_onScroll);
    }
    _selectedPiece = widget.analysis.detectedPieces.isNotEmpty
        ? widget.analysis.detectedPieces.first
        : (widget.analysis.clothingType.trim().isEmpty
            ? null
            : widget.analysis.clothingType);
    _selectedColor = widget.analysis.dominantColors
        .map((c) => c.trim())
        .where((c) => c.isNotEmpty)
        .cast<String?>()
        .firstWhere((_) => true, orElse: () => null);
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
    final next = (offset / 110).clamp(0.0, 1.0);
    if ((next - _photoCollapse).abs() > 0.02) {
      setState(() => _photoCollapse = next);
    }
  }

  void _openAdvisor({String? focusExtra}) {
    final reportId = AnalysisSession.lastOutfit?.id;
    final uuid = RegExp(
      r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    );
    final piece = _selectedPiece ??
        (widget.analysis.detectedPieces.isNotEmpty
            ? widget.analysis.detectedPieces.first
            : widget.analysis.clothingType);
    final color = _selectedColor;
    final focus = [
      'التبويب ${_tabs[_index]}',
      if (piece.trim().isNotEmpty) 'القطعة $piece',
      if (color != null) 'اللون $color',
      if (focusExtra != null && focusExtra.isNotEmpty) focusExtra,
    ].join('، ');
    Navigator.pushNamed(
      context,
      AppRoutes.miraAdvisor,
      arguments: AdvisorRouteArgs(
        outfitAnalysis: widget.analysis,
        outfitAnalysisId:
            reportId != null && uuid.hasMatch(reportId) ? reportId : null,
        discussionFocus: focus,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    final photoT = reduceMotion ? 0.0 : _photoCollapse;
    final short = MediaQuery.sizeOf(context).height < 740;
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFFFF9FB), AppColors.background, Color(0xFFF8F0F5)],
        ),
      ),
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
              compact: short,
              summary: _photoSummary(widget.analysis),
              pieceLabel: _selectedPiece,
              showPiecePin: widget.analysis.segmentMap?.hasTrustedOverlay == true,
            ),
          Expanded(
            child: IndexedStack(
              index: _index,
              children: [
                _LookPage(
                  analysis: widget.analysis,
                  controller: _scrolls[0],
                  selectedPiece: _selectedPiece,
                  onSelectPiece: (p) => setState(() => _selectedPiece = p),
                  onAskWhy: () => _openAdvisor(focusExtra: 'لماذا هذا الاستنتاج؟'),
                ),
                _ColorsPage(
                  analysis: widget.analysis,
                  controller: _scrolls[1],
                  selectedColor: _selectedColor,
                  selectedPiece: _selectedPiece ?? 'القطعة',
                  onSelectColor: (c) => setState(() => _selectedColor = c),
                  onAskWhy: (color) => _openAdvisor(
                    focusExtra: 'لماذا اقترحتِ اللون $color؟',
                  ),
                  onTryColor: (color) {
                    setState(() {
                      _selectedColor = color;
                      _index = 2;
                    });
                  },
                  onKeepLook: () => _openAdvisor(
                    focusExtra: 'أريد إبقاء لون الإطلالة كما هو',
                  ),
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
              padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_index == 1 || _index == 0)
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      reverse: true,
                      child: Row(
                        children: [
                          for (final q in _quickQuestions())
                            Padding(
                              padding: const EdgeInsets.only(left: 8),
                              child: ActionChip(
                                label: Text(q, style: AppTypography.labelSmall),
                                onPressed: () => _openAdvisor(focusExtra: q),
                              ),
                            ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 6),
                  FilledButton.icon(
                    key: const Key('ask_mira_entry'),
                    onPressed: () => _openAdvisor(),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(50),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(18),
                      ),
                    ),
                    icon: const Icon(Icons.auto_awesome_rounded),
                    label: const Text('اسألي ميرا ✨'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<String> _quickQuestions() {
    if (_index == 1) {
      return [
        'لماذا اقترحتِ هذا اللون؟',
        'كيف أختار حقيبة لهذه الإطلالة؟',
      ];
    }
    return [
      'هل تناسب إطلالتى هذه المناسبة؟',
      'ما الذي يمكن تحسينه؟',
    ];
  }

  static String _photoSummary(OutfitAnalysis analysis) {
    final piece = analysis.detectedPieces.isNotEmpty
        ? analysis.detectedPieces.first
        : analysis.clothingType;
    final color = analysis.dominantColors.isNotEmpty
        ? analysis.dominantColors.first
        : null;
    return [
      analysis.occasion.labelAr,
      if (piece.trim().isNotEmpty) piece.trim(),
      if (color != null) color,
    ].join(' · ');
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
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 4),
      child: Row(
        textDirection: TextDirection.rtl,
        children: [
          for (var i = 0; i < labels.length; i++)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 3),
                child: Material(
                  color: i == index ? AppColors.primary : AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  elevation: i == index ? 0 : 0,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () {
                      HapticFeedback.selectionClick();
                      onSelect(i);
                    },
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Column(
                        children: [
                          Icon(
                            _icons[i],
                            size: 18,
                            color: i == index
                                ? Colors.white
                                : AppColors.primaryDark,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            labels[i],
                            style: AppTypography.labelSmall.copyWith(
                              color: i == index
                                  ? Colors.white
                                  : AppColors.primaryDark,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
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
  final bool compact;
  final String summary;
  final String? pieceLabel;
  final bool showPiecePin;

  const _Photo({
    required this.path,
    required this.collapse,
    required this.compact,
    required this.summary,
    required this.pieceLabel,
    required this.showPiecePin,
  });

  @override
  Widget build(BuildContext context) {
    final file = path == null || path!.isEmpty ? null : File(path!);
    final maxH = MediaQuery.sizeOf(context).height * (compact ? 0.28 : 0.34);
    final height = (maxH * (1 - collapse * 0.78)).clamp(52.0, maxH);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 6),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutCubic,
        height: height,
        width: double.infinity,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: AppColors.border.withValues(alpha: 0.4)),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.08),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
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
                        child: Image.file(
                          file,
                          width: 40,
                          height: 40,
                          fit: BoxFit.cover,
                        ),
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
            : Stack(
                fit: StackFit.expand,
                children: [
                  if (file != null && file.existsSync())
                    InteractiveViewer(
                      child: Image.file(file, fit: BoxFit.contain),
                    )
                  else
                    const Center(
                      child: Text(
                        'الصورة غير متاحة لهذا التحليل.',
                        style: TextStyle(height: 1.4),
                      ),
                    ),
                  if (showPiecePin &&
                      pieceLabel != null &&
                      pieceLabel!.trim().isNotEmpty)
                    Positioned(
                      right: 12,
                      bottom: 12,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.92),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: AppColors.border.withValues(alpha: 0.5),
                          ),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              OutfitPieceArt.visual(
                                label: pieceLabel!,
                                size: 22,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                pieceLabel!,
                                style: AppTypography.labelSmall.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
      ),
    );
  }
}

class _LookPage extends StatelessWidget {
  final OutfitAnalysis analysis;
  final ScrollController controller;
  final String? selectedPiece;
  final ValueChanged<String> onSelectPiece;
  final VoidCallback onAskWhy;

  const _LookPage({
    required this.analysis,
    required this.controller,
    required this.selectedPiece,
    required this.onSelectPiece,
    required this.onAskWhy,
  });

  @override
  Widget build(BuildContext context) {
    final pieces = <String>{
      ...analysis.detectedPieces,
      analysis.clothingType,
    }
        .map((p) => p.trim())
        .where((p) => p.isNotEmpty && p != 'قطعة غير قابلة للتحليل')
        .toList();
    final style = analysis.styleType.trim().isEmpty
        ? 'غير محدد من الصورة'
        : analysis.styleType;
    return ListView(
      controller: controller,
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
      children: [
        Text(
          style.contains('سهرة') || analysis.occasion == MiraOccasion.eid
              ? 'إطلالة للمناسبة'
              : 'ملخص الإطلالة',
          style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _FactTile(
                label: 'القطعة',
                value: pieces.isEmpty ? 'غير محددة بدقة' : pieces.first,
                artLabel: pieces.isEmpty ? 'فستان' : pieces.first,
                selected: selectedPiece != null &&
                    pieces.isNotEmpty &&
                    selectedPiece == pieces.first,
                onTap: pieces.isEmpty
                    ? null
                    : () {
                        onSelectPiece(pieces.first);
                        _openDetail(
                          context,
                          title: pieces.first,
                          body: analysis.explanation.trim().isEmpty
                              ? 'هذه القطعة كما ظهرت في الصورة ضمن مناسبة ${analysis.occasion.labelAr}.'
                              : analysis.explanation,
                        );
                      },
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _FactTile(
                label: 'الأسلوب',
                value: style,
                artLabel: style,
                onTap: () => _openDetail(
                  context,
                  title: 'الأسلوب',
                  body: 'الأسلوب المستنتج: $style.',
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _FactTile(
                label: 'المناسبة',
                value: analysis.occasion.labelAr,
                artLabel: analysis.occasion.labelAr,
                onTap: () => _openDetail(
                  context,
                  title: analysis.occasion.labelAr,
                  body:
                      'المناسبة المختارة ${analysis.occasion.labelAr}. التوصيات تُبنى عليها.',
                ),
              ),
            ),
          ],
        ),
        if (analysis.occasion == MiraOccasion.university &&
            '${analysis.clothingType} ${analysis.styleType}'.contains('سهرة'))
          const Padding(
            padding: EdgeInsets.only(top: 10),
            child: _Hint(
              'فستان السهرة لا يُعد مناسباً للجامعة تلقائياً. إن كانت المناسبة حفلاً جامعياً، وضّحي ذلك لميرا.',
            ),
          ),
        for (final reason in analysis.matchReasons.take(3))
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: _NoteCard(title: 'ملاحظة', body: reason),
          ),
        for (final gap in analysis.mismatchReasons.take(2))
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: _NoteCard(title: 'تحفظ', body: gap),
          ),
        const SizedBox(height: 10),
        TextButton.icon(
          onPressed: onAskWhy,
          icon: const Icon(Icons.help_outline_rounded, size: 18),
          label: const Text('لماذا هذا الاستنتاج؟'),
        ),
      ],
    );
  }

  void _openDetail(
    BuildContext context, {
    required String title,
    required String body,
  }) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title, style: AppTypography.titleSmall),
            const SizedBox(height: 8),
            Text(body, style: AppTypography.bodyMedium.copyWith(height: 1.45)),
          ],
        ),
      ),
    );
  }
}

class _FactTile extends StatelessWidget {
  final String label;
  final String value;
  final String artLabel;
  final bool selected;
  final VoidCallback? onTap;

  const _FactTile({
    required this.label,
    required this.value,
    required this.artLabel,
    this.selected = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.primaryLight : AppColors.surface,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.fromLTRB(10, 12, 10, 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: selected
                  ? AppColors.primary
                  : AppColors.border.withValues(alpha: 0.45),
              width: selected ? 1.6 : 1,
            ),
          ),
          child: Column(
            children: [
              OutfitPieceArt.visual(label: artLabel, size: 36),
              const SizedBox(height: 8),
              Text(
                label,
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
              Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: AppTypography.labelLarge.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ColorsPage extends StatelessWidget {
  final OutfitAnalysis analysis;
  final ScrollController controller;
  final String? selectedColor;
  final String selectedPiece;
  final ValueChanged<String> onSelectColor;
  final ValueChanged<String> onAskWhy;
  final ValueChanged<String> onTryColor;
  final VoidCallback onKeepLook;

  const _ColorsPage({
    required this.analysis,
    required this.controller,
    required this.selectedColor,
    required this.selectedPiece,
    required this.onSelectColor,
    required this.onAskWhy,
    required this.onTryColor,
    required this.onKeepLook,
  });

  @override
  Widget build(BuildContext context) {
    final observed = <String>{
      ...analysis.dominantColors,
      ...analysis.upperBodyColors,
      ...analysis.lowerBodyColors,
    }.map((c) => c.trim()).where((c) => c.isNotEmpty).toList();
    final suggestions = analysis.recommendedColors
        .where((c) => c.trim().isNotEmpty && !observed.contains(c))
        .toList();
    final canTry = analysis.segmentMap?.hasTrustedOverlay == true;

    return ListView(
      controller: controller,
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
      children: [
        Text('اللون الظاهر', style: AppTypography.titleSmall),
        const SizedBox(height: 8),
        if (observed.isEmpty)
          const _Hint('تعذر قراءة لون القماش من هذه الصورة.')
        else
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              for (final color in observed)
                _ColorCircle(
                  nameAr: color,
                  subtitle: selectedPiece,
                  selected: selectedColor == color,
                  onTap: () {
                    onSelectColor(color);
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
                              'على $selectedPiece · من الصورة'
                              '${bound.hex == null ? '' : ' · ${bound.hex}'}'
                              '. التقدير يتأثر بالإضاءة.',
                              style: AppTypography.bodyMedium
                                  .copyWith(height: 1.4),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
            ],
          ),
        if (analysis.shoeColors.isNotEmpty) ...[
          const SizedBox(height: 14),
          Text('الحذاء', style: AppTypography.titleSmall),
          const SizedBox(height: 8),
          Wrap(
            spacing: 12,
            children: [
              for (final c in analysis.shoeColors)
                if (c.trim().isNotEmpty)
                  _ColorCircle(nameAr: c, subtitle: 'حذاء', art: 'حذاء'),
            ],
          ),
        ],
        const SizedBox(height: 14),
        FilledButton.tonalIcon(
          onPressed: onKeepLook,
          icon: const Icon(Icons.check_rounded),
          label: const Text('يمكنكِ إبقاء لون الإطلالة'),
        ),
        if (suggestions.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text('ألوان مكملة للإكسسوارات', style: AppTypography.titleSmall),
          const SizedBox(height: 8),
          for (var i = 0; i < suggestions.take(3).length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _SuggestionRow(
                colorAr: suggestions[i],
                pieceHint: i == 0 ? 'حقيبة' : (i == 1 ? 'حذاء' : 'إكسسوار'),
                reason:
                    'يختلف عن اللون المرصود على $selectedPiece فيُظهره ضمن ${analysis.occasion.labelAr}.',
                canTry: canTry,
                onWhy: () => onAskWhy(suggestions[i]),
                onTry: () => onTryColor(suggestions[i]),
              ),
            ),
        ],
      ],
    );
  }
}

class _ColorCircle extends StatelessWidget {
  final String nameAr;
  final String subtitle;
  final String? art;
  final bool selected;
  final VoidCallback? onTap;

  const _ColorCircle({
    required this.nameAr,
    required this.subtitle,
    this.art,
    this.selected = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final bound = FashionColorBinding.resolveDetailed(nameAr: nameAr);
    final color = bound.color ?? AppColors.border;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: SizedBox(
        width: 78,
        child: Column(
          children: [
            Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: color,
                    border: Border.all(
                      color: selected ? AppColors.primary : Colors.white,
                      width: selected ? 3 : 2,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.08),
                        blurRadius: 6,
                      ),
                    ],
                  ),
                ),
                if (art != null)
                  Positioned(
                    bottom: -2,
                    child: OutfitPieceArt.visual(label: art!, size: 18),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              nameAr,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.labelSmall.copyWith(
                fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
              ),
            ),
            Text(
              subtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.labelSmall.copyWith(
                color: AppColors.textSecondary,
                fontSize: 10,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SuggestionRow extends StatelessWidget {
  final String colorAr;
  final String pieceHint;
  final String reason;
  final bool canTry;
  final VoidCallback onWhy;
  final VoidCallback onTry;

  const _SuggestionRow({
    required this.colorAr,
    required this.pieceHint,
    required this.reason,
    required this.canTry,
    required this.onWhy,
    required this.onTry,
  });

  @override
  Widget build(BuildContext context) {
    final bound = FashionColorBinding.resolveDetailed(nameAr: colorAr);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.4)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            OutfitPieceArt.visual(label: pieceHint, size: 40),
            const SizedBox(width: 10),
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: bound.color ?? AppColors.border,
                border: Border.all(color: Colors.white, width: 2),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$colorAr · $pieceHint',
                    style: AppTypography.labelLarge
                        .copyWith(fontWeight: FontWeight.w800),
                  ),
                  Text(
                    reason,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.bodySmall.copyWith(height: 1.35),
                  ),
                ],
              ),
            ),
            Column(
              children: [
                TextButton(
                  onPressed: onWhy,
                  child: const Text('لماذا؟'),
                ),
                if (canTry)
                  TextButton(
                    onPressed: onTry,
                    child: const Text('جرّبيه'),
                  ),
              ],
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
      padding: const EdgeInsets.only(bottom: 20),
      children: [
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
  late final Future<List<_HistoryItem>> _history = _load();

  Future<List<_HistoryItem>> _load() async {
    final reports = await OutfitAnalysisRepositoryImpl().getHistory();
    final items = <_HistoryItem>[];
    for (final report in reports.take(12)) {
      final path = await OutfitLocalImageIndex.pathFor(report.id);
      items.add(_HistoryItem(report: report, localPath: path));
    }
    return items;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<_HistoryItem>>(
      future: _history,
      builder: (context, snapshot) {
        final items = snapshot.data ?? const <_HistoryItem>[];
        return ListView(
          controller: widget.controller,
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'سجل التحليلات',
                    style: AppTypography.titleSmall
                        .copyWith(fontWeight: FontWeight.w800),
                  ),
                ),
                if (items.length >= 2)
                  TextButton.icon(
                    onPressed: () => _compare(context, items),
                    icon: const Icon(Icons.compare_rounded, size: 18),
                    label: const Text('مقارنة'),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            if (snapshot.connectionState == ConnectionState.waiting)
              const _Hint('جارٍ تحميل السجل…')
            else if (snapshot.hasError)
              _Hint('تعذر تحميل السجل.')
            else if (items.isEmpty)
              const _Hint('لا يوجد تحليل محفوظ بعد.')
            else
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: items.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                  childAspectRatio: 0.82,
                ),
                itemBuilder: (context, i) => _HistoryCard(item: items[i]),
              ),
          ],
        );
      },
    );
  }

  void _compare(BuildContext context, List<_HistoryItem> items) {
    final a = items[0].report;
    final b = items[1].report;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('مقارنة إطلالتين', style: AppTypography.titleSmall),
            const SizedBox(height: 10),
            Text(
              'الأولى: ${a.occasionLabelAr} · ${a.garmentType} · ${a.dominantColors.take(2).join('، ')}',
              style: AppTypography.bodyMedium.copyWith(height: 1.4),
            ),
            const SizedBox(height: 6),
            Text(
              'الثانية: ${b.occasionLabelAr} · ${b.garmentType} · ${b.dominantColors.take(2).join('، ')}',
              style: AppTypography.bodyMedium.copyWith(height: 1.4),
            ),
            const SizedBox(height: 10),
            const Text(
              'الدرجات الرقمية غير معروضة دون منهجية مدعومة.',
              style: TextStyle(height: 1.4),
            ),
          ],
        ),
      ),
    );
  }
}

class _HistoryItem {
  final OutfitReport report;
  final String? localPath;

  const _HistoryItem({required this.report, required this.localPath});
}

class _HistoryCard extends StatelessWidget {
  final _HistoryItem item;

  const _HistoryCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final report = item.report;
    final date = report.createdAt;
    final dateText = date == null
        ? 'بدون تاريخ'
        : '${date.year}/${date.month}/${date.day}';
    final file =
        item.localPath == null ? null : File(item.localPath!);
    final hasPhoto = file != null && file.existsSync();
    final swatch = report.dominantColors
        .map((c) => FashionColorBinding.resolveDetailed(nameAr: c).color)
        .whereType<Color>()
        .take(3)
        .toList();

    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
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
                    '${report.dominantColors.isEmpty ? '' : ' · ${report.dominantColors.take(3).join('، ')}'}',
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
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: hasPhoto
                      ? Image.file(file, fit: BoxFit.cover)
                      : ColoredBox(
                          color: AppColors.primaryLight,
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              OutfitPieceArt.visual(
                                label: report.garmentType,
                                size: 36,
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'بلا صورة محفوظة',
                                style: AppTypography.labelSmall.copyWith(
                                  color: AppColors.textSecondary,
                                ),
                              ),
                              if (swatch.isNotEmpty) ...[
                                const SizedBox(height: 8),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    for (final c in swatch)
                                      Container(
                                        width: 12,
                                        height: 12,
                                        margin: const EdgeInsets.symmetric(
                                          horizontal: 2,
                                        ),
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
              ),
              const SizedBox(height: 8),
              Text(
                report.occasionLabelAr,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.labelLarge
                    .copyWith(fontWeight: FontWeight.w800),
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

class _NoteCard extends StatelessWidget {
  final String title;
  final String body;

  const _NoteCard({required this.title, required this.body});

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.35)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title, style: AppTypography.labelLarge),
            const SizedBox(height: 4),
            Text(body, style: AppTypography.bodyMedium.copyWith(height: 1.4)),
          ],
        ),
      ),
    );
  }
}

class _Hint extends StatelessWidget {
  final String text;

  const _Hint(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: AppTypography.bodyMedium.copyWith(
        height: 1.45,
        color: AppColors.textSecondary,
      ),
    );
  }
}

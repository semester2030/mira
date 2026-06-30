import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../../core/navigation/analysis_navigation.dart';
import '../../../../../core/navigation/app_routes.dart';
import '../../../../../core/navigation/route_args.dart';
import '../../../../../core/privacy/privacy_navigation.dart';
import '../../../../../core/session/analysis_session.dart';
import '../../../../../shared/delight/staggered_entrance.dart';
import '../../../../../shared/delight/analysis_celebration.dart';
import '../../../../../shared/theme/colors.dart';
import '../../../../../shared/theme/typography.dart';
import '../../../../../shared/widgets/premium/premium_exports.dart';
import '../../../domain/entities/outfit_analysis.dart';
import '../../../domain/entities/outfit_compare_snapshot.dart';
import '../../../domain/entities/outfit_segment_map.dart';
import '../../../domain/entities/suggested_piece_model.dart';
import '../../../domain/helpers/outfit_result_sections.dart';
import '../../../domain/services/outfit_occasion_scoring.dart';
import '../../../domain/services/outfit_piece_wishlist_service.dart';
import '../outfit_color_alternative_panel.dart';
import '../outfit_color_harmony_panel.dart';
import '../outfit_insight/outfit_insight_builder.dart';
import '../outfit_insight_cards.dart';
import '../outfit_look_result_hero.dart';
import '../outfit_next_occasion_card.dart';
import '../outfit_segment_map_overlay.dart';
import '../outfit_why_this_works_section.dart';
import 'outfit_mira_voice_bubble.dart';
import 'outfit_photo_color_slider.dart';
import 'outfit_piece_swipe_vote.dart';
import 'outfit_result_chapter_progress.dart';
import 'outfit_result_chapters.dart';
import 'outfit_result_sticky_hero.dart';

/// Story-based outfit result — engagement without any sharing.
class OutfitResultStoryShell extends StatefulWidget {
  final OutfitAnalysis analysis;
  final OutfitResultSectionPlan sections;

  const OutfitResultStoryShell({
    super.key,
    required this.analysis,
    required this.sections,
  });

  @override
  State<OutfitResultStoryShell> createState() => _OutfitResultStoryShellState();
}

class _OutfitResultStoryShellState extends State<OutfitResultStoryShell> {
  late final PageController _pageController;
  late final List<ScrollController> _scrollControllers;

  int _currentChapter = 0;
  final Set<int> _visitedChapters = {0};
  final Set<int> _celebratedChapters = {};
  Set<String> _wishlistedIds = {};
  bool _showStickyHero = false;
  OutfitSegmentZone? _selectedZone;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _scrollControllers = List.generate(OutfitResultChapter.all.length, (_) => ScrollController());
    _loadWishlist();
    for (final c in _scrollControllers) {
      c.addListener(_onScroll);
    }
  }

  Future<void> _loadWishlist() async {
    final ids = await OutfitPieceWishlistService.loadIds();
    if (mounted) setState(() => _wishlistedIds = ids);
  }

  @override
  void dispose() {
    for (final c in _scrollControllers) {
      c.removeListener(_onScroll);
      c.dispose();
    }
    _pageController.dispose();
    super.dispose();
  }

  void _onScroll() {
    final controller = _scrollControllers[_currentChapter];
    final show = controller.hasClients && controller.offset > 180;
    if (show != _showStickyHero) setState(() => _showStickyHero = show);
  }

  void _goToChapter(int index) {
    HapticFeedback.selectionClick();
    _pageController.animateToPage(
      index,
      duration: const Duration(milliseconds: 380),
      curve: Curves.easeOutCubic,
    );
  }

  void _onPageChanged(int index) {
    setState(() => _currentChapter = index);
    final isNew = _visitedChapters.add(index);
    if (isNew && mounted) {
      final chapter = OutfitResultChapter.all[index];
      if (_celebratedChapters.add(index)) {
        AnalysisCelebration.showChapterUnlock(
          context,
          message: OutfitResultChapter.completionMessage(chapter),
        );
      }
    }
    _onScroll();
  }

  Future<void> _toggleWishlist(SuggestedPieceModel piece) async {
    HapticFeedback.lightImpact();
    final ids = await OutfitPieceWishlistService.toggle(piece.id);
    if (!mounted) return;
    setState(() => _wishlistedIds = ids);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ids.contains(piece.id)
              ? 'حُفظت «${piece.title}» في دولابك — على جهازك فقط'
              : 'أُزيلت «${piece.title}» من دولابك',
        ),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _showRegionDetail(OutfitSegmentRegion region) {
    HapticFeedback.lightImpact();
    setState(() => _selectedZone = region.zone);
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: AppColors.border.withValues(alpha: 0.35)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(region.labelAr, style: AppTypography.titleMedium),
            const SizedBox(height: 8),
            if (region.colors.isNotEmpty)
              Text(
                'الألوان: ${region.colors.join(' · ')}',
                style: AppTypography.bodySmall.copyWith(height: 1.5),
                textAlign: TextAlign.center,
              ),
            const SizedBox(height: 8),
            Text(
              'ثقة الكشف ${(region.confidence * 100).round()}%',
              style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final chapter = OutfitResultChapter.all[_currentChapter];
    final hasPhoto = widget.analysis.frozenImagePath != null &&
        File(widget.analysis.frozenImagePath!).existsSync();
    final hasTrustedMap = widget.analysis.segmentMap?.hasTrustedOverlay == true;
    final votePieces = [
      ...OutfitInsightBuilder.clothingPieces(widget.analysis),
      ...OutfitInsightBuilder.accessories(widget.analysis),
    ];

    return Stack(
      children: [
        Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: OutfitResultChapterProgress(
                currentIndex: _currentChapter,
                visitedIndices: _visitedChapters,
                onChapterTap: _goToChapter,
              ),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: OutfitMiraVoiceBubble(chapter: chapter),
            ),
            const SizedBox(height: 10),
            Expanded(
              child: PageView(
                controller: _pageController,
                onPageChanged: _onPageChanged,
                children: [
                  _chapterScroll(
                    0,
                    [
                      OutfitLookResultHero(analysis: widget.analysis),
                      const SizedBox(height: 14),
                      OutfitNextOccasionCard(
                        analysis: widget.analysis,
                        onTryOccasion: () {
                          final next = OutfitOccasionScoring.suggestNext(widget.analysis);
                          AnalysisNavigation.openOutfitAnalysis(context);
                          if (next != null && context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  'اختاري مناسبة «${next.occasion.labelAr}» في الخطوة التالية',
                                ),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          }
                        },
                      ),
                      if (hasPhoto && hasTrustedMap) ...[
                        const SizedBox(height: 16),
                        _InteractivePhotoCard(
                          analysis: widget.analysis,
                          selectedZone: _selectedZone,
                          onRegionTap: _showRegionDetail,
                        ),
                      ] else if (hasPhoto && widget.analysis.segmentMap?.validationMessage != null) ...[
                        const SizedBox(height: 16),
                        _VisualValidationNotice(
                          message: widget.analysis.segmentMap!.validationMessage!,
                        ),
                      ],
                    ],
                  ),
                  _chapterScroll(
                    1,
                    [
                      OutfitColorHarmonyPanel(analysis: widget.analysis),
                      const SizedBox(height: 16),
                      OutfitWhyThisWorksSection(analysis: widget.analysis),
                      const SizedBox(height: 16),
                      OutfitPhotoColorSlider(analysis: widget.analysis),
                    ],
                  ),
                  _chapterScroll(
                    2,
                    [
                      OutfitColorAlternativePanel(analysis: widget.analysis),
                      const SizedBox(height: 16),
                      OutfitPieceSwipeVote(pieces: votePieces),
                    ],
                  ),
                  _chapterScroll(
                    3,
                    [
                      OutfitInsightCards(
                        analysis: widget.analysis,
                        wishlistedIds: _wishlistedIds,
                        onWishlistToggle: _toggleWishlist,
                      ),
                      if (widget.sections.strengths.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        _ReasonSection(
                          title: 'نقاط القوة',
                          icon: Icons.check_circle_outline_rounded,
                          color: AppColors.success,
                          items: widget.sections.strengths,
                        ),
                      ],
                      if (widget.sections.mismatches.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        _ReasonSection(
                          title: 'القطع التي تحتاج تعديل',
                          icon: Icons.info_outline_rounded,
                          color: AppColors.gold,
                          items: widget.sections.mismatches,
                        ),
                      ],
                      if (widget.sections.improvements.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        _ReasonSection(
                          title: 'اقتراحات التحسين',
                          icon: Icons.auto_fix_high_outlined,
                          color: AppColors.secondary,
                          items: widget.sections.improvements,
                        ),
                      ],
                      if (widget.analysis.isSmartMode && widget.analysis.suggestedMakeup.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        PremiumCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('مكياج مقترح', style: AppTypography.titleMedium),
                              const SizedBox(height: 8),
                              Text(
                                widget.analysis.suggestedMakeup,
                                style: AppTypography.bodyMedium.copyWith(height: 1.5),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 20),
                      PremiumButton(
                        label: 'قارني مع إطلالة من السجل',
                        icon: Icons.compare_arrows_rounded,
                        variant: PremiumButtonVariant.secondary,
                        onPressed: () {
                          Navigator.pushNamed(
                            context,
                            AppRoutes.outfitHistory,
                            arguments: OutfitHistoryRouteArgs(
                              anchorSnapshot: OutfitCompareSnapshot.fromAnalysis(widget.analysis),
                              startCompareMode: true,
                            ),
                          );
                        },
                      ),
                      const SizedBox(height: 12),
                      if (AnalysisSession.canBuildFullRecommendation) ...[
                        PremiumButton(
                          label: 'توصيات ميرا الكاملة',
                          icon: Icons.auto_awesome_rounded,
                          variant: PremiumButtonVariant.gold,
                          onPressed: () => PrivacyNavigation.openRecommendations(
                            context,
                            skin: AnalysisSession.lastSkin,
                            outfit: AnalysisSession.lastOutfit,
                          ),
                        ),
                        const SizedBox(height: 8),
                      ],
                      PremiumButton(
                        label: 'تحليل إطلالة أخرى',
                        icon: Icons.refresh_rounded,
                        variant: PremiumButtonVariant.secondary,
                        onPressed: () => AnalysisNavigation.openOutfitAnalysis(context),
                      ),
                      const SizedBox(height: 8),
                      PremiumButton(
                        label: 'العودة للرئيسية',
                        variant: PremiumButtonVariant.secondary,
                        onPressed: () => Navigator.pushNamedAndRemoveUntil(
                          context,
                          AppRoutes.dashboard,
                          (_) => false,
                        ),
                      ),
                      const SizedBox(height: 24),
                    ],
                  ),
                ],
              ),
            ),
            if (_currentChapter < OutfitResultChapter.all.length - 1)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                child: PremiumButton(
                  label: 'الفصل التالي: ${OutfitResultChapter.all[_currentChapter + 1].titleAr}',
                  icon: Icons.arrow_back_rounded,
                  onPressed: () => _goToChapter(_currentChapter + 1),
                ),
              ),
          ],
        ),
        if (_showStickyHero)
          Positioned(
            top: 8,
            left: 20,
            right: 20,
            child: OutfitResultStickyHero(
              analysis: widget.analysis,
              onTap: () {
                _scrollControllers[_currentChapter].animateTo(
                  0,
                  duration: const Duration(milliseconds: 400),
                  curve: Curves.easeOut,
                );
              },
            ),
          ),
      ],
    );
  }

  Widget _chapterScroll(int index, List<Widget> children) {
    return SingleChildScrollView(
      controller: _scrollControllers[index],
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
      child: StaggeredEntrance(children: children),
    );
  }
}

class _InteractivePhotoCard extends StatelessWidget {
  final OutfitAnalysis analysis;
  final OutfitSegmentZone? selectedZone;
  final ValueChanged<OutfitSegmentRegion> onRegionTap;

  const _InteractivePhotoCard({
    required this.analysis,
    required this.selectedZone,
    required this.onRegionTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.4)),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'لمسي القطع على صورتك',
            style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            'كل منطقة تكشف تفاصيل القطعة والألوان',
            style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 12),
          OutfitSegmentMapOverlay(
            imageFile: File(analysis.frozenImagePath!),
            segmentMap: analysis.segmentMap!,
            interactive: true,
            selectedZone: selectedZone,
            onRegionTap: onRegionTap,
          ),
        ],
      ),
    );
  }
}

class _VisualValidationNotice extends StatelessWidget {
  final String message;

  const _VisualValidationNotice({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          Icon(Icons.visibility_off_outlined, color: AppColors.gold, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Text(message, style: AppTypography.bodySmall.copyWith(height: 1.45)),
          ),
        ],
      ),
    );
  }
}

class _ReasonSection extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color color;
  final List<String> items;

  const _ReasonSection({
    required this.title,
    required this.icon,
    required this.color,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(title, style: AppTypography.titleMedium),
        const SizedBox(height: 10),
        PremiumCard(
          child: Column(
            children: [
              for (var i = 0; i < items.length; i++) ...[
                if (i > 0) const Divider(height: 20),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(icon, size: 18, color: color),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        items[i],
                        style: AppTypography.bodyMedium.copyWith(height: 1.5),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/ai/models/mira_occasion.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/route_args.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../../core/utils/firebase_error_message.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../blocs/outfit_analysis_bloc.dart';
import '../blocs/outfit_analysis_event.dart';
import '../blocs/outfit_analysis_state.dart';

class OccasionSelectScreen extends StatefulWidget {
  const OccasionSelectScreen({super.key});

  @override
  State<OccasionSelectScreen> createState() => _OccasionSelectScreenState();
}

class _OccasionSelectScreenState extends State<OccasionSelectScreen> {
  MiraOccasion? _selected;

  @override
  Widget build(BuildContext context) {
    final args = ModalRoute.of(context)?.settings.arguments as OutfitOccasionRouteArgs?;
    if (args == null) {
      return Scaffold(
        appBar: const MiraAppBar(pageTitle: 'المناسبة'),
        body: const Center(child: Text('مسار غير صالح')),
      );
    }

    return BlocProvider(
      create: (_) => OutfitAnalysisBloc(),
      child: BlocConsumer<OutfitAnalysisBloc, OutfitAnalysisState>(
        listener: (context, state) {
          if (state is OutfitAnalysisSuccess) {
            AnalysisSession.setOutfit(state.report);
            Navigator.pushReplacementNamed(
              context,
              AppRoutes.outfitResult,
              arguments: state.report,
            );
          } else if (state is OutfitAnalysisFailure) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(friendlyFirebaseError(state.message)),
                backgroundColor: AppColors.error,
              ),
            );
          }
        },
        builder: (context, state) {
          final loading = state is OutfitAnalysisLoading;

          return Scaffold(
            appBar: const MiraAppBar(pageTitle: 'اختيار المناسبة'),
            body: FloatingGradientBackground(
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'لأي مناسبة هذه الإطلالة؟',
                        style: AppTypography.headlineSmall,
                      ),
                      const SizedBox(height: 16),
                      Expanded(
                        child: GridView.count(
                          crossAxisCount: 2,
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                          childAspectRatio: 1.4,
                          children: MiraOccasion.values.map((o) {
                            final selected = _selected == o;
                            return PressableScale(
                              onTap: loading ? null : () => setState(() => _selected = o),
                              child: PremiumCard(
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      _iconFor(o),
                                      color: selected ? AppColors.primary : AppColors.textSecondary,
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      o.labelAr,
                                      style: AppTypography.titleMedium.copyWith(
                                        color: selected ? AppColors.primary : null,
                                      ),
                                      textAlign: TextAlign.center,
                                    ),
                                  ],
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                      PremiumButton(
                        label: loading ? 'جاري التحليل...' : 'تحليل الإطلالة',
                        loading: loading,
                        icon: Icons.auto_awesome_rounded,
                        variant: PremiumButtonVariant.gold,
                        onPressed: _selected != null && !loading
                            ? () {
                                context.read<OutfitAnalysisBloc>().add(
                                      StartOutfitAnalysis(
                                        imagePath: args.imagePath,
                                        occasion: _selected!,
                                      ),
                                    );
                              }
                            : null,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  IconData _iconFor(MiraOccasion o) {
    switch (o) {
      case MiraOccasion.wedding:
        return Icons.favorite_border_rounded;
      case MiraOccasion.work:
        return Icons.work_outline_rounded;
      case MiraOccasion.casual:
        return Icons.weekend_outlined;
      case MiraOccasion.university:
        return Icons.school_outlined;
      case MiraOccasion.evening:
        return Icons.nightlife_outlined;
      case MiraOccasion.eid:
        return Icons.celebration_outlined;
      case MiraOccasion.interview:
        return Icons.record_voice_over_outlined;
    }
  }
}

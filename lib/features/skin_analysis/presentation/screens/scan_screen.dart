import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../blocs/skin_analysis_bloc.dart';
import '../blocs/skin_analysis_event.dart';
import '../blocs/skin_analysis_state.dart';
import '../widgets/face_frame_overlay.dart';
import '../../../../shared/widgets/primary_button.dart';

class ScanScreen extends StatelessWidget {
  const ScanScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('فحص البشرة')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const FaceFrameOverlay(),
            const SizedBox(height: 32),
            BlocConsumer<SkinAnalysisBloc, SkinAnalysisState>(
              listener: (context, state) {
                if (state is SkinAnalysisSuccess) {
                  Navigator.pushNamed(context, '/skin_result', arguments: state.report);
                }
              },
              builder: (context, state) {
                if (state is SkinAnalysisLoading) {
                  return const CircularProgressIndicator();
                }
                return PrimaryButton(
                  text: 'ابدأ التحليل',
                  onPressed: () {
                    context.read<SkinAnalysisBloc>().add(StartSkinAnalysis());
                  },
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import '../../../skin_analysis/presentation/widgets/face_frame_overlay.dart';

class NewAnalysisScreen extends StatefulWidget {
  const NewAnalysisScreen({super.key});

  @override
  State<NewAnalysisScreen> createState() => _NewAnalysisScreenState();
}

class _NewAnalysisScreenState extends State<NewAnalysisScreen> {
  String? selectedSkinType;
  String? imagePath;
  File? _capturedImage;
  final ImagePicker _picker = ImagePicker();

  final skinTypes = [
    {'label': 'دهنية', 'icon': Icons.water_drop},
    {'label': 'جافة', 'icon': Icons.spa},
    {'label': 'مختلطة', 'icon': Icons.blur_on},
    {'label': 'عادية', 'icon': Icons.face_retouching_natural},
  ];

  Future<void> _pickImageFromCamera() async {
    final pickedFile = await _picker.pickImage(source: ImageSource.camera);
    if (pickedFile != null) {
      setState(() {
        _capturedImage = File(pickedFile.path);
        imagePath = pickedFile.path;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('بدء تحليل جديد')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('اختر نوع بشرتك:', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            Wrap(
              spacing: 16,
              children: skinTypes.map((type) => ChoiceChip(
                label: Text(type['label'] as String),
                avatar: Icon(type['icon'] as IconData, color: Colors.pink),
                selected: selectedSkinType == type['label'],
                onSelected: (_) {
                  setState(() => selectedSkinType = type['label'] as String);
                },
              )).toList(),
            ),
            const SizedBox(height: 32),
            Text('التقط صورة واضحة لبشرتك:', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            GestureDetector(
              onTap: _pickImageFromCamera,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  const FaceFrameOverlay(width: 180, height: 240),
                  if (_capturedImage == null)
                    const Icon(Icons.camera_alt, size: 40, color: Colors.pink)
                  else
                    ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Image.file(_capturedImage!, width: 120, height: 120, fit: BoxFit.cover),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 32),
            Center(
              child: ElevatedButton.icon(
                icon: const Icon(Icons.analytics),
                label: const Text('بدء التحليل'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                  textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  backgroundColor: Colors.pink,
                ),
                onPressed: (selectedSkinType != null && _capturedImage != null)
                    ? () {
                        showDialog(
                          context: context,
                          builder: (_) => AlertDialog(
                            title: const Text('جاري التحليل...'),
                            content: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: const [
                                CircularProgressIndicator(),
                                SizedBox(height: 16),
                                Text('يتم الآن تحليل بشرتك بناءً على البيانات المدخلة...'),
                              ],
                            ),
                          ),
                        );
                        Future.delayed(const Duration(seconds: 2), () {
                          Navigator.pop(context);
                          showDialog(
                            context: context,
                            builder: (_) => AlertDialog(
                              title: const Text('تم التحليل بنجاح!'),
                              content: const Text('تم تحليل بشرتك بنجاح. يمكنك الآن استعراض النتائج والتوصيات.'),
                              actions: [
                                TextButton(
                                  onPressed: () => Navigator.pop(context),
                                  child: const Text('حسناً'),
                                ),
                              ],
                            ),
                          );
                        });
                      }
                    : null,
              ),
            ),
          ],
        ),
      ),
    );
  }
} 
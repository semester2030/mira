import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../../../core/ai/ai_module.dart';
import '../../../../core/ai/mappers/skin_result_mapper.dart';
import '../../../../core/ai/models/skin_analysis_result.dart';
import '../../../../core/privacy/temp_image_cleanup.dart';
import '../../../../core/services/user_stats_service.dart';
import '../models/skin_report_model.dart';

/// Firestore persistence for analysis **results only** — no image upload (privacy).
class SkinAnalysisRemoteDataSource {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  CollectionReference<Map<String, dynamic>> _analysesRef(String uid) =>
      _firestore.collection('users').doc(uid).collection('analyses');

  Future<SkinReportModel> analyzeAndSave({required String imagePath}) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('يجب تسجيل الدخول لإجراء التحليل');
    }

    final file = File(imagePath);
    if (!await file.exists()) {
      throw Exception('لم يتم العثور على صورة التحليل');
    }

    try {
      final imageBytes = await file.readAsBytes();
      final analysisResult = await AiModule.instance.skinProvider.analyze(imageBytes);
      return _persistAnalysis(user.uid, analysisResult);
    } finally {
      await TempImageCleanup.deleteIfExists(imagePath);
    }
  }

  Future<SkinReportModel> _persistAnalysis(
    String uid,
    SkinAnalysisResult result,
  ) async {
    final previousScore = await _latestBeautyScore(uid);
    final doc = _analysesRef(uid).doc();
    final createdAt = DateTime.now();
    final report = SkinResultMapper.toReport(
      result,
      id: doc.id,
      createdAt: createdAt,
      previousBeautyScore: previousScore,
    );
    final model = SkinReportModel.fromEntity(report);

    await doc.set(model.toJson());

    try {
      await UserStatsService.recordSkinAnalysis();
    } catch (_) {
      // لا نمنع عرض نتيجة التحليل إذا فشل تحديث النقاط فقط.
    }

    return model;
  }

  Future<int?> _latestBeautyScore(String uid) async {
    final snapshot = await _analysesRef(uid)
        .orderBy('createdAt', descending: true)
        .limit(1)
        .get();
    if (snapshot.docs.isEmpty) return null;
    final score = snapshot.docs.first.data()['score'];
    if (score is num) return score.round();
    return null;
  }

  Future<List<SkinReportModel>> fetchHistory({int limit = 50}) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('يجب تسجيل الدخول');
    }

    final snapshot = await _analysesRef(user.uid)
        .orderBy('createdAt', descending: true)
        .limit(limit)
        .get();

    return snapshot.docs
        .map((d) => SkinReportModel.fromJson(d.id, d.data()))
        .toList();
  }

  Stream<List<SkinReportModel>> watchHistory({int limit = 20}) {
    final user = _auth.currentUser;
    if (user == null) {
      return Stream.error(Exception('يجب تسجيل الدخول'));
    }

    return _analysesRef(user.uid)
        .orderBy('createdAt', descending: true)
        .limit(limit)
        .snapshots()
        .map((snap) => snap.docs
            .map((d) => SkinReportModel.fromJson(d.id, d.data()))
            .toList());
  }
}

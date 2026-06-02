import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../profile/user_level.dart';
import '../utils/firestore_parsers.dart';

/// يحدّث إحصائيات الملف في Firestore بعد التحليلات والنصائح.
abstract final class UserStatsService {
  UserStatsService._();

  static final _firestore = FirebaseFirestore.instance;

  static const int skinAnalysisPoints = 15;
  static const int outfitAnalysisPoints = 12;
  static const int tipEngagementPoints = 5;

  static String? get _uid => FirebaseAuth.instance.currentUser?.uid;

  static Future<void> recordSkinAnalysis() async {
    final uid = _uid;
    if (uid == null) return;
    await _apply(
      uid: uid,
      analysesDelta: 1,
      pointsDelta: skinAnalysisPoints,
    );
  }

  static Future<void> recordOutfitAnalysis() async {
    final uid = _uid;
    if (uid == null) return;
    await _apply(
      uid: uid,
      analysesDelta: 1,
      pointsDelta: outfitAnalysisPoints,
    );
  }

  static Future<void> recordTipEngagement() async {
    final uid = _uid;
    if (uid == null) return;
    await _apply(
      uid: uid,
      tipsDelta: 1,
      pointsDelta: tipEngagementPoints,
    );
  }

  static Future<void> _apply({
    required String uid,
    int analysesDelta = 0,
    int pointsDelta = 0,
    int tipsDelta = 0,
  }) async {
    if (analysesDelta == 0 && pointsDelta == 0 && tipsDelta == 0) return;

    await _firestore.runTransaction((transaction) async {
      final ref = _firestore.collection('users').doc(uid);
      final snapshot = await transaction.get(ref);

      final currentPoints = snapshot.exists
          ? FirestoreParsers.integer(snapshot.data()?['points'])
          : 0;
      final projectedPoints = currentPoints + pointsDelta;
      final level = UserLevel.fromPoints(projectedPoints);

      final updates = <String, dynamic>{
        'level': level,
        'lastActive': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      };
      if (analysesDelta != 0) {
        updates['analyses'] = FieldValue.increment(analysesDelta);
      }
      if (pointsDelta != 0) {
        updates['points'] = FieldValue.increment(pointsDelta);
      }
      if (tipsDelta != 0) {
        updates['tips'] = FieldValue.increment(tipsDelta);
      }

      transaction.set(ref, updates, SetOptions(merge: true));
    });
  }
}

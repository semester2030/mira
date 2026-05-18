import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

/// Result of syncing the Firestore user profile after Auth sign-in/up.
enum UserDocumentSyncResult { created, updated, skippedPermissionDenied, failed }

/// Ensures Firestore user profile exists after sign-up / first login.
class UserDocumentService {
  UserDocumentService._();

  static final _firestore = FirebaseFirestore.instance;

  /// Never throws [FirebaseException] for permission-denied — Auth already succeeded.
  static Future<UserDocumentSyncResult> ensureUserDocument({
    required User user,
    String? displayName,
  }) async {
    try {
      final doc = _firestore.collection('users').doc(user.uid);
      final snap = await doc.get();
      if (snap.exists) {
        await doc.set(
          {
            'lastActive': 'الآن',
            'updatedAt': FieldValue.serverTimestamp(),
          },
          SetOptions(merge: true),
        );
        return UserDocumentSyncResult.updated;
      }

      await doc.set({
        'id': user.uid,
        'name': displayName ?? user.displayName ?? 'مستخدمة ميرا',
        'email': user.email ?? '',
        'phone': user.phoneNumber,
        'avatarUrl': user.photoURL,
        'level': 'مبتدئة',
        'points': 0,
        'analyses': 0,
        'tips': 0,
        'lastActive': 'الآن',
        'achievements': <Map<String, dynamic>>[],
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      return UserDocumentSyncResult.created;
    } on FirebaseException catch (e) {
      if (e.code == 'permission-denied') {
        return UserDocumentSyncResult.skippedPermissionDenied;
      }
      rethrow;
    }
  }
}

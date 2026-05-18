import 'package:firebase_auth/firebase_auth.dart';
import 'guest_session_service.dart';

/// App-wide session: signed-in Firebase user or local guest browsing.
class AppSession {
  AppSession._();

  static bool get hasAccount => FirebaseAuth.instance.currentUser != null;

  static bool get isGuest => GuestSessionService.isActive && !hasAccount;

  static bool get canBrowse => hasAccount || isGuest;

  static bool get canUseCloud => hasAccount;
}

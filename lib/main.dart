import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'features/auth/presentation/screens/login_screen.dart';
import 'features/auth/presentation/screens/register_screen.dart';
import 'features/auth/presentation/screens/forgot_password_screen.dart';
import 'features/dashboard/presentation/screens/dashboard_screen.dart';
import 'features/profile/presentation/screens/profile_screen.dart';
import 'features/dashboard/presentation/screens/analysis_screen.dart';
import 'features/dashboard/presentation/screens/points_screen.dart';
import 'features/dashboard/presentation/screens/tips_screen.dart';
import 'features/dashboard/presentation/screens/new_analysis_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const MirraApp());
}

class MirraApp extends StatelessWidget {
  const MirraApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Mirra App',
      theme: ThemeData(
        primarySwatch: Colors.pink,
      ),
      initialRoute: '/login',
      routes: {
        '/login': (context) => const LoginScreen(),
        '/register': (context) => const RegisterScreen(),
        '/forgot': (context) => const ForgotPasswordScreen(),
        '/dashboard': (context) => const DashboardScreen(),
        '/profile': (context) => const ProfileScreen(),
        '/analysis': (context) => const AnalysisScreen(),
        '/points': (context) => const PointsScreen(),
        '/tips': (context) => const TipsScreen(),
        '/new-analysis': (context) => const NewAnalysisScreen(),
      },
    );
  }
}
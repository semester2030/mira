import 'package:flutter/material.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';

class HelpScreen extends StatelessWidget {
  const HelpScreen({super.key});

  static const _faqs = [
    (
      'كيف أسجّل الدخول؟',
      'أدخلي اسمك ورقم جوالك السعودي (05xxxxxxxx)، ثم رمز التحقق المرسل برسالة SMS. نفس الخطوات للحساب الجديد أو القديم.',
    ),
    (
      'هل تُحفظ صوري؟',
      'صور التحليل تُعالَج للنتيجة فقط ولا تُرفع للعرض العام. النتائج النصية تُحفظ في حسابك إن سجّلتِ الدخول.',
    ),
    (
      'ما الفرق بين وضع الزائر والحساب؟',
      'كزائرة يمكنك تجربة التحليل والتصفّح. بالحساب تُحفظ النقاط والسجل والملف الشخصي.',
    ),
    (
      'كيف أحذف حسابي؟',
      'من الإعدادات → حذف الحساب. يُحذف حسابك وبياناتك نهائياً ولا يمكن التراجع.',
    ),
    (
      'لم يصل رمز التحقق',
      'تأكدي من صحة الرقم بصيغة 05xxxxxxxx، وانتظري دقيقة ثم «إعادة إرسال الرمز». للتجربة أضيفي رقم اختبار في Firebase Console.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const MiraAppBar(pageTitle: 'المساعدة'),
      body: FloatingGradientBackground(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            PremiumCard(
              child: Row(
                children: [
                  Icon(Icons.support_agent_rounded, color: AppColors.primary, size: 32),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'نحن هنا لمساعدتكِ في رحلة العناية ببشرتكِ وإطلالتكِ.',
                      style: AppTypography.bodyMedium,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            ..._faqs.map(
              (faq) => PremiumCard(
                margin: const EdgeInsets.only(bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(faq.$1, style: AppTypography.titleMedium),
                    const SizedBox(height: 8),
                    Text(
                      faq.$2,
                      style: AppTypography.bodyMedium
                          .copyWith(color: AppColors.textSecondary, height: 1.5),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

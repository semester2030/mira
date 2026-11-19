import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/ask_mira_entry.dart';
import '../../../../shared/widgets/mirra_logo.dart';
import '../../../../core/navigation/route_args.dart';
import '../../data/catalog_price.dart';
import '../../domain/entities/catalog_service.dart';
import '../occasion_plan.dart';

/// «مناسبتي» — aggregates venue / hospitality / photography / beauty choices per provider.
class MyOccasionScreen extends StatefulWidget {
  const MyOccasionScreen({super.key, this.initialTitleAr = 'مناسبتي'});

  final String initialTitleAr;

  @override
  State<MyOccasionScreen> createState() => _MyOccasionScreenState();
}

class _MyOccasionScreenState extends State<MyOccasionScreen> {
  late String _title = widget.initialTitleAr;
  DateTime _date = DateTime(2026, 12, 11);
  int _guests = 80;

  @override
  void initState() {
    super.initState();
    OccasionPlan.instance.addListener(_onPlan);
  }

  @override
  void dispose() {
    OccasionPlan.instance.removeListener(_onPlan);
    super.dispose();
  }

  void _onPlan() {
    if (mounted) setState(() {});
  }

  int get _estimateHalalas {
    var sum = 0;
    for (final item in OccasionPlan.instance.items) {
      if (item.priceKnown) sum += item.priceHalalas;
    }
    return sum;
  }

  bool get _anyUnknown => OccasionPlan.instance.items.any((i) => !i.priceKnown);

  @override
  Widget build(BuildContext context) {
    final items = OccasionPlan.instance.items;
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        centerTitle: true,
        title: const MirraLogo.appBar(),
        actions: [
          IconButton(onPressed: () {}, icon: Icon(Icons.more_horiz, color: AppColors.brandBurgundy)),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: AspectRatio(
                    aspectRatio: 16 / 9,
                    child: ColoredBox(
                      color: AppColors.primaryLight,
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          if (items.isNotEmpty && items.first.imageUrl != null)
                            Image.network(items.first.imageUrl!, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox()),
                          Align(
                            alignment: Alignment.bottomRight,
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    _title,
                                    style: AppTypography.headlineSmall.copyWith(
                                      color: AppColors.brandBurgundy,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  Text(
                                    'كل تفاصيل يومك، في مكان واحد',
                                    style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: _pill(icon: Icons.people_outline, label: '$_guests ضيفة', onEdit: _editGuests)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _pill(
                        icon: Icons.calendar_today_outlined,
                        label: _formatDate(_date),
                        onEdit: _editDate,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  reverse: true,
                  child: Row(
                    children: [
                      for (final chip in const [
                        ('المكان', Icons.location_city_outlined),
                        ('التنسيق', Icons.local_florist_outlined),
                        ('التصوير', Icons.photo_camera_outlined),
                        ('التجميل', Icons.brush_outlined),
                        ('الضيافة', Icons.room_service_outlined),
                      ])
                        Padding(
                          padding: const EdgeInsets.only(left: 12),
                          child: Column(
                            children: [
                              CircleAvatar(
                                radius: 28,
                                backgroundColor: const Color(0xFFFCE8F0),
                                child: Icon(chip.$2, color: AppColors.brandBurgundy),
                              ),
                              const SizedBox(height: 6),
                              Text(chip.$1, style: AppTypography.labelSmall),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    TextButton.icon(
                      onPressed: () => Navigator.of(context).maybePop(),
                      icon: Icon(Icons.add, color: AppColors.brandBurgundy),
                      label: Text('+ أضيفي خدمة', style: TextStyle(color: AppColors.brandBurgundy)),
                    ),
                    const Spacer(),
                    Text('اختياراتك', style: AppTypography.titleSmall.copyWith(color: AppColors.brandBurgundy)),
                  ],
                ),
                if (items.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 24),
                    child: Text(
                      'أضيفي قاعة أو خدمة من مناسباتك لتظهر هنا بحالتها وسعرها.',
                      style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                      textAlign: TextAlign.center,
                    ),
                  )
                else
                  for (final item in items) ...[
                    _choiceRow(item),
                    const SizedBox(height: 10),
                  ],
                const SizedBox(height: 12),
                AskMiraEntry(
                  compact: false,
                  contextLine: 'اسألي ميرا',
                  subtitle: 'وش باقي لتجهيز مناسبتي؟',
                  suggestions: const [
                    'وش باقي لتجهيز مناسبتي؟',
                    'هل الورد مشمول؟',
                    'قارني القاعات',
                  ],
                  routeArgs: (question) => AdvisorRouteArgs.marketplaceOffer(
                    offerId: items.isEmpty ? 'occasion-plan' : items.first.serviceId,
                    offerKind: 'service',
                    partnerId: items.isEmpty ? null : items.first.partnerId,
                    initialQuestion: question ?? 'وش باقي لتجهيز مناسبتي؟',
                    discussionFocus: 'مناسبتي: $_title · $_guests ضيفة · ${_formatDate(_date)}',
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'تأكيد مستقل لكل مقدّم خدمة',
                  style: AppTypography.bodySmall.copyWith(color: AppColors.textTertiary),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 88),
              ],
            ),
          ),
          Material(
            elevation: 10,
            color: AppColors.surface,
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                child: Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: items.isEmpty ? null : () {},
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.brandBurgundy,
                          foregroundColor: Colors.white,
                          minimumSize: const Size.fromHeight(52),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        icon: const Icon(Icons.event_note_outlined),
                        label: const Text('مراجعة الحجوزات'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('التكلفة التقديرية', style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary)),
                        Text(
                          _anyUnknown && _estimateHalalas == 0
                              ? 'بانتظار عرض'
                              : CatalogPrice.text(known: _estimateHalalas > 0, halalas: _estimateHalalas),
                          style: AppTypography.titleMedium.copyWith(
                            color: AppColors.brandBurgundy,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _pill({required IconData icon, required String label, required VoidCallback onEdit}) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onEdit,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.brandBurgundy.withValues(alpha: 0.45)),
          ),
          child: Row(
            children: [
              Icon(Icons.edit_outlined, size: 16, color: AppColors.brandBurgundy),
              const SizedBox(width: 6),
              Expanded(child: Text(label, style: AppTypography.labelLarge, textAlign: TextAlign.right)),
              Icon(icon, size: 18, color: AppColors.brandBurgundy),
            ],
          ),
        ),
      ),
    );
  }

  Widget _choiceRow(OccasionPlanItem item) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
      ),
      child: Row(
        children: [
          Icon(Icons.chevron_left, color: AppColors.textTertiary),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(item.partnerNameAr, style: AppTypography.titleSmall, textAlign: TextAlign.right),
                Text(item.summaryAr, style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary), textAlign: TextAlign.right),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text(
                      item.priceKnown
                          ? CatalogPrice.text(known: true, halalas: item.priceHalalas)
                          : 'بانتظار عرض',
                      style: AppTypography.labelLarge.copyWith(color: AppColors.brandBurgundy),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF0E0),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(item.statusLabelAr, style: AppTypography.labelSmall),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          CircleAvatar(
            radius: 26,
            backgroundColor: AppColors.primaryLight,
            backgroundImage: item.imageUrl != null ? NetworkImage(item.imageUrl!) : null,
            child: item.imageUrl == null ? Icon(Icons.celebration_outlined, color: AppColors.brandBurgundy) : null,
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime d) => '${d.day} ${_monthAr(d.month)} ${d.year}';

  String _monthAr(int m) {
    const names = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return names[m];
  }

  Future<void> _editGuests() async {
    final controller = TextEditingController(text: '$_guests');
    final value = await showDialog<int>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('عدد الضيفات'),
        content: TextField(controller: controller, keyboardType: TextInputType.number, textAlign: TextAlign.right),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, int.tryParse(controller.text.trim())),
            child: const Text('حفظ'),
          ),
        ],
      ),
    );
    if (value != null && value > 0) setState(() => _guests = value);
  }

  Future<void> _editDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2026, 1, 1),
      lastDate: DateTime(2028, 12, 31),
    );
    if (picked != null) setState(() => _date = picked);
  }
}

/// Convenience: add a published service into «مناسبتي».
void addServiceToMyOccasion(CatalogService service, {String? summaryAr, String statusLabelAr = 'لم يُرسل الطلب'}) {
  OccasionPlan.instance.upsert(
    OccasionPlanItem(
      serviceId: service.id,
      partnerId: service.partnerId,
      partnerNameAr: service.partnerNameAr,
      summaryAr: summaryAr ?? service.nameAr,
      priceHalalas: service.priceHalalas,
      priceKnown: service.priceKnown,
      statusLabelAr: statusLabelAr,
      imageUrl: () {
        for (final m in service.media) {
          if (m.kind == 'image') return m.url;
        }
        return null;
      }(),
    ),
  );
}

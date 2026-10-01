import 'package:flutter/material.dart';

import '../../../../core/constants/marketplace_copy.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../data/commerce_api_client.dart';
import '../../domain/commerce_models.dart';
import '../widgets/commerce_common.dart';

class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key, required this.orderId, this.client});

  final String orderId;
  final CommerceClient? client;

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  late final CommerceClient _client = widget.client ?? ApiCommerceClient();
  CommerceOrder? _order;
  String? _error;
  bool _loading = true;
  bool _needsLogin = false;
  bool _cancelling = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!_client.signedIn) {
      setState(() {
        _needsLogin = true;
        _loading = false;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final order = await _client.getOrder(widget.orderId);
      if (!mounted) return;
      setState(() {
        _order = order;
        _loading = false;
      });
    } on CommerceAuthException {
      if (mounted) {
        setState(() {
          _needsLogin = true;
          _loading = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = commerceErrorText(error);
          _loading = false;
        });
      }
    }
  }

  Future<void> _cancel() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('إلغاء الطلب؟'),
        content: const Text('يمكن الإلغاء قبل أن يقبل المتجر الطلب فقط.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('تراجع')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('إلغاء الطلب')),
        ],
      ),
    );
    if (ok != true || _cancelling) return;
    setState(() => _cancelling = true);
    try {
      final order = await _client.cancelOrder(widget.orderId);
      if (mounted) setState(() => _order = order);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(commerceErrorText(error))));
        _load();
      }
    } finally {
      if (mounted) setState(() => _cancelling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: const MiraAppBar(pageTitle: 'تفاصيل الطلب'),
      body: SafeArea(child: _body()),
    );
  }

  Widget _body() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_needsLogin) return const CommerceLoginRequired(message: MarketplaceCopy.loginRequiredOrders);
    if (_error != null) return CommerceErrorRetry(message: _error!, onRetry: _load);
    final order = _order!;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('طلب ${order.publicNumber}', style: AppTypography.headlineSmall, textAlign: TextAlign.center),
        Text(order.partnerNameAr, style: AppTypography.titleMedium, textAlign: TextAlign.center),
        const SizedBox(height: 12),
        Wrap(
          alignment: WrapAlignment.center,
          spacing: 8,
          runSpacing: 6,
          children: [
            CommerceStatusChip(CommerceLabels.fulfillment(order.fulfillmentStatus), tone: orderTone(order.fulfillmentStatus)),
            CommerceStatusChip(CommerceLabels.paymentCollection(order.paymentCollectionStatus)),
          ],
        ),
        const SizedBox(height: 12),
        PremiumCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final item in order.items)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Text(
                    '${item.productNameAr}${item.selections.isEmpty ? '' : ' (${item.selections.map((s) => s.valueLabelAr).join('، ')})'} × ${item.quantity} = ${CommerceLabels.money(item.lineTotalHalalas)}',
                    style: AppTypography.bodyMedium,
                  ),
                ),
              const Divider(),
              Text('المجموع الفرعي: ${CommerceLabels.money(order.subtotalHalalas)}', style: AppTypography.bodyMedium),
              Text(
                order.deliveryFeeKnown ? 'التوصيل: ${CommerceLabels.money(order.deliveryFeeHalalas ?? 0)}' : 'التوصيل: غير محدد، يؤكده المتجر',
                style: AppTypography.bodyMedium,
              ),
              Text('الإجمالي: ${CommerceLabels.money(order.totalHalalas)}', style: AppTypography.titleMedium),
              Text(MarketplaceCopy.codOnly, style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary)),
            ],
          ),
        ),
        PremiumCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('التسليم', style: AppTypography.titleMedium),
              Text('${order.contactName} · ${order.contactPhone}', style: AppTypography.bodyMedium),
              Text('${order.city} · ${order.addressLine}', style: AppTypography.bodyMedium),
              if (order.notes != null && order.notes!.isNotEmpty) Text('ملاحظات: ${order.notes}', style: AppTypography.bodySmall),
              Text('أُنشئ: ${riyadhDateTimeLabel(order.createdAt)}', style: AppTypography.bodySmall),
            ],
          ),
        ),
        if (order.events.isNotEmpty)
          PremiumCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('السجل', style: AppTypography.titleMedium),
                for (final event in order.events.where((e) => e.field != 'delivery' && e.field != 'note'))
                  Text(
                    '${riyadhDateTimeLabel(event.createdAt)} · ${event.field == 'payment' ? CommerceLabels.paymentCollection(event.toStatus) : CommerceLabels.fulfillment(event.toStatus)}',
                    style: AppTypography.bodySmall,
                  ),
              ],
            ),
          ),
        if (order.customerCanCancel)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: OutlinedButton(onPressed: _cancelling ? null : _cancel, child: const Text('إلغاء الطلب')),
          ),
      ],
    );
  }
}

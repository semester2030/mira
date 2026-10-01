import 'package:flutter/material.dart';

import '../../../../core/constants/marketplace_copy.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../data/commerce_api_client.dart';
import '../../domain/commerce_models.dart';
import '../widgets/commerce_common.dart';

/// Customer orders. Shows the public number, fulfillment status and payment collection status separately.
class OrdersListScreen extends StatefulWidget {
  const OrdersListScreen({super.key, this.client});

  final CommerceClient? client;

  @override
  State<OrdersListScreen> createState() => _OrdersListScreenState();
}

class _OrdersListScreenState extends State<OrdersListScreen> {
  late final CommerceClient _client = widget.client ?? ApiCommerceClient();
  final _orders = <CommerceOrder>[];
  String? _cursor;
  String? _error;
  bool _loading = true;
  bool _loadingMore = false;
  bool _needsLogin = false;

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
      final page = await _client.listOrders();
      if (!mounted) return;
      setState(() {
        _orders
          ..clear()
          ..addAll(page.items);
        _cursor = page.nextCursor;
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

  Future<void> _more() async {
    if (_loadingMore || _cursor == null) return;
    setState(() => _loadingMore = true);
    try {
      final page = await _client.listOrders(cursor: _cursor);
      if (!mounted) return;
      setState(() {
        _orders.addAll(page.items);
        _cursor = page.nextCursor;
      });
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(commerceErrorText(error))));
      }
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: const MiraAppBar(pageTitle: 'طلباتي'),
      body: SafeArea(child: _body()),
    );
  }

  Widget _body() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_needsLogin) return const CommerceLoginRequired(message: MarketplaceCopy.loginRequiredOrders);
    if (_error != null) return CommerceErrorRetry(message: _error!, onRetry: _load);
    if (_orders.isEmpty) return Center(child: Text(MarketplaceCopy.noOrders, style: AppTypography.bodyLarge));
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final order in _orders)
            PremiumCard(
              onTap: () async {
                await Navigator.of(context).pushNamed(AppRoutes.orderDetail, arguments: order.id);
                if (mounted) _load();
              },
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('طلب ${order.publicNumber}', style: AppTypography.titleMedium),
                  Text(order.partnerNameAr, style: AppTypography.bodySmall),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      CommerceStatusChip(CommerceLabels.fulfillment(order.fulfillmentStatus), tone: orderTone(order.fulfillmentStatus)),
                      CommerceStatusChip(CommerceLabels.paymentCollection(order.paymentCollectionStatus)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'الإجمالي ${CommerceLabels.money(order.totalHalalas)}${order.deliveryFeeKnown ? '' : ' (التوصيل غير محدد)'}',
                    style: AppTypography.bodyMedium,
                  ),
                ],
              ),
            ),
          if (_cursor != null)
            TextButton(onPressed: _loadingMore ? null : _more, child: Text(_loadingMore ? 'جارٍ التحميل' : 'عرض المزيد')),
        ],
      ),
    );
  }
}

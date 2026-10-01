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

/// The customer's Mira cart. One store per cart, cash on delivery only.
class CartScreen extends StatefulWidget {
  const CartScreen({super.key, this.client});

  final CommerceClient? client;

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  late final CommerceClient _client = widget.client ?? ApiCommerceClient();
  CommerceCart? _cart;
  String? _error;
  bool _loading = true;
  bool _busy = false;
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
      _needsLogin = false;
    });
    try {
      final cart = await _client.getCart();
      if (!mounted) return;
      setState(() {
        _cart = cart;
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

  Future<void> _mutate(Future<CommerceCart> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final cart = await action();
      if (mounted) setState(() => _cart = cart);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(commerceErrorText(error))));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirmClear() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('إفراغ السلة؟'),
        content: const Text('ستُحذف كل المنتجات من السلة.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text(MarketplaceCopy.cancel)),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('إفراغ')),
        ],
      ),
    );
    if (ok == true) await _mutate(_client.clearCart);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: const MiraAppBar(pageTitle: 'السلة'),
      body: SafeArea(child: _body()),
    );
  }

  Widget _body() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_needsLogin) return const CommerceLoginRequired(message: MarketplaceCopy.loginRequiredCart);
    if (_error != null) return CommerceErrorRetry(message: _error!, onRetry: _load);
    final cart = _cart ?? CommerceCart.empty;
    if (cart.isEmpty) {
      return Center(child: Text(MarketplaceCopy.emptyCart, style: AppTypography.bodyLarge));
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (cart.partnerNameAr != null)
          Text('من ${cart.partnerNameAr}', style: AppTypography.titleMedium, textAlign: TextAlign.center),
        const SizedBox(height: 8),
        for (final line in cart.items) _line(line),
        const SizedBox(height: 12),
        PremiumCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _sumRow('المجموع الفرعي', CommerceLabels.money(cart.subtotalHalalas)),
              _sumRow('التوصيل', cart.deliveryFeeKnown ? CommerceLabels.money(cart.deliveryFeeHalalas ?? 0) : 'غير محدد'),
              if (!cart.deliveryFeeKnown)
                Text(MarketplaceCopy.deliveryFeeUnknown, style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary)),
              const Divider(),
              _sumRow('الإجمالي', CommerceLabels.money(cart.totalHalalas), bold: true),
              const SizedBox(height: 6),
              Text(MarketplaceCopy.codOnly, style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary)),
            ],
          ),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: cart.canCheckout && !_busy
              ? () async {
                  await Navigator.of(context).pushNamed(AppRoutes.checkout);
                  if (mounted) _load();
                }
              : null,
          child: const Text('متابعة إلى إتمام الطلب'),
        ),
        if (!cart.canCheckout)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              'عالجي المشاكل الظاهرة على المنتجات قبل المتابعة.',
              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
          ),
        TextButton(onPressed: _busy ? null : _confirmClear, child: const Text('إفراغ السلة')),
      ],
    );
  }

  Widget _sumRow(String label, String value, {bool bold = false}) {
    final style = bold ? AppTypography.titleMedium : AppTypography.bodyMedium;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [Text(label, style: style), Text(value, style: style)],
      ),
    );
  }

  Widget _line(CommerceCartLine line) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: PremiumCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(line.nameAr, style: AppTypography.titleMedium),
            if (line.selections.isNotEmpty)
              Text(line.selections.map((item) => item.label).join('، '), style: AppTypography.bodySmall),
            const SizedBox(height: 4),
            Text(
              line.unitPriceHalalas == null ? 'السعر غير متاح' : '${CommerceLabels.money(line.unitPriceHalalas!)} للوحدة',
              style: AppTypography.bodyMedium,
            ),
            for (final issue in line.issues)
              Text(issue.messageAr, style: AppTypography.bodySmall.copyWith(color: Colors.red.shade700)),
            Row(
              children: [
                IconButton(
                  tooltip: 'إنقاص',
                  onPressed: _busy || line.quantity <= 1 ? null : () => _mutate(() => _client.updateCartItem(line.id, line.quantity - 1)),
                  icon: const Icon(Icons.remove_circle_outline),
                ),
                Text('${line.quantity}', style: AppTypography.titleMedium),
                IconButton(
                  tooltip: 'زيادة',
                  onPressed: _busy ? null : () => _mutate(() => _client.updateCartItem(line.id, line.quantity + 1)),
                  icon: const Icon(Icons.add_circle_outline),
                ),
                const Spacer(),
                if (line.lineTotalHalalas != null) Text(CommerceLabels.money(line.lineTotalHalalas!), style: AppTypography.titleMedium),
                IconButton(
                  tooltip: 'حذف',
                  onPressed: _busy ? null : () => _mutate(() => _client.removeCartItem(line.id)),
                  icon: const Icon(Icons.delete_outline),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

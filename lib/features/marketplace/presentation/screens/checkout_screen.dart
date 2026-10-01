import 'package:flutter/material.dart';

import '../../../../core/constants/marketplace_copy.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/utils/saudi_phone.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../data/commerce_api_client.dart';
import '../../domain/commerce_models.dart';
import '../widgets/commerce_common.dart';

/// COD checkout. Blocks confirm when delivery fee is unknown (no fake final total).
class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key, this.client});

  final CommerceClient? client;

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  late final CommerceClient _client = widget.client ?? ApiCommerceClient();
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _city = TextEditingController(text: 'الرياض');
  final _address = TextEditingController();
  final _notes = TextEditingController();

  CommerceQuote? _quote;
  String? _loadError;
  String? _submitError;
  bool _loading = true;
  bool _submitting = false;
  bool _needsLogin = false;
  String? _idempotencyKey;
  String? _keySignature;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _city.dispose();
    _address.dispose();
    _notes.dispose();
    super.dispose();
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
      _loadError = null;
      _needsLogin = false;
    });
    try {
      final quote = await _client.quote();
      if (!mounted) return;
      setState(() {
        _quote = quote;
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
          _loadError = commerceErrorText(error);
          _loading = false;
        });
      }
    }
  }

  CommerceDelivery _delivery(String phoneE164) => CommerceDelivery(
        contactName: _name.text.trim(),
        contactPhone: phoneE164,
        addressLine: _address.text.trim(),
        city: _city.text.trim(),
        notes: _notes.text,
      );

  Future<void> _confirm() async {
    if (_submitting) return;
    if (!_form.currentState!.validate()) return;
    final quote = _quote;
    if (quote == null) return;
    final fingerprint = quote.confirmationFingerprint;
    if (!quote.canConfirmOrder || !quote.cart.deliveryFeeKnown || fingerprint == null || fingerprint.isEmpty) {
      setState(() => _submitError = MarketplaceCopy.deliveryFeeUnknown);
      return;
    }
    final phone = SaudiPhone.toE164(_phone.text);
    if (phone == null) return;
    final delivery = _delivery(phone);
    final signature = '${delivery.toJson()}|$fingerprint';
    if (_idempotencyKey == null || _keySignature != signature) {
      _idempotencyKey = newIdempotencyKey();
      _keySignature = signature;
    }
    setState(() {
      _submitting = true;
      _submitError = null;
    });
    try {
      final result = await _client.createOrder(
        idempotencyKey: _idempotencyKey!,
        delivery: delivery,
        confirmationFingerprint: fingerprint,
      );
      _idempotencyKey = null;
      _keySignature = null;
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text(MarketplaceCopy.orderRequested)));
      await Navigator.of(context).pushReplacementNamed(AppRoutes.orderDetail, arguments: result.order.id);
    } on CommerceAuthException {
      if (mounted) setState(() => _needsLogin = true);
    } on CommerceApiException catch (error) {
      if (!mounted) return;
      setState(() => _submitError = error.messageAr);
      if (error.isIdempotencyAmbiguous || error.isIdempotencyConflict) {
        // Do not mint a new key or start a second create — send the customer to their orders.
        _idempotencyKey = null;
        _keySignature = null;
        await Navigator.of(context).pushReplacementNamed(AppRoutes.myOrders);
        return;
      }
      if (error.isQuoteStale ||
          error.isDeliveryFeeUnknown ||
          error.code == 'OUT_OF_STOCK' ||
          error.code == 'CART_EMPTY' ||
          error.code == 'PRODUCT_UNAVAILABLE') {
        _idempotencyKey = null;
        _keySignature = null;
        _load();
      }
      // Network / unknown: keep idempotency key so a retry cannot create a second order blindly.
    } catch (error) {
      if (mounted) setState(() => _submitError = commerceErrorText(error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String? _required(String? value, String message) => (value == null || value.trim().length < 2) ? message : null;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: const MiraAppBar(pageTitle: 'إتمام الطلب'),
      body: SafeArea(child: _body()),
    );
  }

  Widget _body() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_needsLogin) return const CommerceLoginRequired(message: MarketplaceCopy.loginRequiredCheckout);
    if (_loadError != null) return CommerceErrorRetry(message: _loadError!, onRetry: _load);
    final quote = _quote!;
    final cart = quote.cart;
    final canConfirm = quote.canConfirmOrder && cart.canCheckout && cart.deliveryFeeKnown;
    return Form(
      key: _form,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          PremiumCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(cart.partnerNameAr == null ? 'ملخص الطلب' : 'طلب من ${cart.partnerNameAr}', style: AppTypography.titleMedium),
                const SizedBox(height: 6),
                for (final line in cart.items)
                  Text(
                    '${line.nameAr}${line.selections.isEmpty ? '' : ' (${line.selections.map((s) => s.valueLabelAr).join('، ')})'} × ${line.quantity}',
                    style: AppTypography.bodyMedium,
                  ),
                const Divider(),
                Text('المجموع الفرعي: ${CommerceLabels.money(cart.subtotalHalalas)}', style: AppTypography.bodyMedium),
                Text(
                  cart.deliveryFeeKnown ? 'التوصيل: ${CommerceLabels.money(cart.deliveryFeeHalalas ?? 0)}' : 'التوصيل: غير محدد',
                  style: AppTypography.bodyMedium,
                ),
                if (cart.deliveryFeeKnown)
                  Text(
                    'المبلغ عند الاستلام: ${CommerceLabels.money(cart.totalHalalas)}',
                    style: AppTypography.titleMedium,
                  )
                else
                  Text(
                    quote.deliveryFeeNoteAr ?? MarketplaceCopy.deliveryFeeUnknown,
                    style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                  ),
                const SizedBox(height: 6),
                Text(quote.paymentNoteAr ?? MarketplaceCopy.codOnly, style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _name,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(labelText: 'الاسم'),
            validator: (value) => _required(value, 'الاسم مطلوب'),
          ),
          TextFormField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(labelText: 'رقم الجوال', hintText: '05xxxxxxxx'),
            validator: (value) => SaudiPhone.validateMessage(value ?? ''),
          ),
          TextFormField(
            controller: _city,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(labelText: 'المدينة'),
            validator: (value) => _required(value, 'المدينة مطلوبة'),
          ),
          TextFormField(
            controller: _address,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(labelText: 'العنوان (الحي والشارع)'),
            validator: (value) => (value == null || value.trim().length < 5) ? 'العنوان مطلوب' : null,
          ),
          TextFormField(
            controller: _notes,
            decoration: const InputDecoration(labelText: 'ملاحظات (اختياري)'),
            maxLength: 500,
          ),
          if (_submitError != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(_submitError!, style: AppTypography.bodyMedium.copyWith(color: Colors.red.shade700)),
            ),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: _submitting || !canConfirm ? null : _confirm,
            child: Text(_submitting ? 'جارٍ إرسال الطلب' : 'تأكيد الطلب (الدفع عند الاستلام)'),
          ),
        ],
      ),
    );
  }
}

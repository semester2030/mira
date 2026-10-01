/// Cart, COD order and service booking shapes returned by `/marketplace/commerce/*`.
/// Money is integer halalas. The server is the source of truth for price, stock and status.

int _int(Object? value, [int fallback = 0]) => value is num ? value.toInt() : fallback;
int? _intOrNull(Object? value) => value is num ? value.toInt() : null;
String _str(Object? value, [String fallback = '']) => value is String ? value : fallback;
Map<String, dynamic> _map(Object? value) => value is Map ? Map<String, dynamic>.from(value) : const {};

class CommerceIssue {
  const CommerceIssue({required this.code, required this.messageAr});

  final String code;
  final String messageAr;

  factory CommerceIssue.fromJson(Map<String, dynamic> json) =>
      CommerceIssue(code: _str(json['code']), messageAr: _str(json['messageAr']));
}

class CommerceSelection {
  const CommerceSelection({required this.groupLabelAr, required this.valueLabelAr});

  final String groupLabelAr;
  final String valueLabelAr;

  factory CommerceSelection.fromJson(Map<String, dynamic> json) => CommerceSelection(
        groupLabelAr: _str(json['groupLabelAr']),
        valueLabelAr: _str(json['valueLabelAr']),
      );

  String get label => '$groupLabelAr: $valueLabelAr';
}

class CommerceCartLine {
  const CommerceCartLine({
    required this.id,
    required this.productId,
    required this.nameAr,
    required this.quantity,
    required this.selections,
    required this.issues,
    this.unitPriceHalalas,
    this.lineTotalHalalas,
    this.availableQty,
  });

  final String id;
  final String productId;
  final String nameAr;
  final int quantity;
  final List<CommerceSelection> selections;
  final List<CommerceIssue> issues;
  final int? unitPriceHalalas;
  final int? lineTotalHalalas;
  final int? availableQty;

  factory CommerceCartLine.fromJson(Map<String, dynamic> json) => CommerceCartLine(
        id: _str(json['id']),
        productId: _str(json['productId']),
        nameAr: _str(json['nameAr']),
        quantity: _int(json['quantity'], 1),
        unitPriceHalalas: _intOrNull(json['unitPriceHalalas']),
        lineTotalHalalas: _intOrNull(json['lineTotalHalalas']),
        availableQty: _intOrNull(json['availableQty']),
        selections: [for (final item in (json['selections'] as List? ?? const [])) if (item is Map) CommerceSelection.fromJson(_map(item))],
        issues: [for (final item in (json['issues'] as List? ?? const [])) if (item is Map) CommerceIssue.fromJson(_map(item))],
      );
}

class CommerceCart {
  const CommerceCart({
    required this.items,
    required this.subtotalHalalas,
    required this.deliveryFeeKnown,
    required this.totalHalalas,
    required this.canCheckout,
    required this.issues,
    this.partnerId,
    this.partnerNameAr,
    this.deliveryFeeHalalas,
  });

  static const empty = CommerceCart(
    items: [],
    subtotalHalalas: 0,
    deliveryFeeKnown: false,
    totalHalalas: 0,
    canCheckout: false,
    issues: [],
  );

  final String? partnerId;
  final String? partnerNameAr;
  final List<CommerceCartLine> items;
  final int subtotalHalalas;
  final int? deliveryFeeHalalas;
  final bool deliveryFeeKnown;
  final int totalHalalas;
  final bool canCheckout;
  final List<CommerceIssue> issues;

  bool get isEmpty => items.isEmpty;

  factory CommerceCart.fromJson(Map<String, dynamic> json) => CommerceCart(
        partnerId: json['partnerId'] as String?,
        partnerNameAr: json['partnerNameAr'] as String?,
        items: [for (final item in (json['items'] as List? ?? const [])) if (item is Map) CommerceCartLine.fromJson(_map(item))],
        subtotalHalalas: _int(json['subtotalHalalas']),
        deliveryFeeHalalas: _intOrNull(json['deliveryFeeHalalas']),
        deliveryFeeKnown: json['deliveryFeeKnown'] == true,
        totalHalalas: _int(json['totalHalalas']),
        canCheckout: json['canCheckout'] == true,
        issues: [for (final item in (json['issues'] as List? ?? const [])) if (item is Map) CommerceIssue.fromJson(_map(item))],
      );
}

class CommerceQuote {
  const CommerceQuote({
    required this.cart,
    required this.canConfirmOrder,
    this.confirmationFingerprint,
    this.deliveryFeeNoteAr,
    this.paymentNoteAr,
  });

  final CommerceCart cart;
  /// False when delivery fee is unknown — no final COD total / order confirm.
  final bool canConfirmOrder;
  /// Server hash of the priced cart the customer reviewed. Required to place the order.
  final String? confirmationFingerprint;
  final String? deliveryFeeNoteAr;
  final String? paymentNoteAr;

  factory CommerceQuote.fromJson(Map<String, dynamic> json) {
    final cart = CommerceCart.fromJson(json);
    final canConfirm = json['canConfirmOrder'] == true || (cart.deliveryFeeKnown && cart.canCheckout);
    final fingerprint = json['confirmationFingerprint'] as String?;
    return CommerceQuote(
      cart: cart,
      canConfirmOrder: canConfirm && fingerprint != null && fingerprint.isNotEmpty,
      confirmationFingerprint: fingerprint,
      deliveryFeeNoteAr: json['deliveryFeeNoteAr'] as String?,
      paymentNoteAr: json['paymentNoteAr'] as String?,
    );
  }
}

/// Delivery and contact details typed by the customer at checkout.
class CommerceDelivery {
  const CommerceDelivery({
    required this.contactName,
    required this.contactPhone,
    required this.addressLine,
    required this.city,
    this.notes,
  });

  final String contactName;
  final String contactPhone;
  final String addressLine;
  final String city;
  final String? notes;

  Map<String, dynamic> toJson() => {
        'contactName': contactName,
        'contactPhone': contactPhone,
        'addressLine': addressLine,
        'city': city,
        if (notes != null && notes!.trim().isNotEmpty) 'notes': notes!.trim(),
      };
}

class CommerceOrderItem {
  const CommerceOrderItem({
    required this.productNameAr,
    required this.quantity,
    required this.unitPriceHalalas,
    required this.lineTotalHalalas,
    required this.selections,
  });

  final String productNameAr;
  final int quantity;
  final int unitPriceHalalas;
  final int lineTotalHalalas;
  final List<CommerceSelection> selections;

  factory CommerceOrderItem.fromJson(Map<String, dynamic> json) => CommerceOrderItem(
        productNameAr: _str(json['productNameAr']),
        quantity: _int(json['quantity'], 1),
        unitPriceHalalas: _int(json['unitPriceHalalas']),
        lineTotalHalalas: _int(json['lineTotalHalalas']),
        selections: [for (final item in (json['selections'] as List? ?? const [])) if (item is Map) CommerceSelection.fromJson(_map(item))],
      );
}

class CommerceEvent {
  const CommerceEvent({required this.field, required this.toStatus, required this.createdAt, this.note});

  final String? field;
  final String toStatus;
  final DateTime? createdAt;
  final String? note;

  factory CommerceEvent.fromJson(Map<String, dynamic> json) => CommerceEvent(
        field: json['field'] as String?,
        toStatus: _str(json['toStatus']),
        createdAt: DateTime.tryParse(_str(json['createdAt'])),
        note: json['note'] as String?,
      );
}

class CommerceOrder {
  const CommerceOrder({
    required this.id,
    required this.publicNumber,
    required this.partnerNameAr,
    required this.fulfillmentStatus,
    required this.deliveryStatus,
    required this.paymentCollectionStatus,
    required this.subtotalHalalas,
    required this.deliveryFeeKnown,
    required this.totalHalalas,
    required this.contactName,
    required this.contactPhone,
    required this.addressLine,
    required this.city,
    required this.items,
    required this.events,
    this.deliveryFeeHalalas,
    this.notes,
    this.createdAt,
  });

  final String id;
  final String publicNumber;
  final String partnerNameAr;
  final String fulfillmentStatus;
  final String deliveryStatus;
  final String paymentCollectionStatus;
  final int subtotalHalalas;
  final int? deliveryFeeHalalas;
  final bool deliveryFeeKnown;
  final int totalHalalas;
  final String contactName;
  final String contactPhone;
  final String addressLine;
  final String city;
  final String? notes;
  final DateTime? createdAt;
  final List<CommerceOrderItem> items;
  final List<CommerceEvent> events;

  /// The customer may cancel only before the partner accepts.
  bool get customerCanCancel => fulfillmentStatus == 'new';

  factory CommerceOrder.fromJson(Map<String, dynamic> json) => CommerceOrder(
        id: _str(json['id']),
        publicNumber: _str(json['publicNumber']),
        partnerNameAr: _str(_map(json['partner'])['nameAr']),
        fulfillmentStatus: _str(json['fulfillmentStatus']),
        deliveryStatus: _str(json['deliveryStatus']),
        paymentCollectionStatus: _str(json['paymentCollectionStatus']),
        subtotalHalalas: _int(json['subtotalHalalas']),
        deliveryFeeHalalas: _intOrNull(json['deliveryFeeHalalas']),
        deliveryFeeKnown: json['deliveryFeeKnown'] == true,
        totalHalalas: _int(json['totalHalalas']),
        contactName: _str(json['contactName']),
        contactPhone: _str(json['contactPhone']),
        addressLine: _str(json['addressLine']),
        city: _str(json['city']),
        notes: json['notes'] as String?,
        createdAt: DateTime.tryParse(_str(json['createdAt'])),
        items: [for (final item in (json['items'] as List? ?? const [])) if (item is Map) CommerceOrderItem.fromJson(_map(item))],
        events: [for (final item in (json['events'] as List? ?? const [])) if (item is Map) CommerceEvent.fromJson(_map(item))],
      );
}

class CommercePage<T> {
  const CommercePage({required this.items, this.nextCursor});

  final List<T> items;
  final String? nextCursor;
}

class CommerceOrderResult {
  const CommerceOrderResult({required this.order, required this.idempotentReplay});

  final CommerceOrder order;
  final bool idempotentReplay;
}

class CommerceSlot {
  const CommerceSlot({
    required this.startsAt,
    required this.endsAt,
    required this.remaining,
    required this.available,
    this.resourceId = '',
  });

  final DateTime startsAt;
  final DateTime endsAt;
  final int remaining;
  final bool available;
  final String resourceId;

  static CommerceSlot? tryParse(Map<String, dynamic> json) {
    final start = DateTime.tryParse(_str(json['startsAt']));
    final end = DateTime.tryParse(_str(json['endsAt']));
    if (start == null || end == null) return null;
    return CommerceSlot(
      startsAt: start,
      endsAt: end,
      remaining: _int(json['remaining']),
      available: json['available'] == true,
      resourceId: _str(json['resourceId']),
    );
  }
}

class CommerceAvailability {
  const CommerceAvailability({
    required this.serviceId,
    required this.date,
    required this.durationMin,
    required this.priceHalalas,
    required this.payMode,
    required this.slots,
  });

  final String serviceId;
  final String date;
  final int durationMin;
  final int priceHalalas;
  final String payMode;
  final List<CommerceSlot> slots;

  factory CommerceAvailability.fromJson(Map<String, dynamic> json) => CommerceAvailability(
        serviceId: _str(json['serviceId']),
        date: _str(json['date']),
        durationMin: _int(json['durationMin']),
        priceHalalas: _int(json['priceHalalas']),
        payMode: _str(json['payMode'], 'pay_at_venue'),
        slots: (json['slots'] as List? ?? const [])
            .whereType<Map>()
            .map((item) => CommerceSlot.tryParse(_map(item)))
            .whereType<CommerceSlot>()
            .toList(),
      );
}

class CommerceBooking {
  const CommerceBooking({
    required this.id,
    required this.publicNumber,
    required this.partnerNameAr,
    required this.serviceId,
    required this.serviceNameAr,
    required this.branchLabel,
    required this.startsAt,
    required this.endsAt,
    required this.durationMin,
    required this.priceHalalas,
    required this.payMode,
    required this.status,
    required this.contactName,
    required this.contactPhone,
    this.notes,
  });

  final String id;
  final String publicNumber;
  final String partnerNameAr;
  final String serviceId;
  final String serviceNameAr;
  final String branchLabel;
  final DateTime startsAt;
  final DateTime endsAt;
  final int durationMin;
  final int priceHalalas;
  final String payMode;
  final String status;
  final String contactName;
  final String contactPhone;
  final String? notes;

  bool get customerCanCancel => status == 'requested' || status == 'confirmed';

  factory CommerceBooking.fromJson(Map<String, dynamic> json) => CommerceBooking(
        id: _str(json['id']),
        publicNumber: _str(json['publicNumber']),
        partnerNameAr: _str(_map(json['partner'])['nameAr']),
        serviceId: _str(json['serviceId']),
        serviceNameAr: _str(json['serviceNameAr']),
        branchLabel: _str(json['branchLabel']),
        startsAt: DateTime.tryParse(_str(json['startsAt'])) ?? DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
        endsAt: DateTime.tryParse(_str(json['endsAt'])) ?? DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
        durationMin: _int(json['durationMin']),
        priceHalalas: _int(json['priceHalalas']),
        payMode: _str(json['payMode'], 'pay_at_venue'),
        status: _str(json['status']),
        contactName: _str(json['contactName']),
        contactPhone: _str(json['contactPhone']),
        notes: json['notes'] as String?,
      );
}

class CommerceBookingResult {
  const CommerceBookingResult({required this.booking, required this.idempotentReplay});

  final CommerceBooking booking;
  final bool idempotentReplay;
}

/// Arabic labels for server statuses. Fulfillment and payment collection stay separate;
/// a booking `requested` is never described as confirmed.
abstract final class CommerceLabels {
  static String fulfillment(String status) => switch (status) {
        'new' => 'جديد بانتظار قبول المتجر',
        'accepted' => 'قبل المتجر الطلب',
        'preparing' => 'قيد التجهيز',
        'out_for_delivery' => 'في الطريق إليكِ',
        'delivered' => 'تم التسليم',
        'rejected' => 'رفضه المتجر',
        'cancelled' => 'ملغي',
        'failed_delivery' => 'تعذر التسليم',
        _ => status,
      };

  static String paymentCollection(String status) => switch (status) {
        'uncollected' => 'الدفع نقدًا عند الاستلام (لم يُحصَّل بعد)',
        'collected' => 'حُصِّل الدفع نقدًا',
        'waived' => 'أُعفي من الدفع',
        _ => status,
      };

  static String booking(String status) => switch (status) {
        'requested' => 'طلب موعد بانتظار تأكيد الجهة (غير مؤكد)',
        'confirmed' => 'موعد مؤكد من الجهة',
        'completed' => 'مكتمل',
        'cancelled' => 'ملغي',
        'rejected' => 'رفضته الجهة',
        _ => status,
      };

  static String money(int halalas) {
    final riyals = halalas / 100;
    final text = halalas % 100 == 0 ? riyals.toStringAsFixed(0) : riyals.toStringAsFixed(2);
    return '$text ر.س';
  }
}

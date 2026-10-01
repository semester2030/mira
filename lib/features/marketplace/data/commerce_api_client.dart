import 'dart:math';

import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/mira_api_endpoints.dart';
import '../domain/commerce_models.dart';

/// The customer is not signed in, or the token was refused.
class CommerceAuthException implements Exception {
  const CommerceAuthException();
}

/// A coded Arabic error from `/marketplace/commerce/*`. [messageAr] is safe to show.
class CommerceApiException implements Exception {
  const CommerceApiException({
    required this.code,
    required this.messageAr,
    this.status,
    this.details = const {},
  });

  static const partnerConflict = 'CART_PARTNER_CONFLICT';
  static const deliveryFeeUnknown = 'DELIVERY_FEE_UNKNOWN';
  static const network = 'NETWORK';

  final String code;
  final String messageAr;
  final int? status;
  final Map<String, dynamic> details;

  bool get isPartnerConflict => code == partnerConflict;
  bool get isDeliveryFeeUnknown => code == deliveryFeeUnknown;

  @override
  String toString() => 'CommerceApiException($code, $status)';
}

/// One UUID per confirm session. Reusing it after a network failure lets the server replay the same order.
String newIdempotencyKey() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

/// Cart, COD orders and service bookings for the signed-in Mira account.
abstract class CommerceClient {
  bool get signedIn;

  Future<CommerceCart> getCart();
  Future<CommerceCart> addCartItem({
    required String productId,
    int quantity = 1,
    Map<String, String> selections = const {},
    String? variantKey,
  });
  Future<CommerceCart> updateCartItem(String itemId, int quantity);
  Future<CommerceCart> removeCartItem(String itemId);
  Future<CommerceCart> clearCart();
  Future<CommerceQuote> quote();
  Future<CommerceOrderResult> createOrder({
    required String idempotencyKey,
    required CommerceDelivery delivery,
    bool acknowledgeUnknownDeliveryFee = false,
  });
  Future<CommercePage<CommerceOrder>> listOrders({String? cursor});
  Future<CommerceOrder> getOrder(String id);
  Future<CommerceOrder> cancelOrder(String id, {String? note});

  Future<CommerceAvailability> availability(String serviceId, String date);
  Future<CommerceBookingResult> createBooking({
    required String idempotencyKey,
    required String serviceId,
    required DateTime startsAt,
    required String contactName,
    required String contactPhone,
    String? notes,
  });
  Future<CommercePage<CommerceBooking>> listBookings({String? cursor});
  Future<CommerceBooking> getBooking(String id);
  Future<CommerceBooking> cancelBooking(String id, {String? note});
}

/// Dio client that reuses the shared [ApiClient] (Firebase ID token in `Authorization`), like favorites.
class ApiCommerceClient implements CommerceClient {
  ApiCommerceClient({Dio? dio, bool Function()? signedIn}) : _dioOverride = dio, _signedIn = signedIn;

  final Dio? _dioOverride;
  final bool Function()? _signedIn;

  Dio get _dio => _dioOverride ?? ApiClient.instance;

  static const _base = MiraApiEndpoints.marketplaceCommerce;

  @override
  bool get signedIn {
    final override = _signedIn;
    if (override != null) return override();
    try {
      return Firebase.apps.isNotEmpty && FirebaseAuth.instance.currentUser != null;
    } catch (_) {
      return false;
    }
  }

  Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Object? data,
    Map<String, dynamic>? query,
    Map<String, dynamic>? headers,
  }) async {
    if (!signedIn) throw const CommerceAuthException();
    try {
      final response = await _dio.request<Map<String, dynamic>>(
        '$_base$path',
        data: data,
        queryParameters: query,
        options: Options(method: method, headers: headers),
      );
      return response.data ?? const <String, dynamic>{};
    } on DioException catch (error) {
      throw _map(error);
    }
  }

  static Object _map(DioException error) {
    final status = error.response?.statusCode;
    if (status == 401) return const CommerceAuthException();
    final body = error.response?.data;
    if (body is Map) {
      final details = body['details'];
      final message = body['messageAr'] ?? body['message'];
      return CommerceApiException(
        status: status,
        code: body['code'] is String ? body['code'] as String : 'HTTP_${status ?? 0}',
        messageAr: message is String && message.trim().isNotEmpty ? message : 'تعذر إكمال الطلب. حاولي مرة أخرى.',
        details: details is Map ? Map<String, dynamic>.from(details) : const {},
      );
    }
    return const CommerceApiException(
      code: CommerceApiException.network,
      messageAr: 'تعذر الاتصال بالخادم. تحققي من الشبكة وحاولي مرة أخرى.',
    );
  }

  @override
  Future<CommerceCart> getCart() async => CommerceCart.fromJson(await _send('GET', '/cart'));

  @override
  Future<CommerceCart> addCartItem({
    required String productId,
    int quantity = 1,
    Map<String, String> selections = const {},
    String? variantKey,
  }) async {
    final json = await _send('POST', '/cart/items', data: {
      'productId': productId,
      'quantity': quantity,
      if (selections.isNotEmpty) 'selections': selections,
      if (variantKey != null && variantKey.isNotEmpty) 'variantKey': variantKey,
    });
    return CommerceCart.fromJson(json);
  }

  @override
  Future<CommerceCart> updateCartItem(String itemId, int quantity) async =>
      CommerceCart.fromJson(await _send('PATCH', '/cart/items/$itemId', data: {'quantity': quantity}));

  @override
  Future<CommerceCart> removeCartItem(String itemId) async =>
      CommerceCart.fromJson(await _send('DELETE', '/cart/items/$itemId'));

  @override
  Future<CommerceCart> clearCart() async => CommerceCart.fromJson(await _send('DELETE', '/cart'));

  @override
  Future<CommerceQuote> quote() async => CommerceQuote.fromJson(await _send('POST', '/checkout/quote'));

  @override
  Future<CommerceOrderResult> createOrder({
    required String idempotencyKey,
    required CommerceDelivery delivery,
    bool acknowledgeUnknownDeliveryFee = false,
  }) async {
    final json = await _send(
      'POST',
      '/orders',
      headers: {'Idempotency-Key': idempotencyKey},
      data: {
        ...delivery.toJson(),
        'idempotencyKey': idempotencyKey,
        if (acknowledgeUnknownDeliveryFee) 'acknowledgeUnknownDeliveryFee': true,
      },
    );
    return CommerceOrderResult(
      order: CommerceOrder.fromJson(Map<String, dynamic>.from(json['order'] as Map)),
      idempotentReplay: json['idempotentReplay'] == true,
    );
  }

  @override
  Future<CommercePage<CommerceOrder>> listOrders({String? cursor}) async {
    final json = await _send('GET', '/orders', query: {'limit': 20, if (cursor != null) 'cursor': cursor});
    return CommercePage(
      items: [for (final item in (json['items'] as List? ?? const [])) if (item is Map) CommerceOrder.fromJson(Map<String, dynamic>.from(item))],
      nextCursor: json['nextCursor'] as String?,
    );
  }

  @override
  Future<CommerceOrder> getOrder(String id) async => CommerceOrder.fromJson(await _send('GET', '/orders/$id'));

  @override
  Future<CommerceOrder> cancelOrder(String id, {String? note}) async =>
      CommerceOrder.fromJson(await _send('POST', '/orders/$id/cancel', data: {if (note != null && note.isNotEmpty) 'note': note}));

  @override
  Future<CommerceAvailability> availability(String serviceId, String date) async {
    // Availability is public on the server, but the client keeps one auth rule for all commerce calls.
    return CommerceAvailability.fromJson(await _send('GET', '/services/$serviceId/availability', query: {'date': date}));
  }

  @override
  Future<CommerceBookingResult> createBooking({
    required String idempotencyKey,
    required String serviceId,
    required DateTime startsAt,
    required String contactName,
    required String contactPhone,
    String? notes,
  }) async {
    final json = await _send(
      'POST',
      '/bookings',
      headers: {'Idempotency-Key': idempotencyKey},
      data: {
        'idempotencyKey': idempotencyKey,
        'serviceId': serviceId,
        'startsAt': startsAt.toUtc().toIso8601String(),
        'contactName': contactName,
        'contactPhone': contactPhone,
        if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      },
    );
    return CommerceBookingResult(
      booking: CommerceBooking.fromJson(Map<String, dynamic>.from(json['booking'] as Map)),
      idempotentReplay: json['idempotentReplay'] == true,
    );
  }

  @override
  Future<CommercePage<CommerceBooking>> listBookings({String? cursor}) async {
    final json = await _send('GET', '/bookings', query: {'limit': 20, if (cursor != null) 'cursor': cursor});
    return CommercePage(
      items: [for (final item in (json['items'] as List? ?? const [])) if (item is Map) CommerceBooking.fromJson(Map<String, dynamic>.from(item))],
      nextCursor: json['nextCursor'] as String?,
    );
  }

  @override
  Future<CommerceBooking> getBooking(String id) async => CommerceBooking.fromJson(await _send('GET', '/bookings/$id'));

  @override
  Future<CommerceBooking> cancelBooking(String id, {String? note}) async =>
      CommerceBooking.fromJson(await _send('POST', '/bookings/$id/cancel', data: {if (note != null && note.isNotEmpty) 'note': note}));
}

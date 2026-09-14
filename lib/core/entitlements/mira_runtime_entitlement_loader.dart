import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../network/api_client.dart';
import '../network/mira_api_endpoints.dart';
import 'mira_runtime_entitlement.dart';
import 'mira_runtime_entitlement_store.dart';

/// Loads server entitlements. Any failure → fail-closed OFF.
abstract final class MiraRuntimeEntitlementLoader {
  MiraRuntimeEntitlementLoader._();

  static Future<MiraRuntimeEntitlement> refresh({Dio? dio}) async {
    try {
      final client = dio ?? ApiClient.instance;
      final response = await client.get<Map<String, dynamic>>(
        MiraApiEndpoints.entitlementsRuntime,
      );
      final data = response.data;
      if (data == null) {
        MiraRuntimeEntitlementStore.clear();
        return MiraRuntimeEntitlement.off;
      }
      final snap = MiraRuntimeEntitlement.fromJson(data);
      MiraRuntimeEntitlementStore.apply(snap);
      return snap;
    } catch (e, st) {
      debugPrint('MiraRuntimeEntitlementLoader: fail-closed ($e)');
      assert(() {
        debugPrint('$st');
        return true;
      }());
      MiraRuntimeEntitlementStore.clear();
      return MiraRuntimeEntitlement.off;
    }
  }
}

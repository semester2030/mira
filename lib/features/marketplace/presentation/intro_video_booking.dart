import 'package:flutter/material.dart';

import '../../../core/constants/marketplace_copy.dart';
import '../data/catalog_record_scope.dart';
import '../data/discover_availability_context.dart';
import '../data/discover_catalog_query.dart';
import '../domain/entities/catalog_service.dart';
import 'screens/booking_request_screen.dart';

/// Shared booking entry for discover video CTA and service detail.
/// Intro video → Arabic service names → selected service → branch/slot screen.
/// Service-specific video → book that service directly.
Future<void> openServiceBookingFlow({
  required BuildContext context,
  required CatalogService service,
  String? bookingDateKey,
  String? bookingBranchId,
  DiscoverAvailabilityContext? availabilityContext,
  DiscoverLane? discoverLane,
  void Function(String message)? tell,
}) async {
  void notify(String message) {
    if (tell != null) {
      tell(message);
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  if (service.id.startsWith('preview-')) {
    notify(MarketplaceCopy.previewAppointment);
    return;
  }
  if (!service.bookingEnabled && !service.isProviderIntroVideo) {
    notify(MarketplaceCopy.appointmentUnavailable);
    return;
  }

  var target = service;
  if (service.isProviderIntroVideo) {
    final options = service.linkedServices.isNotEmpty
        ? service.linkedServices
        : service.linkedServiceIds
            .map((id) => CatalogLinkedService(id: id, nameAr: null, missing: true))
            .toList();
    final bookable = options.where((o) => !o.missing && o.bookingEnabled && o.nameAr != null && o.nameAr!.trim().isNotEmpty).toList();
    if (bookable.isEmpty) {
      notify('لا توجد خدمة مرتبطة قابلة للحجز لهذا الفيديو التعريفي');
      return;
    }
    final picked = await showModalBottomSheet<CatalogLinkedService>(
      context: context,
      builder: (sheetContext) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const ListTile(title: Text('اختاري الخدمة للحجز')),
              for (final opt in bookable)
                ListTile(
                  title: Text(opt.displayNameAr),
                  onTap: () => Navigator.pop(sheetContext, opt),
                ),
            ],
          ),
        );
      },
    );
    if (picked == null) return;
    if (picked.id != service.id) {
      if (!context.mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => CatalogRecordScope.page(
            kind: 'service',
            id: picked.id,
            bookingDateKey: bookingDateKey ?? availabilityContext?.availableOn,
            bookingBranchId: bookingBranchId ?? availabilityContext?.branchId,
            availabilityContext: availabilityContext,
            discoverLane: discoverLane,
          ),
        ),
      );
      return;
    }
  }

  if (!target.bookingEnabled) {
    notify(MarketplaceCopy.appointmentUnavailable);
    return;
  }
  if (!context.mounted) return;
  await Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => BookingRequestScreen(
        service: target,
        initialDateKey: bookingDateKey ?? availabilityContext?.availableOn,
        initialBranchId: bookingBranchId ?? availabilityContext?.branchId,
        availabilityContext: availabilityContext,
        discoverLane: discoverLane,
      ),
    ),
  );
}

import 'package:geolocator/geolocator.dart';

/// Result of a one-shot foreground location request for Discover distance.
class DeviceLocationResult {
  const DeviceLocationResult._({
    required this.status,
    this.lat,
    this.lng,
    this.messageAr,
  });

  factory DeviceLocationResult.ok(double lat, double lng) =>
      DeviceLocationResult._(status: DeviceLocationStatus.ok, lat: lat, lng: lng);

  factory DeviceLocationResult.denied() => const DeviceLocationResult._(
        status: DeviceLocationStatus.denied,
        messageAr: 'رُفض إذن الموقع',
      );

  factory DeviceLocationResult.deniedForever() => const DeviceLocationResult._(
        status: DeviceLocationStatus.deniedForever,
        messageAr: 'إذن الموقع مرفوض دائمًا — يمكن تفعيله من إعدادات النظام',
      );

  factory DeviceLocationResult.disabled() => const DeviceLocationResult._(
        status: DeviceLocationStatus.disabled,
        messageAr: 'خدمات الموقع متوقفة على الجهاز',
      );

  factory DeviceLocationResult.failed(String messageAr) => DeviceLocationResult._(
        status: DeviceLocationStatus.failed,
        messageAr: messageAr,
      );

  final DeviceLocationStatus status;
  final double? lat;
  final double? lng;
  final String? messageAr;

  bool get isOk => status == DeviceLocationStatus.ok && lat != null && lng != null;
}

enum DeviceLocationStatus { ok, denied, deniedForever, disabled, failed }

/// Requests when-in-use location for distance sorting / «يبعد عنك».
Future<DeviceLocationResult> requestDeviceLocationForDistance() async {
  try {
    final serviceOn = await Geolocator.isLocationServiceEnabled();
    if (!serviceOn) return DeviceLocationResult.disabled();

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied) {
      return DeviceLocationResult.denied();
    }
    if (permission == LocationPermission.deniedForever) {
      return DeviceLocationResult.deniedForever();
    }

    final pos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.medium,
        timeLimit: Duration(seconds: 12),
      ),
    );
    return DeviceLocationResult.ok(pos.latitude, pos.longitude);
  } catch (e) {
    return DeviceLocationResult.failed('تعذّر قراءة الموقع');
  }
}

/// Stable Saudi city catalog for Discover city search / nearby search point.
/// Keep ids aligned with mira-api/src/geo/saudi-cities.json.
class SaudiCity {
  const SaudiCity({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    required this.lat,
    required this.lng,
  });

  final String id;
  final String nameAr;
  final String nameEn;
  final double lat;
  final double lng;
}

const kSaudiCities = <SaudiCity>[
  SaudiCity(id: 'sa-riyadh', nameAr: 'الرياض', nameEn: 'Riyadh', lat: 24.7136, lng: 46.6753),
  SaudiCity(id: 'sa-jeddah', nameAr: 'جدة', nameEn: 'Jeddah', lat: 21.4858, lng: 39.1925),
  SaudiCity(id: 'sa-makkah', nameAr: 'مكة المكرمة', nameEn: 'Makkah', lat: 21.3891, lng: 39.8579),
  SaudiCity(id: 'sa-madinah', nameAr: 'المدينة المنورة', nameEn: 'Madinah', lat: 24.5247, lng: 39.5692),
  SaudiCity(id: 'sa-dammam', nameAr: 'الدمام', nameEn: 'Dammam', lat: 26.4207, lng: 50.0888),
  SaudiCity(id: 'sa-khobar', nameAr: 'الخبر', nameEn: 'Khobar', lat: 26.2172, lng: 50.1971),
  SaudiCity(id: 'sa-taif', nameAr: 'الطائف', nameEn: 'Taif', lat: 21.2703, lng: 40.4158),
  SaudiCity(id: 'sa-tabuk', nameAr: 'تبوك', nameEn: 'Tabuk', lat: 28.3838, lng: 36.555),
  SaudiCity(id: 'sa-abha', nameAr: 'أبها', nameEn: 'Abha', lat: 18.2164, lng: 42.5053),
  SaudiCity(id: 'sa-khamis', nameAr: 'خميس مشيط', nameEn: 'Khamis Mushait', lat: 18.3, lng: 42.7333),
  SaudiCity(id: 'sa-najran', nameAr: 'نجران', nameEn: 'Najran', lat: 17.4924, lng: 44.1277),
  SaudiCity(id: 'sa-jazan', nameAr: 'جازان', nameEn: 'Jazan', lat: 16.8892, lng: 42.561),
  SaudiCity(id: 'sa-hail', nameAr: 'حائل', nameEn: 'Hail', lat: 27.5114, lng: 41.7208),
  SaudiCity(id: 'sa-buraidah', nameAr: 'بريدة', nameEn: 'Buraidah', lat: 26.326, lng: 43.975),
  SaudiCity(id: 'sa-jubail', nameAr: 'الجبيل', nameEn: 'Jubail', lat: 27.0046, lng: 49.646),
  SaudiCity(id: 'sa-yanbu', nameAr: 'ينبع', nameEn: 'Yanbu', lat: 24.0895, lng: 38.0618),
  SaudiCity(id: 'sa-qatif', nameAr: 'القطيف', nameEn: 'Qatif', lat: 26.565, lng: 49.994),
  SaudiCity(id: 'sa-kharj', nameAr: 'الخرج', nameEn: 'Al Kharj', lat: 24.1556, lng: 47.312),
];

List<SaudiCity> searchSaudiCities(String q) {
  final needle = q.trim().toLowerCase();
  if (needle.isEmpty) return List<SaudiCity>.from(kSaudiCities);
  return kSaudiCities
      .where(
        (c) =>
            c.nameAr.contains(needle) ||
            c.nameEn.toLowerCase().contains(needle) ||
            c.id.contains(needle),
      )
      .toList();
}

/// Occasions supported by Mira styling recommendations.
enum MiraOccasion {
  wedding,
  work,
  casual,
  university,
  evening,
  eid,
  interview;

  String get id => name;

  String get labelAr {
    switch (this) {
      case MiraOccasion.wedding:
        return 'زفاف';
      case MiraOccasion.work:
        return 'عمل';
      case MiraOccasion.casual:
        return 'كاجوال';
      case MiraOccasion.university:
        return 'جامعة';
      case MiraOccasion.evening:
        return 'سهرة';
      case MiraOccasion.eid:
        return 'عيد';
      case MiraOccasion.interview:
        return 'مقابلة';
    }
  }

  String get labelEn {
    switch (this) {
      case MiraOccasion.wedding:
        return 'Wedding';
      case MiraOccasion.work:
        return 'Work';
      case MiraOccasion.casual:
        return 'Casual';
      case MiraOccasion.university:
        return 'University';
      case MiraOccasion.evening:
        return 'Evening';
      case MiraOccasion.eid:
        return 'Eid';
      case MiraOccasion.interview:
        return 'Interview';
    }
  }

  static MiraOccasion? fromId(String? id) {
    if (id == null || id.isEmpty) return null;
    for (final o in MiraOccasion.values) {
      if (o.id == id) return o;
    }
    return null;
  }
}

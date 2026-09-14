import '../contracts/result_enums.dart';

abstract final class PersonalizationLabels {
  static String ar(PersonalizationClass c) {
    switch (c) {
      case PersonalizationClass.evidenceDerived:
        return 'بناءً على تحليلك';
      case PersonalizationClass.profileDerived:
        return 'بناءً على ملفك الشخصي';
      case PersonalizationClass.contextDerived:
        return 'بناءً على سياقك الحالي';
      case PersonalizationClass.generalEducation:
        return 'إرشاد عام';
      case PersonalizationClass.unsupported:
        return '';
    }
  }

  static String en(PersonalizationClass c) {
    switch (c) {
      case PersonalizationClass.evidenceDerived:
        return 'Based on your analysis';
      case PersonalizationClass.profileDerived:
        return 'Based on your profile';
      case PersonalizationClass.contextDerived:
        return 'Based on your current context';
      case PersonalizationClass.generalEducation:
        return 'General education';
      case PersonalizationClass.unsupported:
        return '';
    }
  }
}

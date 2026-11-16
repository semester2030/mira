import 'mira_advisor_memory_store.dart';

/// Resolves «عطيني الرابط» / «رابط الثاني» against the last assistant offer list.
class MiraOfferLinkResolver {
  MiraOfferLinkResolver._();

  static final _linkAsk = RegExp(
    r'(ال)?رابط|افتح(ي)?\s*(المنتج|البطاقة|العرض)?',
  );

  static bool asksForLink(String text) => _linkAsk.hasMatch(text.trim());

  /// 1-based index from Arabic ordinals / digits; null if unspecified.
  static int? ordinalIndex(String text) {
    final t = text.trim();
    if (RegExp(r'الأول|اول واحد|الخيار الأول|الرقم\s*1\b|\b1\b').hasMatch(t)) {
      return 1;
    }
    if (RegExp(r'الثاني|ثاني واحد|الخيار الثاني|الرقم\s*2\b|\b2\b').hasMatch(t)) {
      return 2;
    }
    if (RegExp(r'الثالث|ثالث واحد|الخيار الثالث|الرقم\s*3\b|\b3\b').hasMatch(t)) {
      return 3;
    }
    final n = RegExp(r'(?:رقم|خيار)\s*(\d)').firstMatch(t);
    if (n != null) return int.tryParse(n.group(1)!);
    return null;
  }

  static Future<MiraOfferLinkDecision> resolve(String text) async {
    if (!asksForLink(text)) {
      return const MiraOfferLinkDecision.none();
    }
    final offers = await MiraAdvisorMemoryStore.lastTurnOffers();
    if (offers.isEmpty) {
      return const MiraOfferLinkDecision.none();
    }
    final ordinal = ordinalIndex(text);
    if (offers.length == 1) {
      final o = offers.first;
      return MiraOfferLinkDecision.open(id: o.id, kind: o.kind, titleAr: o.titleAr);
    }
    if (ordinal != null) {
      if (ordinal < 1 || ordinal > offers.length) {
        return MiraOfferLinkDecision.clarify(
          'أي عرض تقصدين؟ عندي ${offers.length} خيارات — قولي الأول أو الثاني أو الثالث.',
        );
      }
      final o = offers[ordinal - 1];
      return MiraOfferLinkDecision.open(id: o.id, kind: o.kind, titleAr: o.titleAr);
    }
    final titles = [
      for (var i = 0; i < offers.length; i++) '${i + 1}) ${offers[i].titleAr}',
    ].join('\n');
    return MiraOfferLinkDecision.clarify(
      'عرضتُ أكثر من خيار. أي رابط تريدين؟\n$titles\nقولي مثلًا: عطيني رابط الثاني.',
    );
  }
}

class MiraOfferLinkDecision {
  const MiraOfferLinkDecision._({
    required this.kind,
    this.offerId,
    this.offerKind,
    this.titleAr,
    this.clarifyAr,
  });

  const MiraOfferLinkDecision.none()
      : this._(kind: MiraOfferLinkKind.none);

  factory MiraOfferLinkDecision.open({
    required String id,
    required String kind,
    required String titleAr,
  }) =>
      MiraOfferLinkDecision._(
        kind: MiraOfferLinkKind.open,
        offerId: id,
        offerKind: kind,
        titleAr: titleAr,
      );

  factory MiraOfferLinkDecision.clarify(String messageAr) =>
      MiraOfferLinkDecision._(
        kind: MiraOfferLinkKind.clarify,
        clarifyAr: messageAr,
      );

  final MiraOfferLinkKind kind;
  final String? offerId;
  final String? offerKind;
  final String? titleAr;
  final String? clarifyAr;
}

enum MiraOfferLinkKind { none, open, clarify }

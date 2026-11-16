import 'mira_advisor_memory_store.dart';

/// Resolves «عطيني الرابط» / «رابط الثاني» / bare «الثاني» (selection only).
class MiraOfferLinkResolver {
  MiraOfferLinkResolver._();

  static final _linkAsk = RegExp(
    r'(ال)?رابط|افتح(ي)?\s*(المنتج|البطاقة|العرض)?',
  );

  static bool asksForLink(String text) => _linkAsk.hasMatch(text.trim());

  /// Comparison / why questions must not open a product.
  static bool looksLikeComparisonQuestion(String text) {
    return RegExp(
      r'ليش|لماذا|أغلى|أرخص|أفضل|أقارن|مقارنة|فرق|ولا|أم|أو\s+ال',
    ).hasMatch(text.trim());
  }

  /// Bare ordinal only after a pending clarify, and only as a short selection.
  static bool isBareOrdinalSelection(String text) {
    final t = text.trim();
    if (t.isEmpty || t.length > 32) return false;
    if (asksForLink(t)) return false;
    if (looksLikeComparisonQuestion(t)) return false;
    if (ordinalIndex(t) == null) return false;
    return RegExp(
      r'^(الأول|اول|الثاني|ثاني|الثالث|ثالث)(\s+(لو\s*سمحت|من\s*فضلك|يا\s*ميرا))?[.!؟]?$',
    ).hasMatch(t);
  }

  /// Link ask, or ordinal selection while a clarify is pending.
  static Future<bool> isOfferLinkTurn(String text) async {
    if (asksForLink(text)) return true;
    if (!isBareOrdinalSelection(text)) return false;
    return MiraAdvisorMemoryStore.isAwaitingLinkOrdinal();
  }

  /// 1-based index from Arabic ordinals / digits; null if unspecified.
  static int? ordinalIndex(String text) {
    final t = text.trim();
    if (RegExp(r'الأول|اول واحد|الخيار الأول|الرقم\s*1\b').hasMatch(t)) {
      return 1;
    }
    if (RegExp(r'الثاني|ثاني واحد|الخيار الثاني|الرقم\s*2\b').hasMatch(t)) {
      return 2;
    }
    if (RegExp(r'الثالث|ثالث واحد|الخيار الثالث|الرقم\s*3\b').hasMatch(t)) {
      return 3;
    }
    final n = RegExp(r'(?:رقم|خيار)\s*(\d)').firstMatch(t);
    if (n != null) return int.tryParse(n.group(1)!);
    return null;
  }

  static Future<MiraOfferLinkDecision> resolve(String text) async {
    if (!await isOfferLinkTurn(text)) {
      return const MiraOfferLinkDecision.none();
    }
    final offers = await MiraAdvisorMemoryStore.lastTurnOffers();
    if (offers.isEmpty) {
      await MiraAdvisorMemoryStore.setAwaitingLinkOrdinal(false);
      return MiraOfferLinkDecision.clarify(
        'ما عندي عرض محفوظ من هذه المحادثة لفتح رابطه. اطلبي ترشيحًا من ميرا أولًا.',
      );
    }

    final ordinal = ordinalIndex(text);

    if (ordinal != null) {
      if (ordinal < 1 || ordinal > offers.length) {
        await MiraAdvisorMemoryStore.setAwaitingLinkOrdinal(true);
        return MiraOfferLinkDecision.clarify(
          offers.length == 1
              ? 'عندي خيار واحد فقط في هذه التوصية. هل تقصدين رابطه؟ قولي «عطيني الرابط».'
              : 'ما عندي خيار رقم $ordinal. عندي ${offers.length} خيارات — قولي الأول أو الثاني${offers.length >= 3 ? ' أو الثالث' : ''}.',
        );
      }
      final o = offers[ordinal - 1];
      if (o.liveStatus == 'withdrawn') {
        await MiraAdvisorMemoryStore.setAwaitingLinkOrdinal(false);
        return MiraOfferLinkDecision.clarify(
          '«${o.titleAr}» لم يعد منشورًا في الكتالوج — لن أفتح شراء أو حجزًا له. أطلب بحثًا جديدًا إن رغبتِ.',
        );
      }
      await MiraAdvisorMemoryStore.setAwaitingLinkOrdinal(false);
      return MiraOfferLinkDecision.open(id: o.id, kind: o.kind, titleAr: o.titleAr);
    }

    if (offers.length == 1) {
      final o = offers.first;
      if (o.liveStatus == 'withdrawn') {
        await MiraAdvisorMemoryStore.setAwaitingLinkOrdinal(false);
        return MiraOfferLinkDecision.clarify(
          'هذا العرض سُحب من الكتالوج ولم يعد متاحًا للطلب.',
        );
      }
      await MiraAdvisorMemoryStore.setAwaitingLinkOrdinal(false);
      return MiraOfferLinkDecision.open(id: o.id, kind: o.kind, titleAr: o.titleAr);
    }

    await MiraAdvisorMemoryStore.setAwaitingLinkOrdinal(true);
    final titles = [
      for (var i = 0; i < offers.length; i++) '${i + 1}) ${offers[i].titleAr}',
    ].join('\n');
    return MiraOfferLinkDecision.clarify(
      'عرضتُ أكثر من خيار. أي رابط تريدين؟\n$titles\nقولي مثلًا: الثاني.',
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

  const MiraOfferLinkDecision.none() : this._(kind: MiraOfferLinkKind.none);

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

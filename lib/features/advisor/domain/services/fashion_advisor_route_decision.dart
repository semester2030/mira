/// AT-3 — Client route decision by product context (not NLP recreation).
enum FashionAdvisorClientRoute {
  /// POST /advisor/chat with fashion context
  advisorFashionChat,

  /// Existing MCE consultation SSE
  mceConsultation,

  /// Fashion advice unavailable (flag OFF / Option A safe surface)
  fashionUnavailable,
}

abstract final class FashionAdvisorRouteDecision {
  /// Outfit/atelier-with-outfit focus is fashion-capable product context.
  /// Skin-only and atelier-without-outfit stay on MCE (or atelier MCE).
  static FashionAdvisorClientRoute decide({
    required bool fashionAdvisorV1Enabled,
    required bool outfitContextPresent,
    required bool fashionConversationSticky,
    required bool isSkinOnlyFocus,
    required bool isAtelierFocus,
  }) {
    // Skin / beauty consultation must remain on MCE.
    if (isSkinOnlyFocus && !outfitContextPresent && !fashionConversationSticky) {
      return FashionAdvisorClientRoute.mceConsultation;
    }

    // Atelier QEL recolor consultation stays on MCE (not Fashion Knowledge).
    if (isAtelierFocus && !fashionConversationSticky) {
      return FashionAdvisorClientRoute.mceConsultation;
    }

    final fashionCapable =
        outfitContextPresent || fashionConversationSticky;

    if (!fashionCapable) {
      return FashionAdvisorClientRoute.mceConsultation;
    }

    if (!fashionAdvisorV1Enabled) {
      // Option A: do not send fashion-prescriptive turns through unrestricted MCE.
      return FashionAdvisorClientRoute.fashionUnavailable;
    }

    return FashionAdvisorClientRoute.advisorFashionChat;
  }
}

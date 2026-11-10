/**
 * Phase1 description contract (read/save/restore).
 * UI phrase picker is Phase4 — this module is the server/client-shared rule surface.
 */

export type DescriptionDraftState = {
  descriptionAr: string;
  descriptionPhraseIds: string[];
  descriptionDirty: boolean;
};

export type Phrase = { id: string; textAr: string };

/** Merge selected phrase texts; never inject attributes the partner did not choose as phrases. */
export function composeDescriptionFromPhrases(
  selectedIds: string[],
  catalog: Phrase[],
  manualSuffix?: string,
): string {
  const byId = new Map(catalog.map((p) => [p.id, p.textAr]));
  const parts = selectedIds.map((id) => byId.get(id)).filter((t): t is string => !!t && !!t.trim());
  const manual = (manualSuffix || '').trim();
  if (manual) parts.push(manual);
  return parts.join(' ').trim();
}

/**
 * When subcategory changes: refresh available phrases only.
 * Never auto-replace partner text when dirty or non-empty description exists.
 */
export function onSubcategoryChange(
  prev: DescriptionDraftState,
  nextPhrases: Phrase[],
): { state: DescriptionDraftState; availablePhrases: Phrase[]; replaced: boolean } {
  const keepText = prev.descriptionDirty || !!(prev.descriptionAr && prev.descriptionAr.trim());
  if (keepText) {
    return {
      state: { ...prev },
      availablePhrases: nextPhrases,
      replaced: false,
    };
  }
  // Empty + not dirty: clear phrase ids that are no longer in the catalog; keep empty text.
  const nextIds = prev.descriptionPhraseIds.filter((id) => nextPhrases.some((p) => p.id === id));
  return {
    state: {
      descriptionAr: '',
      descriptionPhraseIds: nextIds,
      descriptionDirty: false,
    },
    availablePhrases: nextPhrases,
    replaced: false,
  };
}

/** Mark dirty when partner edits the final text away from a pure phrase compose. */
export function markDescriptionEdited(
  state: DescriptionDraftState,
  nextText: string,
): DescriptionDraftState {
  return {
    ...state,
    descriptionAr: nextText,
    descriptionDirty: true,
  };
}

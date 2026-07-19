/**
 * Analysis sources linked into a Beauty Session (read-only references).
 * Never mutate Skin / Face / Fashion intelligence engines.
 */
export interface BeautyAnalysisSources {
  skinReportId?: string;
  faceReportId?: string;
  fashionReportId?: string;
  /** Future intelligence ids */
  extra?: Record<string, string>;
}

export function emptyAnalysisSources(): BeautyAnalysisSources {
  return {};
}

export function withAnalysisSources(
  base: BeautyAnalysisSources,
  patch: BeautyAnalysisSources,
): BeautyAnalysisSources {
  return {
    ...base,
    ...patch,
    extra: { ...(base.extra ?? {}), ...(patch.extra ?? {}) },
  };
}

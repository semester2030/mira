export const SUBSCRIPTION_PLANS = {
  free: 'free',
  premium: 'premium',
} as const;

export type SubscriptionPlan =
  (typeof SUBSCRIPTION_PLANS)[keyof typeof SUBSCRIPTION_PLANS];

export const FREE_TIER_LIMITS = {
  skinAnalysisPerMonth: 3,
  outfitAnalysisPerMonth: 3,
} as const;

export const PREMIUM_FEATURES = {
  unlimitedSkinAnalysis: true,
  unlimitedOutfitAnalysis: true,
  unlimitedRecommendations: true,
} as const;

export enum MiraOccasion {
  Wedding = 'wedding',
  Work = 'work',
  Casual = 'casual',
  University = 'university',
  Evening = 'evening',
  Eid = 'eid',
  Interview = 'interview',
}

export const MIRA_OCCASION_LABELS: Record<
  MiraOccasion,
  { ar: string; en: string }
> = {
  [MiraOccasion.Wedding]: { ar: 'زفاف', en: 'Wedding' },
  [MiraOccasion.Work]: { ar: 'عمل', en: 'Work' },
  [MiraOccasion.Casual]: { ar: 'كاجوال', en: 'Casual' },
  [MiraOccasion.University]: { ar: 'جامعة', en: 'University' },
  [MiraOccasion.Evening]: { ar: 'سهرة', en: 'Evening' },
  [MiraOccasion.Eid]: { ar: 'عيد', en: 'Eid' },
  [MiraOccasion.Interview]: { ar: 'مقابلة', en: 'Interview' },
};

const OCCASION_INDEX: Record<MiraOccasion, number> = {
  [MiraOccasion.Wedding]: 0,
  [MiraOccasion.Work]: 1,
  [MiraOccasion.Casual]: 2,
  [MiraOccasion.University]: 3,
  [MiraOccasion.Evening]: 4,
  [MiraOccasion.Eid]: 5,
  [MiraOccasion.Interview]: 6,
};

export function occasionIndex(occasion: MiraOccasion): number {
  return OCCASION_INDEX[occasion];
}

export function parseOccasion(value: string): MiraOccasion | null {
  const normalized = value.trim().toLowerCase();
  return (Object.values(MiraOccasion) as string[]).includes(normalized)
    ? (normalized as MiraOccasion)
    : null;
}

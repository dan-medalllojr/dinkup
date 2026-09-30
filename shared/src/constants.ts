// Ordered lowest → highest. Leveling moves a player one step up this list.
export const SKILL_LEVELS = ['3.0', '3.5', '4.0', '4.5', '5.0'] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const SKILL_LABELS: Record<SkillLevel, string> = {
  '3.0': 'Beginner',
  '3.5': 'Novice',
  '4.0': 'Intermediate',
  '4.5': 'Advanced',
  '5.0': 'Expert',
};

export const FORMATS = ['singles', 'doubles', 'either'] as const;
export type PreferredFormat = (typeof FORMATS)[number];

export const TIMEZONE = 'Asia/Manila';

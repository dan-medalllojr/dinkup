import { FORMATS, SKILL_LABELS, SKILL_LEVELS, type PreferredFormat, type SkillLevel } from '@dinkup/shared';

export const FORMAT_LABELS: Record<PreferredFormat, string> = {
  singles: 'Singles',
  doubles: 'Doubles',
  either: 'Either',
};

export const levelOptions = SKILL_LEVELS.map((l) => ({ value: l, label: `${l} · ${SKILL_LABELS[l]}` }));
export const formatOptions = FORMATS.map((f) => ({ value: f, label: FORMAT_LABELS[f] }));

export const levelLabel = (l: SkillLevel) => `${l} ${SKILL_LABELS[l]}`;

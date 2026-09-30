import { SKILL_LEVELS, type Me, type PublicUser, type SkillLevel } from '@dinkup/shared';
import type { SkillLevel as DbSkillLevel, User } from '../generated/prisma/client.ts';

// Prisma enum names can't contain dots, so the DB enum is L3_0 … L5_0
// (stored as "3.0" … "5.0"). These map between that and the API's "3.0" form.
const DB_LEVELS = ['L3_0', 'L3_5', 'L4_0', 'L4_5', 'L5_0'] as const satisfies readonly DbSkillLevel[];

export function toDbLevel(level: SkillLevel): DbSkillLevel {
  return DB_LEVELS[SKILL_LEVELS.indexOf(level)]!;
}

export function fromDbLevel(level: DbSkillLevel): SkillLevel {
  return SKILL_LEVELS[DB_LEVELS.indexOf(level)]!;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    photoUrl: user.photoUrl,
    skillLevel: fromDbLevel(user.skillLevel),
    preferredFormat: user.preferredFormat,
    skillPoints: user.skillPoints,
    createdAt: user.createdAt.toISOString(),
  };
}

// Only ever returned to the user themselves.
export function toMe(user: User): Me {
  return { ...toPublicUser(user), email: user.email };
}

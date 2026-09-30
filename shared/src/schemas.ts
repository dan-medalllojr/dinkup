import { z } from 'zod';
import { FORMATS, SKILL_LEVELS } from './constants';

// Normalise first, then validate: z.email() alone would reject " ana@x.com ".
const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email').max(254));
const name = z.string().trim().min(2, 'Name must be at least 2 characters').max(60);

export const registerSchema = z.object({
  name,
  email,
  // bcrypt only uses the first 72 bytes, so cap the length.
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
  skillLevel: z.enum(SKILL_LEVELS).default('3.0'),
  preferredFormat: z.enum(FORMATS).default('either'),
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(72),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z
  .object({
    name,
    skillLevel: z.enum(SKILL_LEVELS),
    preferredFormat: z.enum(FORMATS),
  })
  .partial()
  .strict();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export type PublicUser = {
  id: string;
  name: string;
  photoUrl: string | null;
  skillLevel: (typeof SKILL_LEVELS)[number];
  preferredFormat: (typeof FORMATS)[number];
  skillPoints: number;
  createdAt: string;
};

export type Me = PublicUser & { email: string };

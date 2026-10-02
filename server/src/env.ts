import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  // Keeps a rolling week of labeled demo games and enables "Try the demo".
  DEMO_MODE: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  // Web Push (phone notifications). Without both keys, push is off and the
  // in-app inbox still works. Generate with: npx web-push generate-vapid-keys
  // A blank value counts as unset (the tests blank them to keep push off).
  VAPID_PUBLIC_KEY: z.string().optional().transform((v) => v || undefined),
  VAPID_PRIVATE_KEY: z.string().optional().transform((v) => v || undefined),
  // Who push services can contact about this sender.
  VAPID_SUBJECT: z.string().default('https://dinkup.onrender.com'),
});

// Fail fast on boot instead of at the first request that needs a missing value.
export const env = envSchema.parse(process.env);

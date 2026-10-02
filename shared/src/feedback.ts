import { z } from 'zod';

export const FEEDBACK_KINDS = ['bug', 'court', 'idea', 'other'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export const FEEDBACK_KIND_LABELS: Record<FeedbackKind, string> = {
  bug: 'Something broke',
  court: 'A court is wrong or missing',
  idea: 'An idea',
  other: 'Something else',
};
export const FEEDBACK_MAX_LENGTH = 1000;

export const feedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  message: z.string().trim().min(5, 'Tell us a little more (at least 5 characters)').max(FEEDBACK_MAX_LENGTH, `Keep it under ${FEEDBACK_MAX_LENGTH} characters`),
  contact: z.string().trim().max(200).optional().transform((v) => v || undefined),
  courtId: z.uuid().optional(),
  // Hidden field real people never see. Bots fill every input.
  website: z.string().max(200).optional(),
});
export type FeedbackInput = z.input<typeof feedbackSchema>;

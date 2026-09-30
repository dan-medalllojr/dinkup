import { z } from 'zod';
import { inCebu } from './geo';

const coords = {
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
};

const courtFields = z.object({
  name: z.string().trim().min(3, 'Give the court a name (at least 3 characters)').max(100),
  address: z.string().trim().max(200).default(''),
  city: z.string().trim().max(60).default(''),
  ...coords,
});

export const createCourtSchema = courtFields.refine(inCebu, {
  path: ['lat'],
  message: 'Courts must be in Cebu',
});
export type CreateCourtInput = z.input<typeof createCourtSchema>;

// The player who added a court can fix its details or move the pin.
export const updateCourtSchema = courtFields
  .partial()
  .strict()
  .refine((c) => (c.lat === undefined) === (c.lng === undefined), { path: ['lat'], message: 'Send lat and lng together' })
  .refine((c) => c.lat === undefined || inCebu({ lat: c.lat, lng: c.lng! }), { path: ['lat'], message: 'Courts must be in Cebu' });
export type UpdateCourtInput = z.infer<typeof updateCourtSchema>;

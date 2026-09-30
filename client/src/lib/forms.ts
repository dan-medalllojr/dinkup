import { z } from 'zod';
import { ApiError } from './api.ts';

export type FieldErrors = Record<string, string | undefined>;

// Validate with the same Zod schema the server uses; returns first error per field.
export function validate<S extends z.ZodType>(schema: S, values: unknown) {
  const result = schema.safeParse(values);
  if (result.success) return { data: result.data as z.output<S>, errors: null };
  return { data: null, errors: firstErrors(z.flattenError(result.error).fieldErrors) };
}

export function errorsFromApi(err: unknown): { form: string; fields: FieldErrors } {
  if (err instanceof ApiError) return { form: err.message, fields: firstErrors(err.fields) };
  return { form: 'Something went wrong', fields: {} };
}

function firstErrors(fields: Record<string, string[] | undefined>): FieldErrors {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v?.[0]]));
}

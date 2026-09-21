import { z } from 'zod';

import { REQUEST_STATUSES } from '@/types/domain';

/**
 * Write payloads are validated strictly — unlike list query parameters, an
 * unexpected value here is a client bug and is rejected with 422 rather than
 * silently normalised. At least one field must be present so an empty PATCH
 * cannot masquerade as a successful update.
 */
export const updateRequestSchema = z
  .object({
    status: z.enum(REQUEST_STATUSES, { error: 'Select a valid status.' }).optional(),
    assigneeId: z
      .string({ error: 'Select a member of the service desk team.' })
      .min(1)
      .max(64)
      .nullable()
      .optional(),
  })
  .refine((value) => value.status !== undefined || value.assigneeId !== undefined, {
    message: 'Provide a status or an assignee to update.',
  });

/** Flattens a Zod error into the field map used by the 422 response body. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    fields[key] ??= issue.message;
  }
  return fields;
}

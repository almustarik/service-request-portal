import { NextResponse } from 'next/server';

export type ApiErrorCode =
  'UNAUTHORIZED' | 'NOT_FOUND' | 'VALIDATION_FAILED' | 'INVALID_CREDENTIALS' | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Field-level messages for 422 responses, keyed by field name. */
    fields?: Record<string, string>;
  };
}

/** Client-safe error envelope. Internal detail never reaches this function. */
export function jsonError(
  status: number,
  code: ApiErrorCode,
  message: string,
  fields?: Record<string, string>,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: { code, message, ...(fields && { fields }) } }, { status });
}

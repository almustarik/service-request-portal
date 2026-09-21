'use client';

import { ErrorState } from '@/components/ui/ErrorState';

export default function RequestDetailError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      title="Unable to load this request"
      description="Something went wrong while fetching the request details. Please try again in a moment."
      onRetry={reset}
    />
  );
}

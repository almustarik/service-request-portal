'use client';

import { ErrorState } from '@/components/ui/ErrorState';

export default function RequestsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      title="Unable to load service requests"
      description="Something went wrong while fetching the request list. Please try again in a moment."
      onRetry={reset}
    />
  );
}

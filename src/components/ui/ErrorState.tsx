import { Button } from './Button';

/**
 * Error boundaries render this. The underlying error is deliberately not shown:
 * it can carry database or stack detail that must not reach a browser.
 */
export function ErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="border-line bg-surface rounded-lg border px-4 py-12 text-center">
      <h2 className="text-ink font-semibold">{title}</h2>
      <p className="text-ink-muted mx-auto mt-1 max-w-md text-[0.8125rem]">{description}</p>
      <Button variant="primary" onClick={onRetry} className="mt-4">
        Try again
      </Button>
    </div>
  );
}

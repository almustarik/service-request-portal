import Link from 'next/link';

export default function RequestNotFound() {
  return (
    <div className="border-line bg-surface mx-auto max-w-lg rounded-lg border px-4 py-14 text-center">
      <h1 className="text-ink font-semibold">Request not found</h1>
      <p className="text-ink-muted mt-1 text-[0.8125rem]">
        This request may have been removed, or the link may be incorrect.
      </p>
      <Link
        href="/requests"
        className="text-brand-700 mt-4 inline-block text-[0.8125rem] font-medium underline underline-offset-2"
      >
        Back to service requests
      </Link>
    </div>
  );
}

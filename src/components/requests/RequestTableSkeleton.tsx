const WIDTHS = ['w-16', 'w-64', 'w-24', 'w-20', 'w-16', 'w-20', 'w-24', 'w-20'];

/** Placeholder rows sized to the real table so swapping them in does not shift
 *  the surrounding layout. */
export function RequestTableSkeleton({ rows = 25 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="animate-pulse p-3">
      {Array.from({ length: Math.min(rows, 12) }, (_, index) => (
        <div
          key={index}
          className="border-line flex items-center gap-4 border-b py-3 last:border-0"
        >
          {WIDTHS.map((width, cell) => (
            <span
              key={cell}
              className={`bg-line h-3 rounded-sm ${width} ${cell > 2 ? 'hidden lg:block' : ''}`}
            />
          ))}
        </div>
      ))}
      <span className="sr-only">Loading requests</span>
    </div>
  );
}

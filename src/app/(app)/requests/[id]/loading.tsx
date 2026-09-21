export default function RequestDetailLoading() {
  return (
    <div aria-busy="true" className="mx-auto max-w-5xl animate-pulse space-y-4">
      <span className="sr-only">Loading request</span>
      <div aria-hidden="true" className="bg-line h-3 w-40 rounded-sm" />
      <div aria-hidden="true" className="space-y-2">
        <div className="bg-line h-3 w-24 rounded-sm" />
        <div className="bg-line h-5 w-2/3 rounded-sm" />
        <div className="bg-line h-4 w-52 rounded-sm" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_19rem]">
        <div aria-hidden="true" className="border-line bg-surface h-64 rounded-lg border" />
        <div aria-hidden="true" className="border-line bg-surface h-72 rounded-lg border" />
      </div>
    </div>
  );
}

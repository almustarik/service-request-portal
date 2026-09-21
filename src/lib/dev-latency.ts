/**
 * Optional artificial delay for exercising loading, skeleton and pending states
 * during development. Set API_LATENCY_MS to 200, 500 or 1000 and every server
 * read pauses before returning.
 *
 * It is a no-op in production builds, so shipped code never delays a response
 * just to make loading UI visible.
 */
export async function devLatency(): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;

  const delay = Number(process.env.API_LATENCY_MS ?? 0);
  if (!Number.isFinite(delay) || delay <= 0) return;

  await new Promise((resolve) => setTimeout(resolve, delay));
}

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The data layer talks to SQLite through the node:sqlite built-in, which must
  // stay outside the bundler's module graph.
  serverExternalPackages: ['node:sqlite'],
};

export default nextConfig;

import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Service Requests · As-Sunnah Foundation',
    template: '%s · Service Requests',
  },
  description: 'Internal service request management portal for As-Sunnah Foundation.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

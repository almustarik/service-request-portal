import { AppShell } from '@/components/layout/AppShell';
import { requireSession } from '@/lib/auth/session';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();

  return <AppShell user={user}>{children}</AppShell>;
}

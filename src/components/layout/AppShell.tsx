import { Button } from '@/components/ui/Button';
import type { User } from '@/types/domain';

import { MainNav } from './MainNav';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/* Sign-out is a plain form POST so it works without client JavaScript; the route
 * handler clears the cookie and redirects. */
function SignOutForm() {
  return (
    <form action="/api/auth/logout" method="post">
      <Button type="submit" variant="ghost" className="w-full justify-start px-2">
        Sign out
      </Button>
    </form>
  );
}

function CurrentUser({ user }: { user: User }) {
  return (
    <div className="flex items-center gap-2.5 px-2 py-1.5">
      <span
        aria-hidden="true"
        className="bg-brand-50 text-brand-700 grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold"
      >
        {initials(user.name)}
      </span>
      <span className="min-w-0">
        <span className="text-ink block truncate text-[0.8125rem] font-medium">{user.name}</span>
        <span className="text-ink-subtle block truncate text-xs">{user.email}</span>
      </span>
    </div>
  );
}

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[15rem_1fr]">
      <header className="border-line bg-surface border-b lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-4 px-4 py-3 lg:block lg:px-3 lg:py-4">
          <div className="lg:px-2">
            <span className="text-ink block text-[0.9375rem] leading-tight font-semibold">
              As-Sunnah Foundation
            </span>
            <span className="text-ink-subtle block text-xs">Service Desk</span>
          </div>
          <div className="lg:hidden">
            <SignOutForm />
          </div>
        </div>

        <div className="border-line border-t px-2 py-2 lg:mt-2 lg:flex-1 lg:border-t-0">
          <MainNav />
        </div>

        <div className="border-line hidden border-t p-2 lg:block">
          <CurrentUser user={user} />
          <SignOutForm />
        </div>
      </header>

      <main id="main" className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

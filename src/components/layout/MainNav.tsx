'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/requests', label: 'Service requests' },
  { href: '/performance', label: 'Team performance' },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main">
      <ul className="flex gap-1 lg:flex-col">
        {LINKS.map(({ href, label }) => {
          const isCurrent = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isCurrent ? 'page' : undefined}
                className={`block rounded-md px-3 py-2 text-[0.8125rem] font-medium transition-colors ${
                  isCurrent
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-muted hover:bg-canvas hover:text-ink'
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

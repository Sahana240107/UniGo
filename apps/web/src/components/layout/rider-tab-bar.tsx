'use client';

/**
 * src/components/layout/rider-tab-bar.tsx
 *
 * Responsive primary navigation for all rider pages after the dashboard:
 *  - Mobile (< md): bottom tab bar with floating SOS button.
 *  - Desktop (>= md): fixed left vertical sidebar (w-[72px]).
 *
 * Color theme: UniGo purple (#6C63FF) — matches the rest of the app.
 *
 * Pages using this should add `md:pl-[72px]` to their outermost wrapper
 * so content doesn't sit under the sidebar.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  {
    href: '/pulse',
    label: 'Home',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: '/commute',
    label: 'Commute',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="11" cy="11" r="8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
      </svg>
    ),
  },
  {
    href: '/community',
    label: 'Community',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0" />
      </svg>
    ),
  },
  {
  href: '/ridehistory',
  label: 'Impact',
  icon: (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 22V12" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12C12 12 8 10 8 6a4 4 0 0 1 8 0c0 4-4 6-4 6z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16c0 0-3.5-1.5-3.5-4.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16c0 0 3.5-1.5 3.5-4.5" />
    </svg>
  ),
},
  {
    href: '/profile',
    label: 'Profile',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="12" cy="8" r="4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 20c0-4 3.582-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
];

const SOS_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />
  </svg>
);

export default function RiderTabBar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  // Split nav items around the SOS slot (after Commute, before Rides)
  const before = NAV_ITEMS.slice(0, 2); // Home, Commute
  const after = NAV_ITEMS.slice(2);     // Rides, Community, Profile

  return (
    <>
      {/* ── Mobile bottom bar ──────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#E5E4F0] bg-white pb-safe md:hidden">
        <div className="mx-auto flex max-w-lg items-end justify-around px-2 pt-1 pb-2">
          {before.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-semibold transition-colors ${
                isActive(item.href) ? 'text-[#6C63FF]' : 'text-gray-400'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}

          {/* SOS — center floating */}
          <Link href="/safety" className="flex flex-col items-center gap-0.5 -mt-5">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 shadow-md">
              {SOS_ICON}
            </span>
            <span className="text-xs font-bold text-gray-500">SOS</span>
          </Link>

          {after.slice(0, 2).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-semibold transition-colors ${
                isActive(item.href) ? 'text-[#6C63FF]' : 'text-gray-400'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* ── Desktop left sidebar ───────────────────────────────────────── */}
      <nav className="fixed left-0 top-0 z-40 hidden h-screen w-[72px] flex-col items-center border-r border-[#E5E4F0] bg-white py-5 md:flex">
        {/* Logo mark */}
        <Link
          href="/pulse"
          className="mb-7 flex h-9 w-9 items-center justify-center rounded-xl bg-[#6C63FF] text-sm font-extrabold text-white shadow-md shadow-[#6C63FF]/30"
        >
          UG
        </Link>

        <div className="flex flex-1 flex-col items-center gap-1 w-full px-2">
          {/* Before SOS items */}
          {before.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex w-full flex-col items-center gap-1 rounded-xl py-2.5 text-[10px] font-semibold transition-colors ${
                isActive(item.href)
                  ? 'bg-[#EAE8FF] text-[#6C63FF]'
                  : 'text-gray-400 hover:bg-[#F8F7FF] hover:text-[#6C63FF]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}

          {/* SOS button */}
          <Link
            href="/safety"
            className="mt-1 mb-1 flex w-full flex-col items-center gap-1 rounded-xl py-2.5 text-[10px] font-bold text-red-500 transition-colors hover:bg-red-50"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 shadow-sm">
              {SOS_ICON}
            </span>
            <span>SOS</span>
          </Link>

          <div className="my-1 h-px w-8 bg-[#E5E4F0]" />

          {/* After SOS items */}
          {after.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex w-full flex-col items-center gap-1 rounded-xl py-2.5 text-[10px] font-semibold transition-colors ${
                isActive(item.href)
                  ? 'bg-[#EAE8FF] text-[#6C63FF]'
                  : 'text-gray-400 hover:bg-[#F8F7FF] hover:text-[#6C63FF]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
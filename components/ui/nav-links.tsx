"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/upgrades", label: "Upgrades" },
  { href: "/tracks", label: "Tracks" },
  { href: "/eips", label: "Explorer" },
  { href: "/about", label: "About" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Primary" className="order-last w-full sm:order-none sm:w-auto">
      <ul className="flex gap-4 overflow-x-auto text-sm">
        {LINKS.map((l) => {
          const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`block py-1 no-underline ${active ? "border-b-2 border-fg font-medium text-fg" : "text-muted hover:text-fg"}`}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

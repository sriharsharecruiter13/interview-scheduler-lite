"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Scheduler" },
  { href: "/respond", label: "EA page" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/candidates", label: "Candidate log" },
  { href: "/execs", label: "Exec availability" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive =
          pathname === tab.href ||
          (tab.href !== "/" && pathname.startsWith(tab.href));

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={[
              "rounded-full px-4 py-1.5 text-sm border transition-colors",
              isActive
                ? "bg-white text-black border-white shadow-sm"
                : "bg-zinc-900 border-zinc-700 text-zinc-200 hover:border-zinc-500",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}


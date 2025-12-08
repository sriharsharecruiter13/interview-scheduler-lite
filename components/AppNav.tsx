"use client";

import Link from "next/link";

type ActiveTab = "scheduler" | "ea" | "dashboard" | "candidates" | "execs";

interface AppNavProps {
  active: ActiveTab;
}

export default function AppNav({ active }: AppNavProps) {
  const baseClasses =
    "px-3 py-1.5 text-xs rounded-full border transition-colors";
  const activeClasses = "bg-slate-900 text-white border-slate-900";
  const inactiveClasses =
    "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200";

  return (
    <nav className="flex flex-wrap gap-2 items-center mb-4">
      {/* Scheduler */}
      {active === "scheduler" ? (
        <span className={`${baseClasses} ${activeClasses}`}>Scheduler</span>
      ) : (
        <Link
          href="/"
          className={`${baseClasses} ${inactiveClasses}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Scheduler
        </Link>
      )}

      {/* EA page */}
      {active === "ea" ? (
        <span className={`${baseClasses} ${activeClasses}`}>EA page</span>
      ) : (
        <Link
          href="/respond"
          className={`${baseClasses} ${inactiveClasses}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          EA page
        </Link>
      )}

      {/* Dashboard */}
      {active === "dashboard" ? (
        <span className={`${baseClasses} ${activeClasses}`}>Dashboard</span>
      ) : (
        <Link
          href="/dashboard"
          className={`${baseClasses} ${inactiveClasses}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Dashboard
        </Link>
      )}

      {/* Candidate log */}
      {active === "candidates" ? (
        <span className={`${baseClasses} ${activeClasses}`}>Candidate log</span>
      ) : (
        <Link
          href="/candidates"
          className={`${baseClasses} ${inactiveClasses}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Candidate log
        </Link>
      )}

      {/* Exec availability */}
      {active === "execs" ? (
        <span className={`${baseClasses} ${activeClasses}`}>
          Exec availability
        </span>
      ) : (
        <Link
          href="/execs"
          className={`${baseClasses} ${inactiveClasses}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Exec availability
        </Link>
      )}
    </nav>
  );
}


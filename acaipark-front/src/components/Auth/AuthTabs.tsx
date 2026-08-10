"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function isActive(pathname: string, href: string) {
  if (href === "/auth/sign-in") {
    return pathname.startsWith("/auth/sign-in");
  }
  if (href === "/auth/sign-up") {
    return pathname.startsWith("/auth/sign-up");
  }
  return pathname === href;
}

export default function AuthTabs() {
  const pathname = usePathname() ?? "";

  const tabs = [
    { href: "/auth/sign-in", label: "Iniciar sesión" },
    { href: "/auth/sign-up", label: "Registrarse" },
  ] as const;

  return (
    <div className="mb-6">
      <div className="inline-flex w-full rounded-xl bg-gray-2 p-1 dark:bg-dark-2">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                "flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium transition " +
                (active
                  ? "bg-white text-dark shadow-sm ring-1 ring-black/5 dark:bg-gray-dark dark:text-white dark:ring-white/10"
                  : "text-body hover:text-dark dark:text-dark-6 dark:hover:text-white")
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

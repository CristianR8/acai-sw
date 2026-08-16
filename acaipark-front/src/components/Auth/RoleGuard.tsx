"use client";

import { useCurrentUserRole } from "@/hooks/use-current-user-role";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type PropsWithChildren } from "react";

const ADMIN_ONLY_PATHS = [
  "/dashboard",
  "/personnel",
  "/sales",
  "/inventory/purchases",
  "/expenses",
];

export function RoleGuard({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, loading } = useCurrentUserRole();
  const unauthenticated = !loading && role === null;
  const restricted =
    role === "cashier" &&
    ADMIN_ONLY_PATHS.some((path) => pathname.startsWith(path));

  useEffect(() => {
    if (unauthenticated) {
      router.replace(`/auth/sign-in?next=${encodeURIComponent(pathname)}`);
    } else if (restricted) {
      router.replace("/pos");
    }
  }, [pathname, restricted, router, unauthenticated]);

  if (loading || unauthenticated || restricted) return null;
  return children;
}

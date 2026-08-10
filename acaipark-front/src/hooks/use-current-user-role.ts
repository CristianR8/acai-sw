"use client";

import { readAuth, storeAuth, type UserRole } from "@/lib/auth/storage";
import { useEffect, useState } from "react";

export function useCurrentUserRole() {
  const [role, setRole] = useState<UserRole | null>(
    () => readAuth()?.role ?? null,
  );
  const [loading, setLoading] = useState(role === null);

  useEffect(() => {
    const auth = readAuth();
    if (!auth?.accessToken) {
      setLoading(false);
      return;
    }
    if (auth.role) {
      setRole(auth.role);
      setLoading(false);
      return;
    }

    fetch("/api/auth/me", {
      headers: {
        authorization: `${auth.tokenType || "Bearer"} ${auth.accessToken}`,
      },
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { role?: UserRole };
      })
      .then((profile) => {
        if (!profile?.role) return;
        setRole(profile.role);
        storeAuth({ ...auth, role: profile.role }, auth.remember ?? false);
      })
      .finally(() => setLoading(false));
  }, []);

  return { role, loading, isAdministrator: role === "administrator" };
}

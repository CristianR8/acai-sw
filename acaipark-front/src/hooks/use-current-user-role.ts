"use client";

import { readAuth, storeAuth, type UserRole } from "@/lib/auth/storage";
import { useEffect, useState } from "react";

export function useCurrentUserRole() {
  // Keep the server and first client render identical; storage is read after mount.
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

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
      .catch(() => setRole(null))
      .finally(() => setLoading(false));
  }, []);

  return { role, loading, isAdministrator: role === "administrator" };
}

"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/providers";
import type { Role } from "@/lib/types";

/** Redirects guests to /login?next=... and reports whether the signed-in user has one of `roles`. */
export function useRequireAuth(roles?: Role[]) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  React.useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);
  const allowed = !!user && (!roles || roles.includes(user.role));
  return { user, loading: loading || !user, allowed };
}

"use client";

import type { ReactNode } from "react";
import { useCurrentRole } from "@/hooks/useCurrentRole";
import type { UserRole } from "@/lib/roles";

export default function Can({
  roles,
  children,
  fallback = null,
}: {
  roles: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { role, loadingRole } = useCurrentRole();

  if (loadingRole) return null;

  if (!roles.includes(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

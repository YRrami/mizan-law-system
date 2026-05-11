"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import LoadingCard from "@/components/ui/LoadingCard";
import { useCurrentRole } from "@/hooks/useCurrentRole";
import type { UserRole } from "@/lib/roles";

export default function RequireRole({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: ReactNode;
}) {
  const router = useRouter();
  const { role, loadingRole } = useCurrentRole();

  useEffect(() => {
    if (!loadingRole && !allowedRoles.includes(role)) {
      router.replace("/unauthorized");
    }
  }, [allowedRoles, loadingRole, role, router]);

  if (loadingRole) {
    return <LoadingCard text="جاري التحقق من الصلاحيات..." />;
  }

  if (!allowedRoles.includes(role)) {
    return <LoadingCard text="غير مصرح لك بالدخول..." />;
  }

  return <>{children}</>;
}

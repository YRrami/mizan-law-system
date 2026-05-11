"use client";

import { useEffect, useState } from "react";
import { getCurrentProfile, type CurrentProfile, type UserRole } from "@/lib/roles";

export function useCurrentRole() {
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [role, setRole] = useState<UserRole>("user");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);

  async function loadRole() {
    setLoadingRole(true);
    const currentProfile = await getCurrentProfile();

    setProfile(currentProfile);
    setRole(currentProfile?.role || "user");
    setIsAdmin(currentProfile?.role === "admin");
    setLoadingRole(false);
  }

  useEffect(() => {
    loadRole();
  }, []);

  return {
    profile,
    role,
    isAdmin,
    loadingRole,
    reloadRole: loadRole,
  };
}

"use client";

import { supabase } from "@/lib/supabase";

export type UserRole = "admin" | "user";

export type CurrentProfile = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
};

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id,email,full_name,role")
    .eq("user_id", authData.user.id)
    .single();

  if (error || !data) {
    return {
      user_id: authData.user.id,
      email: authData.user.email ?? null,
      full_name: null,
      role: "user",
    };
  }

  return data as CurrentProfile;
}

export async function getCurrentUserRole(): Promise<UserRole> {
  const profile = await getCurrentProfile();
  return profile?.role || "user";
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role === "admin";
}

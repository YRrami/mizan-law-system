"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import RequireRole from "@/components/auth/RequireRole";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import LoadingCard from "@/components/ui/LoadingCard";
import PageHeader from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase";
import type { UserRole } from "@/lib/roles";

type ProfileRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

function AdminUsersContent() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchProfiles();
  }, []);

  function showSuccess(message: string) {
    setSuccess(message);
    setTimeout(() => setSuccess(""), 2400);
  }

  async function fetchProfiles() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("profiles")
      .select("user_id,email,full_name,role,created_at,updated_at")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setProfiles((data || []) as ProfileRow[]);
  }

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();

    return profiles.filter((profile) => {
      const text = [
        profile.email,
        profile.full_name,
        profile.role,
        profile.user_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return !q || text.includes(q);
    });
  }, [profiles, search]);

  async function updateRole(userId: string, role: UserRole) {
    const ok = confirm(
      role === "admin"
        ? "هل تريد جعل هذا المستخدم Admin؟"
        : "هل تريد تحويل هذا المستخدم إلى Regular User؟"
    );

    if (!ok) return;

    setSavingId(userId);
    setError("");

    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("user_id", userId);

    setSavingId("");

    if (error) {
      setError(error.message);
      return;
    }

    showSuccess("تم تحديث صلاحية المستخدم.");
    await fetchProfiles();
  }

  if (loading) {
    return <LoadingCard text="جاري تحميل المستخدمين..." />;
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Admin Panel"
          title="إدارة صلاحيات المستخدمين"
          tone="blue"
          description="من هنا تقدر تحول المستخدمين إلى Admin أو Regular User."
          action={
            <button
              onClick={fetchProfiles}
              className="h-10 rounded-[18px] border border-black/10 bg-white/80 px-4 text-xs font-black text-black shadow-sm hover:bg-white"
            >
              تحديث
            </button>
          }
        />

        {error ? (
          <div className="rounded-[22px] border border-red-200 bg-red-50/80 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-[22px] border border-slate-200 bg-slate-100/80 p-4 text-sm font-black text-slate-800">
            {success}
          </div>
        ) : null}

        <section className="rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الإيميل أو الدور..."
            className="h-11 w-full rounded-[18px] border border-black/10 bg-white px-4 text-sm font-bold text-black outline-none"
          />
        </section>

        <section className="rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
          {filteredProfiles.length === 0 ? (
            <EmptyState
              title="لا يوجد مستخدمين"
              description="لا توجد نتائج مطابقة للبحث."
            />
          ) : (
            <div className="space-y-3">
              {filteredProfiles.map((profile) => (
                <div
                  key={profile.user_id}
                  className="flex flex-col gap-3 rounded-[22px] border border-black/5 bg-white/80 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <h3 className="break-all text-sm font-black text-black">
                      {profile.email || profile.user_id}
                    </h3>

                    <p className="mt-1 text-xs font-bold text-zinc-500">
                      {profile.full_name || "No name"}
                    </p>

                    <p className="mt-1 break-all text-[11px] font-bold text-zinc-400">
                      {profile.user_id}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={profile.role === "admin" ? "blue" : "zinc"}>
                      {profile.role === "admin" ? "Admin" : "Regular User"}
                    </Badge>

                    <button
                      disabled={savingId === profile.user_id}
                      onClick={() =>
                        updateRole(
                          profile.user_id,
                          profile.role === "admin" ? "user" : "admin"
                        )
                      }
                      className="rounded-2xl bg-black px-4 py-2 text-xs font-black text-white disabled:opacity-60"
                    >
                      {savingId === profile.user_id
                        ? "جاري الحفظ..."
                        : profile.role === "admin"
                        ? "Make User"
                        : "Make Admin"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

export default function AdminUsersPage() {
  return (
    <RequireRole allowedRoles={["admin"]}>
      <AdminUsersContent />
    </RequireRole>
  );
}

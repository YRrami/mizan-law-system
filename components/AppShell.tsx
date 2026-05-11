"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useCurrentRole } from "@/hooks/useCurrentRole";
import type { UserRole } from "@/lib/roles";
import LogoMark from "@/components/LogoMark";

type NavItem = {
  href: string;
  label: string;
  roles?: UserRole[];
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "لوحة التحكم" },
  { href: "/clients", label: "الموكلين" },
  { href: "/cases", label: "القضايا" },
  { href: "/documents", label: "المستندات" },
  { href: "/hearings", label: "الجلسات" },
  { href: "/calendar", label: "التقويم" },
  { href: "/tasks", label: "المهام" },
  { href: "/payments", label: "الأتعاب", roles: ["admin"] },
  { href: "/admin/users", label: "صلاحيات المستخدمين", roles: ["admin"] },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [navigatingTo, setNavigatingTo] = useState("");
  const { role, isAdmin, loadingRole } = useCurrentRole();

  const visibleNavItems = useMemo(() => {
    return navItems.filter((item) => !item.roles || item.roles.includes(role));
  }, [role]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function roleLabel() {
    if (loadingRole) return "جاري التحقق";
    return isAdmin ? "Admin" : "Regular User";
  }

  return (
    <main dir="rtl" className="min-h-dvh bg-[#f6f7fb] text-slate-950">
      {navigatingTo ? (
        <div className="fixed left-0 right-0 top-0 z-50 h-1 bg-slate-200">
          <div className="h-full w-2/3 animate-pulse rounded-l-full bg-slate-950" />
        </div>
      ) : null}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/60 blur-3xl" />
        <div className="absolute left-[-160px] top-24 h-[420px] w-[420px] rounded-full bg-white/55 blur-3xl" />
        <div className="absolute bottom-[-180px] right-1/3 h-[460px] w-[460px] rounded-full bg-white blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-7xl gap-5 p-4 lg:p-6">
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-6 rounded-[34px] border border-slate-200/80 bg-white/82 p-4 shadow-[0_25px_80px_rgba(15,23,42,0.10)] backdrop-blur-3xl">
            <div className="mb-6 rounded-[28px] bg-slate-950 p-4 text-white shadow-xl">
              <div className="flex items-center gap-3">
                <LogoMark size="lg" rounded="rounded-[24px]" />
                <div className="min-w-0">
                  <h1 className="truncate text-sm font-black leading-6">
                    مؤسسة ياسر الرفاعي
                  </h1>
                  <p className="text-xs font-semibold text-slate-300">
                    للمحاماة
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-white/10 px-3 py-2 text-xs font-black text-white">
                الصلاحية: {roleLabel()}
              </div>
            </div>

            <nav className="space-y-2">
              {visibleNavItems.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setNavigatingTo(item.href)}
                    className={`block rounded-[22px] px-4 py-3 text-sm font-black transition ${
                      active
                        ? "bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                        : "text-slate-800 hover:bg-slate-100 hover:text-slate-950"
                    }`}
                  >
                    <span className="block truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <button
              onClick={handleLogout}
              className="mt-6 h-12 w-full rounded-[22px] border border-slate-200 bg-white text-sm font-black text-slate-900 transition hover:bg-rose-50 hover:text-rose-700"
            >
              تسجيل الخروج
            </button>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="mb-5 rounded-[30px] border border-slate-200/80 bg-white/82 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.07)] backdrop-blur-3xl lg:hidden">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <LogoMark size="md" rounded="rounded-[22px]" />
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-black text-slate-950">
                    مؤسسة ياسر الرفاعي
                  </h1>
                  <p className="truncate text-xs font-bold text-slate-500">
                    نظام إدارة العمل القانوني · {roleLabel()}
                  </p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="shrink-0 rounded-2xl bg-slate-950 px-4 py-2 text-xs font-black text-white"
              >
                خروج
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {visibleNavItems.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setNavigatingTo(item.href)}
                    className={`whitespace-nowrap rounded-2xl px-4 py-2 text-xs font-black ${
                      active
                        ? "bg-slate-950 text-white"
                        : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </header>

          {children}
        </section>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { ReactNode } from "react";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "لوحة التحكم", accent: "bg-slate-950 text-white" },
  { href: "/clients", label: "الموكلين", accent: "bg-blue-600 text-white" },
  { href: "/cases", label: "القضايا", accent: "bg-violet-600 text-white" },
  { href: "/documents", label: "المستندات", accent: "bg-emerald-600 text-white" },
  { href: "/hearings", label: "الجلسات", accent: "bg-amber-400 text-black" },
  { href: "/tasks", label: "المهام", accent: "bg-rose-600 text-white" },
  { href: "/payments", label: "الأتعاب", accent: "bg-teal-600 text-white" },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [navigatingTo, setNavigatingTo] = useState("");

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main dir="rtl" className="min-h-dvh bg-[#f5f5f7] text-black">
      {navigatingTo ? (
        <div className="fixed left-0 right-0 top-0 z-50 h-1 bg-zinc-200">
          <div className="h-full w-2/3 animate-pulse rounded-l-full bg-black" />
        </div>
      ) : null}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white blur-3xl" />
        <div className="absolute left-[-140px] top-32 h-96 w-96 rounded-full bg-blue-200/35 blur-3xl" />
        <div className="absolute bottom-[-160px] right-1/3 h-[430px] w-[430px] rounded-full bg-emerald-100/45 blur-3xl" />
        <div className="absolute left-1/3 top-1/2 h-72 w-72 rounded-full bg-violet-100/35 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-7xl gap-5 p-4 lg:p-6">
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-6 rounded-[34px] border border-white/70 bg-white/75 p-4 shadow-[0_25px_80px_rgba(0,0,0,0.10)] backdrop-blur-3xl">
            <div className="mb-6 rounded-[28px] bg-black p-4 text-white shadow-xl">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl font-black text-black">
                  ي
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-sm font-black leading-6">
                    مؤسسة ياسر الرفاعي
                  </h1>
                  <p className="text-xs font-semibold text-zinc-400">
                    للمحاماة
                  </p>
                </div>
              </div>
            </div>

            <nav className="space-y-2">
              {navItems.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setNavigatingTo(item.href)}
                    className={`block rounded-[22px] px-4 py-3 text-sm font-black transition ${
                      active
                        ? item.accent + " shadow-lg"
                        : "text-black hover:bg-white"
                    }`}
                  >
                    <span className="block truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <button
              onClick={handleLogout}
              className="mt-6 h-12 w-full rounded-[22px] border border-black/10 bg-white/80 text-sm font-black text-black transition hover:bg-red-50 hover:text-red-700"
            >
              تسجيل الخروج
            </button>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="mb-5 rounded-[30px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.07)] backdrop-blur-3xl lg:hidden">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-lg font-black text-black">
                  مؤسسة ياسر الرفاعي
                </h1>
                <p className="truncate text-xs font-bold text-zinc-600">
                  نظام إدارة العمل القانوني
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="shrink-0 rounded-2xl bg-black px-4 py-2 text-xs font-black text-white"
              >
                خروج
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {navItems.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setNavigatingTo(item.href)}
                    className={`whitespace-nowrap rounded-2xl px-4 py-2 text-xs font-black ${
                      active ? item.accent : "bg-white/90 text-black"
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
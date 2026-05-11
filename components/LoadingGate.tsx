"use client";

import { useEffect, useState } from "react";
import LogoMark from "@/components/LogoMark";

export default function LoadingGate() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const holdTimer = window.setTimeout(() => {
      setLeaving(true);
    }, 3600);

    const removeTimer = window.setTimeout(() => {
      setVisible(false);
    }, 4000);

    return () => {
      window.clearTimeout(holdTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      dir="rtl"
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#f6f7fb] p-4 text-slate-950 transition-opacity duration-500 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
      aria-label="جاري تحميل النظام"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white blur-3xl" />
        <div className="absolute left-[-120px] top-20 h-80 w-80 rounded-full bg-slate-200/35 blur-3xl" />
        <div className="absolute bottom-[-140px] right-1/3 h-[420px] w-[420px] rounded-full bg-slate-100/50 blur-3xl" />
        <div className="absolute left-1/3 top-1/2 h-72 w-72 rounded-full bg-slate-100/40 blur-3xl" />
      </div>

      <section className="relative z-10 w-full max-w-md overflow-hidden rounded-[40px] border border-white/70 bg-white/78 p-7 text-center shadow-[0_28px_90px_rgba(0,0,0,0.13)] backdrop-blur-3xl sm:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/80 to-transparent" />

        <div className="relative mx-auto mb-5 flex justify-center">
          <LogoMark
            size="2xl"
            rounded="rounded-[30px]"
            className="shadow-[0_18px_45px_rgba(0,0,0,0.14)]"
            imgClassName="p-1"
          />
        </div>

        <p className="mx-auto mb-3 inline-flex rounded-full border border-black/10 bg-white/70 px-4 py-2 text-[11px] font-black text-slate-950 backdrop-blur-xl">
          Legal Management System
        </p>

        <h1 className="text-2xl font-black tracking-tight text-slate-950">
          مؤسسة ياسر الرفاعي للمحاماة
        </h1>

        <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-7 text-zinc-600">
          بنجهز لوحة التحكم، القضايا، الجلسات، المستندات، والمهام...
        </p>

        <div className="mt-7 overflow-hidden rounded-full bg-zinc-200/80 p-1">
          <div className="h-2.5 w-full origin-right animate-[mizanLoading_4s_ease-in-out_forwards] rounded-full bg-slate-950" />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 text-[11px] font-black text-zinc-600">
          <div className="rounded-2xl bg-white/80 px-3 py-2">آمن</div>
          <div className="rounded-2xl bg-white/80 px-3 py-2">منظم</div>
          <div className="rounded-2xl bg-white/80 px-3 py-2">جاهز</div>
        </div>
      </section>

      <style jsx global>{`
        @keyframes mizanLoading {
          0% {
            transform: scaleX(0.08);
            opacity: 0.75;
          }
          35% {
            transform: scaleX(0.48);
            opacity: 1;
          }
          72% {
            transform: scaleX(0.82);
            opacity: 1;
          }
          100% {
            transform: scaleX(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

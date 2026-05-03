import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main
      dir="rtl"
      className="relative min-h-dvh overflow-hidden bg-[#f5f5f7] text-black"
    >
      {/* iOS-like soft background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white blur-3xl" />
        <div className="absolute left-[-90px] top-24 h-72 w-72 rounded-full bg-zinc-300/50 blur-3xl" />
        <div className="absolute bottom-[-120px] right-1/3 h-96 w-96 rounded-full bg-white/80 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.85),rgba(229,229,234,0.72))]" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-dvh max-w-7xl grid-cols-1 gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-8">
        {/* Brand side */}
        <section className="hidden lg:flex">
          <div className="relative flex w-full flex-col justify-between overflow-hidden rounded-[44px] border border-white/70 bg-white/45 p-10 shadow-[0_30px_90px_rgba(0,0,0,0.10)] backdrop-blur-3xl">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/70 via-white/25 to-zinc-200/30" />

            <div className="relative z-10 flex items-center justify-between">
              <Link href="/login" className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-black text-3xl font-black text-white shadow-xl">
                  ي
                </div>

                <div>
                  <h1 className="text-2xl font-black leading-tight text-black">
                    مؤسسة ياسر الرفاعي للمحاماة
                  </h1>
                  <p className="mt-1 text-sm font-semibold text-zinc-600">
                    نظام إدارة العمل القانوني
                  </p>
                </div>
              </Link>

              <div className="rounded-full border border-black/10 bg-white/60 px-4 py-2 text-xs font-black text-black backdrop-blur-xl">
                Secure MVP
              </div>
            </div>

            <div className="relative z-10 max-w-2xl">
              <div className="mb-6 inline-flex rounded-full border border-black/10 bg-white/60 px-4 py-2 text-sm font-black text-black backdrop-blur-xl">
                منصة داخلية لإدارة المكتب
              </div>

              <h2 className="text-5xl font-black leading-[1.08] tracking-tight text-black xl:text-6xl">
                إدارة القضايا
                <br />
                والموكلين
                <br />
                <span className="text-zinc-500">بشكل أوضح وأسرع</span>
              </h2>

              <p className="mt-7 max-w-xl text-lg font-medium leading-9 text-zinc-700">
                واجهة حديثة بنمط iOS لإدارة الموكلين، القضايا، الجلسات، المهام،
                والأتعاب من مكان واحد بشكل منظم وسهل الاستخدام.
              </p>

              <div className="mt-10 grid grid-cols-2 gap-4">
                {[
                  "ملفات الموكلين",
                  "متابعة القضايا",
                  "جدولة الجلسات",
                  "لوحة تحكم واضحة",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-[26px] border border-white/70 bg-white/55 p-5 shadow-sm backdrop-blur-2xl"
                  >
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-sm font-black text-white">
                      ✓
                    </div>
                    <p className="text-sm font-black text-black">{item}</p>
                    <p className="mt-2 text-xs font-medium leading-5 text-zinc-600">
                      تنظيم سريع ومناسب لروتين المكتب اليومي.
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10 grid grid-cols-3 gap-4">
              <div className="rounded-[26px] border border-white/70 bg-white/55 p-5 text-center shadow-sm backdrop-blur-2xl">
                <p className="text-3xl font-black text-black">RTL</p>
                <p className="mt-1 text-xs font-bold text-zinc-600">
                  عربي بالكامل
                </p>
              </div>

              <div className="rounded-[26px] border border-white/70 bg-white/55 p-5 text-center shadow-sm backdrop-blur-2xl">
                <p className="text-3xl font-black text-black">DB</p>
                <p className="mt-1 text-xs font-bold text-zinc-600">
                  Supabase
                </p>
              </div>

              <div className="rounded-[26px] border border-white/70 bg-white/55 p-5 text-center shadow-sm backdrop-blur-2xl">
                <p className="text-3xl font-black text-black">MVP</p>
                <p className="mt-1 text-xs font-bold text-zinc-600">
                  جاهز للتطوير
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Form side */}
        <section className="flex items-center justify-center">
          <div className="w-full max-w-md">
            {/* Mobile brand */}
            <div className="mb-5 rounded-[30px] border border-white/70 bg-white/55 p-5 text-center shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur-3xl lg:hidden">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-[22px] bg-black text-2xl font-black text-white">
                ي
              </div>
              <h1 className="text-lg font-black text-black">
                مؤسسة ياسر الرفاعي للمحاماة
              </h1>
              <p className="mt-1 text-sm font-semibold text-zinc-600">
                نظام إدارة العمل القانوني
              </p>
            </div>

            <div className="rounded-[36px] border border-white/70 bg-white/58 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.12)] backdrop-blur-3xl sm:p-8">
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 inline-flex rounded-full border border-black/10 bg-white/70 px-4 py-2 text-xs font-black text-black backdrop-blur-xl">
                  Secure Access
                </div>

                <h2 className="text-3xl font-black tracking-tight text-black sm:text-4xl">
                  {title}
                </h2>

                <p className="mt-3 text-sm font-medium leading-7 text-zinc-700">
                  {subtitle}
                </p>
              </div>

              {children}

              <div className="mt-7 border-t border-black/10 pt-6 text-center text-sm font-medium text-zinc-700">
                {footer}
              </div>
            </div>

            <p className="mt-5 text-center text-xs font-semibold text-zinc-600">
              © مؤسسة ياسر الرفاعي للمحاماة
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
import Link from "next/link";
import type { ReactNode } from "react";
import LogoMark from "@/components/LogoMark";

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
    <main dir="rtl" className="relative min-h-dvh overflow-hidden bg-[#f6f7fb] text-slate-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-28 -top-28 h-96 w-96 rounded-full bg-slate-100/75 blur-3xl" />
        <div className="absolute left-[-120px] top-28 h-80 w-80 rounded-full bg-slate-200/75 blur-3xl" />
        <div className="absolute bottom-[-140px] right-1/3 h-[440px] w-[440px] rounded-full bg-white blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-dvh max-w-7xl grid-cols-1 gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-8">
        <section className="hidden lg:flex">
          <div className="relative flex w-full flex-col justify-between overflow-hidden rounded-[44px] border border-slate-200/80 bg-white/65 p-10 shadow-[0_30px_90px_rgba(15,23,42,0.10)] backdrop-blur-3xl">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/80 via-white/35 to-slate-50/80" />

            <div className="relative z-10 flex items-center justify-between">
              <Link href="/login" className="flex items-center gap-4">
                <LogoMark size="2xl" rounded="rounded-[30px]" className="shadow-xl" />

                <div>
                  <h1 className="text-2xl font-black leading-tight text-slate-950">
                    مؤسسة ياسر الرفاعي للمحاماة
                  </h1>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    نظام إدارة العمل القانوني
                  </p>
                </div>
              </Link>

              <div className="rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-xs font-black text-slate-900 backdrop-blur-xl">
                Secure Workspace
              </div>
            </div>

            <div className="relative z-10 max-w-2xl">
              <div className="mb-6 inline-flex rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-black text-slate-950 backdrop-blur-xl">
                منصة داخلية لإدارة المكتب
              </div>

              <h2 className="text-5xl font-black leading-[1.08] tracking-tight text-slate-950 xl:text-6xl">
                إدارة القضايا
                <br />
                والموكلين
                <br />
                <span className="text-slate-500">بشكل أوضح وأسرع</span>
              </h2>

              <p className="mt-7 max-w-xl text-lg font-medium leading-9 text-slate-600">
                واجهة موحدة لإدارة الموكلين، القضايا، الجلسات، المهام،
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
                    className="rounded-[26px] border border-slate-200 bg-white/75 p-5 shadow-sm backdrop-blur-2xl"
                  >
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">
                      ✓
                    </div>
                    <p className="text-sm font-black text-slate-950">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10 text-sm font-bold text-slate-500">
              Mizan Legal Management · Unified Palette
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
              <LogoMark size="xl" rounded="rounded-[26px]" />
              <div>
                <h1 className="text-xl font-black text-slate-950">
                  مؤسسة ياسر الرفاعي
                </h1>
                <p className="text-xs font-bold text-slate-500">
                  نظام إدارة العمل القانوني
                </p>
              </div>
            </div>

            <div className="rounded-[38px] border border-slate-200/80 bg-white/82 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.11)] backdrop-blur-3xl sm:p-8">
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 inline-flex rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-black text-slate-950 backdrop-blur-xl">
                  Secure Access
                </div>

                <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  {title}
                </h2>

                <p className="mt-3 text-sm font-medium leading-7 text-slate-600">
                  {subtitle}
                </p>
              </div>

              {children}

              <div className="mt-7 border-t border-slate-200 pt-6 text-center text-sm font-medium text-slate-600">
                {footer}
              </div>
            </div>

            <p className="mt-5 text-center text-xs font-semibold text-slate-500">
              © مؤسسة ياسر الرفاعي للمحاماة
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

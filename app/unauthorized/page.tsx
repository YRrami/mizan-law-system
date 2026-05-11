import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen bg-[#f6f7fb] p-6 text-black">
      <section className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center">
        <div className="rounded-[32px] border border-white/70 bg-white/80 p-8 text-center shadow-[0_22px_70px_rgba(0,0,0,0.08)] backdrop-blur-3xl">
          <p className="mx-auto mb-4 inline-flex rounded-full bg-red-50 px-4 py-2 text-xs font-black text-red-700">
            Access Denied
          </p>

          <h1 className="text-3xl font-black text-black">
            غير مصرح لك بالدخول
          </h1>

          <p className="mt-3 text-sm font-bold leading-7 text-zinc-600">
            الحساب الحالي لا يمتلك الصلاحية المطلوبة لهذه الصفحة.
          </p>

          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-black text-white"
          >
            الرجوع للداشبورد
          </Link>
        </div>
      </section>
    </main>
  );
}

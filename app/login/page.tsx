"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AuthShell from "@/components/AuthShell";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        router.replace("/dashboard");
        return;
      }

      setChecking(false);
    }

    checkSession();
  }, [router]);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("من فضلك اكتب البريد الإلكتروني وكلمة المرور.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError("بيانات الدخول غير صحيحة. تأكد من البريد وكلمة المرور.");
      return;
    }

    router.push("/dashboard");
  }

  if (checking) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#f5f5f7] p-4 text-black">
        <div className="rounded-[28px] border border-white/70 bg-white/60 px-6 py-4 text-sm font-black text-black shadow-xl backdrop-blur-3xl">
          جاري التحقق من الحساب...
        </div>
      </main>
    );
  }

  return (
    <AuthShell
      title="تسجيل الدخول"
      subtitle="ادخل إلى لوحة إدارة المؤسسة لمتابعة القضايا والموكلين والجلسات."
      footer={
        <>
          معندكش حساب؟{" "}
          <Link href="/signup" className="font-black text-black underline-offset-4 hover:underline">
            إنشاء حساب جديد
          </Link>
        </>
      }
    >
      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-black text-black">
            البريد الإلكتروني
          </label>
          <div className="rounded-[22px] border border-black/10 bg-white/75 px-4 shadow-sm backdrop-blur-2xl transition focus-within:border-black/40 focus-within:ring-4 focus-within:ring-black/5">
            <input
              type="email"
              placeholder="example@email.com"
              className="h-14 w-full bg-transparent text-sm font-semibold text-black outline-none placeholder:text-zinc-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-black text-black">
            كلمة المرور
          </label>
          <div className="flex items-center gap-3 rounded-[22px] border border-black/10 bg-white/75 px-4 shadow-sm backdrop-blur-2xl transition focus-within:border-black/40 focus-within:ring-4 focus-within:ring-black/5">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="اكتب كلمة المرور"
              className="h-14 w-full bg-transparent text-sm font-semibold text-black outline-none placeholder:text-zinc-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="whitespace-nowrap rounded-2xl bg-zinc-100 px-3 py-2 text-xs font-black text-black transition hover:bg-zinc-200"
            >
              {showPassword ? "إخفاء" : "إظهار"}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm font-semibold text-zinc-700">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-black" />
            تذكرني
          </label>

          <button type="button" className="font-black text-black hover:underline">
            نسيت كلمة المرور؟
          </button>
        </div>

        {error ? (
          <div className="rounded-[22px] border border-red-200 bg-red-50/80 px-4 py-3 text-sm font-bold text-red-700 backdrop-blur-xl">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="h-14 w-full rounded-[22px] bg-black text-sm font-black text-white shadow-[0_16px_35px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {loading ? "جاري الدخول..." : "دخول إلى النظام"}
        </button>
      </form>
    </AuthShell>
  );
}
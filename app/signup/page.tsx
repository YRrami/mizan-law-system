"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AuthShell from "@/components/AuthShell";

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  const strength = useMemo(() => {
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (/[a-zA-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    return score;
  }, [password]);

  const strengthText = ["ضعيفة", "ضعيفة", "متوسطة", "جيدة", "قوية"][strength];

  async function handleSignup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!fullName.trim()) {
      setError("من فضلك اكتب الاسم.");
      return;
    }

    if (!email.trim()) {
      setError("من فضلك اكتب البريد الإلكتروني.");
      return;
    }

    if (password.length < 6) {
      setError("كلمة المرور لازم تكون 6 أحرف على الأقل.");
      return;
    }

    if (password !== confirmPassword) {
      setError("تأكيد كلمة المرور غير مطابق.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess("تم إنشاء الحساب بنجاح. سيتم تحويلك لتسجيل الدخول.");
    setTimeout(() => router.push("/login"), 1200);
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
      title="إنشاء حساب جديد"
      subtitle="ابدأ استخدام نظام إدارة مؤسسة ياسر الرفاعي للمحاماة."
      footer={
        <>
          عندك حساب بالفعل؟{" "}
          <Link href="/login" className="font-black text-black underline-offset-4 hover:underline">
            تسجيل الدخول
          </Link>
        </>
      }
    >
      <form onSubmit={handleSignup} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-black text-black">
            الاسم
          </label>
          <div className="rounded-[22px] border border-black/10 bg-white/75 px-4 shadow-sm backdrop-blur-2xl transition focus-within:border-black/40 focus-within:ring-4 focus-within:ring-black/5">
            <input
              type="text"
              placeholder="مثال: أ. ياسر الرفاعي"
              className="h-14 w-full bg-transparent text-sm font-semibold text-black outline-none placeholder:text-zinc-400"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
        </div>

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
              placeholder="6 أحرف على الأقل"
              className="h-14 w-full bg-transparent text-sm font-semibold text-black outline-none placeholder:text-zinc-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />

            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="whitespace-nowrap rounded-2xl bg-zinc-100 px-3 py-2 text-xs font-black text-black transition hover:bg-zinc-200"
            >
              {showPassword ? "إخفاء" : "إظهار"}
            </button>
          </div>

          <div className="mt-3">
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className={`h-2 flex-1 rounded-full transition ${
                    strength >= item ? "bg-black" : "bg-zinc-300/80"
                  }`}
                />
              ))}
            </div>
            <p className="mt-2 text-xs font-black text-zinc-600">
              قوة كلمة المرور: {strengthText}
            </p>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-black text-black">
            تأكيد كلمة المرور
          </label>
          <div className="rounded-[22px] border border-black/10 bg-white/75 px-4 shadow-sm backdrop-blur-2xl transition focus-within:border-black/40 focus-within:ring-4 focus-within:ring-black/5">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="أعد كتابة كلمة المرور"
              className="h-14 w-full bg-transparent text-sm font-semibold text-black outline-none placeholder:text-zinc-400"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
        </div>

        {error ? (
          <div className="rounded-[22px] border border-red-200 bg-red-50/80 px-4 py-3 text-sm font-bold text-red-700 backdrop-blur-xl">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-[22px] border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm font-bold text-emerald-700 backdrop-blur-xl">
            {success}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="h-14 w-full rounded-[22px] bg-black text-sm font-black text-white shadow-[0_16px_35px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {loading ? "جاري إنشاء الحساب..." : "إنشاء الحساب"}
        </button>
      </form>
    </AuthShell>
  );
}

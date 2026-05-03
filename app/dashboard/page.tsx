"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import LoadingCard from "@/components/ui/LoadingCard";
import Badge from "@/components/ui/Badge";
import { supabase } from "@/lib/supabase";
import {
  caseStatusLabels,
  courtCategoryLabels,
  documentTypeLabels,
  formatDate,
  formatMoney,
} from "@/lib/labels";

type DashboardStats = {
  clients: number;
  cases: number;
  documents: number;
  hearings: number;
  tasks: number;
  agreedFees: number;
  paidFees: number;
  unpaidFees: number;
  expenses: number;
};

type CaseRow = {
  id: string;
  title: string;
  case_number: string | null;
  case_year: string | null;
  court_name: string | null;
  court_category: string;
  status: string;
  next_hearing_date: string | null;
  agreed_fee_amount: number | null;
  paid_fee_amount: number | null;
  fee_notes: string | null;
  created_at: string;
  clients: { id: string; name: string } | null;
};

type HearingRow = {
  id: string;
  hearing_date: string;
  court_name: string | null;
  circuit: string | null;
  required_action: string | null;
  cases: {
    title: string;
    case_number: string | null;
    case_year: string | null;
  } | null;
};

type DocumentRow = {
  id: string;
  title: string;
  document_type: string;
  file_name: string;
  created_at: string;
  clients: { id: string; name: string } | null;
  cases: { title: string } | null;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function numberValue(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function caseFees(item: Pick<CaseRow, "agreed_fee_amount" | "paid_fee_amount">) {
  const agreed = numberValue(item.agreed_fee_amount);
  const paid = numberValue(item.paid_fee_amount);
  return { agreed, paid, remaining: Math.max(agreed - paid, 0) };
}

export default function DashboardPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");

  const [stats, setStats] = useState<DashboardStats>({
    clients: 0,
    cases: 0,
    documents: 0,
    hearings: 0,
    tasks: 0,
    agreedFees: 0,
    paidFees: 0,
    unpaidFees: 0,
    expenses: 0,
  });

  const [latestCases, setLatestCases] = useState<CaseRow[]>([]);
  const [upcomingHearings, setUpcomingHearings] = useState<HearingRow[]>([]);
  const [latestDocuments, setLatestDocuments] = useState<DocumentRow[]>([]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError("");

      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.replace("/login");
        return;
      }

      setUserId(data.user.id);
      setUserEmail(data.user.email || "");
      await fetchDashboard();
      setLoading(false);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function fetchDashboard() {
    setRefreshing(true);
    setError("");
    const today = todayISO();

    const clientsResult = await supabase
      .from("clients")
      .select("*", { count: "exact", head: true });

    const casesCountResult = await supabase
      .from("cases")
      .select("*", { count: "exact", head: true });

    const allCasesResult = await supabase
      .from("cases")
      .select("agreed_fee_amount,paid_fee_amount");

    const documentsResult = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true });

    const hearingsResult = await supabase
      .from("hearings")
      .select("*", { count: "exact", head: true })
      .gte("hearing_date", today);

    const tasksResult = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .neq("status", "done");

    const paymentsResult = await supabase
      .from("payments")
      .select("amount,payment_type,status");

    const latestCasesResult = await supabase
      .from("cases")
      .select(
        "id,title,case_number,case_year,court_name,court_category,status,next_hearing_date,agreed_fee_amount,paid_fee_amount,fee_notes,created_at,clients(id,name)"
      )
      .order("created_at", { ascending: false })
      .limit(6);

    const upcomingHearingsResult = await supabase
      .from("hearings")
      .select(
        "id,hearing_date,court_name,circuit,required_action,cases(title,case_number,case_year)"
      )
      .gte("hearing_date", today)
      .order("hearing_date", { ascending: true })
      .limit(6);

    const latestDocumentsResult = await supabase
      .from("documents")
      .select("id,title,document_type,file_name,created_at,clients(id,name),cases(title)")
      .order("created_at", { ascending: false })
      .limit(6);

    const results = [
      clientsResult,
      casesCountResult,
      allCasesResult,
      documentsResult,
      hearingsResult,
      tasksResult,
      paymentsResult,
      latestCasesResult,
      upcomingHearingsResult,
      latestDocumentsResult,
    ];

    const failed = results.find((result) => result.error);

    if (failed?.error) {
      setError(failed.error.message);
      setRefreshing(false);
      return;
    }

    const casesFees = (allCasesResult.data || []) as Pick<CaseRow, "agreed_fee_amount" | "paid_fee_amount">[];
    const agreedFees = casesFees.reduce((sum, item) => sum + caseFees(item).agreed, 0);
    const paidFees = casesFees.reduce((sum, item) => sum + caseFees(item).paid, 0);
    const unpaidFees = Math.max(agreedFees - paidFees, 0);

    const payments = paymentsResult.data || [];
    const expenses = payments
      .filter((p) => p.payment_type === "expense")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    setStats({
      clients: clientsResult.count || 0,
      cases: casesCountResult.count || 0,
      documents: documentsResult.count || 0,
      hearings: hearingsResult.count || 0,
      tasks: tasksResult.count || 0,
      agreedFees,
      paidFees,
      unpaidFees,
      expenses,
    });

    setLatestCases((latestCasesResult.data || []) as unknown as CaseRow[]);
    setUpcomingHearings((upcomingHearingsResult.data || []) as unknown as HearingRow[]);
    setLatestDocuments((latestDocumentsResult.data || []) as unknown as DocumentRow[]);
    setRefreshing(false);
  }

  async function seedDemoData() {
    if (!userId) return;

    setSeeding(true);
    setError("");

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({
        user_id: userId,
        name: "أحمد محمد علي",
        client_type: "individual",
        phone: "01012345678",
        whatsapp: "01012345678",
        email: "ahmed.mohamed.long.email.demo@example.com",
        national_id: "29801011234567",
        address: "مدينة نصر - القاهرة",
        governorate: "القاهرة",
        legal_capacity: "مدعي",
        occupation: "صاحب شركة",
        notes: "موكل تجريبي لعرض النظام.",
      })
      .select()
      .single();

    if (clientError || !client) {
      setError(clientError?.message || "فشل إنشاء موكل تجريبي.");
      setSeeding(false);
      return;
    }

    const { data: caseOne, error: caseError } = await supabase
      .from("cases")
      .insert({
        user_id: userId,
        client_id: client.id,
        title: "دعوى مطالبة مالية",
        case_number: "245",
        case_year: "2026",
        court_category: "civil",
        litigation_degree: "first_instance",
        court_name: "محكمة جنوب القاهرة الابتدائية",
        circuit: "الدائرة 7 مدني",
        roll_number: "رول 38",
        case_type: "مدني كلي",
        client_role: "مدعي",
        opponent_name: "شركة النور للتوريدات",
        opponent_lawyer: "غير محدد",
        status: "open",
        filing_date: "2026-04-15",
        next_hearing_date: "2026-05-20",
        agreed_fee_amount: 30000,
        paid_fee_amount: 15000,
        fee_notes: "المتبقي يسدد على دفعتين.",
        last_decision: "تأجيل للإعلان وتقديم أصل العقد.",
        required_action: "تجهيز أصل العقد وصورة التوكيل.",
        notes: "قضية تجريبية للديمو.",
      })
      .select()
      .single();

    if (caseError || !caseOne) {
      setError(caseError?.message || "فشل إنشاء قضية تجريبية.");
      setSeeding(false);
      return;
    }

    await supabase.from("hearings").insert({
      user_id: userId,
      case_id: caseOne.id,
      hearing_date: "2026-05-20",
      court_name: "محكمة جنوب القاهرة الابتدائية",
      circuit: "الدائرة 7 مدني",
      decision: "تأجيل للإعلان",
      required_action: "تجهيز أصل العقد وصورة التوكيل.",
      notes: "جلسة ديمو.",
    });

    await supabase.from("tasks").insert({
      user_id: userId,
      client_id: client.id,
      case_id: caseOne.id,
      title: "مراجعة الإعلان قبل الجلسة",
      description: "التأكد من تمام الإعلان وتحضير حافظة المستندات.",
      due_date: "2026-05-18",
      status: "pending",
      priority: "high",
    });

    await supabase.from("payments").insert([
      {
        user_id: userId,
        client_id: client.id,
        case_id: caseOne.id,
        amount: 15000,
        payment_type: "fee",
        status: "paid",
        payment_date: "2026-04-16",
        notes: "دفعة أولى من أتعاب القضية.",
      },
      {
        user_id: userId,
        client_id: client.id,
        case_id: caseOne.id,
        amount: 1200,
        payment_type: "expense",
        status: "paid",
        payment_date: "2026-04-17",
        notes: "مصاريف تصوير وانتقال.",
      },
    ]);

    await fetchDashboard();
    setSeeding(false);
  }

  const hasNoData = useMemo(() => {
    return stats.clients === 0 && stats.cases === 0 && stats.documents === 0 && stats.hearings === 0 && stats.tasks === 0;
  }, [stats]);

  if (loading) {
    return <LoadingCard text="جاري تحميل لوحة التحكم..." />;
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Dashboard"
          title="لوحة التحكم"
          tone="black"
          description={`مرحبًا بك في نظام مؤسسة ياسر الرفاعي للمحاماة. الحساب الحالي: ${userEmail}`}
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={fetchDashboard}
                disabled={refreshing}
                className="h-12 rounded-[20px] border border-black/10 bg-white/80 px-5 text-sm font-black text-black shadow-sm transition hover:bg-white disabled:opacity-60"
              >
                {refreshing ? "جاري التحديث..." : "تحديث البيانات"}
              </button>

              {hasNoData ? (
                <button
                  onClick={seedDemoData}
                  disabled={seeding}
                  className="h-12 rounded-[20px] bg-black px-5 text-sm font-black text-white shadow-lg transition hover:bg-zinc-800 disabled:opacity-60"
                >
                  {seeding ? "جاري إضافة الديمو..." : "إضافة بيانات ديمو"}
                </button>
              ) : null}
            </div>
          }
        />

        {error ? (
          <div className="rounded-[26px] border border-red-200 bg-red-50/80 p-4 text-sm font-bold leading-7 text-red-700 backdrop-blur-xl">
            <p className="font-black">خطأ في قراءة البيانات:</p>
            <p className="mt-2 break-words">{error}</p>
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="الموكلين" value={stats.clients} hint="إجمالي الموكلين" tone="blue" />
          <StatCard label="القضايا" value={stats.cases} hint="إجمالي القضايا" tone="violet" />
          <StatCard label="المستندات" value={stats.documents} hint="ملفات PDF محفوظة" tone="emerald" />
          <StatCard label="الجلسات القادمة" value={stats.hearings} hint="من اليوم فصاعدًا" tone="amber" />
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard label="الأتعاب المتفق عليها" value={formatMoney(stats.agreedFees)} tone="violet" />
          <StatCard label="الأتعاب المدفوعة" value={formatMoney(stats.paidFees)} tone="teal" />
          <StatCard label="الأتعاب المتبقية" value={formatMoney(stats.unpaidFees)} tone="rose" />
          <StatCard label="المصروفات" value={formatMoney(stats.expenses)} tone="black" />
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel title="آخر القضايا" description="أحدث القضايا المسجلة مع ملخص الأتعاب">
            {latestCases.length === 0 ? (
              <EmptyState title="لا توجد قضايا" description="ابدأ بإضافة موكل ثم أضف قضية مرتبطة به." />
            ) : (
              <div className="space-y-3">
                {latestCases.map((item) => {
                  const fees = caseFees(item);
                  return (
                    <Link key={item.id} href={item.clients?.id ? `/clients/${item.clients.id}` : "/clients"} className="block min-w-0 rounded-[26px] border border-black/5 bg-white/75 p-4 shadow-sm">
                      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="break-words font-black text-black">{item.title}</h3>
                          <p className="mt-1 break-words text-sm font-bold text-zinc-600">
                            {item.clients?.name || "موكل غير محدد"} — رقم {item.case_number || "—"} لسنة {item.case_year || "—"}
                          </p>
                          <p className="mt-1 break-words text-xs font-bold text-zinc-500">{item.court_name || "محكمة غير محددة"}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Badge tone="violet">{caseStatusLabels[item.status as keyof typeof caseStatusLabels] || item.status}</Badge>
                          <Badge tone="blue">{courtCategoryLabels[item.court_category as keyof typeof courtCategoryLabels] || item.court_category}</Badge>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-2 text-xs font-bold text-zinc-600 sm:grid-cols-3">
                        <div className="rounded-2xl bg-zinc-100/80 px-3 py-2">المتفق: {formatMoney(fees.agreed)}</div>
                        <div className="rounded-2xl bg-zinc-100/80 px-3 py-2">المدفوع: {formatMoney(fees.paid)}</div>
                        <div className="rounded-2xl bg-zinc-100/80 px-3 py-2">المتبقي: {formatMoney(fees.remaining)}</div>
                      </div>
                      <p className="mt-3 text-xs font-bold text-zinc-500">الجلسة القادمة: {formatDate(item.next_hearing_date)}</p>
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title="أقرب الجلسات" description="الجلسات القادمة حسب التاريخ">
            {upcomingHearings.length === 0 ? (
              <EmptyState title="لا توجد جلسات قريبة" description="عند إضافة جلسة بتاريخ قادم ستظهر هنا." />
            ) : (
              <div className="space-y-3">
                {upcomingHearings.map((item) => (
                  <div key={item.id} className="min-w-0 rounded-[26px] border border-black/5 bg-white/75 p-4 shadow-sm">
                    <Badge tone="amber">{formatDate(item.hearing_date)}</Badge>
                    <h3 className="mt-3 break-words font-black text-black">{item.cases?.title || "قضية غير محددة"}</h3>
                    <p className="mt-1 break-words text-sm font-bold text-zinc-600">{item.court_name || "محكمة غير محددة"} {item.circuit ? `— ${item.circuit}` : ""}</p>
                    <p className="mt-3 break-words text-xs font-bold leading-6 text-zinc-600">المطلوب: {item.required_action || "لا يوجد"}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </section>

        <Panel title="آخر المستندات" description="آخر ملفات PDF المرفوعة">
          {latestDocuments.length === 0 ? (
            <EmptyState title="لا توجد مستندات" description="بعد رفع ملفات PDF ستظهر هنا بعناوينها." />
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {latestDocuments.map((doc) => (
                <div key={doc.id} className="min-w-0 rounded-[26px] border border-black/5 bg-white/75 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words font-black text-black">{doc.title}</h3>
                      <p className="mt-1 break-all text-xs font-bold text-zinc-500">{doc.file_name}</p>
                    </div>
                    <Badge tone="emerald">{documentTypeLabels[doc.document_type as keyof typeof documentTypeLabels] || "PDF"}</Badge>
                  </div>
                  <p className="mt-3 break-words text-xs font-bold text-zinc-600">
                    الموكل: {doc.clients?.name || "غير محدد"} — القضية: {doc.cases?.title || "غير محددة"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <section className="rounded-[34px] border border-white/10 bg-black p-6 text-white shadow-[0_25px_80px_rgba(0,0,0,0.20)]">
          <h2 className="text-2xl font-black">Smart Alerts</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <AlertCard title="جلسات قريبة" text={stats.hearings > 0 ? `عندك ${stats.hearings} جلسة قادمة تحتاج متابعة.` : "لا توجد جلسات قريبة حاليًا."} />
            <AlertCard title="أتعاب متبقية" text={stats.unpaidFees > 0 ? `يوجد ${formatMoney(stats.unpaidFees)} أتعاب متبقية.` : "لا توجد أتعاب متبقية."} />
            <AlertCard title="مصروفات" text={stats.expenses > 0 ? `إجمالي المصروفات المسجلة ${formatMoney(stats.expenses)}.` : "لا توجد مصروفات مسجلة."} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-[34px] border border-white/70 bg-white/70 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.07)] backdrop-blur-3xl">
      <div className="mb-5 min-w-0">
        <h2 className="break-words text-xl font-black text-black">{title}</h2>
        {description ? <p className="mt-1 text-sm font-semibold text-zinc-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function AlertCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="min-w-0 rounded-[26px] border border-white/10 bg-white/10 p-5">
      <h3 className="break-words font-black text-white">{title}</h3>
      <p className="mt-2 break-words text-sm font-semibold leading-7 text-zinc-300">{text}</p>
    </div>
  );
}

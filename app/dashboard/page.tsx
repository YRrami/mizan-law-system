
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import LoadingCard from "@/components/ui/LoadingCard";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { useCurrentRole } from "@/hooks/useCurrentRole";
import { supabase } from "@/lib/supabase";
import {
  caseStatusLabels,
  courtCategoryLabels,
  documentTypeLabels,
  formatDate,
  formatMoney,
  taskPriorityLabels,
  taskStatusLabels,
} from "@/lib/labels";
import type { TaskPriority, TaskStatus } from "@/lib/types";

type DashboardStats = {
  clients: number;
  cases: number;
  documents: number;
  hearings: number;
  tasks: number;
  overdueTasks: number;
  todayTasks: number;
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
  agreed_fee_amount?: number | null;
  paid_fee_amount?: number | null;
  fee_notes?: string | null;
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

type TaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assigned_to: string;
  completion_notes: string | null;
  cases: { title: string } | null;
  clients: { name: string } | null;
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

function taskDueTone(task: TaskRow): "teal" | "amber" | "rose" | "zinc" {
  if (task.status === "done") return "teal";
  if (task.status === "cancelled") return "zinc";
  if (!task.due_date) return "zinc";
  if (task.due_date < todayISO()) return "rose";
  if (task.due_date === todayISO()) return "amber";
  return "teal";
}

function taskDueLabel(task: TaskRow) {
  const tone = taskDueTone(task);
  if (tone === "rose") return "متأخرة";
  if (tone === "amber") return "اليوم";
  if (task.status === "done") return "تمت";
  if (task.status === "cancelled") return "ملغاة";
  if (!task.due_date) return "بدون موعد";
  return "قادمة";
}

export default function DashboardPage() {
  const router = useRouter();
  const { isAdmin, loadingRole, profile } = useCurrentRole();

  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [stats, setStats] = useState<DashboardStats>({
    clients: 0,
    cases: 0,
    documents: 0,
    hearings: 0,
    tasks: 0,
    overdueTasks: 0,
    todayTasks: 0,
    agreedFees: 0,
    paidFees: 0,
    unpaidFees: 0,
    expenses: 0,
  });

  const [latestCases, setLatestCases] = useState<CaseRow[]>([]);
  const [upcomingHearings, setUpcomingHearings] = useState<HearingRow[]>([]);
  const [latestDocuments, setLatestDocuments] = useState<DocumentRow[]>([]);
  const [latestTasks, setLatestTasks] = useState<TaskRow[]>([]);

  useEffect(() => {
    if (loadingRole) return;

    async function init() {
      setLoading(true);
      setError("");

      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.replace("/login");
        return;
      }

      setUserEmail(data.user.email || "");
      await fetchDashboard();
      setLoading(false);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, loadingRole, isAdmin]);

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

    const documentsResult = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true });

    const hearingsResult = await supabase
      .from("hearings")
      .select("*", { count: "exact", head: true })
      .gte("hearing_date", today);

    const tasksResult = await supabase
      .from("tasks")
      .select("id,status,due_date", { count: "exact" });

    const latestTasksResult = await supabase
      .from("tasks")
      .select("id,title,status,priority,due_date,assigned_to,completion_notes,cases(title),clients(name)")
      .neq("status", "done")
      .neq("status", "cancelled")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(6);

    const latestCasesSelect = isAdmin
      ? "id,title,case_number,case_year,court_name,court_category,status,next_hearing_date,agreed_fee_amount,paid_fee_amount,fee_notes,created_at,clients(id,name)"
      : "id,title,case_number,case_year,court_name,court_category,status,next_hearing_date,created_at,clients(id,name)";

    const latestCasesResult = await supabase
      .from("cases")
      .select(latestCasesSelect)
      .order("created_at", { ascending: false })
      .limit(6);

    const upcomingHearingsResult = await supabase
      .from("hearings")
      .select("id,hearing_date,court_name,circuit,required_action,cases(title,case_number,case_year)")
      .gte("hearing_date", today)
      .order("hearing_date", { ascending: true })
      .limit(6);

    const latestDocumentsResult = await supabase
      .from("documents")
      .select("id,title,document_type,file_name,created_at,clients(id,name),cases(title)")
      .order("created_at", { ascending: false })
      .limit(6);

    const baseResults = [
      clientsResult,
      casesCountResult,
      documentsResult,
      hearingsResult,
      tasksResult,
      latestTasksResult,
      latestCasesResult,
      upcomingHearingsResult,
      latestDocumentsResult,
    ];

    const failed = baseResults.find((result) => result.error);

    if (failed?.error) {
      setError(failed.error.message);
      setRefreshing(false);
      return;
    }

    let agreedFees = 0;
    let paidFees = 0;
    let unpaidFees = 0;
    let expenses = 0;

    if (isAdmin) {
      const allCasesResult = await supabase
        .from("cases")
        .select("agreed_fee_amount,paid_fee_amount");

      const paymentsResult = await supabase
        .from("payments")
        .select("amount,payment_type,status");

      if (allCasesResult.error || paymentsResult.error) {
        setError(allCasesResult.error?.message || paymentsResult.error?.message || "فشل تحميل الماليات.");
        setRefreshing(false);
        return;
      }

      const casesFees = (allCasesResult.data || []) as Pick<CaseRow, "agreed_fee_amount" | "paid_fee_amount">[];
      agreedFees = casesFees.reduce((sum, item) => sum + caseFees(item).agreed, 0);
      paidFees = casesFees.reduce((sum, item) => sum + caseFees(item).paid, 0);
      unpaidFees = Math.max(agreedFees - paidFees, 0);

      const payments = paymentsResult.data || [];
      expenses = payments
        .filter((p) => p.payment_type === "expense")
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    }

    const taskRows = (tasksResult.data || []) as Pick<TaskRow, "status" | "due_date">[];
    const activeTasks = taskRows.filter((task) => task.status !== "done" && task.status !== "cancelled");
    const overdueTasks = activeTasks.filter((task) => task.due_date && task.due_date < today).length;
    const todayTasks = activeTasks.filter((task) => task.due_date === today).length;

    setStats({
      clients: clientsResult.count || 0,
      cases: casesCountResult.count || 0,
      documents: documentsResult.count || 0,
      hearings: hearingsResult.count || 0,
      tasks: tasksResult.count || 0,
      overdueTasks,
      todayTasks,
      agreedFees,
      paidFees,
      unpaidFees,
      expenses,
    });

    setLatestCases((latestCasesResult.data || []) as unknown as CaseRow[]);
    setUpcomingHearings((upcomingHearingsResult.data || []) as unknown as HearingRow[]);
    setLatestDocuments((latestDocumentsResult.data || []) as unknown as DocumentRow[]);
    setLatestTasks((latestTasksResult.data || []) as unknown as TaskRow[]);
    setRefreshing(false);
  }

  const emptySystem = useMemo(() => {
    return stats.clients === 0 && stats.cases === 0 && stats.documents === 0 && stats.hearings === 0 && stats.tasks === 0;
  }, [stats]);

  if (loading || loadingRole) {
    return <LoadingCard text="جاري تجهيز لوحة التحكم..." />;
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          eyebrow={isAdmin ? "Admin Dashboard" : "User Dashboard"}
          title="لوحة التحكم"
          tone="black"
          description={
            isAdmin
              ? "نظرة عامة على الموكلين والقضايا والجلسات والمستندات والمهام والماليات."
              : "نظرة عامة على ملفاتك غير المالية والمهام المكلف بها حسابك."
          }
          action={
            <button
              onClick={fetchDashboard}
              disabled={refreshing}
              className="h-12 rounded-[20px] border border-black/10 bg-white/80 px-5 text-sm font-black text-black shadow-sm transition hover:bg-white disabled:opacity-60"
            >
              {refreshing ? "جاري التحديث..." : "تحديث البيانات"}
            </button>
          }
        />

        {error ? (
          <div className="rounded-[26px] border border-red-200 bg-red-50/80 p-4 text-sm font-bold leading-7 text-red-700 backdrop-blur-xl">
            <p className="font-black">فيه مشكلة في قراءة البيانات:</p>
            <p className="mt-2 break-words">{error}</p>
          </div>
        ) : null}

        <section className="rounded-[30px] border border-white/70 bg-white/70 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.07)] backdrop-blur-3xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black text-zinc-500">الحساب الحالي</p>
              <h2 className="mt-1 break-all text-xl font-black text-black">
                {profile?.full_name || userEmail || "مستخدم"}
              </h2>
              <p className="mt-1 break-all text-xs font-bold text-zinc-500">{userEmail}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge tone={isAdmin ? "blue" : "zinc"}>{isAdmin ? "Admin" : "Regular User"}</Badge>
              <Badge tone={stats.overdueTasks > 0 ? "rose" : "teal"}>مهام متأخرة: {stats.overdueTasks}</Badge>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="الموكلين" value={stats.clients} hint="إجمالي الموكلين المتاحين لك" tone="blue" />
          <StatCard label="القضايا" value={stats.cases} hint="إجمالي القضايا" tone="violet" />
          <StatCard label="الجلسات القادمة" value={stats.hearings} hint="من اليوم فصاعدًا" tone="amber" />
          <StatCard label="المهام النشطة" value={stats.tasks} hint={`اليوم: ${stats.todayTasks} | متأخرة: ${stats.overdueTasks}`} tone="rose" />
        </section>

        {isAdmin ? (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="الأتعاب المتفق عليها" value={formatMoney(stats.agreedFees)} tone="violet" />
            <StatCard label="الأتعاب المدفوعة" value={formatMoney(stats.paidFees)} tone="teal" />
            <StatCard label="الأتعاب المتبقية" value={formatMoney(stats.unpaidFees)} tone="rose" />
            <StatCard label="المصروفات" value={formatMoney(stats.expenses)} tone="amber" />
          </section>
        ) : null}

        {emptySystem ? (
          <EmptyState
            title="ابدأ بإضافة أول بيانات"
            description="ابدأ بإضافة موكل أو قضية أو مستند. المهام تظهر هنا بعد تكليفك بها."
            action={<Link href="/clients" className="rounded-2xl bg-black px-5 py-3 text-sm font-black text-white">إضافة موكل</Link>}
          />
        ) : null}

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Panel title="آخر القضايا" description={isAdmin ? "أحدث القضايا المسجلة مع ملخص الأتعاب" : "أحدث القضايا المسجلة"}>
            {latestCases.length === 0 ? (
              <EmptyState title="لا توجد قضايا" />
            ) : (
              <div className="space-y-3">
                {latestCases.map((item) => {
                  const fees = caseFees(item);

                  return (
                    <Link key={item.id} href={`/clients/${item.clients?.id || ""}`} className="block rounded-[24px] border border-black/5 bg-white/70 p-4 shadow-sm transition hover:bg-white">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="break-words text-base font-black text-black">{item.title}</h3>
                          <p className="mt-1 break-words text-xs font-bold text-zinc-600">
                            {item.clients?.name || "موكل غير محدد"} · رقم {item.case_number || "—"} / {item.case_year || "—"}
                          </p>
                          <p className="mt-1 break-words text-xs font-bold text-zinc-500">{item.court_name || "محكمة غير محددة"}</p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          <Badge tone="violet">{caseStatusLabels[item.status as keyof typeof caseStatusLabels] || item.status}</Badge>
                          <Badge tone="blue">{courtCategoryLabels[item.court_category as keyof typeof courtCategoryLabels] || item.court_category}</Badge>
                        </div>
                      </div>
                      {isAdmin ? (
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-black">
                          <Mini label="متفق" value={formatMoney(fees.agreed)} />
                          <Mini label="مدفوع" value={formatMoney(fees.paid)} />
                          <Mini label="متبقي" value={formatMoney(fees.remaining)} />
                        </div>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title="المهام" description={isAdmin ? "آخر المهام المفتوحة لكل المستخدمين" : "مهامك المفتوحة"}>
            {latestTasks.length === 0 ? (
              <EmptyState title="لا توجد مهام نشطة" />
            ) : (
              <div className="space-y-3">
                {latestTasks.map((task) => (
                  <Link key={task.id} href="/tasks" className="block rounded-[24px] border border-black/5 bg-white/70 p-4 shadow-sm transition hover:bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-base font-black text-black">{task.title}</h3>
                        <p className="mt-1 truncate text-xs font-bold text-zinc-600">{task.cases?.title || task.clients?.name || "غير مرتبطة بملف"}</p>
                        <p className="mt-1 text-xs font-bold text-zinc-500">الموعد: {formatDate(task.due_date)}</p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2">
                        <Badge tone={taskDueTone(task)}>{taskDueLabel(task)}</Badge>
                        <Badge tone={task.priority === "urgent" ? "rose" : task.priority === "high" ? "amber" : "blue"}>{taskPriorityLabels[task.priority]}</Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="الجلسات القادمة" description="أقرب الجلسات من اليوم">
            {upcomingHearings.length === 0 ? (
              <EmptyState title="لا توجد جلسات قادمة" />
            ) : (
              <div className="space-y-3">
                {upcomingHearings.map((item) => (
                  <div key={item.id} className="rounded-[24px] border border-black/5 bg-white/70 p-4 shadow-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="break-words text-base font-black text-black">{item.cases?.title || "قضية غير محددة"}</h3>
                        <p className="mt-1 text-xs font-bold text-zinc-600">{item.court_name || "محكمة غير محددة"} {item.circuit ? `· ${item.circuit}` : ""}</p>
                      </div>
                      <Badge tone="amber">{formatDate(item.hearing_date)}</Badge>
                    </div>
                    {item.required_action ? <p className="mt-3 text-sm font-bold leading-7 text-zinc-700">{item.required_action}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="آخر المستندات" description="أحدث ملفات PDF المرفوعة">
            {latestDocuments.length === 0 ? (
              <EmptyState title="لا توجد مستندات" />
            ) : (
              <div className="space-y-3">
                {latestDocuments.map((item) => (
                  <div key={item.id} className="rounded-[24px] border border-black/5 bg-white/70 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-base font-black text-black">{item.title}</h3>
                        <p className="mt-1 break-all text-xs font-bold text-zinc-500">{item.file_name}</p>
                        <p className="mt-1 text-xs font-bold text-zinc-600">{item.clients?.name || "بدون موكل"} · {item.cases?.title || "بدون قضية"}</p>
                      </div>
                      <Badge tone="emerald">{documentTypeLabels[item.document_type as keyof typeof documentTypeLabels] || item.document_type}</Badge>
                    </div>
                    <p className="mt-2 text-xs font-bold text-zinc-500">{formatDate(item.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </section>

        {!isAdmin ? (
          <Panel title="حدود صلاحية المستخدم" description="الصلاحيات المفعلة لحسابك">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <AlertCard title="المتاح" text="إضافة موكلين وقضايا وجلسات ومستندات، ومتابعة المهام المكلف بها حسابك." />
              <AlertCard title="غير متاح" text="عرض الماليات أو تعديل/حذف السجلات. هذه الصلاحيات للمدير فقط." />
            </div>
          </Panel>
        ) : null}
      </div>
    </AppShell>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-[34px] border border-white/70 bg-white/70 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.07)] backdrop-blur-3xl">
      <div className="mb-5 min-w-0">
        <h2 className="break-words text-xl font-black text-black">{title}</h2>
        {description ? <p className="mt-1 text-sm font-semibold leading-6 text-zinc-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-zinc-100/80 px-3 py-2">
      <p className="text-[10px] font-black text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-xs font-black text-black">{value}</p>
    </div>
  );
}

function AlertCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[24px] border border-black/5 bg-white/70 p-4 shadow-sm">
      <h3 className="text-sm font-black text-black">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-7 text-zinc-600">{text}</p>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/ui/EmptyState";
import LoadingCard from "@/components/ui/LoadingCard";
import PageHeader from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/labels";

type ClientLite = {
  id: string;
  name: string;
  phone: string | null;
};

type CaseLite = {
  id: string;
  client_id: string | null;
  title: string;
  case_number: string | null;
  case_year: string | null;
  court_name: string | null;
  circuit: string | null;
  clients?: ClientLite | null;
};

type HearingRow = {
  id: string;
  hearing_date: string;
  court_name: string | null;
  circuit: string | null;
  required_action: string | null;
  notes: string | null;
  cases?: CaseLite | null;
};

type CalendarFilter = "all" | "today" | "week" | "month";

const WEEK_DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function todayISO(): string {
  return toISODate(new Date());
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function plannerMonthTitle(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  })
    .format(date)
    .toUpperCase();
}

function arabicMonthTitle(date: Date): string {
  return new Intl.DateTimeFormat("ar-EG", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function dayLongTitle(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);

  return new Intl.DateTimeFormat("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function buildCalendarWeeks(currentMonth: Date): Date[][] {
  const monthStart = getMonthStart(currentMonth);
  const monthEnd = getMonthEnd(currentMonth);

  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - monthStart.getDay());

  const calendarEnd = new Date(monthEnd);
  calendarEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));

  const days: Date[] = [];
  const cursor = new Date(calendarStart);

  while (cursor <= calendarEnd) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const weeks: Date[][] = [];

  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return weeks;
}

function groupByDate(hearings: HearingRow[]): Record<string, HearingRow[]> {
  return hearings.reduce<Record<string, HearingRow[]>>((acc, hearing) => {
    if (!acc[hearing.hearing_date]) acc[hearing.hearing_date] = [];
    acc[hearing.hearing_date].push(hearing);
    return acc;
  }, {});
}

function daysBetween(start: string, end: string): number {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  return Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);
}

function getEventStyle(date: string): string {
  const diff = daysBetween(todayISO(), date);

  if (diff === 0) return "bg-slate-950 text-white";
  if (diff > 0 && diff <= 7) return "bg-slate-800 text-white";
  return "bg-slate-100 text-slate-800 ring-1 ring-slate-200";
}

function getTimingLabel(date: string): string {
  const diff = daysBetween(todayISO(), date);

  if (diff === 0) return "اليوم";
  if (diff === 1) return "غدًا";
  if (diff > 1 && diff <= 7) return `خلال ${diff} أيام`;
  if (diff > 7) return `بعد ${diff} يوم`;
  return "فاتت";
}

function getHearingTitle(hearing: HearingRow): string {
  return hearing.cases?.title || "جلسة";
}

function getClientName(hearing: HearingRow): string {
  return hearing.cases?.clients?.name || "موكل غير محدد";
}

function getCourtName(hearing: HearingRow): string {
  return hearing.court_name || hearing.cases?.court_name || "محكمة غير محددة";
}

function getCaseNumber(hearing: HearingRow): string {
  const number = hearing.cases?.case_number || "—";
  const year = hearing.cases?.case_year || "—";
  return `${number} / ${year}`;
}

export default function CalendarPage() {
  const router = useRouter();

  const [hearings, setHearings] = useState<HearingRow[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CalendarFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError("");

      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.replace("/login");
        return;
      }

      await fetchHearings();
      setLoading(false);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function fetchHearings() {
    setRefreshing(true);
    setError("");

    const { data, error } = await supabase
      .from("hearings")
      .select(
        "id,hearing_date,court_name,circuit,required_action,notes,cases(id,client_id,title,case_number,case_year,court_name,circuit,clients(id,name,phone))"
      )
      .gte("hearing_date", todayISO())
      .order("hearing_date", { ascending: true });

    setRefreshing(false);

    if (error) {
      setError(error.message);
      return;
    }

    setHearings(((data || []) as unknown) as HearingRow[]);
  }

  const filteredHearings = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = todayISO();
    const weekEnd = toISODate(new Date(Date.now() + 7 * 86400000));
    const monthStart = toISODate(getMonthStart(currentMonth));
    const monthEnd = toISODate(getMonthEnd(currentMonth));

    return hearings.filter((item) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "today" && item.hearing_date === today) ||
        (filter === "week" && item.hearing_date >= today && item.hearing_date <= weekEnd) ||
        (filter === "month" && item.hearing_date >= monthStart && item.hearing_date <= monthEnd);

      const haystack = [
        item.hearing_date,
        item.court_name,
        item.circuit,
        item.required_action,
        item.notes,
        item.cases?.title,
        item.cases?.case_number,
        item.cases?.case_year,
        item.cases?.clients?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesFilter && (!q || haystack.includes(q));
    });
  }, [hearings, search, filter, currentMonth]);

  const hearingsByDate = useMemo(() => groupByDate(filteredHearings), [filteredHearings]);
  const calendarWeeks = useMemo(() => buildCalendarWeeks(currentMonth), [currentMonth]);

  const selectedDateHearings = useMemo(() => {
    return filteredHearings.filter((item) => item.hearing_date === selectedDate);
  }, [filteredHearings, selectedDate]);

  const todayHearings = hearings.filter((item) => item.hearing_date === todayISO());
  const weekHearings = hearings.filter((item) => {
    const weekEnd = toISODate(new Date(Date.now() + 7 * 86400000));
    return item.hearing_date >= todayISO() && item.hearing_date <= weekEnd;
  });

  const monthHearings = hearings.filter((item) => {
    const start = toISODate(getMonthStart(currentMonth));
    const end = toISODate(getMonthEnd(currentMonth));
    return item.hearing_date >= start && item.hearing_date <= end;
  });

  const upcomingHearings = filteredHearings.slice(0, 6);

  if (loading) {
    return <LoadingCard text="جاري تحميل التقويم..." />;
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Calendar"
          title="تقويم الجلسات"
          tone="blue"
          description="تقويم شهري أفقي موحّد الألوان، مع اختيار اليوم وعرض الجلسات القادمة بتصميم أبسط."
          action={
            <button
              type="button"
              onClick={fetchHearings}
              disabled={refreshing}
              className="h-10 rounded-[16px] border border-slate-200 bg-white px-4 text-xs font-black text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              {refreshing ? "تحديث..." : "تحديث"}
            </button>
          }
        />

        {error ? (
          <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
            <div className="font-black">حدث خطأ:</div>
            <div className="mt-1 break-words">{error}</div>
          </div>
        ) : null}

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard label="اليوم" value={todayHearings.length} hint={formatDate(todayISO())} />
          <StatCard label="خلال 7 أيام" value={weekHearings.length} hint="الجلسات القريبة" />
          <StatCard label="هذا الشهر" value={monthHearings.length} hint={arabicMonthTitle(currentMonth)} />
          <StatCard label="اليوم المحدد" value={selectedDateHearings.length} hint={dayLongTitle(selectedDate)} />
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white/88 p-4 shadow-[0_16px_45px_rgba(15,23,42,0.06)] backdrop-blur-3xl">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_170px_170px_140px_140px]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="بحث باسم القضية أو الموكل أو المحكمة..."
              className="h-11 min-w-0 rounded-[16px] border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-400/10"
            />

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as CalendarFilter)}
              className="h-11 rounded-[16px] border border-slate-200 bg-white px-4 text-xs font-black text-slate-950 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-400/10"
            >
              <option value="all">كل الجلسات</option>
              <option value="today">اليوم</option>
              <option value="week">خلال 7 أيام</option>
              <option value="month">هذا الشهر</option>
            </select>

            <button
              type="button"
              onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
              className="h-11 rounded-[16px] bg-slate-100 px-4 text-xs font-black text-slate-900 transition hover:bg-slate-200"
            >
              الشهر السابق
            </button>

            <button
              type="button"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="h-11 rounded-[16px] bg-slate-100 px-4 text-xs font-black text-slate-900 transition hover:bg-slate-200"
            >
              التالي
            </button>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setFilter("all");
                setCurrentMonth(new Date());
                setSelectedDate(todayISO());
              }}
              className="h-11 rounded-[16px] bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-slate-900"
            >
              اليوم
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-200 bg-white px-4 py-6">
            <div className="flex flex-col items-center justify-center gap-2">
              <h2
                dir="ltr"
                className="text-center font-serif text-3xl font-black uppercase tracking-wide text-slate-950 sm:text-5xl"
              >
                {plannerMonthTitle(currentMonth)}
              </h2>
              <p className="text-xs font-black text-slate-500">
                اضغط على أي يوم لعرض تفاصيل الجلسات
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[1180px]">
              <table className="w-full table-fixed border-collapse" dir="ltr">
                <thead>
                  <tr>
                    {WEEK_DAYS.map((day) => (
                      <th
                        key={day}
                        className="border-r border-white/20 bg-slate-950 px-2 py-3 text-center text-xs font-black tracking-wide text-white last:border-r-0"
                      >
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {calendarWeeks.map((week, weekIndex) => (
                    <tr key={`week-${weekIndex}`}>
                      {week.map((day, dayIndex) => {
                        const iso = toISODate(day);
                        const dayHearings = hearingsByDate[iso] || [];
                        const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                        const isSelected = iso === selectedDate;
                        const isTodayCell = iso === todayISO();

                        return (
                          <td
                            key={`${weekIndex}-${dayIndex}-${iso}`}
                            className={`h-[150px] align-top border-r border-b border-slate-200 p-0 last:border-r-0 ${
                              isSelected ? "bg-slate-100" : "bg-white"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedDate(iso)}
                              className="flex h-full w-full flex-col p-3 text-left transition hover:bg-slate-100/50"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span
                                  className={`text-2xl leading-none ${
                                    isCurrentMonth ? "text-slate-950" : "text-slate-300"
                                  }`}
                                >
                                  {day.getDate()}
                                </span>

                                <div className="flex items-center gap-1">
                                  {dayHearings.length > 0 ? (
                                    <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-black text-white">
                                      {dayHearings.length}
                                    </span>
                                  ) : null}

                                  {isTodayCell ? (
                                    <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-black text-white">
                                      Today
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              <div className="mt-3 space-y-1.5">
                                {dayHearings.slice(0, 3).map((hearing) => (
                                  <div
                                    key={hearing.id}
                                    className={`truncate rounded-lg px-2 py-1.5 text-[10px] font-black ${getEventStyle(hearing.hearing_date)}`}
                                    title={`${getHearingTitle(hearing)} - ${getCourtName(hearing)}`}
                                  >
                                    {getHearingTitle(hearing)}
                                  </div>
                                ))}

                                {dayHearings.length > 3 ? (
                                  <div className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
                                    +{dayHearings.length - 3} جلسات أخرى
                                  </div>
                                ) : null}
                              </div>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[24px] border border-slate-200 bg-white/88 p-4 shadow-[0_16px_45px_rgba(15,23,42,0.06)] backdrop-blur-3xl">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-950">تفاصيل اليوم المحدد</h3>
                <p className="mt-1 text-xs font-bold text-slate-500">{dayLongTitle(selectedDate)}</p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-700 ring-1 ring-slate-200">
                {selectedDateHearings.length} جلسة
              </span>
            </div>

            {selectedDateHearings.length === 0 ? (
              <EmptyState title="لا توجد جلسات" description="اختر يومًا آخر من التقويم." />
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {selectedDateHearings.map((hearing) => (
                  <HearingCard key={hearing.id} hearing={hearing} />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white/88 p-4 shadow-[0_16px_45px_rgba(15,23,42,0.06)] backdrop-blur-3xl">
            <div className="mb-4">
              <h3 className="text-lg font-black text-slate-950">أقرب الجلسات القادمة</h3>
              <p className="mt-1 text-xs font-bold text-slate-500">أول 6 جلسات قادمة حسب الفلترة الحالية</p>
            </div>

            {upcomingHearings.length === 0 ? (
              <EmptyState title="لا توجد جلسات قادمة" description="لا توجد نتائج مطابقة." />
            ) : (
              <div className="space-y-3">
                {upcomingHearings.map((hearing) => (
                  <HearingCard key={hearing.id} hearing={hearing} compact />
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="min-w-0 rounded-[22px] border border-slate-200 bg-white/88 p-4 shadow-[0_16px_45px_rgba(15,23,42,0.05)] backdrop-blur-3xl">
      <p className="text-[11px] font-black text-slate-500">{label}</p>
      <h3 className="mt-2 break-words text-2xl font-black text-slate-950">{value}</h3>
      <p className="mt-1 truncate text-[11px] font-bold text-slate-500">{hint}</p>
    </div>
  );
}

function HearingCard({
  hearing,
  compact = false,
}: {
  hearing: HearingRow;
  compact?: boolean;
}) {
  return (
    <article className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="break-words text-sm font-black text-slate-950">{getHearingTitle(hearing)}</h4>
          <p className="mt-1 text-xs font-bold text-slate-600">{getClientName(hearing)}</p>
        </div>

        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-600 ring-1 ring-slate-200">
          {getTimingLabel(hearing.hearing_date)}
        </span>
      </div>

      <div className={`grid grid-cols-1 gap-2 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2"}`}>
        <Info label="تاريخ الجلسة">{formatDate(hearing.hearing_date)}</Info>
        <Info label="رقم القضية">{getCaseNumber(hearing)}</Info>
        <Info label="المحكمة">{getCourtName(hearing)}</Info>
        <Info label="الدائرة">{hearing.circuit || hearing.cases?.circuit || "غير محدد"}</Info>
      </div>

      {hearing.required_action ? (
        <div className="mt-3 rounded-[14px] bg-slate-100 p-3 text-xs font-bold leading-6 text-slate-950 ring-1 ring-slate-200">
          <span className="font-black">المطلوب: </span>
          {hearing.required_action}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/hearings"
          className="rounded-2xl bg-slate-100 px-3 py-2 text-[11px] font-black text-slate-900 ring-1 ring-slate-200"
        >
          إدارة الجلسات
        </Link>

        {hearing.cases?.client_id ? (
          <Link
            href={`/clients/${hearing.cases.client_id}`}
            className="rounded-2xl bg-slate-950 px-3 py-2 text-[11px] font-black text-white"
          >
            ملف الموكل
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function Info({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[14px] bg-white p-3 ring-1 ring-slate-200">
      <p className="text-[11px] font-black text-slate-500">{label}</p>
      <div className="mt-1 text-xs font-black text-slate-950">{children}</div>
    </div>
  );
}

"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import Can from "@/components/auth/Can";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Field from "@/components/ui/Field";
import LoadingCard from "@/components/ui/LoadingCard";
import PageHeader from "@/components/ui/PageHeader";
import ResponsiveText from "@/components/ui/ResponsiveText";
import SelectField from "@/components/ui/SelectField";
import TextareaField from "@/components/ui/TextareaField";
import { supabase } from "@/lib/supabase";
import {
  caseStatusLabels,
  courtCategoryLabels,
  formatDate,
} from "@/lib/labels";

type CaseStatus = keyof typeof caseStatusLabels;
type CourtCategory = keyof typeof courtCategoryLabels;
type HearingComputedStatus = "today" | "upcoming" | "overdue" | "done";

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
  court_category: CourtCategory;
  court_name: string | null;
  circuit: string | null;
  status: CaseStatus;
  next_hearing_date: string | null;
  last_decision: string | null;
  required_action: string | null;
  clients?: ClientLite | null;
};

type HearingRow = {
  id: string;
  user_id: string;
  case_id: string;
  hearing_date: string;
  court_name: string | null;
  circuit: string | null;
  decision: string | null;
  required_action: string | null;
  notes: string | null;
  created_at: string;
  cases?: CaseLite | null;
};

type HearingFormState = {
  case_id: string;
  hearing_date: string;
  court_name: string;
  circuit: string;
  decision: string;
  required_action: string;
  notes: string;
};

const emptyHearingForm: HearingFormState = {
  case_id: "",
  hearing_date: "",
  court_name: "",
  circuit: "",
  decision: "",
  required_action: "",
  notes: "",
};

function nullIfEmpty(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isPastDate(date: string | null | undefined): boolean {
  if (!date) return false;
  return date < todayISO();
}

function isToday(date: string | null | undefined): boolean {
  if (!date) return false;
  return date === todayISO();
}

function getHearingStatus(item: HearingRow): HearingComputedStatus {
  if (item.decision && isPastDate(item.hearing_date)) return "done";
  if (isToday(item.hearing_date)) return "today";
  if (isPastDate(item.hearing_date)) return "overdue";
  return "upcoming";
}

function hearingStatusLabel(status: HearingComputedStatus): string {
  const labels: Record<HearingComputedStatus, string> = {
    today: "اليوم",
    upcoming: "قادمة",
    overdue: "متأخرة",
    done: "تمت",
  };

  return labels[status];
}

function hearingStatusTone(status: HearingComputedStatus): "amber" | "blue" | "rose" | "teal" {
  const tones: Record<HearingComputedStatus, "amber" | "blue" | "rose" | "teal"> = {
    today: "amber",
    upcoming: "blue",
    overdue: "rose",
    done: "teal",
  };

  return tones[status];
}

function prettyCaseLabel(item: CaseLite): string {
  const numberPart = item.case_number ? ` — رقم ${item.case_number}` : "";
  const yearPart = item.case_year ? `/${item.case_year}` : "";
  const clientPart = item.clients?.name ? ` — ${item.clients.name}` : "";
  return `${item.title}${numberPart}${yearPart}${clientPart}`;
}

export default function HearingsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [cases, setCases] = useState<CaseLite[]>([]);
  const [hearings, setHearings] = useState<HearingRow[]>([]);

  const [form, setForm] = useState<HearingFormState>(emptyHearingForm);
  const [editForm, setEditForm] = useState<HearingFormState>(emptyHearingForm);

  const [selectedHearingId, setSelectedHearingId] = useState("");
  const [editingHearingId, setEditingHearingId] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | HearingComputedStatus>("all");
  const [caseFilter, setCaseFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"nearest" | "newest" | "oldest" | "case">("nearest");

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
      await fetchAll();
      setLoading(false);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function showSuccessMessage(message: string) {
    setSuccess(message);
    setTimeout(() => setSuccess(""), 2500);
  }

  async function fetchAll() {
    setRefreshing(true);
    setError("");

    const casesResult = await supabase
      .from("cases")
      .select(
        "id,client_id,title,case_number,case_year,court_category,court_name,circuit,status,next_hearing_date,last_decision,required_action,clients(id,name,phone)"
      )
      .order("created_at", { ascending: false });

    const hearingsResult = await supabase
      .from("hearings")
      .select(
        "*,cases(id,client_id,title,case_number,case_year,court_category,court_name,circuit,status,next_hearing_date,last_decision,required_action,clients(id,name,phone))"
      )
      .order("hearing_date", { ascending: true });

    if (casesResult.error) {
      setError(casesResult.error.message);
      setRefreshing(false);
      return;
    }

    if (hearingsResult.error) {
      setError(hearingsResult.error.message);
      setRefreshing(false);
      return;
    }

    const fetchedCases = ((casesResult.data || []) as unknown) as CaseLite[];
    const fetchedHearings = ((hearingsResult.data || []) as unknown) as HearingRow[];

    setCases(fetchedCases);
    setHearings(fetchedHearings);
    setSelectedHearingId((current) => current || fetchedHearings[0]?.id || "");
    setRefreshing(false);
  }

  const caseOptions = useMemo(() => {
    return [
      { value: "", label: "اختر القضية" },
      ...cases.map((item) => ({
        value: item.id,
        label: prettyCaseLabel(item),
      })),
    ];
  }, [cases]);

  const filterCaseOptions = useMemo(() => {
    return [
      { value: "all", label: "كل القضايا" },
      ...cases.map((item) => ({
        value: item.id,
        label: prettyCaseLabel(item),
      })),
    ];
  }, [cases]);

  const filteredHearings = useMemo(() => {
    const q = search.trim().toLowerCase();

    let result = hearings.filter((item) => {
      const status = getHearingStatus(item);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesCase = caseFilter === "all" || item.case_id === caseFilter;

      const searchable = [
        item.hearing_date,
        item.court_name,
        item.circuit,
        item.decision,
        item.required_action,
        item.notes,
        item.cases?.title,
        item.cases?.case_number,
        item.cases?.case_year,
        item.cases?.clients?.name,
        item.cases?.clients?.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && matchesCase && (!q || searchable.includes(q));
    });

    if (sortBy === "case") {
      result = [...result].sort((a, b) =>
        (a.cases?.title || "").localeCompare(b.cases?.title || "", "ar")
      );
    }

    if (sortBy === "oldest") {
      result = [...result].sort(
        (a, b) => new Date(a.hearing_date).getTime() - new Date(b.hearing_date).getTime()
      );
    }

    if (sortBy === "newest") {
      result = [...result].sort(
        (a, b) => new Date(b.hearing_date).getTime() - new Date(a.hearing_date).getTime()
      );
    }

    if (sortBy === "nearest") {
      result = [...result].sort((a, b) => {
        const today = todayISO();
        const aTime = a.hearing_date >= today
          ? new Date(a.hearing_date).getTime()
          : new Date("9999-12-31").getTime() + new Date(a.hearing_date).getTime();
        const bTime = b.hearing_date >= today
          ? new Date(b.hearing_date).getTime()
          : new Date("9999-12-31").getTime() + new Date(b.hearing_date).getTime();

        return aTime - bTime;
      });
    }

    return result;
  }, [hearings, search, statusFilter, caseFilter, sortBy]);

  const selectedHearing =
    hearings.find((item) => item.id === selectedHearingId) || filteredHearings[0] || null;

  const todayCount = hearings.filter((item) => getHearingStatus(item) === "today").length;
  const upcomingCount = hearings.filter((item) => getHearingStatus(item) === "upcoming").length;
  const overdueCount = hearings.filter((item) => getHearingStatus(item) === "overdue").length;
  const doneCount = hearings.filter((item) => getHearingStatus(item) === "done").length;

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setCaseFilter("all");
    setSortBy("nearest");
  }

  function autofillFromCase(caseId: string, mode: "create" | "edit") {
    const selectedCase = cases.find((item) => item.id === caseId);

    if (mode === "create") {
      setForm((prev) => ({
        ...prev,
        case_id: caseId,
        court_name: prev.court_name || selectedCase?.court_name || "",
        circuit: prev.circuit || selectedCase?.circuit || "",
        required_action: prev.required_action || selectedCase?.required_action || "",
      }));
      return;
    }

    setEditForm((prev) => ({
      ...prev,
      case_id: caseId,
      court_name: prev.court_name || selectedCase?.court_name || "",
      circuit: prev.circuit || selectedCase?.circuit || "",
      required_action: prev.required_action || selectedCase?.required_action || "",
    }));
  }

  async function updateRelatedCaseAfterHearing(formData: HearingFormState) {
    const casePatch: Record<string, string | null> = {
      updated_at: new Date().toISOString(),
    };

    const decision = nullIfEmpty(formData.decision);
    const requiredAction = nullIfEmpty(formData.required_action);
    const courtName = nullIfEmpty(formData.court_name);
    const circuit = nullIfEmpty(formData.circuit);

    if (formData.hearing_date >= todayISO()) {
      casePatch.next_hearing_date = formData.hearing_date;
    }

    if (decision) casePatch.last_decision = decision;
    if (requiredAction) casePatch.required_action = requiredAction;
    if (courtName) casePatch.court_name = courtName;
    if (circuit) casePatch.circuit = circuit;

    await supabase.from("cases").update(casePatch).eq("id", formData.case_id);
  }

  async function handleAddHearing(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!userId) return;

    if (!form.case_id) {
      setError("اختر القضية أولًا.");
      return;
    }

    if (!form.hearing_date) {
      setError("تاريخ الجلسة مطلوب.");
      return;
    }

    setSaving(true);

    const selectedCase = cases.find((item) => item.id === form.case_id);

    const payload: HearingFormState = {
      ...form,
      court_name: form.court_name || selectedCase?.court_name || "",
      circuit: form.circuit || selectedCase?.circuit || "",
    };

    const { data: createdHearing, error } = await supabase
      .from("hearings")
      .insert({
        user_id: userId,
        case_id: payload.case_id,
        hearing_date: payload.hearing_date,
        court_name: nullIfEmpty(payload.court_name),
        circuit: nullIfEmpty(payload.circuit),
        decision: nullIfEmpty(payload.decision),
        required_action: nullIfEmpty(payload.required_action),
        notes: nullIfEmpty(payload.notes),
      })
      .select("id")
      .single();

    if (!error) {
      await updateRelatedCaseAfterHearing(payload);
    }

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    const created = createdHearing as { id: string } | null;

    setForm(emptyHearingForm);
    setShowCreate(false);
    if (created?.id) setSelectedHearingId(created.id);
    showSuccessMessage("تمت إضافة الجلسة وتحديث القضية المرتبطة.");
    await fetchAll();
  }

  function startEditHearing(item: HearingRow) {
    setEditingHearingId(item.id);
    setEditForm({
      case_id: item.case_id || "",
      hearing_date: item.hearing_date || "",
      court_name: item.court_name || "",
      circuit: item.circuit || "",
      decision: item.decision || "",
      required_action: item.required_action || "",
      notes: item.notes || "",
    });
  }

  async function handleUpdateHearing(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!editingHearingId) return;

    if (!editForm.case_id) {
      setError("اختر القضية.");
      return;
    }

    if (!editForm.hearing_date) {
      setError("تاريخ الجلسة مطلوب.");
      return;
    }

    setSavingEdit(true);

    const { error } = await supabase
      .from("hearings")
      .update({
        case_id: editForm.case_id,
        hearing_date: editForm.hearing_date,
        court_name: nullIfEmpty(editForm.court_name),
        circuit: nullIfEmpty(editForm.circuit),
        decision: nullIfEmpty(editForm.decision),
        required_action: nullIfEmpty(editForm.required_action),
        notes: nullIfEmpty(editForm.notes),
      })
      .eq("id", editingHearingId);

    if (!error) {
      await updateRelatedCaseAfterHearing(editForm);
    }

    setSavingEdit(false);

    if (error) {
      setError(error.message);
      return;
    }

    setEditingHearingId("");
    showSuccessMessage("تم تعديل الجلسة وتحديث القضية المرتبطة.");
    await fetchAll();
  }

  async function deleteHearing(item: HearingRow) {
    const ok = confirm("هل تريد حذف هذه الجلسة؟");
    if (!ok) return;

    setDeleting(true);

    const { error } = await supabase.from("hearings").delete().eq("id", item.id);

    setDeleting(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (selectedHearingId === item.id) {
      setSelectedHearingId("");
    }

    showSuccessMessage("تم حذف الجلسة.");
    await fetchAll();
  }

  if (loading) {
    return <LoadingCard text="جاري تحميل الجلسات..." />;
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Hearings Workspace"
          title="إدارة الجلسات"
          tone="amber"
          description="صفحة مستقلة لإدارة الجلسات: إضافة، بحث، فلترة، عرض تفاصيل، تعديل، حذف، وتحديث القضية المرتبطة تلقائيًا."
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowCreate((value) => !value)}
                className="h-10 rounded-[18px] bg-slate-200 px-4 text-xs font-black text-black shadow-sm transition hover:bg-amber-300"
              >
                {showCreate ? "إغلاق الإضافة" : "إضافة جلسة"}
              </button>

              <button
                type="button"
                onClick={fetchAll}
                disabled={refreshing}
                className="h-10 rounded-[18px] border border-black/10 bg-white/80 px-4 text-xs font-black text-black shadow-sm transition hover:bg-white disabled:opacity-60"
              >
                {refreshing ? "تحديث..." : "تحديث"}
              </button>
            </div>
          }
        />

        {error ? <Alert tone="red" title="حدث خطأ" text={error} /> : null}
        {success ? <Alert tone="green" title="تم بنجاح" text={success} /> : null}

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <SummaryCard label="اليوم" value={todayCount} hint="جلسات اليوم" tone="amber" />
          <SummaryCard label="قادمة" value={upcomingCount} hint="بعد اليوم" tone="blue" />
          <SummaryCard label="متأخرة" value={overdueCount} hint="فاتت بدون قرار" tone="rose" />
          <SummaryCard label="تمت" value={doneCount} hint="لها قرار سابق" tone="teal" />
        </section>

        {showCreate ? (
          <form
            onSubmit={handleAddHearing}
            className="min-w-0 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.07)] backdrop-blur-3xl lg:p-5"
          >
            <CompactTitle
              title="إضافة جلسة جديدة"
              description="اختر القضية ثم أضف تاريخ الجلسة والقرار والمطلوب. سيتم تحديث بيانات القضية تلقائيًا."
            />

            <HearingForm
              form={form}
              setForm={setForm}
              caseOptions={caseOptions}
              onCaseChange={(value) => autofillFromCase(value, "create")}
              saving={saving}
              submitLabel={saving ? "جاري الإضافة..." : "إضافة الجلسة"}
            />
          </form>
        ) : null}

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[430px_1fr]">
          <section className="min-w-0 space-y-4">
            <FiltersPanel
              search={search}
              setSearch={setSearch}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              caseFilter={caseFilter}
              setCaseFilter={setCaseFilter}
              sortBy={sortBy}
              setSortBy={setSortBy}
              caseOptions={filterCaseOptions}
              onReset={resetFilters}
            />

            <HearingsList
              filteredHearings={filteredHearings}
              selectedHearingId={selectedHearing?.id || ""}
              onSelect={(id) => {
                setSelectedHearingId(id);
                setEditingHearingId("");
              }}
            />
          </section>

          <HearingDetailsPanel
            selectedHearing={selectedHearing}
            editingHearingId={editingHearingId}
            editForm={editForm}
            setEditForm={setEditForm}
            caseOptions={caseOptions}
            onCaseChange={(value) => autofillFromCase(value, "edit")}
            savingEdit={savingEdit}
            deleting={deleting}
            startEditHearing={startEditHearing}
            cancelEdit={() => setEditingHearingId("")}
            handleUpdateHearing={handleUpdateHearing}
            deleteHearing={deleteHearing}
          />
        </section>
      </div>
    </AppShell>
  );
}

function FiltersPanel({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  caseFilter,
  setCaseFilter,
  sortBy,
  setSortBy,
  caseOptions,
  onReset,
}: {
  search: string;
  setSearch: (value: string) => void;
  statusFilter: "all" | HearingComputedStatus;
  setStatusFilter: (value: "all" | HearingComputedStatus) => void;
  caseFilter: string;
  setCaseFilter: (value: string) => void;
  sortBy: "nearest" | "newest" | "oldest" | "case";
  setSortBy: (value: "nearest" | "newest" | "oldest" | "case") => void;
  caseOptions: { value: string; label: string }[];
  onReset: () => void;
}) {
  return (
    <section className="min-w-0 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)] backdrop-blur-3xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-black text-black">بحث وفلترة</h2>
        <button
          type="button"
          onClick={onReset}
          className="rounded-2xl bg-zinc-100 px-3 py-2 text-[11px] font-black text-black transition hover:bg-zinc-200"
        >
          تصفير
        </button>
      </div>

      <div className="space-y-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالتاريخ، القضية، المحكمة، القرار، الموكل..."
          className="h-10 w-full min-w-0 rounded-[16px] border border-black/10 bg-white/85 px-3 text-xs font-bold text-black outline-none placeholder:text-zinc-400 focus:ring-4 focus:ring-amber-500/10"
        />

        <div className="grid grid-cols-2 gap-2">
          <CompactSelect
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as "all" | HearingComputedStatus)}
          >
            <option value="all">كل الحالات</option>
            <option value="today">اليوم</option>
            <option value="upcoming">قادمة</option>
            <option value="overdue">متأخرة</option>
            <option value="done">تمت</option>
          </CompactSelect>

          <CompactSelect value={caseFilter} onChange={setCaseFilter}>
            {caseOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </CompactSelect>

          <CompactSelect
            value={sortBy}
            onChange={(value) => setSortBy(value as "nearest" | "newest" | "oldest" | "case")}
          >
            <option value="nearest">الأقرب</option>
            <option value="newest">الأحدث تاريخًا</option>
            <option value="oldest">الأقدم تاريخًا</option>
            <option value="case">اسم القضية</option>
          </CompactSelect>
        </div>
      </div>
    </section>
  );
}

function HearingsList({
  filteredHearings,
  selectedHearingId,
  onSelect,
}: {
  filteredHearings: HearingRow[];
  selectedHearingId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="min-w-0 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)] backdrop-blur-3xl">
      <div className="mb-4 flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-black text-black">قائمة الجلسات</h2>
          <p className="text-xs font-bold text-zinc-500">{filteredHearings.length} نتيجة</p>
        </div>
      </div>

      {filteredHearings.length === 0 ? (
        <EmptyState
          title="لا توجد جلسات"
          description="أضف جلسة جديدة أو غيّر البحث والفلترة."
        />
      ) : (
        <div className="max-h-[780px] space-y-2 overflow-y-auto pr-1">
          {filteredHearings.map((item) => {
            const selected = selectedHearingId === item.id;
            const status = getHearingStatus(item);
            const tone = hearingStatusTone(status);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`w-full min-w-0 rounded-[22px] border p-3 text-right shadow-sm transition ${
                  selected
                    ? "border-amber-300 bg-slate-100/90 ring-4 ring-amber-500/10"
                    : "border-black/5 bg-white/80 hover:bg-white"
                }`}
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black text-black">
                      {item.cases?.title || "قضية غير محددة"}
                    </h3>
                    <p className="mt-1 truncate text-xs font-bold text-zinc-600">
                      {item.cases?.clients?.name || "موكل غير محدد"}
                    </p>
                    <p className="mt-1 truncate text-[11px] font-bold text-zinc-500">
                      {item.court_name || item.cases?.court_name || "محكمة غير محددة"}{" "}
                      {item.circuit ? `· ${item.circuit}` : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={tone}>{hearingStatusLabel(status)}</Badge>
                    <Badge tone="zinc">{formatDate(item.hearing_date)}</Badge>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Mini label="قرار" value={item.decision || "لا يوجد"} />
                  <Mini label="المطلوب" value={item.required_action || "لا يوجد"} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function HearingForm({
  form,
  setForm,
  caseOptions,
  onCaseChange,
  saving,
  submitLabel,
}: {
  form: HearingFormState;
  setForm: Dispatch<SetStateAction<HearingFormState>>;
  caseOptions: { value: string; label: string }[];
  onCaseChange: (value: string) => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <div className="space-y-4">
      <FormSection title="بيانات الجلسة">
        <SelectField
          label="القضية"
          value={form.case_id}
          onChange={onCaseChange}
          options={caseOptions}
          required
        />

        <Field
          label="تاريخ الجلسة"
          value={form.hearing_date}
          onChange={(value: string) => setForm((prev) => ({ ...prev, hearing_date: value }))}
          type="date"
          required
        />

        <Field
          label="المحكمة"
          value={form.court_name}
          onChange={(value: string) => setForm((prev) => ({ ...prev, court_name: value }))}
        />

        <Field
          label="الدائرة"
          value={form.circuit}
          onChange={(value: string) => setForm((prev) => ({ ...prev, circuit: value }))}
        />
      </FormSection>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TextareaField
          label="قرار الجلسة"
          value={form.decision}
          onChange={(value: string) => setForm((prev) => ({ ...prev, decision: value }))}
        />

        <TextareaField
          label="المطلوب للجلسة القادمة"
          value={form.required_action}
          onChange={(value: string) => setForm((prev) => ({ ...prev, required_action: value }))}
        />
      </div>

      <TextareaField
        label="ملاحظات"
        value={form.notes}
        onChange={(value: string) => setForm((prev) => ({ ...prev, notes: value }))}
      />

      <button
        disabled={saving}
        className="h-11 w-full rounded-[18px] bg-slate-200 text-sm font-black text-black shadow-lg transition hover:bg-amber-300 disabled:opacity-60"
      >
        {submitLabel}
      </button>
    </div>
  );
}

function HearingDetailsPanel({
  selectedHearing,
  editingHearingId,
  editForm,
  setEditForm,
  caseOptions,
  onCaseChange,
  savingEdit,
  deleting,
  startEditHearing,
  cancelEdit,
  handleUpdateHearing,
  deleteHearing,
}: {
  selectedHearing: HearingRow | null;
  editingHearingId: string;
  editForm: HearingFormState;
  setEditForm: Dispatch<SetStateAction<HearingFormState>>;
  caseOptions: { value: string; label: string }[];
  onCaseChange: (value: string) => void;
  savingEdit: boolean;
  deleting: boolean;
  startEditHearing: (item: HearingRow) => void;
  cancelEdit: () => void;
  handleUpdateHearing: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  deleteHearing: (item: HearingRow) => Promise<void>;
}) {
  if (!selectedHearing) {
    return (
      <div className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
        <EmptyState
          title="اختر جلسة"
          description="اختر جلسة من القائمة لعرض التفاصيل الكاملة."
        />
      </div>
    );
  }

  const isEditing = editingHearingId === selectedHearing.id;
  const status = getHearingStatus(selectedHearing);

  return (
    <section className="min-w-0 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)] backdrop-blur-3xl lg:p-5 xl:sticky xl:top-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="mb-2 inline-flex rounded-full bg-slate-200 px-3 py-1.5 text-[11px] font-black text-black">
            ملف الجلسة
          </p>
          <h2 className="break-words text-xl font-black text-black lg:text-2xl">
            {selectedHearing.cases?.title || "قضية غير محددة"}
          </h2>
          <p className="mt-1 break-words text-xs font-bold text-zinc-600">
            {selectedHearing.cases?.clients?.name || "موكل غير محدد"} —{" "}
            {formatDate(selectedHearing.hearing_date)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Can roles={["admin"]}>
            {!isEditing ? (
              <SmallButton tone="amber" onClick={() => startEditHearing(selectedHearing)}>
                تعديل
              </SmallButton>
            ) : (
              <SmallButton tone="zinc" onClick={cancelEdit}>
                إلغاء
              </SmallButton>
            )}

            <SmallButton tone="rose" onClick={() => deleteHearing(selectedHearing)}>
              {deleting ? "حذف..." : "حذف"}
            </SmallButton>
          </Can>

          {selectedHearing.cases?.id ? (
            <Link
              href="/cases"
              className="rounded-2xl bg-black px-3 py-2 text-[11px] font-black text-white"
            >
              صفحة القضايا
            </Link>
          ) : null}

          {selectedHearing.cases?.client_id ? (
            <Link
              href={`/clients/${selectedHearing.cases.client_id}`}
              className="rounded-2xl bg-slate-900 px-3 py-2 text-[11px] font-black text-white"
            >
              ملف الموكل
            </Link>
          ) : null}
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleUpdateHearing}>
          <HearingForm
            form={editForm}
            setForm={setEditForm}
            caseOptions={caseOptions}
            onCaseChange={onCaseChange}
            saving={savingEdit}
            submitLabel={savingEdit ? "جاري الحفظ..." : "حفظ التعديل"}
          />
        </form>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Info label="الحالة">
              <Badge tone={hearingStatusTone(status)}>{hearingStatusLabel(status)}</Badge>
            </Info>

            <Info label="تاريخ الجلسة">
              <ResponsiveText>{formatDate(selectedHearing.hearing_date)}</ResponsiveText>
            </Info>

            <Info label="المحكمة">
              <ResponsiveText>
                {selectedHearing.court_name || selectedHearing.cases?.court_name}
              </ResponsiveText>
            </Info>

            <Info label="الدائرة">
              <ResponsiveText>
                {selectedHearing.circuit || selectedHearing.cases?.circuit}
              </ResponsiveText>
            </Info>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Info label="القضية">
              <ResponsiveText>{selectedHearing.cases?.title}</ResponsiveText>
            </Info>

            <Info label="الموكل">
              <ResponsiveText>{selectedHearing.cases?.clients?.name}</ResponsiveText>
            </Info>
          </div>

          <Info label="قرار الجلسة">
            <ResponsiveText>{selectedHearing.decision}</ResponsiveText>
          </Info>

          <Info label="المطلوب">
            <ResponsiveText>{selectedHearing.required_action}</ResponsiveText>
          </Info>

          <Info label="ملاحظات">
            <ResponsiveText>{selectedHearing.notes}</ResponsiveText>
          </Info>
        </div>
      )}
    </section>
  );
}

function CompactTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="break-words text-lg font-black text-black">{title}</h2>
      <p className="mt-1 text-xs font-semibold leading-6 text-zinc-600">{description}</p>
    </div>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] bg-white/55 p-3">
      <h3 className="mb-3 text-sm font-black text-black">{title}</h3>
      <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {children}
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone: "amber" | "blue" | "rose" | "teal";
}) {
  const tones = {
    amber: "bg-slate-100 text-slate-800",
    blue: "bg-slate-100 text-slate-800",
    rose: "bg-rose-50 text-rose-800",
    teal: "bg-slate-100 text-slate-800",
  };

  return (
    <div className="min-w-0 rounded-[24px] border border-white/70 bg-white/70 p-4 shadow-[0_12px_35px_rgba(0,0,0,0.05)] backdrop-blur-3xl">
      <p className={`mb-3 inline-flex max-w-full rounded-full px-3 py-1 text-[11px] font-black ${tones[tone]}`}>
        <span className="min-w-0 truncate">{label}</span>
      </p>
      <h3 className="min-w-0 break-words text-2xl font-black text-black lg:text-3xl">
        {value}
      </h3>
      <p className="mt-1 text-[11px] font-bold leading-5 text-zinc-500">{hint}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-zinc-100/80 px-2.5 py-2">
      <p className="text-[9px] font-black text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-[11px] font-black text-black">{value}</p>
    </div>
  );
}

function Info({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-[18px] bg-white/80 p-3 shadow-sm">
      <p className="text-[11px] font-black text-zinc-500">{label}</p>
      <div className="mt-1.5 min-w-0 text-xs font-black text-black">
        {children}
      </div>
    </div>
  );
}

function SmallButton({
  children,
  tone,
  onClick,
}: {
  children: ReactNode;
  tone: "amber" | "rose" | "zinc";
  onClick: () => void;
}) {
  const tones = {
    amber: "bg-slate-100 text-slate-800 hover:bg-amber-200",
    rose: "bg-red-50 text-red-700 hover:bg-red-100",
    zinc: "bg-zinc-100 text-black hover:bg-zinc-200",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-3 py-2 text-[11px] font-black transition disabled:opacity-60 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

function CompactSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 min-w-0 rounded-[16px] border border-black/10 bg-white/85 px-3 text-xs font-black text-black outline-none"
    >
      {children}
    </select>
  );
}

function Alert({
  title,
  text,
  tone,
}: {
  title: string;
  text: string;
  tone: "red" | "green";
}) {
  const tones = {
    red: "border-red-200 bg-red-50/80 text-red-700",
    green: "border-slate-200 bg-slate-100/80 text-slate-800",
  };

  return (
    <div className={`rounded-[22px] border p-4 text-sm font-bold leading-7 backdrop-blur-xl ${tones[tone]}`}>
      <p className="font-black">{title}:</p>
      <p className="mt-1 break-words">{text}</p>
    </div>
  );
}

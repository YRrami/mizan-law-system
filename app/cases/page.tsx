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
  clientTypeLabels,
  courtCategoryLabels,
  formatDate,
  formatMoney,
  litigationDegreeLabels,
} from "@/lib/labels";

type ClientType = keyof typeof clientTypeLabels;
type CaseStatus = keyof typeof caseStatusLabels;
type CourtCategory = keyof typeof courtCategoryLabels;
type LitigationDegree = keyof typeof litigationDegreeLabels;
type QuickFilter = "all" | "open" | "urgent" | "unpaid" | "missing_hearing";

type ClientLite = {
  id: string;
  name: string;
  phone: string | null;
  client_type: ClientType;
};

type CaseRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  title: string;
  case_number: string | null;
  case_year: string | null;
  court_category: CourtCategory;
  litigation_degree: LitigationDegree;
  court_name: string | null;
  circuit: string | null;
  roll_number: string | null;
  case_type: string | null;
  client_role: string | null;
  opponent_name: string | null;
  opponent_lawyer: string | null;
  status: CaseStatus;
  filing_date: string | null;
  next_hearing_date: string | null;
  last_decision: string | null;
  required_action: string | null;
  judgment_summary: string | null;
  agreed_fee_amount: number | null;
  paid_fee_amount: number | null;
  fee_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  clients: ClientLite | null;
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
};

type DocumentRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  case_id: string | null;
  title: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string;
  notes: string | null;
  created_at: string;
};

type PaymentRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  case_id: string | null;
  amount: number;
  payment_type: "fee" | "expense";
  status: "paid" | "unpaid" | "partial";
  payment_date: string | null;
  notes: string | null;
  created_at: string;
};

type CaseFormState = {
  client_id: string;
  title: string;
  case_number: string;
  case_year: string;
  court_category: CourtCategory;
  litigation_degree: LitigationDegree;
  court_name: string;
  circuit: string;
  roll_number: string;
  case_type: string;
  client_role: string;
  opponent_name: string;
  opponent_lawyer: string;
  status: CaseStatus;
  filing_date: string;
  next_hearing_date: string;
  last_decision: string;
  required_action: string;
  judgment_summary: string;
  agreed_fee_amount: string;
  paid_fee_amount: string;
  fee_notes: string;
  notes: string;
};

const emptyCaseForm: CaseFormState = {
  client_id: "",
  title: "",
  case_number: "",
  case_year: "",
  court_category: "civil",
  litigation_degree: "first_instance",
  court_name: "",
  circuit: "",
  roll_number: "",
  case_type: "",
  client_role: "",
  opponent_name: "",
  opponent_lawyer: "",
  status: "open",
  filing_date: "",
  next_hearing_date: "",
  last_decision: "",
  required_action: "",
  judgment_summary: "",
  agreed_fee_amount: "",
  paid_fee_amount: "",
  fee_notes: "",
  notes: "",
};

function nullIfEmpty(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function dateOrNull(value: string): string | null {
  return value ? value : null;
}

function numberOrZero(value: string): number {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function feeRemaining(item: Pick<CaseRow, "agreed_fee_amount" | "paid_fee_amount">): number {
  return Math.max(Number(item.agreed_fee_amount || 0) - Number(item.paid_fee_amount || 0), 0);
}

function feeTone(remaining: number, agreed: number): "teal" | "amber" | "rose" {
  if (agreed <= 0) return "amber";
  if (remaining <= 0) return "teal";
  if (remaining < agreed) return "amber";
  return "rose";
}

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const today = new Date(todayISO()).getTime();
  const target = new Date(date).getTime();
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - today) / 86_400_000);
}

function hearingStatus(date: string | null): { label: string; tone: "teal" | "amber" | "rose" | "zinc" } {
  const days = daysUntil(date);
  if (days === null) return { label: "لا توجد جلسة", tone: "zinc" };
  if (days < 0) return { label: `متأخرة ${Math.abs(days)} يوم`, tone: "rose" };
  if (days === 0) return { label: "جلسة اليوم", tone: "rose" };
  if (days <= 7) return { label: `خلال ${days} يوم`, tone: "amber" };
  return { label: `بعد ${days} يوم`, tone: "teal" };
}

function feeProgress(agreed: number, paid: number): number {
  if (agreed <= 0) return 0;
  return Math.min(100, Math.round((paid / agreed) * 100));
}

function caseMatchesQuickFilter(item: CaseRow, filter: QuickFilter): boolean {
  const remaining = feeRemaining(item);
  const days = daysUntil(item.next_hearing_date);

  if (filter === "open") return item.status === "open";
  if (filter === "urgent") return days !== null && days <= 7;
  if (filter === "unpaid") return remaining > 0;
  if (filter === "missing_hearing") return !item.next_hearing_date;
  return true;
}

export default function CasesPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [hearings, setHearings] = useState<HearingRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const [form, setForm] = useState<CaseFormState>(emptyCaseForm);
  const [editForm, setEditForm] = useState<CaseFormState>(emptyCaseForm);

  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [editingCaseId, setEditingCaseId] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [courtFilter, setCourtFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "hearing" | "remaining" | "title">("newest");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

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
     
  }, [router]);

  function showSuccessMessage(message: string) {
    setSuccess(message);
    setTimeout(() => setSuccess(""), 2500);
  }

  async function fetchAll() {
    setRefreshing(true);
    setError("");

    const clientsResult = await supabase
      .from("clients")
      .select("id,name,phone,client_type")
      .order("created_at", { ascending: false });

    const casesResult = await supabase
      .from("cases")
      .select("*,clients(id,name,phone,client_type)")
      .order("created_at", { ascending: false });

    const hearingsResult = await supabase
      .from("hearings")
      .select("*")
      .order("hearing_date", { ascending: true });

    const documentsResult = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });

    const paymentsResult = await supabase
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false });

    if (clientsResult.error) {
      setError(clientsResult.error.message);
      setRefreshing(false);
      return;
    }

    if (casesResult.error) {
      setError(casesResult.error.message);
      setRefreshing(false);
      return;
    }

    const fetchedCases = ((casesResult.data || []) as unknown) as CaseRow[];

    setClients(((clientsResult.data || []) as unknown) as ClientLite[]);
    setCases(fetchedCases);
    setHearings(hearingsResult.error ? [] : (((hearingsResult.data || []) as unknown) as HearingRow[]));
    setDocuments(documentsResult.error ? [] : (((documentsResult.data || []) as unknown) as DocumentRow[]));
    setPayments(paymentsResult.error ? [] : (((paymentsResult.data || []) as unknown) as PaymentRow[]));

    setSelectedCaseId((current) => current || fetchedCases[0]?.id || "");
    setRefreshing(false);
  }

  const clientOptions = useMemo(() => {
    return [
      { value: "", label: "اختر الموكل" },
      ...clients.map((client) => ({
        value: client.id,
        label: `${client.name}${client.phone ? ` — ${client.phone}` : ""}`,
      })),
    ];
  }, [clients]);

  const filteredCases = useMemo(() => {
    const q = search.trim().toLowerCase();

    let result = cases.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesCourt = courtFilter === "all" || item.court_category === courtFilter;
      const matchesClient = clientFilter === "all" || item.client_id === clientFilter;
      const matchesQuick = caseMatchesQuickFilter(item, quickFilter);

      const searchable = [
        item.title,
        item.case_number,
        item.case_year,
        item.court_name,
        item.circuit,
        item.roll_number,
        item.case_type,
        item.client_role,
        item.opponent_name,
        item.opponent_lawyer,
        item.status,
        item.last_decision,
        item.required_action,
        item.judgment_summary,
        item.notes,
        item.clients?.name,
        item.clients?.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && matchesCourt && matchesClient && matchesQuick && (!q || searchable.includes(q));
    });

    if (sortBy === "title") {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title, "ar"));
    }

    if (sortBy === "remaining") {
      result = [...result].sort((a, b) => feeRemaining(b) - feeRemaining(a));
    }

    if (sortBy === "hearing") {
      result = [...result].sort((a, b) => {
        const aDate = a.next_hearing_date ? new Date(a.next_hearing_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bDate = b.next_hearing_date ? new Date(b.next_hearing_date).getTime() : Number.MAX_SAFE_INTEGER;
        return aDate - bDate;
      });
    }

    if (sortBy === "newest") {
      result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [cases, search, statusFilter, courtFilter, clientFilter, quickFilter, sortBy]);

  const selectedCase =
    cases.find((item) => item.id === selectedCaseId) || filteredCases[0] || null;

  const selectedCaseHearings = useMemo(() => {
    if (!selectedCase) return [];
    return hearings.filter((item) => item.case_id === selectedCase.id);
  }, [hearings, selectedCase]);

  const selectedCaseDocuments = useMemo(() => {
    if (!selectedCase) return [];
    return documents.filter((item) => item.case_id === selectedCase.id);
  }, [documents, selectedCase]);

  const selectedCasePayments = useMemo(() => {
    if (!selectedCase) return [];
    return payments.filter((item) => item.case_id === selectedCase.id);
  }, [payments, selectedCase]);

  const openCasesCount = cases.filter((item) => item.status === "open").length;
  const upcomingHearingsCount = hearings.filter(
    (item) => item.hearing_date >= todayISO()
  ).length;

  const agreedFeesTotal = cases.reduce(
    (sum, item) => sum + Number(item.agreed_fee_amount || 0),
    0
  );

  const paidFeesTotal = cases.reduce(
    (sum, item) => sum + Number(item.paid_fee_amount || 0),
    0
  );

  const remainingFeesTotal = Math.max(agreedFeesTotal - paidFeesTotal, 0);
  const urgentCasesCount = cases.filter((item) => caseMatchesQuickFilter(item, "urgent")).length;
  const unpaidCasesCount = cases.filter((item) => caseMatchesQuickFilter(item, "unpaid")).length;
  const missingHearingCasesCount = cases.filter((item) => caseMatchesQuickFilter(item, "missing_hearing")).length;

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setCourtFilter("all");
    setClientFilter("all");
    setQuickFilter("all");
    setSortBy("newest");
  }

  async function handleAddCase(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!userId) return;

    if (!form.client_id) {
      setError("اختر الموكل المرتبط بالقضية.");
      return;
    }

    if (!form.title.trim()) {
      setError("عنوان القضية مطلوب.");
      return;
    }

    setSaving(true);

    const { data: createdCase, error: caseError } = await supabase
      .from("cases")
      .insert({
        user_id: userId,
        client_id: form.client_id,
        title: form.title.trim(),
        case_number: nullIfEmpty(form.case_number),
        case_year: nullIfEmpty(form.case_year),
        court_category: form.court_category,
        litigation_degree: form.litigation_degree,
        court_name: nullIfEmpty(form.court_name),
        circuit: nullIfEmpty(form.circuit),
        roll_number: nullIfEmpty(form.roll_number),
        case_type: nullIfEmpty(form.case_type),
        client_role: nullIfEmpty(form.client_role),
        opponent_name: nullIfEmpty(form.opponent_name),
        opponent_lawyer: nullIfEmpty(form.opponent_lawyer),
        status: form.status,
        filing_date: dateOrNull(form.filing_date),
        next_hearing_date: dateOrNull(form.next_hearing_date),
        last_decision: nullIfEmpty(form.last_decision),
        required_action: nullIfEmpty(form.required_action),
        judgment_summary: nullIfEmpty(form.judgment_summary),
        agreed_fee_amount: numberOrZero(form.agreed_fee_amount),
        paid_fee_amount: numberOrZero(form.paid_fee_amount),
        fee_notes: nullIfEmpty(form.fee_notes),
        notes: nullIfEmpty(form.notes),
      })
      .select()
      .single();

    if (caseError || !createdCase) {
      setSaving(false);
      setError(caseError?.message || "فشل إنشاء القضية.");
      return;
    }

    const created = createdCase as { id: string };

    if (form.next_hearing_date) {
      const { error: hearingError } = await supabase.from("hearings").insert({
        user_id: userId,
        case_id: created.id,
        hearing_date: form.next_hearing_date,
        court_name: nullIfEmpty(form.court_name),
        circuit: nullIfEmpty(form.circuit),
        decision:
          nullIfEmpty(form.last_decision) ||
          "جلسة قادمة مضافة تلقائيًا مع إنشاء القضية",
        required_action: nullIfEmpty(form.required_action),
        notes: "تم إنشاء هذه الجلسة تلقائيًا من تاريخ الجلسة القادمة في نموذج القضية.",
      });

      if (hearingError) {
        setSaving(false);
        setError(
          `تم إنشاء القضية، لكن فشل إنشاء الجلسة التلقائية: ${hearingError.message}`
        );
        await fetchAll();
        return;
      }
    }

    setSaving(false);
    setForm(emptyCaseForm);
    setSelectedCaseId(created.id);
    setShowCreate(false);

    showSuccessMessage(
      form.next_hearing_date
        ? "تمت إضافة القضية وإنشاء جلسة قادمة تلقائيًا."
        : "تمت إضافة القضية بنجاح."
    );

    await fetchAll();
  }

  function startEditCase(item: CaseRow) {
    setEditingCaseId(item.id);
    setEditForm({
      client_id: item.client_id || "",
      title: item.title || "",
      case_number: item.case_number || "",
      case_year: item.case_year || "",
      court_category: item.court_category,
      litigation_degree: item.litigation_degree,
      court_name: item.court_name || "",
      circuit: item.circuit || "",
      roll_number: item.roll_number || "",
      case_type: item.case_type || "",
      client_role: item.client_role || "",
      opponent_name: item.opponent_name || "",
      opponent_lawyer: item.opponent_lawyer || "",
      status: item.status,
      filing_date: item.filing_date || "",
      next_hearing_date: item.next_hearing_date || "",
      last_decision: item.last_decision || "",
      required_action: item.required_action || "",
      judgment_summary: item.judgment_summary || "",
      agreed_fee_amount: String(item.agreed_fee_amount || ""),
      paid_fee_amount: String(item.paid_fee_amount || ""),
      fee_notes: item.fee_notes || "",
      notes: item.notes || "",
    });
  }

  async function handleUpdateCase(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!editingCaseId) return;

    if (!editForm.client_id) {
      setError("اختر الموكل المرتبط بالقضية.");
      return;
    }

    if (!editForm.title.trim()) {
      setError("عنوان القضية مطلوب.");
      return;
    }

    setSavingEdit(true);

    const { error } = await supabase
      .from("cases")
      .update({
        client_id: editForm.client_id,
        title: editForm.title.trim(),
        case_number: nullIfEmpty(editForm.case_number),
        case_year: nullIfEmpty(editForm.case_year),
        court_category: editForm.court_category,
        litigation_degree: editForm.litigation_degree,
        court_name: nullIfEmpty(editForm.court_name),
        circuit: nullIfEmpty(editForm.circuit),
        roll_number: nullIfEmpty(editForm.roll_number),
        case_type: nullIfEmpty(editForm.case_type),
        client_role: nullIfEmpty(editForm.client_role),
        opponent_name: nullIfEmpty(editForm.opponent_name),
        opponent_lawyer: nullIfEmpty(editForm.opponent_lawyer),
        status: editForm.status,
        filing_date: dateOrNull(editForm.filing_date),
        next_hearing_date: dateOrNull(editForm.next_hearing_date),
        last_decision: nullIfEmpty(editForm.last_decision),
        required_action: nullIfEmpty(editForm.required_action),
        judgment_summary: nullIfEmpty(editForm.judgment_summary),
        agreed_fee_amount: numberOrZero(editForm.agreed_fee_amount),
        paid_fee_amount: numberOrZero(editForm.paid_fee_amount),
        fee_notes: nullIfEmpty(editForm.fee_notes),
        notes: nullIfEmpty(editForm.notes),
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingCaseId);

    setSavingEdit(false);

    if (error) {
      setError(error.message);
      return;
    }

    setEditingCaseId("");
    showSuccessMessage("تم تعديل القضية بنجاح.");
    await fetchAll();
  }

  async function deleteCase(id: string) {
    const ok = confirm(
      "هل تريد حذف هذه القضية؟ سيتم حذف الجلسات المرتبطة بها، وقد تصبح بعض المستندات والمدفوعات بدون قضية."
    );

    if (!ok) return;

    const { error } = await supabase.from("cases").delete().eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    if (selectedCaseId === id) {
      setSelectedCaseId("");
    }

    showSuccessMessage("تم حذف القضية.");
    await fetchAll();
  }

  async function openDocument(doc: DocumentRow) {
    const { data, error } = await supabase.storage
      .from("legal-documents")
      .createSignedUrl(doc.file_path, 60 * 5);

    if (error || !data?.signedUrl) {
      setError(error?.message || "فشل فتح الملف.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return <LoadingCard text="جاري تحميل القضايا..." />;
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Cases Workspace"
          title="إدارة القضايا"
          tone="violet"
          description="صفحة مستقلة لإدارة قضايا المكتب: إضافة، بحث، فلترة، تفاصيل، تعديل، حذف، وربط بالموكلين."
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowCreate((value) => !value)}
                className="h-10 rounded-[18px] bg-slate-900 px-4 text-xs font-black text-white shadow-sm transition hover:bg-slate-950"
              >
                {showCreate ? "إغلاق الإضافة" : "إضافة قضية"}
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

        {error ? (
          <Alert tone="red" title="حدث خطأ" text={error} />
        ) : null}

        {success ? (
          <Alert tone="green" title="تم بنجاح" text={success} />
        ) : null}

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <SummaryCard label="القضايا" value={cases.length} hint="إجمالي" tone="violet" />
          <SummaryCard label="مفتوحة" value={openCasesCount} hint="قيد العمل" tone="blue" />
          <SummaryCard label="جلسات" value={upcomingHearingsCount} hint="قادمة" tone="amber" />
          <Can roles={["admin"]}>
            <SummaryCard
              label="متبقي"
              value={formatMoney(remainingFeesTotal)}
              hint={`مدفوع: ${formatMoney(paidFeesTotal)}`}
              tone="rose"
            />
          </Can>
        </section>

        <QuickFilterBar
          active={quickFilter}
          onChange={setQuickFilter}
          counts={{
            all: cases.length,
            open: openCasesCount,
            urgent: urgentCasesCount,
            unpaid: unpaidCasesCount,
            missing_hearing: missingHearingCasesCount,
          }}
        />

        {showCreate ? (
          <form
            onSubmit={handleAddCase}
            className="min-w-0 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.07)] backdrop-blur-3xl lg:p-5"
          >
            <CompactTitle
              title="إضافة قضية جديدة"
              description="اختر الموكل ثم أضف بيانات القضية. تاريخ الجلسة القادمة ينشئ جلسة تلقائيًا."
            />

            <CaseForm
              form={form}
              setForm={setForm}
              clientOptions={clientOptions}
              saving={saving}
              submitLabel={
                saving
                  ? "جاري الإضافة..."
                  : form.next_hearing_date
                  ? "إضافة + جلسة تلقائيًا"
                  : "إضافة القضية"
              }
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
              courtFilter={courtFilter}
              setCourtFilter={setCourtFilter}
              clientFilter={clientFilter}
              setClientFilter={setClientFilter}
              sortBy={sortBy}
              setSortBy={setSortBy}
              clients={clients}
              onReset={resetFilters}
            />

            <CasesList
              filteredCases={filteredCases}
              selectedCaseId={selectedCase?.id || ""}
              hearings={hearings}
              documents={documents}
              payments={payments}
              onSelect={(id) => {
                setSelectedCaseId(id);
                setEditingCaseId("");
              }}
            />
          </section>

          <CaseDetailsPanel
            selectedCase={selectedCase}
            hearings={selectedCaseHearings}
            documents={selectedCaseDocuments}
            payments={selectedCasePayments}
            editingCaseId={editingCaseId}
            editForm={editForm}
            setEditForm={setEditForm}
            clientOptions={clientOptions}
            savingEdit={savingEdit}
            startEditCase={startEditCase}
            cancelEdit={() => setEditingCaseId("")}
            handleUpdateCase={handleUpdateCase}
            deleteCase={deleteCase}
            openDocument={openDocument}
          />
        </section>
      </div>
    </AppShell>
  );
}

function QuickFilterBar({
  active,
  onChange,
  counts,
}: {
  active: QuickFilter;
  onChange: (filter: QuickFilter) => void;
  counts: Record<QuickFilter, number>;
}) {
  const items: { key: QuickFilter; label: string; hint: string }[] = [
    { key: "all", label: "الكل", hint: "كل القضايا" },
    { key: "open", label: "مفتوحة", hint: "قيد العمل" },
    { key: "urgent", label: "عاجلة", hint: "خلال 7 أيام" },
    { key: "unpaid", label: "أتعاب متبقية", hint: "لم تُسدد بالكامل" },
    { key: "missing_hearing", label: "بدون جلسة", hint: "تحتاج متابعة" },
  ];

  return (
    <section className="min-w-0 rounded-[24px] border border-white/70 bg-white/65 p-3 shadow-[0_12px_35px_rgba(0,0,0,0.05)] backdrop-blur-3xl">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item) => {
          const selected = active === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={`min-w-[145px] rounded-[18px] border px-3 py-2 text-right transition ${
                selected
                  ? "border-slate-300 bg-slate-900 text-white shadow-lg shadow-violet-500/15"
                  : "border-black/5 bg-white/75 text-black hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black">{item.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${selected ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-700"}`}>
                  {counts[item.key]}
                </span>
              </div>
              <p className={`mt-1 truncate text-[10px] font-bold ${selected ? "text-white/75" : "text-zinc-500"}`}>
                {item.hint}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function FiltersPanel({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  courtFilter,
  setCourtFilter,
  clientFilter,
  setClientFilter,
  sortBy,
  setSortBy,
  clients,
  onReset,
}: {
  search: string;
  setSearch: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  courtFilter: string;
  setCourtFilter: (value: string) => void;
  clientFilter: string;
  setClientFilter: (value: string) => void;
  sortBy: "newest" | "hearing" | "remaining" | "title";
  setSortBy: (value: "newest" | "hearing" | "remaining" | "title") => void;
  clients: ClientLite[];
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
          placeholder="بحث بالقضية، الرقم، المحكمة، الخصم..."
          className="h-10 w-full min-w-0 rounded-[16px] border border-black/10 bg-white/85 px-3 text-xs font-bold text-black outline-none placeholder:text-zinc-400 focus:ring-4 focus:ring-slate-400/10"
        />

        <div className="grid grid-cols-2 gap-2">
          <CompactSelect value={statusFilter} onChange={setStatusFilter}>
            <option value="all">كل الحالات</option>
            {Object.entries(caseStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </CompactSelect>

          <CompactSelect value={courtFilter} onChange={setCourtFilter}>
            <option value="all">كل المحاكم</option>
            {Object.entries(courtCategoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </CompactSelect>

          <CompactSelect value={clientFilter} onChange={setClientFilter}>
            <option value="all">كل الموكلين</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </CompactSelect>

          <CompactSelect
            value={sortBy}
            onChange={(value) => setSortBy(value as "newest" | "hearing" | "remaining" | "title")}
          >
            <option value="newest">الأحدث</option>
            <option value="hearing">أقرب جلسة</option>
            <option value="remaining">الأعلى متبقي</option>
            <option value="title">العنوان</option>
          </CompactSelect>
        </div>
      </div>
    </section>
  );
}

function CasesList({
  filteredCases,
  selectedCaseId,
  hearings,
  documents,
  payments,
  onSelect,
}: {
  filteredCases: CaseRow[];
  selectedCaseId: string;
  hearings: HearingRow[];
  documents: DocumentRow[];
  payments: PaymentRow[];
  onSelect: (id: string) => void;
}) {
  return (
    <section className="min-w-0 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)] backdrop-blur-3xl">
      <div className="mb-4 flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-black text-black">قائمة القضايا</h2>
          <p className="text-xs font-bold text-zinc-500">{filteredCases.length} نتيجة</p>
        </div>
      </div>

      {filteredCases.length === 0 ? (
        <EmptyState
          title="لا توجد قضايا"
          description="أضف قضية جديدة أو غيّر البحث والفلترة."
        />
      ) : (
        <div className="max-h-[780px] space-y-2 overflow-y-auto pr-1">
          {filteredCases.map((item) => {
            const selected = selectedCaseId === item.id;
            const remaining = feeRemaining(item);
            const agreed = Number(item.agreed_fee_amount || 0);
            const paid = Number(item.paid_fee_amount || 0);
            const tone = feeTone(remaining, agreed);
            const hearingInfo = hearingStatus(item.next_hearing_date);
            const hearingCount = hearings.filter((hearing) => hearing.case_id === item.id).length;
            const documentCount = documents.filter((doc) => doc.case_id === item.id).length;
            const paymentCount = payments.filter((payment) => payment.case_id === item.id).length;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`w-full min-w-0 rounded-[22px] border p-3 text-right shadow-sm transition ${
                  selected
                    ? "border-slate-300 bg-slate-100/90 ring-4 ring-slate-400/10"
                    : "border-black/5 bg-white/80 hover:bg-white"
                }`}
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black text-black">
                      {item.title}
                    </h3>
                    <p className="mt-1 truncate text-xs font-bold text-zinc-600">
                      {item.clients?.name || "موكل غير محدد"}
                    </p>
                    <p className="mt-1 truncate text-[11px] font-bold text-zinc-500">
                      رقم {item.case_number || "—"} / {item.case_year || "—"} ·{" "}
                      {item.court_name || "محكمة غير محددة"}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone="violet">{caseStatusLabels[item.status]}</Badge>
                    <Badge tone={hearingInfo.tone}>{hearingInfo.label}</Badge>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Mini label="جلسات" value={String(hearingCount)} />
                  <Mini label="ملفات" value={String(documentCount)} />
                  <Mini label="ماليات" value={String(paymentCount)} />
                </div>

                <FeeProgressBar agreed={agreed} paid={paid} remaining={remaining} tone={tone} />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CaseForm({
  form,
  setForm,
  clientOptions,
  saving,
  submitLabel,
}: {
  form: CaseFormState;
  setForm: Dispatch<SetStateAction<CaseFormState>>;
  clientOptions: { value: string; label: string }[];
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <div className="space-y-4">
      <FormSection title="البيانات الأساسية">
        <SelectField
          label="الموكل"
          value={form.client_id}
          onChange={(value: string) => setForm((prev) => ({ ...prev, client_id: value }))}
          options={clientOptions}
          required
        />

        <Field
          label="عنوان القضية"
          value={form.title}
          onChange={(value: string) => setForm((prev) => ({ ...prev, title: value }))}
          required
        />

        <Field
          label="رقم القضية"
          value={form.case_number}
          onChange={(value: string) => setForm((prev) => ({ ...prev, case_number: value }))}
        />

        <Field
          label="سنة القضية"
          value={form.case_year}
          onChange={(value: string) => setForm((prev) => ({ ...prev, case_year: value }))}
        />

        <SelectField
          label="نوع المحكمة"
          value={form.court_category}
          onChange={(value: string) =>
            setForm((prev) => ({ ...prev, court_category: value as CourtCategory }))
          }
          options={Object.entries(courtCategoryLabels).map(([value, label]) => ({
            value,
            label,
          }))}
        />

        <SelectField
          label="درجة التقاضي"
          value={form.litigation_degree}
          onChange={(value: string) =>
            setForm((prev) => ({ ...prev, litigation_degree: value as LitigationDegree }))
          }
          options={Object.entries(litigationDegreeLabels).map(([value, label]) => ({
            value,
            label,
          }))}
        />

        <SelectField
          label="حالة القضية"
          value={form.status}
          onChange={(value: string) =>
            setForm((prev) => ({ ...prev, status: value as CaseStatus }))
          }
          options={Object.entries(caseStatusLabels).map(([value, label]) => ({
            value,
            label,
          }))}
        />

        <Field
          label="تاريخ رفع الدعوى"
          value={form.filing_date}
          onChange={(value: string) => setForm((prev) => ({ ...prev, filing_date: value }))}
          type="date"
        />
      </FormSection>

      <FormSection title="المحكمة والأطراف">
        <Field
          label="اسم المحكمة"
          value={form.court_name}
          onChange={(value: string) => setForm((prev) => ({ ...prev, court_name: value }))}
        />

        <Field
          label="الدائرة"
          value={form.circuit}
          onChange={(value: string) => setForm((prev) => ({ ...prev, circuit: value }))}
        />

        <Field
          label="رول الدعوى"
          value={form.roll_number}
          onChange={(value: string) => setForm((prev) => ({ ...prev, roll_number: value }))}
        />

        <Field
          label="نوع القضية"
          value={form.case_type}
          onChange={(value: string) => setForm((prev) => ({ ...prev, case_type: value }))}
        />

        <Field
          label="صفة الموكل"
          value={form.client_role}
          onChange={(value: string) => setForm((prev) => ({ ...prev, client_role: value }))}
          placeholder="مدعي / مدعى عليه / متهم..."
        />

        <Field
          label="اسم الخصم"
          value={form.opponent_name}
          onChange={(value: string) => setForm((prev) => ({ ...prev, opponent_name: value }))}
        />

        <Field
          label="محامي الخصم"
          value={form.opponent_lawyer}
          onChange={(value: string) => setForm((prev) => ({ ...prev, opponent_lawyer: value }))}
        />
      </FormSection>

      <FormSection title="الجلسة والأتعاب">
        <div>
          <Field
            label="الجلسة القادمة"
            value={form.next_hearing_date}
            onChange={(value: string) => setForm((prev) => ({ ...prev, next_hearing_date: value }))}
            type="date"
          />

          {form.next_hearing_date ? (
            <p className="mt-2 rounded-2xl bg-slate-100 px-3 py-2 text-xs font-black leading-6 text-slate-800">
              سيتم إنشاء جلسة تلقائيًا عند حفظ القضية.
            </p>
          ) : null}
        </div>

        <Can roles={["admin"]}>
          <Field
            label="الأتعاب المتفق عليها"
            value={form.agreed_fee_amount}
            onChange={(value: string) => setForm((prev) => ({ ...prev, agreed_fee_amount: value }))}
            type="number"
          />

          <Field
            label="المدفوع من الأتعاب"
            value={form.paid_fee_amount}
            onChange={(value: string) => setForm((prev) => ({ ...prev, paid_fee_amount: value }))}
            type="number"
          />
        </Can>
      </FormSection>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TextareaField
          label="آخر قرار"
          value={form.last_decision}
          onChange={(value: string) => setForm((prev) => ({ ...prev, last_decision: value }))}
        />

        <TextareaField
          label="المطلوب"
          value={form.required_action}
          onChange={(value: string) => setForm((prev) => ({ ...prev, required_action: value }))}
        />

        <TextareaField
          label="ملخص الحكم"
          value={form.judgment_summary}
          onChange={(value: string) => setForm((prev) => ({ ...prev, judgment_summary: value }))}
        />

        <TextareaField
          label="ملاحظات الأتعاب"
          value={form.fee_notes}
          onChange={(value: string) => setForm((prev) => ({ ...prev, fee_notes: value }))}
        />
      </div>

      <TextareaField
        label="ملاحظات عامة"
        value={form.notes}
        onChange={(value: string) => setForm((prev) => ({ ...prev, notes: value }))}
      />

      <button
        disabled={saving}
        className="h-11 w-full rounded-[18px] bg-slate-900 text-sm font-black text-white shadow-lg transition hover:bg-slate-950 disabled:opacity-60"
      >
        {submitLabel}
      </button>
    </div>
  );
}

function CaseDetailsPanel({
  selectedCase,
  hearings,
  documents,
  payments,
  editingCaseId,
  editForm,
  setEditForm,
  clientOptions,
  savingEdit,
  startEditCase,
  cancelEdit,
  handleUpdateCase,
  deleteCase,
  openDocument,
}: {
  selectedCase: CaseRow | null;
  hearings: HearingRow[];
  documents: DocumentRow[];
  payments: PaymentRow[];
  editingCaseId: string;
  editForm: CaseFormState;
  setEditForm: Dispatch<SetStateAction<CaseFormState>>;
  clientOptions: { value: string; label: string }[];
  savingEdit: boolean;
  startEditCase: (item: CaseRow) => void;
  cancelEdit: () => void;
  handleUpdateCase: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  deleteCase: (id: string) => Promise<void>;
  openDocument: (doc: DocumentRow) => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);

  if (!selectedCase) {
    return (
      <div className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
        <EmptyState
          title="اختر قضية"
          description="اختر قضية من القائمة لعرض التفاصيل الكاملة."
        />
      </div>
    );
  }

  const isEditing = editingCaseId === selectedCase.id;
  const remainingFee = feeRemaining(selectedCase);
  const agreedFee = Number(selectedCase.agreed_fee_amount || 0);
  const paidFee = Number(selectedCase.paid_fee_amount || 0);
  const remainingTone = feeTone(remainingFee, agreedFee);
  const hearingInfo = hearingStatus(selectedCase.next_hearing_date);

  async function copySummary() {
    if (!selectedCase) return;
    const text = `${selectedCase.title}
الموكل: ${selectedCase.clients?.name || "غير محدد"}
رقم القضية: ${selectedCase.case_number || "—"} لسنة ${selectedCase.case_year || "—"}
المحكمة: ${selectedCase.court_name || "—"}
الجلسة القادمة: ${formatDate(selectedCase.next_hearing_date)}
المتبقي: ${formatMoney(remainingFee)}
المطلوب: ${selectedCase.required_action || "—"}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="min-w-0 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)] backdrop-blur-3xl lg:p-5 xl:sticky xl:top-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="mb-2 inline-flex rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-black text-white">
            ملف القضية
          </p>
          <h2 className="break-words text-xl font-black text-black lg:text-2xl">
            {selectedCase.title}
          </h2>
          <p className="mt-1 break-words text-xs font-bold text-zinc-600 lg:text-sm">
            {selectedCase.clients?.name || "موكل غير محدد"} — رقم{" "}
            {selectedCase.case_number || "—"} لسنة {selectedCase.case_year || "—"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Can roles={["admin"]}>
            {!isEditing ? (
              <SmallButton tone="amber" onClick={() => startEditCase(selectedCase)}>
                تعديل
              </SmallButton>
            ) : (
              <SmallButton tone="zinc" onClick={cancelEdit}>
                إلغاء
              </SmallButton>
            )}

            <SmallButton tone="rose" onClick={() => deleteCase(selectedCase.id)}>
              حذف
            </SmallButton>
          </Can>

          <SmallButton tone="zinc" onClick={copySummary}>
            {copied ? "تم النسخ" : "نسخ ملخص"}
          </SmallButton>

          {selectedCase.client_id ? (
            <Link
              href={`/clients/${selectedCase.client_id}`}
              className="rounded-2xl bg-black px-3 py-2 text-[11px] font-black text-white"
            >
              ملف الموكل
            </Link>
          ) : null}
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleUpdateCase}>
          <CaseForm
            form={editForm}
            setForm={setEditForm}
            clientOptions={clientOptions}
            saving={savingEdit}
            submitLabel={savingEdit ? "جاري الحفظ..." : "حفظ التعديل"}
          />
        </form>
      ) : (
        <div className="space-y-5">
          <Can roles={["admin"]}>
            <CaseStatusStrip
              agreed={agreedFee}
              paid={paidFee}
              remaining={remainingFee}
              remainingTone={remainingTone}
              hearingLabel={hearingInfo.label}
              hearingTone={hearingInfo.tone}
            />
          </Can>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Can roles={["admin"]}>
              <Info label="متفق">
                <ResponsiveText>{formatMoney(agreedFee)}</ResponsiveText>
              </Info>

              <Info label="مدفوع">
                <ResponsiveText>{formatMoney(paidFee)}</ResponsiveText>
              </Info>

              <Info label="متبقي">
                <Badge tone={remainingTone}>{formatMoney(remainingFee)}</Badge>
              </Info>
            </Can>

            <Info label="الجلسة">
              <Badge tone={hearingInfo.tone}>{hearingInfo.label}</Badge>
            </Info>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Info label="نوع المحكمة">
              <Badge tone="blue">
                {courtCategoryLabels[selectedCase.court_category]}
              </Badge>
            </Info>

            <Info label="درجة التقاضي">
              <ResponsiveText>
                {litigationDegreeLabels[selectedCase.litigation_degree]}
              </ResponsiveText>
            </Info>

            <Info label="الحالة">
              <Badge tone="violet">{caseStatusLabels[selectedCase.status]}</Badge>
            </Info>

            <Info label="المحكمة">
              <ResponsiveText>{selectedCase.court_name}</ResponsiveText>
            </Info>

            <Info label="الدائرة">
              <ResponsiveText>{selectedCase.circuit}</ResponsiveText>
            </Info>

            <Info label="الرول">
              <ResponsiveText>{selectedCase.roll_number}</ResponsiveText>
            </Info>

            <Info label="نوع القضية">
              <ResponsiveText>{selectedCase.case_type}</ResponsiveText>
            </Info>

            <Info label="صفة الموكل">
              <ResponsiveText>{selectedCase.client_role}</ResponsiveText>
            </Info>

            <Info label="الخصم">
              <ResponsiveText>{selectedCase.opponent_name}</ResponsiveText>
            </Info>

            <Info label="محامي الخصم">
              <ResponsiveText>{selectedCase.opponent_lawyer}</ResponsiveText>
            </Info>

            <Info label="تاريخ الرفع">
              <ResponsiveText>{formatDate(selectedCase.filing_date)}</ResponsiveText>
            </Info>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Info label="آخر قرار">
              <ResponsiveText>{selectedCase.last_decision}</ResponsiveText>
            </Info>

            <Info label="المطلوب">
              <ResponsiveText>{selectedCase.required_action}</ResponsiveText>
            </Info>

            <Info label="ملخص الحكم">
              <ResponsiveText>{selectedCase.judgment_summary}</ResponsiveText>
            </Info>

            <Info label="ملاحظات الأتعاب">
              <ResponsiveText>{selectedCase.fee_notes}</ResponsiveText>
            </Info>
          </div>

          <Info label="ملاحظات">
            <ResponsiveText>{selectedCase.notes}</ResponsiveText>
          </Info>

          <section className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <RelatedBox title="الجلسات" count={hearings.length} tone="amber">
              {hearings.length === 0 ? (
                <SmallEmpty text="لا توجد جلسات مرتبطة." />
              ) : (
                <div className="space-y-2">
                  {hearings.map((item) => (
                    <div key={item.id} className="rounded-[18px] bg-white/80 p-3 shadow-sm">
                      <Badge tone="amber">{formatDate(item.hearing_date)}</Badge>
                      <p className="mt-2 break-words text-xs font-black text-black">
                        {item.court_name || "محكمة غير محددة"}{" "}
                        {item.circuit ? `— ${item.circuit}` : ""}
                      </p>
                      <p className="mt-2 break-words text-[11px] font-bold leading-5 text-zinc-600">
                        القرار: {item.decision || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </RelatedBox>

            <RelatedBox title="المستندات" count={documents.length} tone="emerald">
              {documents.length === 0 ? (
                <SmallEmpty text="لا توجد مستندات مرتبطة." />
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="rounded-[18px] bg-white/80 p-3 shadow-sm">
                      <h3 className="break-words text-xs font-black text-black">
                        {doc.title}
                      </h3>
                      <p className="mt-1 break-all text-[11px] font-bold text-zinc-500">
                        {doc.file_name}
                      </p>
                      <SmallButton tone="black" onClick={() => openDocument(doc)}>
                        فتح PDF
                      </SmallButton>
                    </div>
                  ))}
                </div>
              )}
            </RelatedBox>

            <Can roles={["admin"]}>
              <RelatedBox title="الماليات" count={payments.length} tone="teal">
              {payments.length === 0 ? (
                <SmallEmpty text="لا توجد عمليات مالية مرتبطة." />
              ) : (
                <div className="space-y-2">
                  {payments.map((payment) => (
                    <div key={payment.id} className="rounded-[18px] bg-white/80 p-3 shadow-sm">
                      <h3 className="text-sm font-black text-black">
                        {formatMoney(Number(payment.amount))}
                      </h3>
                      <p className="mt-1 text-[11px] font-bold text-zinc-600">
                        {payment.payment_type === "fee" ? "أتعاب" : "مصروفات"} —{" "}
                        {payment.status}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </RelatedBox>
            </Can>
          </section>
        </div>
      )}
    </section>
  );
}

function FeeProgressBar({
  agreed,
  paid,
  remaining,
  tone,
}: {
  agreed: number;
  paid: number;
  remaining: number;
  tone: "teal" | "amber" | "rose";
}) {
  const progress = feeProgress(agreed, paid);
  const barTones = {
    teal: "bg-slate-800",
    amber: "bg-slate-200",
    rose: "bg-rose-500",
  };

  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-black text-zinc-500">
        <span>تحصيل الأتعاب</span>
        <span>{progress}% · متبقي {formatMoney(remaining)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full rounded-full transition-all ${barTones[tone]}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function CaseStatusStrip({
  agreed,
  paid,
  remaining,
  remainingTone,
  hearingLabel,
  hearingTone,
}: {
  agreed: number;
  paid: number;
  remaining: number;
  remainingTone: "teal" | "amber" | "rose";
  hearingLabel: string;
  hearingTone: "teal" | "amber" | "rose" | "zinc";
}) {
  const progress = feeProgress(agreed, paid);

  return (
    <section className="rounded-[22px] border border-black/5 bg-zinc-50/80 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black text-zinc-500">Case health</p>
          <h3 className="mt-1 text-lg font-black text-black">تحصيل {progress}% من الأتعاب</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={remainingTone}>متبقي {formatMoney(remaining)}</Badge>
          <Badge tone={hearingTone}>{hearingLabel}</Badge>
        </div>
      </div>
      <FeeProgressBar agreed={agreed} paid={paid} remaining={remaining} tone={remainingTone} />
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
      <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
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
  tone: "violet" | "blue" | "amber" | "rose";
}) {
  const tones = {
    violet: "bg-slate-100 text-slate-800",
    blue: "bg-slate-100 text-slate-800",
    amber: "bg-slate-100 text-slate-800",
    rose: "bg-rose-50 text-rose-800",
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

function RelatedBox({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone: "amber" | "emerald" | "teal";
  children: ReactNode;
}) {
  const tones = {
    amber: "bg-slate-100 text-slate-800",
    emerald: "bg-slate-100 text-slate-800",
    teal: "bg-slate-100 text-slate-800",
  };

  return (
    <section className="min-w-0 rounded-[22px] border border-black/5 bg-zinc-50/80 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ${tones[tone]}`}>
          {title}
        </p>
        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-zinc-600">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function SmallButton({
  children,
  tone,
  onClick,
}: {
  children: ReactNode;
  tone: "amber" | "rose" | "zinc" | "black";
  onClick: () => void;
}) {
  const tones = {
    amber: "bg-slate-100 text-slate-800 hover:bg-amber-200",
    rose: "bg-red-50 text-red-700 hover:bg-red-100",
    zinc: "bg-zinc-100 text-black hover:bg-zinc-200",
    black: "bg-black text-white hover:bg-zinc-800 mt-2",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-3 py-2 text-[11px] font-black transition ${tones[tone]}`}
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

function SmallEmpty({ text }: { text: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-black/10 bg-white/60 p-4 text-center text-[11px] font-black text-zinc-500">
      {text}
    </div>
  );
}

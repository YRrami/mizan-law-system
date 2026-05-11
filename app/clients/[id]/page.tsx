"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useParams, useRouter } from "next/navigation";
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
  documentTypeLabels,
  formatDate,
  formatFileSize,
  formatMoney,
  governorates,
  litigationDegreeLabels,
} from "@/lib/labels";
import type {
  Case,
  CaseStatus,
  Client,
  ClientType,
  CourtCategory,
  DocumentRow,
  DocumentType,
  Hearing,
  LitigationDegree,
  Payment,
} from "@/lib/types";

type SectionKey = "cases" | "hearings" | "documents" | "payments";

type HearingWithCase = Hearing & {
  cases?: Pick<Case, "id" | "title" | "case_number" | "case_year"> | null;
};

type DocumentWithCase = DocumentRow & {
  cases?: Pick<Case, "id" | "title" | "case_number" | "case_year"> | null;
};

const clientEmptyForm = {
  name: "",
  client_type: "individual" as ClientType,
  phone: "",
  whatsapp: "",
  email: "",
  national_id: "",
  passport_number: "",
  commercial_register: "",
  tax_card_number: "",
  address: "",
  governorate: "",
  legal_capacity: "",
  occupation: "",
  company_representative: "",
  notes: "",
};

const caseEmptyForm = {
  title: "",
  case_number: "",
  case_year: "",
  court_category: "civil" as CourtCategory,
  litigation_degree: "first_instance" as LitigationDegree,
  court_name: "",
  circuit: "",
  roll_number: "",
  case_type: "",
  client_role: "",
  opponent_name: "",
  opponent_lawyer: "",
  status: "open" as CaseStatus,
  filing_date: "",
  next_hearing_date: "",
  agreed_fee_amount: "",
  paid_fee_amount: "",
  fee_notes: "",
  last_decision: "",
  required_action: "",
  judgment_summary: "",
  notes: "",
};

const hearingEmptyForm = {
  case_id: "",
  hearing_date: "",
  court_name: "",
  circuit: "",
  decision: "",
  required_action: "",
  notes: "",
};

const documentEmptyForm = {
  title: "",
  document_type: "other" as DocumentType,
  case_id: "",
  notes: "",
};

const paymentEmptyForm = {
  case_id: "",
  amount: "",
  payment_type: "fee",
  status: "paid",
  payment_date: "",
  notes: "",
};

function valueOrEmpty(value: string | null | undefined) {
  return value || "";
}

function nullIfEmpty(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function dateOrNull(value: string) {
  return value ? value : null;
}

function numberOrNull(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function numberValue(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function caseFeeSummary(item: Case) {
  const agreed = numberValue((item as Case & { agreed_fee_amount?: number | null }).agreed_fee_amount);
  const paid = numberValue((item as Case & { paid_fee_amount?: number | null }).paid_fee_amount);
  const remaining = Math.max(agreed - paid, 0);
  return { agreed, paid, remaining };
}

function createSafeId(): string {
  const cryptoObj = globalThis.crypto as
    | (Crypto & { randomUUID?: () => string })
    | undefined;

  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }

  if (cryptoObj?.getRandomValues) {
    const bytes = cryptoObj.getRandomValues(new Uint8Array(16));

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
      12,
      16
    )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function safeStorageFileName(file: File) {
  const extension = file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "pdf";
  return `document-${Date.now()}-${createSafeId()}.${extension}`;
}





export default function ClientDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const [activeSection, setActiveSection] = useState<SectionKey>("cases");

  const [userId, setUserId] = useState("");
  const [client, setClient] = useState<Client | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [hearings, setHearings] = useState<HearingWithCase[]>([]);
  const [documents, setDocuments] = useState<DocumentWithCase[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [clientForm, setClientForm] = useState(clientEmptyForm);
  const [caseForm, setCaseForm] = useState(caseEmptyForm);
  const [hearingForm, setHearingForm] = useState(hearingEmptyForm);
  const [documentForm, setDocumentForm] = useState(documentEmptyForm);
  const [paymentForm, setPaymentForm] = useState(paymentEmptyForm);
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [editingClient, setEditingClient] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [savingCase, setSavingCase] = useState(false);
  const [savingHearing, setSavingHearing] = useState(false);
  const [savingDocument, setSavingDocument] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!clientId || clientId === "undefined" || clientId === "[id]") {
      router.replace("/clients");
      return;
    }

    async function init() {
      setLoading(true);
      setError("");

      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.replace("/login");
        return;
      }

      setUserId(data.user.id);
      await fetchClientData();
      setLoading(false);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, router]);

  async function fetchClientData() {
    const clientResult = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();

    if (clientResult.error) {
      setClient(null);
      setError(clientResult.error.message);
      return;
    }

    const currentClient = clientResult.data as Client;
    setClient(currentClient);

    setClientForm({
      name: currentClient.name || "",
      client_type: currentClient.client_type || "individual",
      phone: valueOrEmpty(currentClient.phone),
      whatsapp: valueOrEmpty(currentClient.whatsapp),
      email: valueOrEmpty(currentClient.email),
      national_id: valueOrEmpty(currentClient.national_id),
      passport_number: valueOrEmpty(currentClient.passport_number),
      commercial_register: valueOrEmpty(currentClient.commercial_register),
      tax_card_number: valueOrEmpty(currentClient.tax_card_number),
      address: valueOrEmpty(currentClient.address),
      governorate: valueOrEmpty(currentClient.governorate),
      legal_capacity: valueOrEmpty(currentClient.legal_capacity),
      occupation: valueOrEmpty(currentClient.occupation),
      company_representative: valueOrEmpty(currentClient.company_representative),
      notes: valueOrEmpty(currentClient.notes),
    });

    const casesResult = await supabase
      .from("cases")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    const clientCases = casesResult.error
      ? []
      : ((casesResult.data || []) as Case[]);

    setCases(clientCases);

    const caseIds = clientCases.map((item) => item.id);

    if (caseIds.length > 0) {
      const hearingsResult = await supabase
        .from("hearings")
        .select("*,cases(id,title,case_number,case_year)")
        .in("case_id", caseIds)
        .order("hearing_date", { ascending: true });

      setHearings(
        hearingsResult.error
          ? []
          : ((hearingsResult.data || []) as unknown as HearingWithCase[])
      );
    } else {
      setHearings([]);
    }

    const docsResult = await supabase
      .from("documents")
      .select("*,cases(id,title,case_number,case_year)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    setDocuments(
      docsResult.error
        ? []
        : ((docsResult.data || []) as unknown as DocumentWithCase[])
    );

    const paymentsResult = await supabase
      .from("payments")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    setPayments(
      paymentsResult.error ? [] : ((paymentsResult.data || []) as Payment[])
    );
  }

  function showSuccess(message: string) {
    setSuccess(message);
    setTimeout(() => setSuccess(""), 2600);
  }

  async function handleUpdateClient(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!client) return;

    if (!clientForm.name.trim()) {
      setError("اسم الموكل مطلوب.");
      return;
    }

    setSavingClient(true);

    const { error } = await supabase
      .from("clients")
      .update({
        name: clientForm.name.trim(),
        client_type: clientForm.client_type,
        phone: nullIfEmpty(clientForm.phone),
        whatsapp: nullIfEmpty(clientForm.whatsapp),
        email: nullIfEmpty(clientForm.email),
        national_id: nullIfEmpty(clientForm.national_id),
        passport_number: nullIfEmpty(clientForm.passport_number),
        commercial_register: nullIfEmpty(clientForm.commercial_register),
        tax_card_number: nullIfEmpty(clientForm.tax_card_number),
        address: nullIfEmpty(clientForm.address),
        governorate: nullIfEmpty(clientForm.governorate),
        legal_capacity: nullIfEmpty(clientForm.legal_capacity),
        occupation: nullIfEmpty(clientForm.occupation),
        company_representative: nullIfEmpty(clientForm.company_representative),
        notes: nullIfEmpty(clientForm.notes),
        updated_at: new Date().toISOString(),
      })
      .eq("id", client.id);

    setSavingClient(false);

    if (error) {
      setError(error.message);
      return;
    }

    setEditingClient(false);
    showSuccess("تم تحديث بيانات الموكل بنجاح.");
    await fetchClientData();
  }

  async function handleDeleteClient() {
    if (!client) return;

    const ok = confirm(
      "هل تريد حذف هذا الموكل؟ القضايا والمستندات المرتبطة ستبقى موجودة لكن بدون موكل."
    );

    if (!ok) return;

    setDeleting(true);

    const { error } = await supabase.from("clients").delete().eq("id", client.id);

    setDeleting(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/clients");
  }

  async function handleAddCase(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!userId || !client) return;

    if (!caseForm.title.trim()) {
      setError("عنوان القضية مطلوب.");
      return;
    }

    setSavingCase(true);

    const { data: createdCase, error: caseError } = await supabase
      .from("cases")
      .insert({
        user_id: userId,
        client_id: client.id,
        title: caseForm.title.trim(),
        case_number: nullIfEmpty(caseForm.case_number),
        case_year: nullIfEmpty(caseForm.case_year),
        court_category: caseForm.court_category,
        litigation_degree: caseForm.litigation_degree,
        court_name: nullIfEmpty(caseForm.court_name),
        circuit: nullIfEmpty(caseForm.circuit),
        roll_number: nullIfEmpty(caseForm.roll_number),
        case_type: nullIfEmpty(caseForm.case_type),
        client_role: nullIfEmpty(caseForm.client_role),
        opponent_name: nullIfEmpty(caseForm.opponent_name),
        opponent_lawyer: nullIfEmpty(caseForm.opponent_lawyer),
        status: caseForm.status,
        filing_date: dateOrNull(caseForm.filing_date),
        next_hearing_date: dateOrNull(caseForm.next_hearing_date),
        agreed_fee_amount: numberOrNull(caseForm.agreed_fee_amount),
        paid_fee_amount: numberOrNull(caseForm.paid_fee_amount),
        fee_notes: nullIfEmpty(caseForm.fee_notes),
        last_decision: nullIfEmpty(caseForm.last_decision),
        required_action: nullIfEmpty(caseForm.required_action),
        judgment_summary: nullIfEmpty(caseForm.judgment_summary),
        notes: nullIfEmpty(caseForm.notes),
      })
      .select()
      .single();

    if (caseError || !createdCase) {
      setSavingCase(false);
      setError(caseError?.message || "فشل إنشاء القضية.");
      return;
    }

    const initialPaidAmount = numberOrNull(caseForm.paid_fee_amount);
    if (initialPaidAmount && initialPaidAmount > 0) {
      await supabase.from("payments").insert({
        user_id: userId,
        client_id: client.id,
        case_id: createdCase.id,
        amount: initialPaidAmount,
        payment_type: "fee",
        status: "paid",
        payment_date: dateOrNull(caseForm.filing_date),
        notes: "دفعة أتعاب مضافة تلقائيًا عند إنشاء القضية.",
      });
    }

    if (caseForm.next_hearing_date) {
      const { error: hearingError } = await supabase.from("hearings").insert({
        user_id: userId,
        case_id: createdCase.id,
        hearing_date: caseForm.next_hearing_date,
        court_name: nullIfEmpty(caseForm.court_name),
        circuit: nullIfEmpty(caseForm.circuit),
        decision:
          nullIfEmpty(caseForm.last_decision) ||
          "جلسة قادمة مضافة تلقائيًا مع إنشاء القضية",
        required_action: nullIfEmpty(caseForm.required_action),
        notes:
          "تم إنشاء هذه الجلسة تلقائيًا من تاريخ الجلسة القادمة في نموذج القضية.",
      });

      if (hearingError) {
        setSavingCase(false);
        setError(
          `تم إنشاء القضية، لكن فشل إنشاء الجلسة التلقائية: ${hearingError.message}`
        );
        await fetchClientData();
        return;
      }
    }

    setSavingCase(false);
    setCaseForm(caseEmptyForm);
    setActiveSection("cases");

    showSuccess(
      caseForm.next_hearing_date
        ? "تمت إضافة القضية وإنشاء جلسة قادمة تلقائيًا."
        : "تمت إضافة القضية بنجاح."
    );

    await fetchClientData();
  }

  async function handleAddHearing(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!userId) return;

    if (!hearingForm.case_id) {
      setError("اختر القضية أولًا.");
      return;
    }

    if (!hearingForm.hearing_date) {
      setError("تاريخ الجلسة مطلوب.");
      return;
    }

    const selectedCase = cases.find((item) => item.id === hearingForm.case_id);

    setSavingHearing(true);

    const courtName =
      nullIfEmpty(hearingForm.court_name) || selectedCase?.court_name || null;

    const circuit =
      nullIfEmpty(hearingForm.circuit) || selectedCase?.circuit || null;

    const decision = nullIfEmpty(hearingForm.decision);
    const requiredAction = nullIfEmpty(hearingForm.required_action);

    const { error: hearingError } = await supabase.from("hearings").insert({
      user_id: userId,
      case_id: hearingForm.case_id,
      hearing_date: hearingForm.hearing_date,
      court_name: courtName,
      circuit,
      decision,
      required_action: requiredAction,
      notes: nullIfEmpty(hearingForm.notes),
    });

    if (hearingError) {
      setSavingHearing(false);
      setError(hearingError.message);
      return;
    }

    const caseUpdate: Record<string, string | null> = {
      next_hearing_date: hearingForm.hearing_date,
      updated_at: new Date().toISOString(),
    };

    if (decision) caseUpdate.last_decision = decision;
    if (requiredAction) caseUpdate.required_action = requiredAction;
    if (courtName) caseUpdate.court_name = courtName;
    if (circuit) caseUpdate.circuit = circuit;

    await supabase.from("cases").update(caseUpdate).eq("id", hearingForm.case_id);

    setSavingHearing(false);
    setHearingForm(hearingEmptyForm);
    setActiveSection("hearings");

    showSuccess("تمت إضافة الجلسة وتحديث بيانات القضية تلقائيًا.");
    await fetchClientData();
  }

  async function handleAddDocument(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!userId || !client) return;

    if (!documentForm.title.trim()) {
      setError("عنوان المستند مطلوب.");
      return;
    }

    if (!selectedPdf) {
      setError("اختر ملف PDF أولًا.");
      return;
    }

    const isPdf =
      selectedPdf.type === "application/pdf" ||
      selectedPdf.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setError("المسموح فقط ملفات PDF.");
      return;
    }

    if (selectedPdf.size > 10 * 1024 * 1024) {
      setError("حجم الملف يجب ألا يزيد عن 10MB.");
      return;
    }

    setSavingDocument(true);

    const documentId = createSafeId();
    const storageFileName = safeStorageFileName(selectedPdf);
    const filePath = `${userId}/${documentId}-${storageFileName}`;

    const uploadResult = await supabase.storage
      .from("legal-documents")
      .upload(filePath, selectedPdf, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadResult.error) {
      setSavingDocument(false);
      setError(uploadResult.error.message);
      return;
    }

    const insertResult = await supabase.from("documents").insert({
      id: documentId,
      user_id: userId,
      client_id: client.id,
      case_id: documentForm.case_id || null,
      title: documentForm.title.trim(),
      document_type: documentForm.document_type,
      file_name: selectedPdf.name,
      file_path: filePath,
      file_size: selectedPdf.size,
      mime_type: "application/pdf",
      notes: nullIfEmpty(documentForm.notes),
    });

    setSavingDocument(false);

    if (insertResult.error) {
      await supabase.storage.from("legal-documents").remove([filePath]);
      setError(insertResult.error.message);
      return;
    }

    setDocumentForm(documentEmptyForm);
    setSelectedPdf(null);
    setActiveSection("documents");

    const fileInput = document.getElementById(
      "pdf-file-input"
    ) as HTMLInputElement | null;

    if (fileInput) fileInput.value = "";

    showSuccess("تم رفع ملف PDF وحفظه بنجاح.");
    await fetchClientData();
  }

  async function openDocument(doc: DocumentWithCase) {
    const { data, error } = await supabase.storage
      .from("legal-documents")
      .createSignedUrl(doc.file_path, 60 * 5);

    if (error || !data?.signedUrl) {
      setError(error?.message || "فشل فتح الملف.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteDocument(doc: DocumentWithCase) {
    const ok = confirm("هل تريد حذف هذا المستند؟");
    if (!ok) return;

    const storageResult = await supabase.storage
      .from("legal-documents")
      .remove([doc.file_path]);

    if (storageResult.error) {
      setError(storageResult.error.message);
      return;
    }

    const dbResult = await supabase.from("documents").delete().eq("id", doc.id);

    if (dbResult.error) {
      setError(dbResult.error.message);
      return;
    }

    showSuccess("تم حذف المستند.");
    await fetchClientData();
  }

  async function handleAddPayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!userId || !client) return;

    const amount = Number(paymentForm.amount);

    if (!amount || amount <= 0) {
      setError("اكتب مبلغ صحيح.");
      return;
    }

    setSavingPayment(true);

    const { error } = await supabase.from("payments").insert({
      user_id: userId,
      client_id: client.id,
      case_id: paymentForm.case_id || null,
      amount,
      payment_type: paymentForm.payment_type,
      status: paymentForm.status,
      payment_date: dateOrNull(paymentForm.payment_date),
      notes: nullIfEmpty(paymentForm.notes),
    });

    setSavingPayment(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (paymentForm.case_id && paymentForm.payment_type === "fee" && paymentForm.status !== "unpaid") {
      const currentCase = cases.find((item) => item.id === paymentForm.case_id);
      const currentPaid = numberValue((currentCase as Case & { paid_fee_amount?: number | null } | undefined)?.paid_fee_amount);
      await supabase
        .from("cases")
        .update({
          paid_fee_amount: currentPaid + amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentForm.case_id);
    }

    setPaymentForm(paymentEmptyForm);
    setActiveSection("payments");
    showSuccess("تمت إضافة العملية المالية.");
    await fetchClientData();
  }

  function handlePdfChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setSelectedPdf(file);
  }

  const agreedFeesTotal = cases.reduce((sum, item) => sum + caseFeeSummary(item).agreed, 0);

  const paidTotal = cases.reduce((sum, item) => sum + caseFeeSummary(item).paid, 0);

  const unpaidTotal = Math.max(agreedFeesTotal - paidTotal, 0);

  const expensesTotal = payments
    .filter((item) => item.payment_type === "expense")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const caseOptions = useMemo(() => {
    return [
      { value: "", label: "بدون قضية / اختر قضية" },
      ...cases.map((item) => ({
        value: item.id,
        label: `${item.title} ${
          item.case_number ? `— رقم ${item.case_number}` : ""
        }`,
      })),
    ];
  }, [cases]);

  if (loading) {
    return <LoadingCard text="جاري تحميل ملف الموكل..." />;
  }

  if (!client) {
    return (
      <AppShell>
        <EmptyState
          title="لم يتم العثور على الموكل"
          description="قد يكون الموكل محذوفًا أو لا تملك صلاحية الوصول إليه."
          action={
            <Link
              href="/clients"
              className="inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-black text-white"
            >
              الرجوع للموكلين
            </Link>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Client Workspace"
          title={client.name}
          tone="blue"
          description="من هنا تقدر تدير ملف الموكل كاملًا: بيانات، قضايا، جلسات، مستندات PDF، وأتعاب."
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/clients"
                className="h-12 rounded-[20px] border border-black/10 bg-white/80 px-5 py-3 text-center text-sm font-black text-black shadow-sm transition hover:bg-white"
              >
                رجوع
              </Link>

              <Can roles={["admin"]}>
                <button
                  onClick={() => setEditingClient((value) => !value)}
                  className="h-12 rounded-[20px] bg-slate-200 px-5 text-sm font-black text-black shadow-sm transition hover:bg-amber-300"
                >
                  {editingClient ? "إلغاء التعديل" : "تعديل بيانات الموكل"}
                </button>

                <button
                  onClick={handleDeleteClient}
                  disabled={deleting}
                  className="h-12 rounded-[20px] bg-red-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting ? "جاري الحذف..." : "حذف الموكل"}
                </button>
              </Can>
            </div>
          }
        />

        {error ? (
          <div className="rounded-[26px] border border-red-200 bg-red-50/80 p-4 text-sm font-bold leading-7 text-red-700 backdrop-blur-xl">
            <p className="font-black">حدث خطأ:</p>
            <p className="mt-2 break-words">{error}</p>
          </div>
        ) : null}

        {success ? (
          <div className="rounded-[26px] border border-slate-200 bg-slate-100/80 p-4 text-sm font-black text-slate-800 backdrop-blur-xl">
            {success}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ActionBox
            active={activeSection === "cases"}
            tone="violet"
            label="القضايا"
            value={cases.length}
            hint="اضغط لعرض كل القضايا والبحث بينها"
            onClick={() => setActiveSection("cases")}
          />

          <ActionBox
            active={activeSection === "hearings"}
            tone="amber"
            label="الجلسات"
            value={hearings.length}
            hint="اضغط لعرض كل الجلسات والبحث بينها"
            onClick={() => setActiveSection("hearings")}
          />

          <ActionBox
            active={activeSection === "documents"}
            tone="emerald"
            label="المستندات PDF"
            value={documents.length}
            hint="اضغط لعرض كل المستندات والبحث بينها"
            onClick={() => setActiveSection("documents")}
          />

          <Can roles={["admin"]}>
            <ActionBox
              active={activeSection === "payments"}
              tone="rose"
              label="الأتعاب"
              value={formatMoney(unpaidTotal)}
              hint={`المتفق: ${formatMoney(agreedFeesTotal)} | المدفوع: ${formatMoney(paidTotal)} | مصروفات: ${formatMoney(
                expensesTotal
              )}`}
              onClick={() => setActiveSection("payments")}
            />
          </Can>
        </section>

        {editingClient ? (
          <form
            onSubmit={handleUpdateClient}
            className="min-w-0 rounded-[34px] border border-white/70 bg-white/70 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.07)] backdrop-blur-3xl"
          >
            <h2 className="mb-5 text-xl font-black text-black">
              تعديل بيانات الموكل
            </h2>

            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field
                label="اسم الموكل"
                value={clientForm.name}
                onChange={(value: string) =>
                  setClientForm({ ...clientForm, name: value })
                }
                required
              />

              <SelectField
                label="نوع الموكل"
                value={clientForm.client_type}
                onChange={(value: string) =>
                  setClientForm({
                    ...clientForm,
                    client_type: value as ClientType,
                  })
                }
                options={[
                  { value: "individual", label: "فرد" },
                  { value: "company", label: "شركة" },
                ]}
              />

              <Field label="الموبايل" value={clientForm.phone} onChange={(value: string) => setClientForm({ ...clientForm, phone: value })} />
              <Field label="واتساب" value={clientForm.whatsapp} onChange={(value: string) => setClientForm({ ...clientForm, whatsapp: value })} />
              <Field label="البريد الإلكتروني" value={clientForm.email} onChange={(value: string) => setClientForm({ ...clientForm, email: value })} type="email" />

              <SelectField
                label="المحافظة"
                value={clientForm.governorate}
                onChange={(value: string) =>
                  setClientForm({ ...clientForm, governorate: value })
                }
                options={[
                  { value: "", label: "اختر المحافظة" },
                  ...governorates.map((item) => ({ value: item, label: item })),
                ]}
              />

              <Field label="الرقم القومي" value={clientForm.national_id} onChange={(value: string) => setClientForm({ ...clientForm, national_id: value })} />
              <Field label="رقم جواز السفر" value={clientForm.passport_number} onChange={(value: string) => setClientForm({ ...clientForm, passport_number: value })} />
              <Field label="السجل التجاري" value={clientForm.commercial_register} onChange={(value: string) => setClientForm({ ...clientForm, commercial_register: value })} />
              <Field label="البطاقة الضريبية" value={clientForm.tax_card_number} onChange={(value: string) => setClientForm({ ...clientForm, tax_card_number: value })} />
              <Field label="الصفة القانونية" value={clientForm.legal_capacity} onChange={(value: string) => setClientForm({ ...clientForm, legal_capacity: value })} />
              <Field label="الوظيفة / النشاط" value={clientForm.occupation} onChange={(value: string) => setClientForm({ ...clientForm, occupation: value })} />
              <Field label="ممثل الشركة" value={clientForm.company_representative} onChange={(value: string) => setClientForm({ ...clientForm, company_representative: value })} />
              <Field label="العنوان" value={clientForm.address} onChange={(value: string) => setClientForm({ ...clientForm, address: value })} />
            </div>

            <div className="mt-4">
              <TextareaField
                label="ملاحظات"
                value={clientForm.notes}
                onChange={(value: string) =>
                  setClientForm({ ...clientForm, notes: value })
                }
              />
            </div>

            <button
              disabled={savingClient}
              className="mt-5 h-12 w-full rounded-[20px] bg-slate-900 text-sm font-black text-white shadow-lg transition hover:bg-slate-950 disabled:opacity-60"
            >
              {savingClient ? "جاري حفظ التعديلات..." : "حفظ التعديلات"}
            </button>
          </form>
        ) : (
          <ClientInfoPanel client={client} />
        )}

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <QuickAddCase
            caseForm={caseForm}
            setCaseForm={setCaseForm}
            savingCase={savingCase}
            handleAddCase={handleAddCase}
          />

          <QuickAddHearing
            hearingForm={hearingForm}
            setHearingForm={setHearingForm}
            savingHearing={savingHearing}
            handleAddHearing={handleAddHearing}
            caseOptions={caseOptions}
          />

          <QuickAddDocument
            documentForm={documentForm}
            setDocumentForm={setDocumentForm}
            savingDocument={savingDocument}
            handleAddDocument={handleAddDocument}
            handlePdfChange={handlePdfChange}
            selectedPdf={selectedPdf}
            caseOptions={caseOptions}
          />

          <Can roles={["admin"]}>
            <QuickAddPayment
              paymentForm={paymentForm}
              setPaymentForm={setPaymentForm}
              savingPayment={savingPayment}
              handleAddPayment={handleAddPayment}
              caseOptions={caseOptions}
            />
          </Can>
        </section>

        {activeSection === "cases" ? (
          <RelatedCases
            cases={cases}
            hearings={hearings}
            documents={documents}
            payments={payments}
            onOpenDocument={openDocument}
            onDeleteDocument={deleteDocument}
            onRefresh={fetchClientData}
            setError={setError}
            showSuccess={showSuccess}
            setActiveSection={setActiveSection}
          />
        ) : null}

        {activeSection === "hearings" ? (
          <RelatedHearings
            hearings={hearings}
            cases={cases}
            onRefresh={fetchClientData}
            setError={setError}
            showSuccess={showSuccess}
          />
        ) : null}

        {activeSection === "documents" ? (
          <RelatedDocuments
            documents={documents}
            cases={cases}
            onOpen={openDocument}
            onDelete={deleteDocument}
            onRefresh={fetchClientData}
            setError={setError}
            showSuccess={showSuccess}
          />
        ) : null}

        {activeSection === "payments" ? (
          <Can roles={["admin"]}>
            <RelatedPayments
              payments={payments}
              cases={cases}
              onRefresh={fetchClientData}
              setError={setError}
              showSuccess={showSuccess}
            />
          </Can>
        ) : null}
      </div>
    </AppShell>
  );
}

function QuickAddCase({
  caseForm,
  setCaseForm,
  savingCase,
  handleAddCase,
}: {
  caseForm: typeof caseEmptyForm;
  setCaseForm: (form: typeof caseEmptyForm) => void;
  savingCase: boolean;
  handleAddCase: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <QuickPanel title="إضافة قضية" tone="violet">
      <form onSubmit={handleAddCase} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="عنوان القضية" value={caseForm.title} onChange={(value: string) => setCaseForm({ ...caseForm, title: value })} required />
          <Field label="رقم القضية" value={caseForm.case_number} onChange={(value: string) => setCaseForm({ ...caseForm, case_number: value })} />
          <Field label="سنة القضية" value={caseForm.case_year} onChange={(value: string) => setCaseForm({ ...caseForm, case_year: value })} />
          <SelectField label="نوع المحكمة" value={caseForm.court_category} onChange={(value: string) => setCaseForm({ ...caseForm, court_category: value as CourtCategory })} options={Object.entries(courtCategoryLabels).map(([value, label]) => ({ value, label }))} />
          <SelectField label="درجة التقاضي" value={caseForm.litigation_degree} onChange={(value: string) => setCaseForm({ ...caseForm, litigation_degree: value as LitigationDegree })} options={Object.entries(litigationDegreeLabels).map(([value, label]) => ({ value, label }))} />
          <SelectField label="حالة القضية" value={caseForm.status} onChange={(value: string) => setCaseForm({ ...caseForm, status: value as CaseStatus })} options={Object.entries(caseStatusLabels).map(([value, label]) => ({ value, label }))} />
          <Field label="اسم المحكمة" value={caseForm.court_name} onChange={(value: string) => setCaseForm({ ...caseForm, court_name: value })} />
          <Field label="الدائرة" value={caseForm.circuit} onChange={(value: string) => setCaseForm({ ...caseForm, circuit: value })} />
          <Field label="رول الدعوى" value={caseForm.roll_number} onChange={(value: string) => setCaseForm({ ...caseForm, roll_number: value })} />
          <Field label="نوع القضية" value={caseForm.case_type} onChange={(value: string) => setCaseForm({ ...caseForm, case_type: value })} />
          <Field label="صفة الموكل" value={caseForm.client_role} onChange={(value: string) => setCaseForm({ ...caseForm, client_role: value })} placeholder="مدعي / مدعى عليه / متهم..." />
          <Field label="اسم الخصم" value={caseForm.opponent_name} onChange={(value: string) => setCaseForm({ ...caseForm, opponent_name: value })} />
          <Field label="محامي الخصم" value={caseForm.opponent_lawyer} onChange={(value: string) => setCaseForm({ ...caseForm, opponent_lawyer: value })} />
          <Field label="تاريخ رفع الدعوى" value={caseForm.filing_date} onChange={(value: string) => setCaseForm({ ...caseForm, filing_date: value })} type="date" />
          <div>
            <Field label="الجلسة القادمة" value={caseForm.next_hearing_date} onChange={(value: string) => setCaseForm({ ...caseForm, next_hearing_date: value })} type="date" />
            {caseForm.next_hearing_date ? (
              <p className="mt-2 rounded-2xl bg-slate-100 px-3 py-2 text-xs font-black leading-6 text-slate-800">
                سيتم إنشاء جلسة تلقائيًا في قائمة الجلسات عند حفظ القضية.
              </p>
            ) : null}
          </div>
          <Field label="الأتعاب المتفق عليها" value={caseForm.agreed_fee_amount} onChange={(value: string) => setCaseForm({ ...caseForm, agreed_fee_amount: value })} type="number" placeholder="مثال: 30000" />
          <Field label="المدفوع من الأتعاب" value={caseForm.paid_fee_amount} onChange={(value: string) => setCaseForm({ ...caseForm, paid_fee_amount: value })} type="number" placeholder="مثال: 10000" />
        </div>
        <TextareaField label="ملاحظات الأتعاب" value={caseForm.fee_notes} onChange={(value: string) => setCaseForm({ ...caseForm, fee_notes: value })} placeholder="مثال: المتبقي يسدد على دفعتين" />
        <TextareaField label="آخر قرار" value={caseForm.last_decision} onChange={(value: string) => setCaseForm({ ...caseForm, last_decision: value })} />
        <TextareaField label="المطلوب" value={caseForm.required_action} onChange={(value: string) => setCaseForm({ ...caseForm, required_action: value })} />
        <TextareaField label="ملخص الحكم" value={caseForm.judgment_summary} onChange={(value: string) => setCaseForm({ ...caseForm, judgment_summary: value })} />
        <TextareaField label="ملاحظات" value={caseForm.notes} onChange={(value: string) => setCaseForm({ ...caseForm, notes: value })} />
        <button disabled={savingCase} className="h-12 w-full rounded-[20px] bg-slate-900 text-sm font-black text-white shadow-lg hover:bg-slate-950 disabled:opacity-60">
          {savingCase ? "جاري إضافة القضية..." : caseForm.next_hearing_date ? "إضافة القضية + إنشاء جلسة تلقائيًا" : "إضافة القضية"}
        </button>
      </form>
    </QuickPanel>
  );
}

function QuickAddHearing({
  hearingForm,
  setHearingForm,
  savingHearing,
  handleAddHearing,
  caseOptions,
}: {
  hearingForm: typeof hearingEmptyForm;
  setHearingForm: (form: typeof hearingEmptyForm) => void;
  savingHearing: boolean;
  handleAddHearing: (e: FormEvent<HTMLFormElement>) => void;
  caseOptions: { value: string; label: string }[];
}) {
  return (
    <QuickPanel title="إضافة جلسة" tone="amber">
      <form onSubmit={handleAddHearing} className="space-y-4">
        <SelectField label="اختر القضية" value={hearingForm.case_id} onChange={(value: string) => setHearingForm({ ...hearingForm, case_id: value })} options={caseOptions} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="تاريخ الجلسة" value={hearingForm.hearing_date} onChange={(value: string) => setHearingForm({ ...hearingForm, hearing_date: value })} type="date" required />
          <Field label="المحكمة" value={hearingForm.court_name} onChange={(value: string) => setHearingForm({ ...hearingForm, court_name: value })} />
          <Field label="الدائرة" value={hearingForm.circuit} onChange={(value: string) => setHearingForm({ ...hearingForm, circuit: value })} />
        </div>
        <TextareaField label="قرار الجلسة" value={hearingForm.decision} onChange={(value: string) => setHearingForm({ ...hearingForm, decision: value })} />
        <TextareaField label="المطلوب للجلسة القادمة" value={hearingForm.required_action} onChange={(value: string) => setHearingForm({ ...hearingForm, required_action: value })} />
        <TextareaField label="ملاحظات" value={hearingForm.notes} onChange={(value: string) => setHearingForm({ ...hearingForm, notes: value })} />
        <button disabled={savingHearing} className="h-12 w-full rounded-[20px] bg-slate-200 text-sm font-black text-black shadow-lg hover:bg-amber-300 disabled:opacity-60">
          {savingHearing ? "جاري إضافة الجلسة..." : "إضافة الجلسة"}
        </button>
      </form>
    </QuickPanel>
  );
}

function QuickAddDocument({
  documentForm,
  setDocumentForm,
  savingDocument,
  handleAddDocument,
  handlePdfChange,
  selectedPdf,
  caseOptions,
}: {
  documentForm: typeof documentEmptyForm;
  setDocumentForm: (form: typeof documentEmptyForm) => void;
  savingDocument: boolean;
  handleAddDocument: (e: FormEvent<HTMLFormElement>) => void;
  handlePdfChange: (e: ChangeEvent<HTMLInputElement>) => void;
  selectedPdf: File | null;
  caseOptions: { value: string; label: string }[];
}) {
  return (
    <QuickPanel title="رفع مستند PDF" tone="emerald">
      <form onSubmit={handleAddDocument} className="space-y-4">
        <Field label="عنوان المستند" value={documentForm.title} onChange={(value: string) => setDocumentForm({ ...documentForm, title: value })} required />
        <SelectField label="نوع المستند" value={documentForm.document_type} onChange={(value: string) => setDocumentForm({ ...documentForm, document_type: value as DocumentType })} options={Object.entries(documentTypeLabels).map(([value, label]) => ({ value, label }))} />
        <SelectField label="ربط بقضية" value={documentForm.case_id} onChange={(value: string) => setDocumentForm({ ...documentForm, case_id: value })} options={caseOptions} />
        <div>
          <label className="mb-2 block text-sm font-black text-black">ملف PDF</label>
          <input id="pdf-file-input" type="file" accept="application/pdf,.pdf" onChange={handlePdfChange} className="w-full rounded-[20px] border border-black/10 bg-white/80 p-3 text-sm font-bold text-black" />
          {selectedPdf ? (
            <p className="mt-2 break-all text-xs font-bold text-zinc-600">
              {selectedPdf.name} — {formatFileSize(selectedPdf.size)}
            </p>
          ) : null}
        </div>
        <TextareaField label="ملاحظات" value={documentForm.notes} onChange={(value: string) => setDocumentForm({ ...documentForm, notes: value })} />
        <button disabled={savingDocument} className="h-12 w-full rounded-[20px] bg-slate-900 text-sm font-black text-white shadow-lg hover:bg-slate-950 disabled:opacity-60">
          {savingDocument ? "جاري رفع الملف..." : "رفع وحفظ المستند"}
        </button>
      </form>
    </QuickPanel>
  );
}

function QuickAddPayment({
  paymentForm,
  setPaymentForm,
  savingPayment,
  handleAddPayment,
  caseOptions,
}: {
  paymentForm: typeof paymentEmptyForm;
  setPaymentForm: (form: typeof paymentEmptyForm) => void;
  savingPayment: boolean;
  handleAddPayment: (e: FormEvent<HTMLFormElement>) => void;
  caseOptions: { value: string; label: string }[];
}) {
  return (
    <QuickPanel title="إضافة أتعاب / مصروفات" tone="teal">
      <form onSubmit={handleAddPayment} className="space-y-4">
        <SelectField label="ربط بقضية" value={paymentForm.case_id} onChange={(value: string) => setPaymentForm({ ...paymentForm, case_id: value })} options={caseOptions} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="المبلغ" value={paymentForm.amount} onChange={(value: string) => setPaymentForm({ ...paymentForm, amount: value })} type="number" required />
          <SelectField label="النوع" value={paymentForm.payment_type} onChange={(value: string) => setPaymentForm({ ...paymentForm, payment_type: value })} options={[{ value: "fee", label: "أتعاب" }, { value: "expense", label: "مصروفات" }]} />
          <SelectField label="الحالة" value={paymentForm.status} onChange={(value: string) => setPaymentForm({ ...paymentForm, status: value })} options={[{ value: "paid", label: "مدفوع" }, { value: "unpaid", label: "غير مدفوع" }, { value: "partial", label: "جزئي" }]} />
          <Field label="تاريخ الدفع" value={paymentForm.payment_date} onChange={(value: string) => setPaymentForm({ ...paymentForm, payment_date: value })} type="date" />
        </div>
        <TextareaField label="ملاحظات" value={paymentForm.notes} onChange={(value: string) => setPaymentForm({ ...paymentForm, notes: value })} />
        <button disabled={savingPayment} className="h-12 w-full rounded-[20px] bg-slate-900 text-sm font-black text-white shadow-lg hover:bg-slate-950 disabled:opacity-60">
          {savingPayment ? "جاري الحفظ..." : "حفظ العملية المالية"}
        </button>
      </form>
    </QuickPanel>
  );
}

function ActionBox({
  label,
  value,
  hint,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone: "violet" | "amber" | "emerald" | "rose";
  active: boolean;
  onClick: () => void;
}) {
  const colors = {
    violet: active
      ? "bg-slate-900 text-white border-slate-700"
      : "bg-white/70 text-black border-white/70",
    amber: active
      ? "bg-slate-200 text-black border-amber-400"
      : "bg-white/70 text-black border-white/70",
    emerald: active
      ? "bg-slate-900 text-white border-slate-700"
      : "bg-white/70 text-black border-white/70",
    rose: active
      ? "bg-rose-600 text-white border-rose-600"
      : "bg-white/70 text-black border-white/70",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 rounded-[30px] border p-5 text-right shadow-[0_18px_55px_rgba(0,0,0,0.07)] backdrop-blur-3xl transition hover:-translate-y-0.5 ${colors[tone]}`}
    >
      <p className="text-sm font-black opacity-80">{label}</p>
      <h3 className="mt-3 break-words text-3xl font-black">{value}</h3>
      <p className="mt-2 text-xs font-bold leading-5 opacity-75">{hint}</p>
    </button>
  );
}

function ClientInfoPanel({ client }: { client: Client }) {
  return (
    <section className="min-w-0 rounded-[34px] border border-white/70 bg-white/70 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.07)] backdrop-blur-3xl">
      <h2 className="mb-5 text-xl font-black text-black">بيانات الموكل</h2>

      <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Info label="نوع الموكل">
          <Badge tone={client.client_type === "company" ? "violet" : "emerald"}>
            {clientTypeLabels[client.client_type]}
          </Badge>
        </Info>
        <Info label="الصفة القانونية"><ResponsiveText>{client.legal_capacity}</ResponsiveText></Info>
        <Info label="الموبايل"><ResponsiveText>{client.phone}</ResponsiveText></Info>
        <Info label="واتساب"><ResponsiveText>{client.whatsapp}</ResponsiveText></Info>
        <Info label="البريد الإلكتروني"><ResponsiveText className="break-all">{client.email}</ResponsiveText></Info>
        <Info label="المحافظة"><ResponsiveText>{client.governorate}</ResponsiveText></Info>
        <Info label="العنوان"><ResponsiveText>{client.address}</ResponsiveText></Info>
        <Info label="الرقم القومي"><ResponsiveText className="break-all">{client.national_id}</ResponsiveText></Info>
        <Info label="رقم جواز السفر"><ResponsiveText className="break-all">{client.passport_number}</ResponsiveText></Info>
        <Info label="السجل التجاري"><ResponsiveText className="break-all">{client.commercial_register}</ResponsiveText></Info>
        <Info label="البطاقة الضريبية"><ResponsiveText className="break-all">{client.tax_card_number}</ResponsiveText></Info>
        <Info label="الوظيفة / النشاط"><ResponsiveText>{client.occupation}</ResponsiveText></Info>
        <Info label="ممثل الشركة"><ResponsiveText>{client.company_representative}</ResponsiveText></Info>
      </div>

      <div className="mt-3 rounded-[24px] bg-zinc-100/80 p-4">
        <p className="text-xs font-black text-zinc-500">ملاحظات</p>
        <p className="mt-2 break-words text-sm font-bold leading-7 text-black">
          {client.notes || "لا توجد ملاحظات."}
        </p>
      </div>
    </section>
  );
}

function QuickPanel({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "violet" | "amber" | "emerald" | "teal";
  children: React.ReactNode;
}) {
  const colors = {
    violet: "bg-slate-900 text-white",
    amber: "bg-slate-200 text-black",
    emerald: "bg-slate-900 text-white",
    teal: "bg-slate-900 text-white",
  };

  return (
    <details className="group min-w-0 rounded-[34px] border border-white/70 bg-white/70 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.07)] backdrop-blur-3xl">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <h2 className="break-words text-xl font-black text-black">{title}</h2>
        <span className={`rounded-2xl px-4 py-2 text-xs font-black ${colors[tone]}`}>
          فتح
        </span>
      </summary>
      <div className="mt-5">{children}</div>
    </details>
  );
}

function RelatedCases({
  cases,
  hearings,
  documents,
  payments,
  onOpenDocument,
  onDeleteDocument,
  onRefresh,
  setError,
  showSuccess,
  setActiveSection,
}: {
  cases: Case[];
  hearings: HearingWithCase[];
  documents: DocumentWithCase[];
  payments: Payment[];
  onOpenDocument: (doc: DocumentWithCase) => void;
  onDeleteDocument: (doc: DocumentWithCase) => void;
  onRefresh: () => Promise<void>;
  setError: (message: string) => void;
  showSuccess: (message: string) => void;
  setActiveSection: (section: SectionKey) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState(caseEmptyForm);

  const filteredCases = useMemo(() => {
    const q = search.trim().toLowerCase();

    return cases.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
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
        item.last_decision,
        item.required_action,
        item.judgment_summary,
        (item as Case & { fee_notes?: string | null }).fee_notes,
        item.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!q || searchable.includes(q));
    });
  }, [cases, search, statusFilter]);

  const selectedCase =
    cases.find((item) => item.id === selectedCaseId) || filteredCases[0] || null;

  const relatedHearings = selectedCase
    ? hearings.filter((item) => item.case_id === selectedCase.id)
    : [];

  const relatedDocuments = selectedCase
    ? documents.filter((item) => item.case_id === selectedCase.id)
    : [];

  const relatedPayments = selectedCase
    ? payments.filter((item) => item.case_id === selectedCase.id)
    : [];

  function startEdit(item: Case) {
    setSelectedCaseId(item.id);
    setEditingId(item.id);
    setEditForm({
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
      agreed_fee_amount: String((item as Case & { agreed_fee_amount?: number | null }).agreed_fee_amount || ""),
      paid_fee_amount: String((item as Case & { paid_fee_amount?: number | null }).paid_fee_amount || ""),
      fee_notes: (item as Case & { fee_notes?: string | null }).fee_notes || "",
      last_decision: item.last_decision || "",
      required_action: item.required_action || "",
      judgment_summary: item.judgment_summary || "",
      notes: item.notes || "",
    });
  }

  async function updateCase(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingId) return;
    if (!editForm.title.trim()) {
      setError("عنوان القضية مطلوب.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("cases")
      .update({
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
        agreed_fee_amount: numberOrNull(editForm.agreed_fee_amount),
        paid_fee_amount: numberOrNull(editForm.paid_fee_amount),
        fee_notes: nullIfEmpty(editForm.fee_notes),
        last_decision: nullIfEmpty(editForm.last_decision),
        required_action: nullIfEmpty(editForm.required_action),
        judgment_summary: nullIfEmpty(editForm.judgment_summary),
        notes: nullIfEmpty(editForm.notes),
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingId);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setEditingId("");
    showSuccess("تم تعديل بيانات القضية.");
    await onRefresh();
  }

  async function deleteCase(id: string) {
    const ok = confirm("هل تريد حذف هذه القضية؟ سيتم حذف الجلسات المرتبطة بها، وقد تصبح بعض المستندات أو المدفوعات بدون قضية.");
    if (!ok) return;

    const { error } = await supabase.from("cases").delete().eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    setSelectedCaseId("");
    setEditingId("");
    showSuccess("تم حذف القضية.");
    await onRefresh();
  }

  return (
    <Panel title="إدارة القضايا">
      <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_180px]">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث في القضايا بالرقم، الخصم، المحكمة، القرار..." className="h-12 min-w-0 rounded-[20px] border border-black/10 bg-white/80 px-4 text-sm font-bold text-black outline-none placeholder:text-zinc-400 focus:ring-4 focus:ring-slate-400/10" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-12 rounded-[20px] border border-black/10 bg-white/80 px-4 text-sm font-black text-black outline-none">
          <option value="all">كل الحالات</option>
          {Object.entries(caseStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {filteredCases.length === 0 ? (
        <EmptyState title="لا توجد قضايا" description="جرّب تغيير البحث أو أضف قضية جديدة من الأعلى." />
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.75fr_1.25fr]">
          <div className="space-y-3">
            {filteredCases.map((item) => {
              const active = selectedCase?.id === item.id;
              return (
                <button key={item.id} type="button" onClick={() => { setSelectedCaseId(item.id); setEditingId(""); }} className={`w-full min-w-0 rounded-[24px] border p-4 text-right shadow-sm transition ${active ? "border-slate-300 bg-slate-100" : "border-black/5 bg-white/75 hover:bg-white"}`}>
                  <h3 className="break-words font-black text-black">{item.title}</h3>
                  <p className="mt-1 break-words text-xs font-bold text-zinc-600">رقم {item.case_number || "—"} لسنة {item.case_year || "—"}</p>
                  <p className="mt-1 break-words text-xs font-bold text-zinc-500">{item.court_name || "محكمة غير محددة"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone="violet">{caseStatusLabels[item.status]}</Badge>
                    <Badge tone="blue">{courtCategoryLabels[item.court_category]}</Badge>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="min-w-0 rounded-[30px] border border-white/70 bg-white/70 p-5 shadow-sm">
            {!selectedCase ? (
              <EmptyState title="اختر قضية" description="اضغط على قضية من القائمة لعرض التفاصيل." />
            ) : editingId === selectedCase.id ? (
              <CaseEditForm editForm={editForm} setEditForm={setEditForm} saving={saving} onSubmit={updateCase} onCancel={() => setEditingId("")} />
            ) : (
              <CaseDetailsView
                selectedCase={selectedCase}
                relatedHearings={relatedHearings}
                relatedDocuments={relatedDocuments}
                relatedPayments={relatedPayments}
                onEdit={() => startEdit(selectedCase)}
                onDelete={() => deleteCase(selectedCase.id)}
                onOpenDocument={onOpenDocument}
                onDeleteDocument={onDeleteDocument}
                setActiveSection={setActiveSection}
              />
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

function CaseEditForm({
  editForm,
  setEditForm,
  saving,
  onSubmit,
  onCancel,
}: {
  editForm: typeof caseEmptyForm;
  setEditForm: (form: typeof caseEmptyForm) => void;
  saving: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h3 className="text-xl font-black text-black">تعديل القضية</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="عنوان القضية" value={editForm.title} onChange={(value: string) => setEditForm({ ...editForm, title: value })} required />
        <Field label="رقم القضية" value={editForm.case_number} onChange={(value: string) => setEditForm({ ...editForm, case_number: value })} />
        <Field label="سنة القضية" value={editForm.case_year} onChange={(value: string) => setEditForm({ ...editForm, case_year: value })} />
        <SelectField label="نوع المحكمة" value={editForm.court_category} onChange={(value: string) => setEditForm({ ...editForm, court_category: value as CourtCategory })} options={Object.entries(courtCategoryLabels).map(([value, label]) => ({ value, label }))} />
        <SelectField label="درجة التقاضي" value={editForm.litigation_degree} onChange={(value: string) => setEditForm({ ...editForm, litigation_degree: value as LitigationDegree })} options={Object.entries(litigationDegreeLabels).map(([value, label]) => ({ value, label }))} />
        <SelectField label="حالة القضية" value={editForm.status} onChange={(value: string) => setEditForm({ ...editForm, status: value as CaseStatus })} options={Object.entries(caseStatusLabels).map(([value, label]) => ({ value, label }))} />
        <Field label="اسم المحكمة" value={editForm.court_name} onChange={(value: string) => setEditForm({ ...editForm, court_name: value })} />
        <Field label="الدائرة" value={editForm.circuit} onChange={(value: string) => setEditForm({ ...editForm, circuit: value })} />
        <Field label="رول الدعوى" value={editForm.roll_number} onChange={(value: string) => setEditForm({ ...editForm, roll_number: value })} />
        <Field label="نوع القضية" value={editForm.case_type} onChange={(value: string) => setEditForm({ ...editForm, case_type: value })} />
        <Field label="صفة الموكل" value={editForm.client_role} onChange={(value: string) => setEditForm({ ...editForm, client_role: value })} />
        <Field label="اسم الخصم" value={editForm.opponent_name} onChange={(value: string) => setEditForm({ ...editForm, opponent_name: value })} />
        <Field label="محامي الخصم" value={editForm.opponent_lawyer} onChange={(value: string) => setEditForm({ ...editForm, opponent_lawyer: value })} />
        <Field label="تاريخ رفع الدعوى" value={editForm.filing_date} onChange={(value: string) => setEditForm({ ...editForm, filing_date: value })} type="date" />
        <Field label="الجلسة القادمة" value={editForm.next_hearing_date} onChange={(value: string) => setEditForm({ ...editForm, next_hearing_date: value })} type="date" />
        <Field label="الأتعاب المتفق عليها" value={editForm.agreed_fee_amount} onChange={(value: string) => setEditForm({ ...editForm, agreed_fee_amount: value })} type="number" />
        <Field label="المدفوع من الأتعاب" value={editForm.paid_fee_amount} onChange={(value: string) => setEditForm({ ...editForm, paid_fee_amount: value })} type="number" />
      </div>
      <TextareaField label="ملاحظات الأتعاب" value={editForm.fee_notes} onChange={(value: string) => setEditForm({ ...editForm, fee_notes: value })} />
      <TextareaField label="آخر قرار" value={editForm.last_decision} onChange={(value: string) => setEditForm({ ...editForm, last_decision: value })} />
      <TextareaField label="المطلوب" value={editForm.required_action} onChange={(value: string) => setEditForm({ ...editForm, required_action: value })} />
      <TextareaField label="ملخص الحكم" value={editForm.judgment_summary} onChange={(value: string) => setEditForm({ ...editForm, judgment_summary: value })} />
      <TextareaField label="ملاحظات" value={editForm.notes} onChange={(value: string) => setEditForm({ ...editForm, notes: value })} />
      <div className="flex flex-wrap gap-2">
        <button disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-xs font-black text-white disabled:opacity-60">{saving ? "جاري الحفظ..." : "حفظ تعديل القضية"}</button>
        <button type="button" onClick={onCancel} className="rounded-2xl bg-zinc-100 px-5 py-3 text-xs font-black text-black">إلغاء</button>
      </div>
    </form>
  );
}

function CaseDetailsView({
  selectedCase,
  relatedHearings,
  relatedDocuments,
  relatedPayments,
  onEdit,
  onDelete,
  onOpenDocument,
  onDeleteDocument,
  setActiveSection,
}: {
  selectedCase: Case;
  relatedHearings: HearingWithCase[];
  relatedDocuments: DocumentWithCase[];
  relatedPayments: Payment[];
  onEdit: () => void;
  onDelete: () => void;
  onOpenDocument: (doc: DocumentWithCase) => void;
  onDeleteDocument: (doc: DocumentWithCase) => void;
  setActiveSection: (section: SectionKey) => void;
}) {
  const selectedCaseFees = caseFeeSummary(selectedCase);
  const paidForCase = selectedCaseFees.paid;
  const unpaidForCase = selectedCaseFees.remaining;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="break-words text-2xl font-black text-black">{selectedCase.title}</h3>
          <p className="mt-1 text-xs font-bold text-zinc-600">رقم {selectedCase.case_number || "—"} لسنة {selectedCase.case_year || "—"}</p>
        </div>
        <Can roles={["admin"]}>
          <div className="flex flex-wrap gap-2">
            <button onClick={onEdit} className="rounded-2xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-800">تعديل القضية</button>
            <button onClick={onDelete} className="rounded-2xl bg-red-50 px-4 py-2 text-xs font-black text-red-700">حذف القضية</button>
          </div>
        </Can>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Info label="نوع المحكمة"><Badge tone="blue">{courtCategoryLabels[selectedCase.court_category]}</Badge></Info>
        <Info label="درجة التقاضي"><ResponsiveText>{litigationDegreeLabels[selectedCase.litigation_degree]}</ResponsiveText></Info>
        <Info label="الحالة"><Badge tone="violet">{caseStatusLabels[selectedCase.status]}</Badge></Info>
        <Info label="اسم المحكمة"><ResponsiveText>{selectedCase.court_name}</ResponsiveText></Info>
        <Info label="الدائرة"><ResponsiveText>{selectedCase.circuit}</ResponsiveText></Info>
        <Info label="رول الدعوى"><ResponsiveText>{selectedCase.roll_number}</ResponsiveText></Info>
        <Info label="نوع القضية"><ResponsiveText>{selectedCase.case_type}</ResponsiveText></Info>
        <Info label="صفة الموكل"><ResponsiveText>{selectedCase.client_role}</ResponsiveText></Info>
        <Info label="اسم الخصم"><ResponsiveText>{selectedCase.opponent_name}</ResponsiveText></Info>
        <Info label="محامي الخصم"><ResponsiveText>{selectedCase.opponent_lawyer}</ResponsiveText></Info>
        <Info label="تاريخ رفع الدعوى"><ResponsiveText>{formatDate(selectedCase.filing_date)}</ResponsiveText></Info>
        <Info label="الجلسة القادمة"><ResponsiveText>{formatDate(selectedCase.next_hearing_date)}</ResponsiveText></Info>
        <Info label="الأتعاب المتفق عليها"><ResponsiveText>{formatMoney(caseFeeSummary(selectedCase).agreed)}</ResponsiveText></Info>
        <Info label="المدفوع من الأتعاب"><ResponsiveText>{formatMoney(caseFeeSummary(selectedCase).paid)}</ResponsiveText></Info>
        <Info label="المتبقي من الأتعاب"><ResponsiveText>{formatMoney(caseFeeSummary(selectedCase).remaining)}</ResponsiveText></Info>
      </div>

      <Info label="ملاحظات الأتعاب"><ResponsiveText>{(selectedCase as Case & { fee_notes?: string | null }).fee_notes}</ResponsiveText></Info>
      <Info label="آخر قرار"><ResponsiveText>{selectedCase.last_decision}</ResponsiveText></Info>
      <Info label="المطلوب"><ResponsiveText>{selectedCase.required_action}</ResponsiveText></Info>
      <Info label="ملخص الحكم"><ResponsiveText>{selectedCase.judgment_summary}</ResponsiveText></Info>
      <Info label="ملاحظات"><ResponsiveText>{selectedCase.notes}</ResponsiveText></Info>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MiniBox label="جلسات القضية" value={relatedHearings.length} tone="amber" />
        <MiniBox label="مستندات القضية" value={relatedDocuments.length} tone="emerald" />
        <MiniBox label="أتعاب مدفوعة / متبقية" value={`${formatMoney(paidForCase)} / ${formatMoney(unpaidForCase)}`} tone="teal" />
      </div>

      <section className="rounded-[26px] bg-zinc-100/70 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="font-black text-black">جلسات هذه القضية</h4>
          <button onClick={() => setActiveSection("hearings")} className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-800">إدارة الجلسات</button>
        </div>
        {relatedHearings.length === 0 ? <SmallEmpty text="لا توجد جلسات مرتبطة بهذه القضية." /> : (
          <div className="space-y-2">
            {relatedHearings.map((item) => (
              <div key={item.id} className="rounded-2xl bg-white/80 p-3">
                <Badge tone="amber">{formatDate(item.hearing_date)}</Badge>
                <p className="mt-2 text-sm font-black text-black">{item.court_name || "محكمة غير محددة"} {item.circuit ? `— ${item.circuit}` : ""}</p>
                <p className="mt-1 break-words text-xs font-bold text-zinc-600">القرار: {item.decision || "—"}</p>
                <p className="mt-1 break-words text-xs font-bold text-zinc-600">المطلوب: {item.required_action || "—"}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[26px] bg-zinc-100/70 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="font-black text-black">مستندات هذه القضية</h4>
          <button onClick={() => setActiveSection("documents")} className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-900">إدارة المستندات</button>
        </div>
        {relatedDocuments.length === 0 ? <SmallEmpty text="لا توجد مستندات مرتبطة بهذه القضية." /> : (
          <div className="space-y-2">
            {relatedDocuments.map((doc) => (
              <div key={doc.id} className="rounded-2xl bg-white/80 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-black text-black">{doc.title}</p>
                    <p className="mt-1 break-all text-xs font-bold text-zinc-500">{doc.file_name}</p>
                    <p className="mt-1 text-xs font-bold text-zinc-500">{formatFileSize(doc.file_size)}</p>
                  </div>
                  <Badge tone="emerald">{documentTypeLabels[doc.document_type]}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => onOpenDocument(doc)} className="rounded-2xl bg-black px-4 py-2 text-xs font-black text-white">فتح PDF</button>
                  <Can roles={["admin"]}><button onClick={() => onDeleteDocument(doc)} className="rounded-2xl bg-red-50 px-4 py-2 text-xs font-black text-red-700">حذف</button></Can>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[26px] bg-zinc-100/70 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="font-black text-black">أتعاب ومصروفات هذه القضية</h4>
          <Can roles={["admin"]}><button onClick={() => setActiveSection("payments")} className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-900">إدارة الأتعاب</button></Can>
        </div>
        {relatedPayments.length === 0 ? <SmallEmpty text="لا توجد عمليات مالية مرتبطة بهذه القضية." /> : (
          <div className="space-y-2">
            {relatedPayments.map((item) => (
              <div key={item.id} className="rounded-2xl bg-white/80 p-3">
                <p className="text-sm font-black text-black">{formatMoney(Number(item.amount))}</p>
                <p className="mt-1 text-xs font-bold text-zinc-600">{item.payment_type === "fee" ? "أتعاب" : "مصروفات"} — {item.status === "paid" ? "مدفوع" : item.status === "partial" ? "جزئي" : "غير مدفوع"}</p>
                <p className="mt-1 break-words text-xs font-bold text-zinc-500">{item.notes || "لا توجد ملاحظات."}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RelatedHearings({ hearings, cases, onRefresh, setError, showSuccess }: { hearings: HearingWithCase[]; cases: Case[]; onRefresh: () => Promise<void>; setError: (message: string) => void; showSuccess: (message: string) => void; }) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState(hearingEmptyForm);

  const caseOptions = [{ value: "", label: "اختر قضية" }, ...cases.map((item) => ({ value: item.id, label: `${item.title} ${item.case_number ? `— رقم ${item.case_number}` : ""}` }))];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return hearings.filter((item) => [item.hearing_date, item.court_name, item.circuit, item.decision, item.required_action, item.notes, item.cases?.title, item.cases?.case_number, item.cases?.case_year].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [hearings, search]);

  const selected = hearings.find((item) => item.id === selectedId) || filtered[0] || null;

  function startEdit(item: HearingWithCase) {
    setSelectedId(item.id);
    setEditingId(item.id);
    setEditForm({ case_id: item.case_id || "", hearing_date: item.hearing_date || "", court_name: item.court_name || "", circuit: item.circuit || "", decision: item.decision || "", required_action: item.required_action || "", notes: item.notes || "" });
  }

  async function updateHearing(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingId) return;
    if (!editForm.case_id) return setError("اختر القضية.");
    if (!editForm.hearing_date) return setError("تاريخ الجلسة مطلوب.");
    setSaving(true);
    const { error } = await supabase.from("hearings").update({ case_id: editForm.case_id, hearing_date: editForm.hearing_date, court_name: nullIfEmpty(editForm.court_name), circuit: nullIfEmpty(editForm.circuit), decision: nullIfEmpty(editForm.decision), required_action: nullIfEmpty(editForm.required_action), notes: nullIfEmpty(editForm.notes) }).eq("id", editingId);
    if (!error) await supabase.from("cases").update({ next_hearing_date: editForm.hearing_date, last_decision: nullIfEmpty(editForm.decision), required_action: nullIfEmpty(editForm.required_action), updated_at: new Date().toISOString() }).eq("id", editForm.case_id);
    setSaving(false);
    if (error) return setError(error.message);
    setEditingId("");
    showSuccess("تم تعديل الجلسة وتحديث القضية.");
    await onRefresh();
  }

  async function deleteHearing(id: string) {
    if (!confirm("هل تريد حذف هذه الجلسة؟")) return;
    const { error } = await supabase.from("hearings").delete().eq("id", id);
    if (error) return setError(error.message);
    setSelectedId("");
    setEditingId("");
    showSuccess("تم حذف الجلسة.");
    await onRefresh();
  }

  return (
    <Panel title="إدارة الجلسات">
      <div className="mb-5"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث في الجلسات بالتاريخ، المحكمة، القرار، القضية..." className="h-12 w-full min-w-0 rounded-[20px] border border-black/10 bg-white/80 px-4 text-sm font-bold text-black outline-none placeholder:text-zinc-400 focus:ring-4 focus:ring-amber-500/10" /></div>
      {filtered.length === 0 ? <EmptyState title="لا توجد جلسات" description="جرّب تغيير البحث أو أضف جلسة جديدة من الأعلى." /> : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.75fr_1.25fr]">
          <div className="space-y-3">{filtered.map((item) => <button key={item.id} type="button" onClick={() => { setSelectedId(item.id); setEditingId(""); }} className={`w-full rounded-[24px] border p-4 text-right shadow-sm ${selected?.id === item.id ? "border-amber-300 bg-slate-100" : "border-black/5 bg-white/75 hover:bg-white"}`}><Badge tone="amber">{formatDate(item.hearing_date)}</Badge><h3 className="mt-3 break-words font-black text-black">{item.cases?.title || "قضية غير محددة"}</h3><p className="mt-1 text-xs font-bold text-zinc-600">{item.court_name || "محكمة غير محددة"}</p></button>)}</div>
          <div className="rounded-[30px] border border-white/70 bg-white/70 p-5 shadow-sm">
            {!selected ? <EmptyState title="اختر جلسة" /> : editingId === selected.id ? (
              <form onSubmit={updateHearing} className="space-y-4"><SelectField label="القضية" value={editForm.case_id} onChange={(value: string) => setEditForm({ ...editForm, case_id: value })} options={caseOptions} /><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Field label="تاريخ الجلسة" value={editForm.hearing_date} onChange={(value: string) => setEditForm({ ...editForm, hearing_date: value })} type="date" required /><Field label="المحكمة" value={editForm.court_name} onChange={(value: string) => setEditForm({ ...editForm, court_name: value })} /><Field label="الدائرة" value={editForm.circuit} onChange={(value: string) => setEditForm({ ...editForm, circuit: value })} /></div><TextareaField label="قرار الجلسة" value={editForm.decision} onChange={(value: string) => setEditForm({ ...editForm, decision: value })} /><TextareaField label="المطلوب" value={editForm.required_action} onChange={(value: string) => setEditForm({ ...editForm, required_action: value })} /><TextareaField label="ملاحظات" value={editForm.notes} onChange={(value: string) => setEditForm({ ...editForm, notes: value })} /><div className="flex flex-wrap gap-2"><button disabled={saving} className="rounded-2xl bg-slate-200 px-5 py-3 text-xs font-black text-black disabled:opacity-60">{saving ? "جاري الحفظ..." : "حفظ تعديل الجلسة"}</button><button type="button" onClick={() => setEditingId("")} className="rounded-2xl bg-zinc-100 px-5 py-3 text-xs font-black text-black">إلغاء</button></div></form>
            ) : (
              <div className="space-y-4"><h3 className="text-2xl font-black text-black">{selected.cases?.title || "قضية غير محددة"}</h3><div className="grid grid-cols-1 gap-3 md:grid-cols-2"><Info label="تاريخ الجلسة"><ResponsiveText>{formatDate(selected.hearing_date)}</ResponsiveText></Info><Info label="المحكمة"><ResponsiveText>{selected.court_name}</ResponsiveText></Info><Info label="الدائرة"><ResponsiveText>{selected.circuit}</ResponsiveText></Info></div><Info label="قرار الجلسة"><ResponsiveText>{selected.decision}</ResponsiveText></Info><Info label="المطلوب"><ResponsiveText>{selected.required_action}</ResponsiveText></Info><Info label="ملاحظات"><ResponsiveText>{selected.notes}</ResponsiveText></Info><div className="flex flex-wrap gap-2"><Can roles={["admin"]}><button onClick={() => startEdit(selected)} className="rounded-2xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-800">تعديل الجلسة</button><button onClick={() => deleteHearing(selected.id)} className="rounded-2xl bg-red-50 px-4 py-2 text-xs font-black text-red-700">حذف الجلسة</button></Can></div></div>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

function RelatedDocuments({ documents, cases, onOpen, onDelete, onRefresh, setError, showSuccess }: { documents: DocumentWithCase[]; cases: Case[]; onOpen: (doc: DocumentWithCase) => void; onDelete: (doc: DocumentWithCase) => void; onRefresh: () => Promise<void>; setError: (message: string) => void; showSuccess: (message: string) => void; }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState(documentEmptyForm);
  const caseOptions = [{ value: "", label: "بدون قضية" }, ...cases.map((item) => ({ value: item.id, label: `${item.title} ${item.case_number ? `— رقم ${item.case_number}` : ""}` }))];
  const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return documents.filter((doc) => (typeFilter === "all" || doc.document_type === typeFilter) && (!q || [doc.title, doc.document_type, doc.file_name, doc.notes, doc.cases?.title, doc.cases?.case_number, doc.cases?.case_year].filter(Boolean).join(" ").toLowerCase().includes(q))); }, [documents, search, typeFilter]);
  const selected = documents.find((item) => item.id === selectedId) || filtered[0] || null;
  function startEdit(doc: DocumentWithCase) { setSelectedId(doc.id); setEditingId(doc.id); setEditForm({ title: doc.title || "", document_type: doc.document_type, case_id: doc.case_id || "", notes: doc.notes || "" }); }
  async function updateDocument(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (!editingId) return; if (!editForm.title.trim()) return setError("عنوان المستند مطلوب."); setSaving(true); const { error } = await supabase.from("documents").update({ title: editForm.title.trim(), document_type: editForm.document_type, case_id: editForm.case_id || null, notes: nullIfEmpty(editForm.notes) }).eq("id", editingId); setSaving(false); if (error) return setError(error.message); setEditingId(""); showSuccess("تم تعديل بيانات المستند."); await onRefresh(); }
  return <Panel title="إدارة المستندات PDF"><div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px]"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث في المستندات بالعنوان، اسم الملف، القضية..." className="h-12 min-w-0 rounded-[20px] border border-black/10 bg-white/80 px-4 text-sm font-bold text-black outline-none placeholder:text-zinc-400 focus:ring-4 focus:ring-slate-400/10" /><select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-12 rounded-[20px] border border-black/10 bg-white/80 px-4 text-sm font-black text-black outline-none"><option value="all">كل أنواع المستندات</option>{Object.entries(documentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>{filtered.length === 0 ? <EmptyState title="لا توجد مستندات" description="جرّب تغيير البحث أو ارفع ملف PDF جديد من الأعلى." /> : <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.75fr_1.25fr]"><div className="space-y-3">{filtered.map((doc) => <button key={doc.id} type="button" onClick={() => { setSelectedId(doc.id); setEditingId(""); }} className={`w-full rounded-[24px] border p-4 text-right shadow-sm ${selected?.id === doc.id ? "border-slate-300 bg-slate-100" : "border-black/5 bg-white/75 hover:bg-white"}`}><h3 className="break-words font-black text-black">{doc.title}</h3><p className="mt-1 break-all text-xs font-bold text-zinc-500">{doc.file_name}</p><p className="mt-1 text-xs font-bold text-zinc-600">{doc.cases?.title || "غير مرتبط بقضية"}</p></button>)}</div><div className="rounded-[30px] border border-white/70 bg-white/70 p-5 shadow-sm">{!selected ? <EmptyState title="اختر مستند" /> : editingId === selected.id ? <form onSubmit={updateDocument} className="space-y-4"><Field label="عنوان المستند" value={editForm.title} onChange={(value: string) => setEditForm({ ...editForm, title: value })} required /><SelectField label="نوع المستند" value={editForm.document_type} onChange={(value: string) => setEditForm({ ...editForm, document_type: value as DocumentType })} options={Object.entries(documentTypeLabels).map(([value, label]) => ({ value, label }))} /><SelectField label="ربط بقضية" value={editForm.case_id} onChange={(value: string) => setEditForm({ ...editForm, case_id: value })} options={caseOptions} /><TextareaField label="ملاحظات" value={editForm.notes} onChange={(value: string) => setEditForm({ ...editForm, notes: value })} /><div className="flex flex-wrap gap-2"><button disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-xs font-black text-white disabled:opacity-60">{saving ? "جاري الحفظ..." : "حفظ تعديل المستند"}</button><button type="button" onClick={() => setEditingId("")} className="rounded-2xl bg-zinc-100 px-5 py-3 text-xs font-black text-black">إلغاء</button></div></form> : <div className="space-y-4"><h3 className="text-2xl font-black text-black">{selected.title}</h3><div className="grid grid-cols-1 gap-3 md:grid-cols-2"><Info label="نوع المستند"><Badge tone="emerald">{documentTypeLabels[selected.document_type]}</Badge></Info><Info label="اسم الملف الأصلي"><ResponsiveText className="break-all">{selected.file_name}</ResponsiveText></Info><Info label="الحجم"><ResponsiveText>{formatFileSize(selected.file_size)}</ResponsiveText></Info><Info label="تاريخ الرفع"><ResponsiveText>{formatDate(selected.created_at)}</ResponsiveText></Info><Info label="القضية"><ResponsiveText>{selected.cases?.title || "غير مرتبط بقضية"}</ResponsiveText></Info></div><Info label="ملاحظات"><ResponsiveText>{selected.notes}</ResponsiveText></Info><div className="flex flex-wrap gap-2"><button onClick={() => onOpen(selected)} className="rounded-2xl bg-black px-4 py-2 text-xs font-black text-white">فتح PDF</button><Can roles={["admin"]}><button onClick={() => startEdit(selected)} className="rounded-2xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-800">تعديل البيانات</button><button onClick={() => onDelete(selected)} className="rounded-2xl bg-red-50 px-4 py-2 text-xs font-black text-red-700">حذف المستند</button></Can></div></div>}</div></div>}</Panel>;
}

function RelatedPayments({ payments, cases, onRefresh, setError, showSuccess }: { payments: Payment[]; cases: Case[]; onRefresh: () => Promise<void>; setError: (message: string) => void; showSuccess: (message: string) => void; }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState(paymentEmptyForm);
  const caseOptions = [{ value: "", label: "بدون قضية" }, ...cases.map((item) => ({ value: item.id, label: `${item.title} ${item.case_number ? `— رقم ${item.case_number}` : ""}` }))];
  const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return payments.filter((item) => (typeFilter === "all" || item.payment_type === typeFilter) && (statusFilter === "all" || item.status === statusFilter) && (!q || [item.amount, item.payment_type, item.status, item.payment_date, item.notes].filter(Boolean).join(" ").toLowerCase().includes(q))); }, [payments, search, typeFilter, statusFilter]);
  const selected = payments.find((item) => item.id === selectedId) || filtered[0] || null;
  function startEdit(item: Payment) { setSelectedId(item.id); setEditingId(item.id); setEditForm({ case_id: item.case_id || "", amount: String(item.amount || ""), payment_type: item.payment_type, status: item.status, payment_date: item.payment_date || "", notes: item.notes || "" }); }
  async function adjustCasePaidAmount(caseId: string, delta: number) { const currentCase = cases.find((item) => item.id === caseId); const currentPaid = numberValue((currentCase as Case & { paid_fee_amount?: number | null } | undefined)?.paid_fee_amount); await supabase.from("cases").update({ paid_fee_amount: Math.max(currentPaid + delta, 0), updated_at: new Date().toISOString() }).eq("id", caseId); }
  async function updatePayment(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (!editingId) return; const amount = Number(editForm.amount); if (!amount || amount <= 0) return setError("اكتب مبلغ صحيح."); const original = payments.find((item) => item.id === editingId); setSaving(true); const { error } = await supabase.from("payments").update({ case_id: editForm.case_id || null, amount, payment_type: editForm.payment_type, status: editForm.status, payment_date: dateOrNull(editForm.payment_date), notes: nullIfEmpty(editForm.notes) }).eq("id", editingId); if (!error) { if (original?.case_id && original.payment_type === "fee" && original.status !== "unpaid") await adjustCasePaidAmount(original.case_id, -Number(original.amount || 0)); if (editForm.case_id && editForm.payment_type === "fee" && editForm.status !== "unpaid") await adjustCasePaidAmount(editForm.case_id, amount); } setSaving(false); if (error) return setError(error.message); setEditingId(""); showSuccess("تم تعديل العملية المالية وتحديث أتعاب القضية."); await onRefresh(); }
  async function deletePayment(id: string) { if (!confirm("هل تريد حذف هذه العملية المالية؟")) return; const original = payments.find((item) => item.id === id); const { error } = await supabase.from("payments").delete().eq("id", id); if (!error && original?.case_id && original.payment_type === "fee" && original.status !== "unpaid") await adjustCasePaidAmount(original.case_id, -Number(original.amount || 0)); if (error) return setError(error.message); setSelectedId(""); setEditingId(""); showSuccess("تم حذف العملية المالية وتحديث أتعاب القضية."); await onRefresh(); }
  return <Panel title="إدارة الأتعاب والمصروفات"><div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_160px_160px]"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث في العمليات المالية بالمبلغ أو الملاحظات..." className="h-12 min-w-0 rounded-[20px] border border-black/10 bg-white/80 px-4 text-sm font-bold text-black outline-none placeholder:text-zinc-400 focus:ring-4 focus:ring-slate-400/10" /><select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-12 rounded-[20px] border border-black/10 bg-white/80 px-4 text-sm font-black text-black outline-none"><option value="all">كل الأنواع</option><option value="fee">أتعاب</option><option value="expense">مصروفات</option></select><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-12 rounded-[20px] border border-black/10 bg-white/80 px-4 text-sm font-black text-black outline-none"><option value="all">كل الحالات</option><option value="paid">مدفوع</option><option value="unpaid">غير مدفوع</option><option value="partial">جزئي</option></select></div>{filtered.length === 0 ? <EmptyState title="لا توجد عمليات مالية" description="جرّب تغيير البحث أو أضف أتعاب/مصروفات من الأعلى." /> : <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.75fr_1.25fr]"><div className="space-y-3">{filtered.map((item) => <button key={item.id} type="button" onClick={() => { setSelectedId(item.id); setEditingId(""); }} className={`w-full rounded-[24px] border p-4 text-right shadow-sm ${selected?.id === item.id ? "border-slate-300 bg-slate-100" : "border-black/5 bg-white/75 hover:bg-white"}`}><h3 className="font-black text-black">{formatMoney(Number(item.amount))}</h3><p className="mt-1 text-xs font-bold text-zinc-600">{item.payment_type === "fee" ? "أتعاب" : "مصروفات"} — {item.status}</p></button>)}</div><div className="rounded-[30px] border border-white/70 bg-white/70 p-5 shadow-sm">{!selected ? <EmptyState title="اختر عملية مالية" /> : editingId === selected.id ? <form onSubmit={updatePayment} className="space-y-4"><SelectField label="ربط بقضية" value={editForm.case_id} onChange={(value: string) => setEditForm({ ...editForm, case_id: value })} options={caseOptions} /><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Field label="المبلغ" value={editForm.amount} onChange={(value: string) => setEditForm({ ...editForm, amount: value })} type="number" required /><SelectField label="النوع" value={editForm.payment_type} onChange={(value: string) => setEditForm({ ...editForm, payment_type: value })} options={[{ value: "fee", label: "أتعاب" }, { value: "expense", label: "مصروفات" }]} /><SelectField label="الحالة" value={editForm.status} onChange={(value: string) => setEditForm({ ...editForm, status: value })} options={[{ value: "paid", label: "مدفوع" }, { value: "unpaid", label: "غير مدفوع" }, { value: "partial", label: "جزئي" }]} /><Field label="تاريخ الدفع" value={editForm.payment_date} onChange={(value: string) => setEditForm({ ...editForm, payment_date: value })} type="date" /></div><TextareaField label="ملاحظات" value={editForm.notes} onChange={(value: string) => setEditForm({ ...editForm, notes: value })} /><div className="flex flex-wrap gap-2"><button disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-xs font-black text-white disabled:opacity-60">{saving ? "جاري الحفظ..." : "حفظ تعديل العملية"}</button><button type="button" onClick={() => setEditingId("")} className="rounded-2xl bg-zinc-100 px-5 py-3 text-xs font-black text-black">إلغاء</button></div></form> : <div className="space-y-4"><h3 className="text-2xl font-black text-black">{formatMoney(Number(selected.amount))}</h3><div className="grid grid-cols-1 gap-3 md:grid-cols-2"><Info label="النوع"><Badge tone="teal">{selected.payment_type === "fee" ? "أتعاب" : "مصروفات"}</Badge></Info><Info label="الحالة"><Badge tone={selected.status === "paid" ? "teal" : "rose"}>{selected.status === "paid" ? "مدفوع" : selected.status === "partial" ? "جزئي" : "غير مدفوع"}</Badge></Info><Info label="تاريخ الدفع"><ResponsiveText>{formatDate(selected.payment_date)}</ResponsiveText></Info></div><Info label="ملاحظات"><ResponsiveText>{selected.notes}</ResponsiveText></Info><div className="flex flex-wrap gap-2"><button onClick={() => startEdit(selected)} className="rounded-2xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-800">تعديل العملية</button><button onClick={() => deletePayment(selected.id)} className="rounded-2xl bg-red-50 px-4 py-2 text-xs font-black text-red-700">حذف العملية</button></div></div>}</div></div>}</Panel>;
}

function MiniBox({ label, value, tone }: { label: string; value: string | number; tone: "amber" | "emerald" | "teal" }) {
  const colors = { amber: "bg-slate-100 text-slate-800", emerald: "bg-slate-100 text-slate-900", teal: "bg-slate-100 text-slate-900" };
  return <div className={`rounded-[22px] p-4 ${colors[tone]}`}><p className="text-xs font-black opacity-80">{label}</p><p className="mt-2 break-words text-lg font-black">{value}</p></div>;
}

function SmallEmpty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 p-4 text-sm font-bold text-zinc-500">{text}</div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="min-w-0 rounded-[34px] border border-white/70 bg-white/70 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.07)] backdrop-blur-3xl"><h2 className="mb-5 break-words text-xl font-black text-black">{title}</h2>{children}</section>;
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0 rounded-[24px] bg-white/80 p-4 shadow-sm"><p className="text-xs font-black text-zinc-500">{label}</p><div className="mt-2 min-w-0 text-sm font-black text-black">{children}</div></div>;
}

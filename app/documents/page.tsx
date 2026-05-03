"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
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
  documentTypeLabels,
  formatDate,
  formatFileSize,
} from "@/lib/labels";

type DocumentType = keyof typeof documentTypeLabels;

type ClientLite = {
  id: string;
  name: string;
  phone: string | null;
};

type CaseLite = {
  id: string;
  title: string;
  case_number: string | null;
  case_year: string | null;
  client_id: string | null;
  clients?: {
    id: string;
    name: string;
  } | null;
};

type DocumentRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  case_id: string | null;
  title: string;
  document_type: DocumentType;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  notes: string | null;
  created_at: string;
  clients?: {
    id: string;
    name: string;
  } | null;
  cases?: {
    id: string;
    title: string;
    case_number: string | null;
    case_year: string | null;
  } | null;
};

type DocumentFormState = {
  title: string;
  document_type: DocumentType;
  client_id: string;
  case_id: string;
  notes: string;
};

const emptyDocumentForm: DocumentFormState = {
  title: "",
  document_type: "other" as DocumentType,
  client_id: "",
  case_id: "",
  notes: "",
};

function nullIfEmpty(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function prettyCaseLabel(item: CaseLite): string {
  const numberPart = item.case_number ? ` — رقم ${item.case_number}` : "";
  const yearPart = item.case_year ? `/${item.case_year}` : "";
  return `${item.title}${numberPart}${yearPart}`;
}

export default function DocumentsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [cases, setCases] = useState<CaseLite[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);

  const [form, setForm] = useState<DocumentFormState>(emptyDocumentForm);
  const [editForm, setEditForm] = useState<DocumentFormState>(emptyDocumentForm);
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);

  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [editingDocumentId, setEditingDocumentId] = useState("");
  const [showUpload, setShowUpload] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [caseFilter, setCaseFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "size" | "title">("newest");

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

    const clientsResult = await supabase
      .from("clients")
      .select("id,name,phone")
      .order("created_at", { ascending: false });

    const casesResult = await supabase
      .from("cases")
      .select("id,title,case_number,case_year,client_id,clients(id,name)")
      .order("created_at", { ascending: false });

    const documentsResult = await supabase
      .from("documents")
      .select("*,clients(id,name),cases(id,title,case_number,case_year)")
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

    if (documentsResult.error) {
      setError(documentsResult.error.message);
      setRefreshing(false);
      return;
    }

    const fetchedDocuments = ((documentsResult.data || []) as unknown) as DocumentRow[];

    setClients(((clientsResult.data || []) as unknown) as ClientLite[]);
    setCases(((casesResult.data || []) as unknown) as CaseLite[]);
    setDocuments(fetchedDocuments);

    setSelectedDocumentId((current) => current || fetchedDocuments[0]?.id || "");
    setRefreshing(false);
  }

  const clientOptions = useMemo(() => {
    return [
      { value: "", label: "بدون موكل / اختر موكل" },
      ...clients.map((client) => ({
        value: client.id,
        label: `${client.name}${client.phone ? ` — ${client.phone}` : ""}`,
      })),
    ];
  }, [clients]);

  const caseOptions = useMemo(() => {
    const filtered =
      form.client_id || editForm.client_id
        ? cases.filter((item) => {
            const activeClient = editingDocumentId ? editForm.client_id : form.client_id;
            return !activeClient || item.client_id === activeClient;
          })
        : cases;

    return [
      { value: "", label: "بدون قضية / اختر قضية" },
      ...filtered.map((item) => ({
        value: item.id,
        label: prettyCaseLabel(item),
      })),
    ];
  }, [cases, form.client_id, editForm.client_id, editingDocumentId]);

  const allCaseOptions = useMemo(() => {
    return [
      { value: "all", label: "كل القضايا" },
      { value: "none", label: "بدون قضية" },
      ...cases.map((item) => ({
        value: item.id,
        label: prettyCaseLabel(item),
      })),
    ];
  }, [cases]);

  const filteredDocuments = useMemo(() => {
    const q = search.trim().toLowerCase();

    let result = documents.filter((doc) => {
      const matchesType = typeFilter === "all" || doc.document_type === typeFilter;
      const matchesClient =
        clientFilter === "all" ||
        (clientFilter === "none" && !doc.client_id) ||
        doc.client_id === clientFilter;
      const matchesCase =
        caseFilter === "all" ||
        (caseFilter === "none" && !doc.case_id) ||
        doc.case_id === caseFilter;

      const searchable = [
        doc.title,
        doc.document_type,
        doc.file_name,
        doc.notes,
        doc.clients?.name,
        doc.cases?.title,
        doc.cases?.case_number,
        doc.cases?.case_year,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesType && matchesClient && matchesCase && (!q || searchable.includes(q));
    });

    if (sortBy === "title") {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title, "ar"));
    }

    if (sortBy === "size") {
      result = [...result].sort((a, b) => Number(b.file_size || 0) - Number(a.file_size || 0));
    }

    if (sortBy === "oldest") {
      result = [...result].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    if (sortBy === "newest") {
      result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [documents, search, typeFilter, clientFilter, caseFilter, sortBy]);

  const selectedDocument =
    documents.find((item) => item.id === selectedDocumentId) || filteredDocuments[0] || null;

  const totalSize = documents.reduce((sum, doc) => sum + Number(doc.file_size || 0), 0);
  const linkedToCaseCount = documents.filter((doc) => doc.case_id).length;
  const linkedToClientCount = documents.filter((doc) => doc.client_id).length;
  const unlinkedCount = documents.filter((doc) => !doc.client_id && !doc.case_id).length;

  function resetFilters() {
    setSearch("");
    setTypeFilter("all");
    setClientFilter("all");
    setCaseFilter("all");
    setSortBy("newest");
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setSelectedPdf(file);
  }

  function handleCaseChange(value: string, mode: "create" | "edit") {
    const selectedCase = cases.find((item) => item.id === value);

    if (mode === "create") {
      setForm((prev) => ({
        ...prev,
        case_id: value,
        client_id: selectedCase?.client_id || prev.client_id,
      }));
      return;
    }

    setEditForm((prev) => ({
      ...prev,
      case_id: value,
      client_id: selectedCase?.client_id || prev.client_id,
    }));
  }

  async function handleUploadDocument(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!userId) return;

    if (!form.title.trim()) {
      setError("عنوان المستند مطلوب.");
      return;
    }

    if (!selectedPdf) {
      setError("اختر ملف PDF أولًا.");
      return;
    }

    if (!isPdfFile(selectedPdf)) {
      setError("المسموح فقط ملفات PDF.");
      return;
    }

    if (selectedPdf.size > 10 * 1024 * 1024) {
      setError("حجم الملف يجب ألا يزيد عن 10MB.");
      return;
    }

    setUploading(true);

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
      setUploading(false);
      setError(uploadResult.error.message);
      return;
    }

    const insertResult = await supabase.from("documents").insert({
      id: documentId,
      user_id: userId,
      client_id: form.client_id || null,
      case_id: form.case_id || null,
      title: form.title.trim(),
      document_type: form.document_type,
      file_name: selectedPdf.name,
      file_path: filePath,
      file_size: selectedPdf.size,
      mime_type: "application/pdf",
      notes: nullIfEmpty(form.notes),
    });

    setUploading(false);

    if (insertResult.error) {
      await supabase.storage.from("legal-documents").remove([filePath]);
      setError(insertResult.error.message);
      return;
    }

    setForm(emptyDocumentForm);
    setSelectedPdf(null);
    setShowUpload(false);
    setSelectedDocumentId(documentId);

    const fileInput = document.getElementById("documents-file-input") as HTMLInputElement | null;
    if (fileInput) fileInput.value = "";

    showSuccessMessage("تم رفع المستند بنجاح.");
    await fetchAll();
  }

  function startEditDocument(doc: DocumentRow) {
    setEditingDocumentId(doc.id);
    setEditForm({
      title: doc.title || "",
      document_type: doc.document_type,
      client_id: doc.client_id || "",
      case_id: doc.case_id || "",
      notes: doc.notes || "",
    });
  }

  async function handleUpdateDocument(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!editingDocumentId) return;

    if (!editForm.title.trim()) {
      setError("عنوان المستند مطلوب.");
      return;
    }

    setSavingEdit(true);

    const { error } = await supabase
      .from("documents")
      .update({
        title: editForm.title.trim(),
        document_type: editForm.document_type,
        client_id: editForm.client_id || null,
        case_id: editForm.case_id || null,
        notes: nullIfEmpty(editForm.notes),
      })
      .eq("id", editingDocumentId);

    setSavingEdit(false);

    if (error) {
      setError(error.message);
      return;
    }

    setEditingDocumentId("");
    showSuccessMessage("تم تعديل بيانات المستند.");
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

  async function deleteDocument(doc: DocumentRow) {
    const ok = confirm("هل تريد حذف هذا المستند؟ سيتم حذف ملف PDF من التخزين وبياناته من النظام.");
    if (!ok) return;

    setDeleting(true);

    const storageResult = await supabase.storage
      .from("legal-documents")
      .remove([doc.file_path]);

    if (storageResult.error) {
      setDeleting(false);
      setError(storageResult.error.message);
      return;
    }

    const dbResult = await supabase.from("documents").delete().eq("id", doc.id);

    setDeleting(false);

    if (dbResult.error) {
      setError(dbResult.error.message);
      return;
    }

    if (selectedDocumentId === doc.id) {
      setSelectedDocumentId("");
    }

    showSuccessMessage("تم حذف المستند.");
    await fetchAll();
  }

  if (loading) {
    return <LoadingCard text="جاري تحميل المستندات..." />;
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Documents Workspace"
          title="إدارة المستندات"
          tone="emerald"
          description="صفحة مستقلة لإدارة ملفات PDF: رفع، ربط بموكل أو قضية، بحث، فتح، تعديل، وحذف."
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowUpload((value) => !value)}
                className="h-10 rounded-[18px] bg-emerald-600 px-4 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700"
              >
                {showUpload ? "إغلاق الرفع" : "رفع PDF"}
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
          <SummaryCard label="المستندات" value={documents.length} hint="إجمالي PDF" tone="emerald" />
          <SummaryCard label="مرتبطة بقضية" value={linkedToCaseCount} hint="لها case_id" tone="violet" />
          <SummaryCard label="مرتبطة بموكل" value={linkedToClientCount} hint="لها client_id" tone="blue" />
          <SummaryCard label="الحجم" value={formatFileSize(totalSize)} hint={`غير مرتبطة: ${unlinkedCount}`} tone="amber" />
        </section>

        {showUpload ? (
          <form
            onSubmit={handleUploadDocument}
            className="min-w-0 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.07)] backdrop-blur-3xl lg:p-5"
          >
            <CompactTitle
              title="رفع مستند PDF"
              description="ارفع ملف PDF واربطه بموكل أو قضية. لو اخترت قضية، سيتم ربط الموكل تلقائيًا حسب القضية."
            />

            <DocumentForm
              form={form}
              setForm={setForm}
              clientOptions={clientOptions}
              caseOptions={caseOptions}
              onCaseChange={(value) => handleCaseChange(value, "create")}
              saving={uploading}
              submitLabel={uploading ? "جاري الرفع..." : "رفع وحفظ المستند"}
              fileInput={
                <div>
                  <label className="mb-2 block text-sm font-black text-black">
                    ملف PDF
                  </label>

                  <input
                    id="documents-file-input"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handleFileChange}
                    className="w-full rounded-[18px] border border-black/10 bg-white/80 p-3 text-xs font-bold text-black"
                  />

                  {selectedPdf ? (
                    <p className="mt-2 break-all text-xs font-bold text-zinc-600">
                      {selectedPdf.name} — {formatFileSize(selectedPdf.size)}
                    </p>
                  ) : null}
                </div>
              }
            />
          </form>
        ) : null}

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[430px_1fr]">
          <section className="min-w-0 space-y-4">
            <FiltersPanel
              search={search}
              setSearch={setSearch}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              clientFilter={clientFilter}
              setClientFilter={setClientFilter}
              caseFilter={caseFilter}
              setCaseFilter={setCaseFilter}
              sortBy={sortBy}
              setSortBy={setSortBy}
              clients={clients}
              allCaseOptions={allCaseOptions}
              onReset={resetFilters}
            />

            <DocumentsList
              filteredDocuments={filteredDocuments}
              selectedDocumentId={selectedDocument?.id || ""}
              onSelect={(id) => {
                setSelectedDocumentId(id);
                setEditingDocumentId("");
              }}
            />
          </section>

          <DocumentDetailsPanel
            selectedDocument={selectedDocument}
            editingDocumentId={editingDocumentId}
            editForm={editForm}
            setEditForm={setEditForm}
            clientOptions={clientOptions}
            caseOptions={caseOptions}
            onCaseChange={(value) => handleCaseChange(value, "edit")}
            savingEdit={savingEdit}
            deleting={deleting}
            startEditDocument={startEditDocument}
            cancelEdit={() => setEditingDocumentId("")}
            handleUpdateDocument={handleUpdateDocument}
            openDocument={openDocument}
            deleteDocument={deleteDocument}
          />
        </section>
      </div>
    </AppShell>
  );
}

function FiltersPanel({
  search,
  setSearch,
  typeFilter,
  setTypeFilter,
  clientFilter,
  setClientFilter,
  caseFilter,
  setCaseFilter,
  sortBy,
  setSortBy,
  clients,
  allCaseOptions,
  onReset,
}: {
  search: string;
  setSearch: (value: string) => void;
  typeFilter: string;
  setTypeFilter: (value: string) => void;
  clientFilter: string;
  setClientFilter: (value: string) => void;
  caseFilter: string;
  setCaseFilter: (value: string) => void;
  sortBy: "newest" | "oldest" | "size" | "title";
  setSortBy: (value: "newest" | "oldest" | "size" | "title") => void;
  clients: ClientLite[];
  allCaseOptions: { value: string; label: string }[];
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
          placeholder="بحث بالعنوان، اسم الملف، الموكل، القضية..."
          className="h-10 w-full min-w-0 rounded-[16px] border border-black/10 bg-white/85 px-3 text-xs font-bold text-black outline-none placeholder:text-zinc-400 focus:ring-4 focus:ring-emerald-500/10"
        />

        <div className="grid grid-cols-2 gap-2">
          <CompactSelect value={typeFilter} onChange={setTypeFilter}>
            <option value="all">كل الأنواع</option>
            {Object.entries(documentTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </CompactSelect>

          <CompactSelect value={clientFilter} onChange={setClientFilter}>
            <option value="all">كل الموكلين</option>
            <option value="none">بدون موكل</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </CompactSelect>

          <CompactSelect value={caseFilter} onChange={setCaseFilter}>
            {allCaseOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </CompactSelect>

          <CompactSelect
            value={sortBy}
            onChange={(value) => setSortBy(value as "newest" | "oldest" | "size" | "title")}
          >
            <option value="newest">الأحدث</option>
            <option value="oldest">الأقدم</option>
            <option value="size">الأكبر حجمًا</option>
            <option value="title">العنوان</option>
          </CompactSelect>
        </div>
      </div>
    </section>
  );
}

function DocumentsList({
  filteredDocuments,
  selectedDocumentId,
  onSelect,
}: {
  filteredDocuments: DocumentRow[];
  selectedDocumentId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="min-w-0 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)] backdrop-blur-3xl">
      <div className="mb-4 flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-black text-black">قائمة المستندات</h2>
          <p className="text-xs font-bold text-zinc-500">{filteredDocuments.length} نتيجة</p>
        </div>
      </div>

      {filteredDocuments.length === 0 ? (
        <EmptyState
          title="لا توجد مستندات"
          description="ارفع مستند PDF جديد أو غيّر البحث والفلترة."
        />
      ) : (
        <div className="max-h-[780px] space-y-2 overflow-y-auto pr-1">
          {filteredDocuments.map((doc) => {
            const selected = selectedDocumentId === doc.id;

            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => onSelect(doc.id)}
                className={`w-full min-w-0 rounded-[22px] border p-3 text-right shadow-sm transition ${
                  selected
                    ? "border-emerald-300 bg-emerald-50/90 ring-4 ring-emerald-500/10"
                    : "border-black/5 bg-white/80 hover:bg-white"
                }`}
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black text-black">
                      {doc.title}
                    </h3>
                    <p className="mt-1 break-all text-[11px] font-bold text-zinc-500 line-clamp-1">
                      {doc.file_name}
                    </p>
                    <p className="mt-1 truncate text-xs font-bold text-zinc-600">
                      {doc.clients?.name || "بدون موكل"} · {doc.cases?.title || "بدون قضية"}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone="emerald">
                      {documentTypeLabels[doc.document_type] || doc.document_type}
                    </Badge>
                    <Badge tone="zinc">{formatFileSize(doc.file_size)}</Badge>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Mini label="تاريخ الرفع" value={formatDate(doc.created_at)} />
                  <Mini label="الارتباط" value={doc.case_id ? "قضية" : doc.client_id ? "موكل" : "غير مرتبط"} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DocumentForm({
  form,
  setForm,
  clientOptions,
  caseOptions,
  onCaseChange,
  saving,
  submitLabel,
  fileInput,
}: {
  form: DocumentFormState;
  setForm: Dispatch<SetStateAction<DocumentFormState>>;
  clientOptions: { value: string; label: string }[];
  caseOptions: { value: string; label: string }[];
  onCaseChange: (value: string) => void;
  saving: boolean;
  submitLabel: string;
  fileInput?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <FormSection title="بيانات المستند">
        <Field
          label="عنوان المستند"
          value={form.title}
          onChange={(value: string) => setForm((prev) => ({ ...prev, title: value }))}
          required
        />

        <SelectField
          label="نوع المستند"
          value={form.document_type}
          onChange={(value: string) =>
            setForm((prev) => ({ ...prev, document_type: value as DocumentType }))
          }
          options={Object.entries(documentTypeLabels).map(([value, label]) => ({
            value,
            label,
          }))}
        />

        <SelectField
          label="الموكل"
          value={form.client_id}
          onChange={(value: string) =>
            setForm((prev) => ({ ...prev, client_id: value, case_id: "" }))
          }
          options={clientOptions}
        />

        <SelectField
          label="القضية"
          value={form.case_id}
          onChange={onCaseChange}
          options={caseOptions}
        />
      </FormSection>

      {fileInput ? <div>{fileInput}</div> : null}

      <TextareaField
        label="ملاحظات"
        value={form.notes}
        onChange={(value: string) => setForm((prev) => ({ ...prev, notes: value }))}
      />

      <button
        disabled={saving}
        className="h-11 w-full rounded-[18px] bg-emerald-600 text-sm font-black text-white shadow-lg transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {submitLabel}
      </button>
    </div>
  );
}

function DocumentDetailsPanel({
  selectedDocument,
  editingDocumentId,
  editForm,
  setEditForm,
  clientOptions,
  caseOptions,
  onCaseChange,
  savingEdit,
  deleting,
  startEditDocument,
  cancelEdit,
  handleUpdateDocument,
  openDocument,
  deleteDocument,
}: {
  selectedDocument: DocumentRow | null;
  editingDocumentId: string;
  editForm: DocumentFormState;
  setEditForm: Dispatch<SetStateAction<DocumentFormState>>;
  clientOptions: { value: string; label: string }[];
  caseOptions: { value: string; label: string }[];
  onCaseChange: (value: string) => void;
  savingEdit: boolean;
  deleting: boolean;
  startEditDocument: (doc: DocumentRow) => void;
  cancelEdit: () => void;
  handleUpdateDocument: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  openDocument: (doc: DocumentRow) => Promise<void>;
  deleteDocument: (doc: DocumentRow) => Promise<void>;
}) {
  if (!selectedDocument) {
    return (
      <div className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
        <EmptyState
          title="اختر مستند"
          description="اختر مستند من القائمة لعرض التفاصيل الكاملة."
        />
      </div>
    );
  }

  const isEditing = editingDocumentId === selectedDocument.id;

  return (
    <section className="min-w-0 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)] backdrop-blur-3xl lg:p-5 xl:sticky xl:top-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="mb-2 inline-flex rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white">
            ملف المستند
          </p>
          <h2 className="break-words text-xl font-black text-black lg:text-2xl">
            {selectedDocument.title}
          </h2>
          <p className="mt-1 break-all text-xs font-bold text-zinc-500">
            {selectedDocument.file_name}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isEditing ? (
            <SmallButton tone="amber" onClick={() => startEditDocument(selectedDocument)}>
              تعديل
            </SmallButton>
          ) : (
            <SmallButton tone="zinc" onClick={cancelEdit}>
              إلغاء
            </SmallButton>
          )}

          <SmallButton tone="black" onClick={() => openDocument(selectedDocument)}>
            فتح PDF
          </SmallButton>

          <SmallButton tone="rose" onClick={() => deleteDocument(selectedDocument)}>
            {deleting ? "حذف..." : "حذف"}
          </SmallButton>
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleUpdateDocument}>
          <DocumentForm
            form={editForm}
            setForm={setEditForm}
            clientOptions={clientOptions}
            caseOptions={caseOptions}
            onCaseChange={onCaseChange}
            saving={savingEdit}
            submitLabel={savingEdit ? "جاري الحفظ..." : "حفظ التعديل"}
          />
        </form>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Info label="النوع">
              <Badge tone="emerald">
                {documentTypeLabels[selectedDocument.document_type] || selectedDocument.document_type}
              </Badge>
            </Info>

            <Info label="الحجم">
              <ResponsiveText>{formatFileSize(selectedDocument.file_size)}</ResponsiveText>
            </Info>

            <Info label="تاريخ الرفع">
              <ResponsiveText>{formatDate(selectedDocument.created_at)}</ResponsiveText>
            </Info>

            <Info label="نوع الملف">
              <ResponsiveText>{selectedDocument.mime_type || "PDF"}</ResponsiveText>
            </Info>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Info label="الموكل">
              {selectedDocument.client_id ? (
                <Link
                  href={`/clients/${selectedDocument.client_id}`}
                  className="font-black text-emerald-700 hover:underline"
                >
                  {selectedDocument.clients?.name || "فتح ملف الموكل"}
                </Link>
              ) : (
                <ResponsiveText>غير مرتبط بموكل</ResponsiveText>
              )}
            </Info>

            <Info label="القضية">
              {selectedDocument.case_id ? (
                <Link
                  href={`/cases`}
                  className="font-black text-violet-700 hover:underline"
                >
                  {selectedDocument.cases?.title || "مرتبط بقضية"}
                </Link>
              ) : (
                <ResponsiveText>غير مرتبط بقضية</ResponsiveText>
              )}
            </Info>
          </div>

          <Info label="اسم الملف الأصلي">
            <ResponsiveText className="break-all">{selectedDocument.file_name}</ResponsiveText>
          </Info>

          <Info label="مسار التخزين">
            <ResponsiveText className="break-all">{selectedDocument.file_path}</ResponsiveText>
          </Info>

          <Info label="ملاحظات">
            <ResponsiveText>{selectedDocument.notes}</ResponsiveText>
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
  tone: "emerald" | "violet" | "blue" | "amber";
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-800",
    violet: "bg-violet-50 text-violet-800",
    blue: "bg-blue-50 text-blue-800",
    amber: "bg-amber-50 text-amber-900",
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
  tone: "amber" | "rose" | "zinc" | "black";
  onClick: () => void;
}) {
  const tones = {
    amber: "bg-amber-100 text-amber-900 hover:bg-amber-200",
    rose: "bg-red-50 text-red-700 hover:bg-red-100",
    zinc: "bg-zinc-100 text-black hover:bg-zinc-200",
    black: "bg-black text-white hover:bg-zinc-800",
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
    green: "border-emerald-200 bg-emerald-50/80 text-emerald-800",
  };

  return (
    <div className={`rounded-[22px] border p-4 text-sm font-bold leading-7 backdrop-blur-xl ${tones[tone]}`}>
      <p className="font-black">{title}:</p>
      <p className="mt-1 break-words">{text}</p>
    </div>
  );
}

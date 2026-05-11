"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Field from "@/components/ui/Field";
import LoadingCard from "@/components/ui/LoadingCard";
import PageHeader from "@/components/ui/PageHeader";
import SelectField from "@/components/ui/SelectField";
import StatCard from "@/components/ui/StatCard";
import TextareaField from "@/components/ui/TextareaField";
import ResponsiveText from "@/components/ui/ResponsiveText";
import { supabase } from "@/lib/supabase";
import { clientTypeLabels, governorates } from "@/lib/labels";
import type { Client, ClientType } from "@/lib/types";

type CaseLite = {
  id: string;
  client_id: string | null;
};

type DocumentLite = {
  id: string;
  client_id: string | null;
  case_id: string | null;
};

const emptyForm = {
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

function nullIfEmpty(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export default function ClientsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [cases, setCases] = useState<CaseLite[]>([]);
  const [documents, setDocuments] = useState<DocumentLite[]>([]);
  const [form, setForm] = useState(emptyForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

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

  async function fetchAll() {
    setRefreshing(true);
    setError("");

    const clientsResult = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (clientsResult.error) {
      setError(clientsResult.error.message);
      setRefreshing(false);
      return;
    }

    const casesResult = await supabase.from("cases").select("id,client_id");
    const documentsResult = await supabase
      .from("documents")
      .select("id,client_id,case_id");

    setClients((clientsResult.data || []) as Client[]);
    setCases(casesResult.error ? [] : ((casesResult.data || []) as CaseLite[]));
    setDocuments(
      documentsResult.error ? [] : ((documentsResult.data || []) as DocumentLite[])
    );

    setRefreshing(false);
  }

  function getClientStats(clientId: string) {
    const clientCases = cases.filter((item) => item.client_id === clientId);
    const caseIds = new Set(clientCases.map((item) => item.id));

    const clientDocuments = documents.filter((doc) => {
      return doc.client_id === clientId || Boolean(doc.case_id && caseIds.has(doc.case_id));
    });

    return {
      casesCount: clientCases.length,
      documentsCount: clientDocuments.length,
    };
  }

  async function handleCreateClient(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!userId) return;

    if (!form.name.trim()) {
      setError("اسم الموكل مطلوب.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("clients").insert({
      user_id: userId,
      name: form.name.trim(),
      client_type: form.client_type,
      phone: nullIfEmpty(form.phone),
      whatsapp: nullIfEmpty(form.whatsapp),
      email: nullIfEmpty(form.email),
      national_id: nullIfEmpty(form.national_id),
      passport_number: nullIfEmpty(form.passport_number),
      commercial_register: nullIfEmpty(form.commercial_register),
      tax_card_number: nullIfEmpty(form.tax_card_number),
      address: nullIfEmpty(form.address),
      governorate: nullIfEmpty(form.governorate),
      legal_capacity: nullIfEmpty(form.legal_capacity),
      occupation: nullIfEmpty(form.occupation),
      company_representative: nullIfEmpty(form.company_representative),
      notes: nullIfEmpty(form.notes),
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setForm(emptyForm);
    await fetchAll();
  }

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();

    let result = clients.filter((client) => {
      const matchesType =
        typeFilter === "all" || client.client_type === typeFilter;

      const searchable = [
        client.name,
        client.phone,
        client.whatsapp,
        client.email,
        client.national_id,
        client.passport_number,
        client.commercial_register,
        client.tax_card_number,
        client.address,
        client.governorate,
        client.legal_capacity,
        client.occupation,
        client.company_representative,
        client.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesType && (!q || searchable.includes(q));
    });

    if (sortBy === "name") {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name, "ar"));
    }

    if (sortBy === "most_cases") {
      result = [...result].sort(
        (a, b) => getClientStats(b.id).casesCount - getClientStats(a.id).casesCount
      );
    }

    if (sortBy === "newest") {
      result = [...result].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return result;
  }, [clients, cases, documents, search, sortBy, typeFilter]);

  const individualsCount = clients.filter(
    (client) => client.client_type === "individual"
  ).length;

  const companiesCount = clients.filter(
    (client) => client.client_type === "company"
  ).length;

  if (loading) {
    return <LoadingCard text="جاري تحميل الموكلين..." />;
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Clients CRM"
          title="إدارة الموكلين"
          tone="blue"
          description="إضافة وتنظيم بيانات الموكلين للأفراد والشركات، وربط كل موكل بالقضايا والمستندات الخاصة به."
          action={
            <button
              onClick={fetchAll}
              disabled={refreshing}
              className="h-12 rounded-[20px] border border-black/10 bg-white/80 px-5 text-sm font-black text-black shadow-sm transition hover:bg-white disabled:opacity-60"
            >
              {refreshing ? "جاري التحديث..." : "تحديث البيانات"}
            </button>
          }
        />

        {error ? (
          <div className="rounded-[26px] border border-red-200 bg-red-50/80 p-4 text-sm font-bold leading-7 text-red-700 backdrop-blur-xl">
            <p className="font-black">حدث خطأ:</p>
            <p className="mt-2 break-words">{error}</p>
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="إجمالي الموكلين"
            value={clients.length}
            hint="كل الموكلين المسجلين"
            tone="blue"
          />
          <StatCard
            label="أفراد"
            value={individualsCount}
            hint="موكلين أفراد"
            tone="emerald"
          />
          <StatCard
            label="شركات"
            value={companiesCount}
            hint="كيانات وشركات"
            tone="violet"
          />
          <StatCard
            label="قضايا مرتبطة"
            value={cases.filter((item) => item.client_id).length}
            hint="قضايا لها موكل"
            tone="amber"
          />
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <form
            onSubmit={handleCreateClient}
            className="min-w-0 rounded-[34px] border border-white/70 bg-white/70 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.07)] backdrop-blur-3xl"
          >
            <div className="mb-5 min-w-0">
              <h2 className="break-words text-xl font-black text-black">
                إضافة موكل جديد
              </h2>
              <p className="mt-1 text-sm font-semibold text-zinc-600">
                كل الحقول هنا محفوظة فعليًا في Supabase.
              </p>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                label="اسم الموكل"
                value={form.name}
                onChange={(value: string) => setForm({ ...form, name: value })}
                required
              />

              <SelectField
                label="نوع الموكل"
                value={form.client_type}
                onChange={(value: string) =>
                  setForm({ ...form, client_type: value as ClientType })
                }
                options={[
                  { value: "individual", label: "فرد" },
                  { value: "company", label: "شركة" },
                ]}
              />

              <Field
                label="الموبايل"
                value={form.phone}
                onChange={(value: string) => setForm({ ...form, phone: value })}
                placeholder="010..."
              />

              <Field
                label="واتساب"
                value={form.whatsapp}
                onChange={(value: string) =>
                  setForm({ ...form, whatsapp: value })
                }
                placeholder="010..."
              />

              <Field
                label="البريد الإلكتروني"
                value={form.email}
                onChange={(value: string) => setForm({ ...form, email: value })}
                type="email"
                placeholder="example@email.com"
              />

              <SelectField
                label="المحافظة"
                value={form.governorate}
                onChange={(value: string) =>
                  setForm({ ...form, governorate: value })
                }
                options={[
                  { value: "", label: "اختر المحافظة" },
                  ...governorates.map((item) => ({
                    value: item,
                    label: item,
                  })),
                ]}
              />

              <Field
                label="الرقم القومي"
                value={form.national_id}
                onChange={(value: string) =>
                  setForm({ ...form, national_id: value })
                }
                placeholder="14 رقم"
              />

              <Field
                label="رقم جواز السفر"
                value={form.passport_number}
                onChange={(value: string) =>
                  setForm({ ...form, passport_number: value })
                }
              />

              <Field
                label="السجل التجاري"
                value={form.commercial_register}
                onChange={(value: string) =>
                  setForm({ ...form, commercial_register: value })
                }
              />

              <Field
                label="البطاقة الضريبية"
                value={form.tax_card_number}
                onChange={(value: string) =>
                  setForm({ ...form, tax_card_number: value })
                }
              />

              <Field
                label="الصفة القانونية"
                value={form.legal_capacity}
                onChange={(value: string) =>
                  setForm({ ...form, legal_capacity: value })
                }
                placeholder="مدعي / مدعى عليه / ممثل قانوني..."
              />

              <Field
                label="الوظيفة / النشاط"
                value={form.occupation}
                onChange={(value: string) =>
                  setForm({ ...form, occupation: value })
                }
              />

              <Field
                label="ممثل الشركة"
                value={form.company_representative}
                onChange={(value: string) =>
                  setForm({ ...form, company_representative: value })
                }
                placeholder="يستخدم مع الشركات"
              />

              <Field
                label="العنوان"
                value={form.address}
                onChange={(value: string) =>
                  setForm({ ...form, address: value })
                }
              />
            </div>

            <div className="mt-4">
              <TextareaField
                label="ملاحظات داخلية"
                value={form.notes}
                onChange={(value: string) => setForm({ ...form, notes: value })}
                placeholder="أي ملاحظات داخلية عن الموكل..."
              />
            </div>

            <button
              disabled={saving}
              className="mt-5 h-12 w-full rounded-[20px] bg-slate-900 text-sm font-black text-white shadow-lg transition hover:bg-slate-950 disabled:opacity-60"
            >
              {saving ? "جاري حفظ الموكل..." : "حفظ الموكل"}
            </button>
          </form>

          <section className="min-w-0 space-y-5">
            <div className="min-w-0 rounded-[34px] border border-white/70 bg-white/70 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.07)] backdrop-blur-3xl">
              <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-[1fr_150px_150px]">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث بالاسم، الهاتف، الرقم القومي، السجل التجاري..."
                  className="h-12 min-w-0 rounded-[20px] border border-black/10 bg-white/80 px-4 text-sm font-bold text-black outline-none placeholder:text-zinc-400 focus:ring-4 focus:ring-slate-400/10"
                />

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="h-12 rounded-[20px] border border-black/10 bg-white/80 px-4 text-sm font-black text-black outline-none"
                >
                  <option value="all">كل الأنواع</option>
                  <option value="individual">أفراد</option>
                  <option value="company">شركات</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-12 rounded-[20px] border border-black/10 bg-white/80 px-4 text-sm font-black text-black outline-none"
                >
                  <option value="newest">الأحدث</option>
                  <option value="name">الاسم</option>
                  <option value="most_cases">الأكثر قضايا</option>
                </select>
              </div>
            </div>

            <div className="min-w-0 rounded-[34px] border border-white/70 bg-white/70 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.07)] backdrop-blur-3xl">
              <div className="mb-5 flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-xl font-black text-black">
                    قائمة الموكلين
                  </h2>
                  <p className="mt-1 text-sm font-bold text-zinc-600">
                    عدد النتائج: {filteredClients.length}
                  </p>
                </div>
              </div>

              {filteredClients.length === 0 ? (
                <EmptyState
                  title="لا يوجد موكلين"
                  description="أضف أول موكل من النموذج الموجود بجانب القائمة."
                />
              ) : (
                <div className="grid min-w-0 grid-cols-1 gap-3">
                  {filteredClients.map((client) => {
                    const stats = getClientStats(client.id);

                    return (
                      <Link
                        key={client.id}
                        href={`/clients/${client.id}`}
                        className="group min-w-0 rounded-[28px] border border-black/5 bg-white/75 p-4 shadow-sm transition hover:bg-white hover:shadow-md"
                      >
                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h3 className="min-w-0 break-words text-lg font-black text-black">
                              {client.name}
                            </h3>

                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge
                                tone={
                                  client.client_type === "company"
                                    ? "violet"
                                    : "emerald"
                                }
                              >
                                {clientTypeLabels[client.client_type]}
                              </Badge>

                              {client.governorate ? (
                                <Badge tone="blue">{client.governorate}</Badge>
                              ) : null}

                              {client.legal_capacity ? (
                                <Badge tone="zinc">
                                  {client.legal_capacity}
                                </Badge>
                              ) : null}
                            </div>
                          </div>

                          <span className="shrink-0 rounded-2xl bg-black px-4 py-2 text-xs font-black text-white transition group-hover:bg-slate-900">
                            فتح الملف
                          </span>
                        </div>

                        <div className="mt-4 grid min-w-0 grid-cols-1 gap-2 text-xs font-bold text-zinc-600 sm:grid-cols-2">
                          <InfoLine label="الهاتف" value={client.phone} />
                          <InfoLine label="واتساب" value={client.whatsapp} />
                          <InfoLine
                            label="الإيميل"
                            value={client.email}
                            breakAll
                          />
                          <InfoLine
                            label="رقم قومي"
                            value={client.national_id}
                            breakAll
                          />
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                          <MiniStat label="قضايا" value={stats.casesCount} />
                          <MiniStat
                            label="مستندات"
                            value={stats.documentsCount}
                          />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </section>
      </div>
    </AppShell>
  );
}

function InfoLine({
  label,
  value,
  breakAll,
}: {
  label: string;
  value: string | null;
  breakAll?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-zinc-100/80 px-3 py-2">
      <p className="text-[11px] font-black text-zinc-500">{label}</p>
      <ResponsiveText
        className={`mt-1 text-xs font-black ${breakAll ? "break-all" : ""}`}
      >
        {value || "—"}
      </ResponsiveText>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-2xl bg-zinc-100/80 px-3 py-2">
      <p className="break-words text-base font-black text-black">{value}</p>
      <p className="text-[10px] font-bold text-zinc-500">{label}</p>
    </div>
  );
}
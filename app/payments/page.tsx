/* eslint-disable @typescript-eslint/no-explicit-any */
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
import RequireRole from "@/components/auth/RequireRole";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Field from "@/components/ui/Field";
import LoadingCard from "@/components/ui/LoadingCard";
import PageHeader from "@/components/ui/PageHeader";
import ResponsiveText from "@/components/ui/ResponsiveText";
import SelectField from "@/components/ui/SelectField";
import TextareaField from "@/components/ui/TextareaField";
import { supabase } from "@/lib/supabase";
import { formatDate, formatMoney } from "@/lib/labels";

type PaymentType = "fee" | "expense";
type PaymentStatus = "paid" | "unpaid" | "partial";
type QuickFilter = "all" | "collected" | "due" | "expenses" | "unlinked";
type ViewMode = "transactions" | "cases" | "clients";

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
  agreed_fee_amount: number | null;
  paid_fee_amount: number | null;
  clients?: ClientLite | null;
};

type PaymentRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  case_id: string | null;
  amount: number;
  payment_type: PaymentType;
  status: PaymentStatus;
  payment_date: string | null;
  notes: string | null;
  created_at: string;
  clients?: ClientLite | null;
  cases?: {
    id: string;
    title: string;
    case_number: string | null;
    case_year: string | null;
    agreed_fee_amount: number | null;
    paid_fee_amount: number | null;
  } | null;
};

type PaymentFormState = {
  client_id: string;
  case_id: string;
  amount: string;
  payment_type: PaymentType;
  status: PaymentStatus;
  payment_date: string;
  notes: string;
};

type CaseFinanceRow = CaseLite & {
  payments: PaymentRow[];
  collected: number;
  due: number;
  expenses: number;
  net: number;
  remaining: number;
  movement: number;
};

type ClientFinanceRow = ClientLite & {
  cases: CaseLite[];
  payments: PaymentRow[];
  agreed: number;
  paid: number;
  remaining: number;
  collected: number;
  due: number;
  expenses: number;
  net: number;
};

const emptyPaymentForm: PaymentFormState = {
  client_id: "",
  case_id: "",
  amount: "",
  payment_type: "fee",
  status: "paid",
  payment_date: "",
  notes: "",
};

function nullIfEmpty(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function dateOrNull(value: string): string | null {
  return value ? value : null;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartISO(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function numberOrZero(value: string): number {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function paymentTypeLabel(type: PaymentType): string {
  return type === "fee" ? "أتعاب" : "مصروفات";
}

function paymentStatusLabel(status: PaymentStatus): string {
  const labels: Record<PaymentStatus, string> = {
    paid: "مدفوع",
    unpaid: "غير مدفوع",
    partial: "جزئي",
  };

  return labels[status];
}

function paymentStatusTone(status: PaymentStatus): "teal" | "rose" | "amber" {
  const tones: Record<PaymentStatus, "teal" | "rose" | "amber"> = {
    paid: "teal",
    unpaid: "rose",
    partial: "amber",
  };

  return tones[status];
}

function isCollectedPayment(payment: Pick<PaymentRow, "payment_type" | "status">): boolean {
  return payment.payment_type === "fee" && (payment.status === "paid" || payment.status === "partial");
}

function paidEffect(payment: Pick<PaymentRow, "payment_type" | "status" | "amount" | "case_id">): number {
  if (!payment.case_id) return 0;
  return isCollectedPayment(payment) ? Number(payment.amount || 0) : 0;
}

function caseRemainingFee(item: Pick<CaseLite, "agreed_fee_amount" | "paid_fee_amount">): number {
  return Math.max(Number(item.agreed_fee_amount || 0) - Number(item.paid_fee_amount || 0), 0);
}

function prettyCaseLabel(item: CaseLite): string {
  const numberPart = item.case_number ? ` — رقم ${item.case_number}` : "";
  const yearPart = item.case_year ? `/${item.case_year}` : "";
  const clientPart = item.clients?.name ? ` — ${item.clients.name}` : "";
  return `${item.title}${numberPart}${yearPart}${clientPart}`;
}


type ExcelCellValue = string | number | null | undefined;
type ExcelObjectRow = Record<string, ExcelCellValue>;

type ExcelColumn = {
  key: string;
  header: string;
  width?: number;
  numFmt?: string;
  align?: "right" | "center" | "left";
};

type ExcelTheme = {
  argb: string;
  lightArgb: string;
  tableStyle: string;
};

const excelThemes = {
  teal: { argb: "FF0F766E", lightArgb: "FFCCFBF1", tableStyle: "TableStyleMedium4" },
  blue: { argb: "FF1D4ED8", lightArgb: "FFDBEAFE", tableStyle: "TableStyleMedium2" },
  violet: { argb: "FF6D28D9", lightArgb: "FFEDE9FE", tableStyle: "TableStyleMedium5" },
  amber: { argb: "FFD97706", lightArgb: "FFFEF3C7", tableStyle: "TableStyleMedium7" },
  rose: { argb: "FFE11D48", lightArgb: "FFFFE4E6", tableStyle: "TableStyleMedium9" },
} satisfies Record<string, ExcelTheme>;

function safeExcelTableName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_]/g, "_").replace(/^\d/, "T_$&");
  return (cleaned || "MizanTable").slice(0, 28);
}

function excelMoneyFormat(): string {
  return '#,##0.00 "EGP"';
}

function downloadExcelBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function applyExcelSheetHeader(
  worksheet: any,
  title: string,
  subtitle: string,
  columnCount: number,
  theme: ExcelTheme
) {
  const lastColumn = Math.max(columnCount, 6);

  worksheet.mergeCells(1, 1, 1, lastColumn);
  worksheet.mergeCells(2, 1, 2, lastColumn);

  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { horizontal: "right", vertical: "middle" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: theme.argb } };

  const subtitleCell = worksheet.getCell(2, 1);
  subtitleCell.value = subtitle;
  subtitleCell.font = { bold: true, size: 11, color: { argb: "FF334155" } };
  subtitleCell.alignment = { horizontal: "right", vertical: "middle", wrapText: true };
  subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: theme.lightArgb } };

  worksheet.getRow(1).height = 30;
  worksheet.getRow(2).height = 26;
  worksheet.getRow(3).height = 8;
}

function styleExcelTable(
  worksheet: any,
  columns: ExcelColumn[],
  rowCount: number,
  headerRowIndex: number,
  theme: ExcelTheme
) {
  columns.forEach((column, index) => {
    const excelColumn = worksheet.getColumn(index + 1);
    excelColumn.width = column.width || 18;
  });

  const headerRow = worksheet.getRow(headerRowIndex);
  headerRow.height = 24;
  headerRow.eachCell((cell: any) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: theme.argb } };
    cell.border = {
      top: { style: "thin", color: { argb: "FFFFFFFF" } },
      left: { style: "thin", color: { argb: "FFFFFFFF" } },
      bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
      right: { style: "thin", color: { argb: "FFFFFFFF" } },
    };
  });

  for (let r = headerRowIndex + 1; r <= headerRowIndex + rowCount; r += 1) {
    const row = worksheet.getRow(r);
    row.height = 22;

    columns.forEach((column, index) => {
      const cell = row.getCell(index + 1);
      cell.alignment = {
        horizontal: column.align || "right",
        vertical: "middle",
        wrapText: true,
      };
      cell.font = { size: 10, color: { argb: "FF111827" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };

      if (column.numFmt) cell.numFmt = column.numFmt;

      const textValue = String(cell.value ?? "");
      if (["مدفوع", "محصل"].includes(textValue)) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
        cell.font = { bold: true, color: { argb: "FF065F46" }, size: 10 };
      }
      if (["غير مدفوع", "مستحق"].includes(textValue)) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE4E6" } };
        cell.font = { bold: true, color: { argb: "FF9F1239" }, size: 10 };
      }
      if (["جزئي", "مصروفات"].includes(textValue)) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
        cell.font = { bold: true, color: { argb: "FF92400E" }, size: 10 };
      }
    });
  }
}

function addStyledExcelTableSheet(
  workbook: any,
  sheetName: string,
  title: string,
  subtitle: string,
  columns: ExcelColumn[],
  rows: ExcelObjectRow[],
  theme: ExcelTheme
) {
  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 4, rightToLeft: true }],
    properties: { tabColor: { argb: theme.argb } },
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  applyExcelSheetHeader(worksheet, title, subtitle, columns.length, theme);

  const tableRows = rows.map((row) => columns.map((column) => row[column.key] ?? ""));

  worksheet.addTable({
    name: safeExcelTableName(sheetName),
    ref: "A4",
    headerRow: true,
    totalsRow: false,
    style: {
      theme: theme.tableStyle,
      showRowStripes: true,
      showColumnStripes: false,
    },
    columns: columns.map((column) => ({ name: column.header, filterButton: true })),
    rows: tableRows,
  });

  styleExcelTable(worksheet, columns, rows.length, 4, theme);

  return worksheet;
}

function buildMonthlyExcelData(payments: PaymentRow[]): ExcelObjectRow[] {
  const monthly = new Map<
    string,
    { collected: number; due: number; expenses: number; net: number; count: number }
  >();

  payments.forEach((payment) => {
    const date = payment.payment_date || payment.created_at || "بدون تاريخ";
    const month = date === "بدون تاريخ" ? "بدون تاريخ" : date.slice(0, 7);
    const current = monthly.get(month) || {
      collected: 0,
      due: 0,
      expenses: 0,
      net: 0,
      count: 0,
    };

    const amount = Number(payment.amount || 0);

    if (isCollectedPayment(payment)) current.collected += amount;
    if (payment.payment_type === "fee" && payment.status === "unpaid") current.due += amount;
    if (payment.payment_type === "expense") current.expenses += amount;

    current.net = current.collected - current.expenses;
    current.count += 1;
    monthly.set(month, current);
  });

  return Array.from(monthly.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, value]) => ({
      month,
      collected: value.collected,
      due: value.due,
      expenses: value.expenses,
      net: value.net,
      count: value.count,
    }));
}

function addSummarySheet(
  workbook: any,
  exportedAt: string,
  viewMode: ViewMode,
  financialSummary: {
    caseAgreed: number;
    casePaid: number;
    caseRemaining: number;
    collected: number;
    due: number;
    expenses: number;
    net: number;
    monthCollected: number;
    unlinkedAmount: number;
    collectionRate: number;
  },
  counts: { transactions: number; cases: number; clients: number }
) {
  const theme = excelThemes.teal;
  const worksheet = workbook.addWorksheet("Executive Summary", {
    views: [{ state: "frozen", ySplit: 8, rightToLeft: true }],
    properties: { tabColor: { argb: theme.argb } },
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  applyExcelSheetHeader(
    worksheet,
    "Mizan Finance Report",
    `تقرير مالي منظم — تاريخ التصدير: ${exportedAt}`,
    12,
    theme
  );

  const cardData = [
    ["إجمالي المتفق عليه", financialSummary.caseAgreed, excelThemes.blue.argb],
    ["إجمالي المدفوع", financialSummary.casePaid, excelThemes.teal.argb],
    ["إجمالي المتبقي", financialSummary.caseRemaining, excelThemes.rose.argb],
    ["صافي الحركة", financialSummary.net, excelThemes.amber.argb],
  ];

  cardData.forEach(([label, value, color], index) => {
    const startCol = 1 + index * 3;
    worksheet.mergeCells(4, startCol, 4, startCol + 1);
    worksheet.mergeCells(5, startCol, 5, startCol + 1);

    const labelCell = worksheet.getCell(4, startCol);
    labelCell.value = label;
    labelCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    labelCell.alignment = { horizontal: "center", vertical: "middle" };
    labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: String(color) } };

    const valueCell = worksheet.getCell(5, startCol);
    valueCell.value = Number(value || 0);
    valueCell.numFmt = excelMoneyFormat();
    valueCell.font = { bold: true, color: { argb: "FF111827" }, size: 14 };
    valueCell.alignment = { horizontal: "center", vertical: "middle" };
    valueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
  });

  worksheet.getRow(4).height = 24;
  worksheet.getRow(5).height = 30;

  const metricsColumns: ExcelColumn[] = [
    { key: "metric", header: "المؤشر", width: 32 },
    { key: "value", header: "القيمة", width: 22, numFmt: excelMoneyFormat() },
    { key: "note", header: "ملاحظة", width: 34 },
  ];

  const metricsRows: ExcelObjectRow[] = [
    { metric: "طريقة العرض الحالية", value: "", note: viewMode === "transactions" ? "العمليات" : viewMode === "cases" ? "حسب القضية" : "حسب الموكل" },
    { metric: "نسبة التحصيل", value: financialSummary.collectionRate / 100, note: `${financialSummary.collectionRate}%` },
    { metric: "تحصيل هذا الشهر", value: financialSummary.monthCollected, note: "حركات مدفوعة أو جزئية خلال الشهر" },
    { metric: "إجمالي المستحق المسجل", value: financialSummary.due, note: "عمليات أتعاب غير مدفوعة" },
    { metric: "إجمالي المصروفات", value: financialSummary.expenses, note: "كل عمليات المصروفات" },
    { metric: "مبالغ غير مرتبطة", value: financialSummary.unlinkedAmount, note: "عمليات بدون موكل أو قضية" },
    { metric: "عدد العمليات المصدرة", value: counts.transactions, note: "بعد الفلاتر الحالية" },
    { metric: "عدد القضايا المصدرة", value: counts.cases, note: "بعد الفلاتر الحالية" },
    { metric: "عدد الموكلين المصدرين", value: counts.clients, note: "بعد الفلاتر الحالية" },
  ];

  worksheet.addTable({
    name: "ExecutiveMetrics",
    ref: "A8",
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium4", showRowStripes: true },
    columns: metricsColumns.map((column) => ({ name: column.header, filterButton: true })),
    rows: metricsRows.map((row) => metricsColumns.map((column) => row[column.key] ?? "")),
  });

  metricsColumns.forEach((column, index) => {
    worksheet.getColumn(index + 1).width = column.width || 18;
  });

  styleExcelTable(worksheet, metricsColumns, metricsRows.length, 8, theme);
  worksheet.getColumn(2).numFmt = excelMoneyFormat();
  worksheet.getCell("B9").numFmt = "0%";

  return worksheet;
}

function FeesPageContent() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [cases, setCases] = useState<CaseLite[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const [form, setForm] = useState<PaymentFormState>(emptyPaymentForm);
  const [editForm, setEditForm] = useState<PaymentFormState>(emptyPaymentForm);

  const [viewMode, setViewMode] = useState<ViewMode>("transactions");
  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [editingPaymentId, setEditingPaymentId] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | PaymentType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PaymentStatus>("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [caseFilter, setCaseFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "month" | "undated">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "amount" | "case">("newest");

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
      .select("id,client_id,title,case_number,case_year,agreed_fee_amount,paid_fee_amount,clients(id,name,phone)")
      .order("created_at", { ascending: false });

    const paymentsResult = await supabase
      .from("payments")
      .select("*,clients(id,name,phone),cases(id,title,case_number,case_year,agreed_fee_amount,paid_fee_amount)")
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

    if (paymentsResult.error) {
      setError(paymentsResult.error.message);
      setRefreshing(false);
      return;
    }

    const fetchedClients = ((clientsResult.data || []) as unknown) as ClientLite[];
    const fetchedCases = ((casesResult.data || []) as unknown) as CaseLite[];
    const fetchedPayments = ((paymentsResult.data || []) as unknown) as PaymentRow[];

    setClients(fetchedClients);
    setCases(fetchedCases);
    setPayments(fetchedPayments);
    setSelectedPaymentId((current) => current || fetchedPayments[0]?.id || "");
    setSelectedCaseId((current) => current || fetchedCases[0]?.id || "");
    setSelectedClientId((current) => current || fetchedClients[0]?.id || "");
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

  const activeFormClientId = editingPaymentId ? editForm.client_id : form.client_id;

  const caseOptions = useMemo(() => {
    const filtered = activeFormClientId
      ? cases.filter((item) => item.client_id === activeFormClientId)
      : cases;

    return [
      { value: "", label: "بدون قضية / اختر قضية" },
      ...filtered.map((item) => ({
        value: item.id,
        label: prettyCaseLabel(item),
      })),
    ];
  }, [cases, activeFormClientId]);

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

  const caseFinanceRows = useMemo<CaseFinanceRow[]>(() => {
    return cases.map((item) => {
      const casePayments = payments.filter((payment) => payment.case_id === item.id);
      const collected = casePayments
        .filter(isCollectedPayment)
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const due = casePayments
        .filter((payment) => payment.payment_type === "fee" && payment.status === "unpaid")
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const expenses = casePayments
        .filter((payment) => payment.payment_type === "expense")
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

      return {
        ...item,
        payments: casePayments,
        collected,
        due,
        expenses,
        net: collected - expenses,
        remaining: caseRemainingFee(item),
        movement: casePayments.length,
      };
    });
  }, [cases, payments]);

  const clientFinanceRows = useMemo<ClientFinanceRow[]>(() => {
    return clients.map((client) => {
      const clientCases = cases.filter((item) => item.client_id === client.id);
      const clientPayments = payments.filter((payment) => payment.client_id === client.id);
      const agreed = clientCases.reduce((sum, item) => sum + Number(item.agreed_fee_amount || 0), 0);
      const paid = clientCases.reduce((sum, item) => sum + Number(item.paid_fee_amount || 0), 0);
      const collected = clientPayments
        .filter(isCollectedPayment)
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const due = clientPayments
        .filter((payment) => payment.payment_type === "fee" && payment.status === "unpaid")
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const expenses = clientPayments
        .filter((payment) => payment.payment_type === "expense")
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

      return {
        ...client,
        cases: clientCases,
        payments: clientPayments,
        agreed,
        paid,
        remaining: Math.max(agreed - paid, 0),
        collected,
        due,
        expenses,
        net: collected - expenses,
      };
    });
  }, [clients, cases, payments]);

  const financialSummary = useMemo(() => {
    const caseAgreed = cases.reduce((sum, item) => sum + Number(item.agreed_fee_amount || 0), 0);
    const casePaid = cases.reduce((sum, item) => sum + Number(item.paid_fee_amount || 0), 0);
    const caseRemaining = Math.max(caseAgreed - casePaid, 0);

    const collected = payments
      .filter(isCollectedPayment)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    const due = payments
      .filter((payment) => payment.payment_type === "fee" && payment.status === "unpaid")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    const expenses = payments
      .filter((payment) => payment.payment_type === "expense")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    const monthCollected = payments
      .filter(isCollectedPayment)
      .filter((payment) => (payment.payment_date || payment.created_at || "") >= monthStartISO())
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    const unlinkedAmount = payments
      .filter((payment) => !payment.client_id && !payment.case_id)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    return {
      caseAgreed,
      casePaid,
      caseRemaining,
      collected,
      due,
      expenses,
      monthCollected,
      unlinkedAmount,
      net: collected - expenses,
      collectionRate: caseAgreed > 0 ? Math.round((casePaid / caseAgreed) * 100) : 0,
    };
  }, [cases, payments]);

  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();

    let result = payments.filter((item) => {
      const paymentDate = item.payment_date || "";
      const matchesQuick =
        quickFilter === "all" ||
        (quickFilter === "collected" && isCollectedPayment(item)) ||
        (quickFilter === "due" && item.payment_type === "fee" && item.status === "unpaid") ||
        (quickFilter === "expenses" && item.payment_type === "expense") ||
        (quickFilter === "unlinked" && !item.client_id && !item.case_id);

      const matchesType = typeFilter === "all" || item.payment_type === typeFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;

      const matchesClient =
        clientFilter === "all" ||
        (clientFilter === "none" && !item.client_id) ||
        item.client_id === clientFilter;

      const matchesCase =
        caseFilter === "all" ||
        (caseFilter === "none" && !item.case_id) ||
        item.case_id === caseFilter;

      const matchesQuickDate =
        dateFilter === "all" ||
        (dateFilter === "today" && paymentDate === todayISO()) ||
        (dateFilter === "month" && Boolean(paymentDate && paymentDate >= monthStartISO())) ||
        (dateFilter === "undated" && !paymentDate);

      const matchesRange =
        (!dateFrom || Boolean(paymentDate && paymentDate >= dateFrom)) &&
        (!dateTo || Boolean(paymentDate && paymentDate <= dateTo));

      const searchable = [
        item.amount,
        item.payment_type,
        item.status,
        item.payment_date,
        item.notes,
        item.clients?.name,
        item.clients?.phone,
        item.cases?.title,
        item.cases?.case_number,
        item.cases?.case_year,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchesQuick &&
        matchesType &&
        matchesStatus &&
        matchesClient &&
        matchesCase &&
        matchesQuickDate &&
        matchesRange &&
        (!q || searchable.includes(q))
      );
    });

    if (sortBy === "amount") {
      result = [...result].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
    }

    if (sortBy === "case") {
      result = [...result].sort((a, b) =>
        (a.cases?.title || "").localeCompare(b.cases?.title || "", "ar")
      );
    }

    if (sortBy === "oldest") {
      result = [...result].sort(
        (a, b) =>
          new Date(a.payment_date || a.created_at).getTime() -
          new Date(b.payment_date || b.created_at).getTime()
      );
    }

    if (sortBy === "newest") {
      result = [...result].sort(
        (a, b) =>
          new Date(b.payment_date || b.created_at).getTime() -
          new Date(a.payment_date || a.created_at).getTime()
      );
    }

    return result;
  }, [
    payments,
    search,
    quickFilter,
    typeFilter,
    statusFilter,
    clientFilter,
    caseFilter,
    dateFilter,
    dateFrom,
    dateTo,
    sortBy,
  ]);

  const filteredCaseFinanceRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return caseFinanceRows
      .filter((item) => {
        const matchesClient =
          clientFilter === "all" ||
          (clientFilter === "none" && !item.client_id) ||
          item.client_id === clientFilter;

        const searchable = [
          item.title,
          item.case_number,
          item.case_year,
          item.clients?.name,
          item.clients?.phone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return matchesClient && (!q || searchable.includes(q));
      })
      .sort((a, b) => b.remaining - a.remaining);
  }, [caseFinanceRows, search, clientFilter]);

  const filteredClientFinanceRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return clientFinanceRows
      .filter((item) => {
        const searchable = [item.name, item.phone].filter(Boolean).join(" ").toLowerCase();
        return !q || searchable.includes(q);
      })
      .sort((a, b) => b.remaining - a.remaining);
  }, [clientFinanceRows, search]);

  const selectedPayment =
    payments.find((item) => item.id === selectedPaymentId) || filteredPayments[0] || null;

  const selectedCaseFinance =
    caseFinanceRows.find((item) => item.id === selectedCaseId) || filteredCaseFinanceRows[0] || null;

  const selectedClientFinance =
    clientFinanceRows.find((item) => item.id === selectedClientId) || filteredClientFinanceRows[0] || null;

  function resetFilters() {
    setQuickFilter("all");
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setClientFilter("all");
    setCaseFilter("all");
    setDateFilter("all");
    setDateFrom("");
    setDateTo("");
    setSortBy("newest");
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

  async function adjustCasePaidAmount(caseId: string | null, delta: number) {
    if (!caseId || delta === 0) return;

    const { data, error } = await supabase
      .from("cases")
      .select("paid_fee_amount")
      .eq("id", caseId)
      .single();

    if (error || !data) {
      setError(error?.message || "فشل تحديث مدفوعات القضية.");
      return;
    }

    const current = Number((data as { paid_fee_amount: number | null }).paid_fee_amount || 0);
    const next = Math.max(current + delta, 0);

    const updateResult = await supabase
      .from("cases")
      .update({
        paid_fee_amount: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", caseId);

    if (updateResult.error) {
      setError(updateResult.error.message);
    }
  }

  async function handleAddPayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!userId) return;

    const amount = numberOrZero(form.amount);

    if (amount <= 0) {
      setError("اكتب مبلغ صحيح أكبر من صفر.");
      return;
    }

    setSaving(true);

    const selectedCase = cases.find((item) => item.id === form.case_id);

    const payload = {
      user_id: userId,
      client_id: form.client_id || selectedCase?.client_id || null,
      case_id: form.case_id || null,
      amount,
      payment_type: form.payment_type,
      status: form.status,
      payment_date: dateOrNull(form.payment_date),
      notes: nullIfEmpty(form.notes),
    };

    const { data, error } = await supabase
      .from("payments")
      .insert(payload)
      .select()
      .single();

    if (error || !data) {
      setSaving(false);
      setError(error?.message || "فشل حفظ العملية المالية.");
      return;
    }

    const createdPayment = data as PaymentRow;
    await adjustCasePaidAmount(createdPayment.case_id, paidEffect(createdPayment));

    setSaving(false);
    setForm(emptyPaymentForm);
    setSelectedPaymentId(createdPayment.id);
    setViewMode("transactions");
    setShowCreate(false);
    showSuccessMessage("تمت إضافة العملية المالية.");
    await fetchAll();
  }

  function startEditPayment(item: PaymentRow) {
    setEditingPaymentId(item.id);
    setEditForm({
      client_id: item.client_id || "",
      case_id: item.case_id || "",
      amount: String(item.amount || ""),
      payment_type: item.payment_type,
      status: item.status,
      payment_date: item.payment_date || "",
      notes: item.notes || "",
    });
  }

  async function handleUpdatePayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!editingPaymentId) return;

    const original = payments.find((item) => item.id === editingPaymentId);

    if (!original) {
      setError("لم يتم العثور على العملية المالية الأصلية.");
      return;
    }

    const amount = numberOrZero(editForm.amount);

    if (amount <= 0) {
      setError("اكتب مبلغ صحيح أكبر من صفر.");
      return;
    }

    setSavingEdit(true);

    const selectedCase = cases.find((item) => item.id === editForm.case_id);

    const nextPaymentForEffect: PaymentRow = {
      ...original,
      client_id: editForm.client_id || selectedCase?.client_id || null,
      case_id: editForm.case_id || null,
      amount,
      payment_type: editForm.payment_type,
      status: editForm.status,
      payment_date: dateOrNull(editForm.payment_date),
      notes: nullIfEmpty(editForm.notes),
    };

    const { error } = await supabase
      .from("payments")
      .update({
        client_id: nextPaymentForEffect.client_id,
        case_id: nextPaymentForEffect.case_id,
        amount: nextPaymentForEffect.amount,
        payment_type: nextPaymentForEffect.payment_type,
        status: nextPaymentForEffect.status,
        payment_date: nextPaymentForEffect.payment_date,
        notes: nextPaymentForEffect.notes,
      })
      .eq("id", editingPaymentId);

    if (error) {
      setSavingEdit(false);
      setError(error.message);
      return;
    }

    const originalEffect = paidEffect(original);
    const nextEffect = paidEffect(nextPaymentForEffect);

    if (original.case_id && original.case_id === nextPaymentForEffect.case_id) {
      await adjustCasePaidAmount(original.case_id, nextEffect - originalEffect);
    } else {
      await adjustCasePaidAmount(original.case_id, -originalEffect);
      await adjustCasePaidAmount(nextPaymentForEffect.case_id, nextEffect);
    }

    setSavingEdit(false);
    setEditingPaymentId("");
    showSuccessMessage("تم تعديل العملية المالية وتحديث القضية.");
    await fetchAll();
  }

  async function markPaymentAsPaid(item: PaymentRow) {
    if (item.status === "paid") return;

    const ok = confirm("هل تريد تحويل هذه العملية إلى مدفوعة؟");
    if (!ok) return;

    setMarkingPaidId(item.id);

    const nextPayment: PaymentRow = {
      ...item,
      status: "paid",
      payment_date: item.payment_date || todayISO(),
    };

    const { error } = await supabase
      .from("payments")
      .update({
        status: "paid",
        payment_date: nextPayment.payment_date,
      })
      .eq("id", item.id);

    if (error) {
      setMarkingPaidId("");
      setError(error.message);
      return;
    }

    await adjustCasePaidAmount(item.case_id, paidEffect(nextPayment) - paidEffect(item));

    setMarkingPaidId("");
    showSuccessMessage("تم تعليم العملية كمدفوعة وتحديث القضية.");
    await fetchAll();
  }

  async function deletePayment(item: PaymentRow) {
    const ok = confirm("هل تريد حذف هذه العملية المالية؟ سيتم تحديث مدفوعات القضية لو العملية مرتبطة بقضية.");
    if (!ok) return;

    setDeleting(true);

    const { error } = await supabase.from("payments").delete().eq("id", item.id);

    if (error) {
      setDeleting(false);
      setError(error.message);
      return;
    }

    await adjustCasePaidAmount(item.case_id, -paidEffect(item));

    setDeleting(false);

    if (selectedPaymentId === item.id) {
      setSelectedPaymentId("");
    }

    showSuccessMessage("تم حذف العملية المالية.");
    await fetchAll();
  }

  async function copyReceipt(item: PaymentRow) {
    const text = [
      "إيصال عملية مالية",
      `المبلغ: ${formatMoney(Number(item.amount || 0))}`,
      `النوع: ${paymentTypeLabel(item.payment_type)}`,
      `الحالة: ${paymentStatusLabel(item.status)}`,
      `التاريخ: ${formatDate(item.payment_date || item.created_at)}`,
      `الموكل: ${item.clients?.name || "غير مرتبط"}`,
      `القضية: ${item.cases?.title || "غير مرتبط"}`,
      `ملاحظات: ${item.notes || "لا توجد"}`,
    ].join("\n");

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      showSuccessMessage("تم نسخ الإيصال.");
      return;
    }

    setError("المتصفح لا يدعم النسخ التلقائي.");
  }

  async function exportExcelWorkbook() {
    try {
      const ExcelJSImport = await import("exceljs");
      const ExcelJS = (ExcelJSImport as any).default || ExcelJSImport;
      const workbook = new ExcelJS.Workbook();
      const exportedAt = new Date().toLocaleString("ar-EG");

      workbook.creator = "Mizan";
      workbook.lastModifiedBy = "Mizan";
      workbook.created = new Date();
      workbook.modified = new Date();
      workbook.subject = "Fees, payments, cases and clients financial report";
      workbook.title = "Mizan Finance Report";
      workbook.company = "Mizan";
      workbook.views = [
        {
          x: 0,
          y: 0,
          width: 12000,
          height: 8000,
          firstSheet: 0,
          activeTab: 0,
          visibility: "visible",
        },
      ];

      const money = excelMoneyFormat();

      const transactionsColumns: ExcelColumn[] = [
        { key: "amount", header: "المبلغ", width: 16, numFmt: money },
        { key: "type", header: "النوع", width: 14, align: "center" },
        { key: "status", header: "الحالة", width: 14, align: "center" },
        { key: "date", header: "تاريخ العملية", width: 16, align: "center" },
        { key: "client", header: "الموكل", width: 24 },
        { key: "phone", header: "هاتف الموكل", width: 18 },
        { key: "caseTitle", header: "القضية", width: 28 },
        { key: "caseNumber", header: "رقم القضية", width: 14 },
        { key: "caseYear", header: "سنة القضية", width: 14 },
        { key: "notes", header: "ملاحظات", width: 36 },
      ];

      const transactionsRows: ExcelObjectRow[] = filteredPayments.map((item) => ({
        amount: Number(item.amount || 0),
        type: paymentTypeLabel(item.payment_type),
        status: paymentStatusLabel(item.status),
        date: item.payment_date || item.created_at || "",
        client: item.clients?.name || "",
        phone: item.clients?.phone || "",
        caseTitle: item.cases?.title || "",
        caseNumber: item.cases?.case_number || "",
        caseYear: item.cases?.case_year || "",
        notes: item.notes || "",
      }));

      const casesColumns: ExcelColumn[] = [
        { key: "caseTitle", header: "القضية", width: 30 },
        { key: "client", header: "الموكل", width: 24 },
        { key: "caseNumber", header: "رقم القضية", width: 14 },
        { key: "caseYear", header: "سنة القضية", width: 14 },
        { key: "agreed", header: "الأتعاب المتفق عليها", width: 20, numFmt: money },
        { key: "paid", header: "المدفوع داخل القضية", width: 20, numFmt: money },
        { key: "remaining", header: "المتبقي", width: 18, numFmt: money },
        { key: "rate", header: "نسبة التحصيل", width: 16, numFmt: "0%", align: "center" },
        { key: "collected", header: "حركات محصلة", width: 18, numFmt: money },
        { key: "due", header: "مستحق مسجل", width: 18, numFmt: money },
        { key: "expenses", header: "مصروفات", width: 18, numFmt: money },
        { key: "net", header: "الصافي", width: 18, numFmt: money },
        { key: "movement", header: "عدد الحركات", width: 14, align: "center" },
      ];

      const casesRows: ExcelObjectRow[] = filteredCaseFinanceRows.map((item) => {
        const agreed = Number(item.agreed_fee_amount || 0);
        const paid = Number(item.paid_fee_amount || 0);
        return {
          caseTitle: item.title,
          client: item.clients?.name || "",
          caseNumber: item.case_number || "",
          caseYear: item.case_year || "",
          agreed,
          paid,
          remaining: item.remaining,
          rate: agreed > 0 ? paid / agreed : 0,
          collected: item.collected,
          due: item.due,
          expenses: item.expenses,
          net: item.net,
          movement: item.movement,
        };
      });

      const clientsColumns: ExcelColumn[] = [
        { key: "client", header: "الموكل", width: 26 },
        { key: "phone", header: "الهاتف", width: 18 },
        { key: "cases", header: "عدد القضايا", width: 14, align: "center" },
        { key: "agreed", header: "الأتعاب المتفق عليها", width: 20, numFmt: money },
        { key: "paid", header: "المدفوع داخل القضايا", width: 20, numFmt: money },
        { key: "remaining", header: "المتبقي", width: 18, numFmt: money },
        { key: "rate", header: "نسبة التحصيل", width: 16, numFmt: "0%", align: "center" },
        { key: "collected", header: "حركات محصلة", width: 18, numFmt: money },
        { key: "due", header: "مستحق مسجل", width: 18, numFmt: money },
        { key: "expenses", header: "مصروفات", width: 18, numFmt: money },
        { key: "net", header: "الصافي", width: 18, numFmt: money },
        { key: "movement", header: "عدد الحركات", width: 14, align: "center" },
      ];

      const clientsRows: ExcelObjectRow[] = filteredClientFinanceRows.map((item) => ({
        client: item.name,
        phone: item.phone || "",
        cases: item.cases.length,
        agreed: item.agreed,
        paid: item.paid,
        remaining: item.remaining,
        rate: item.agreed > 0 ? item.paid / item.agreed : 0,
        collected: item.collected,
        due: item.due,
        expenses: item.expenses,
        net: item.net,
        movement: item.payments.length,
      }));

      const monthlyColumns: ExcelColumn[] = [
        { key: "month", header: "الشهر", width: 16, align: "center" },
        { key: "collected", header: "المحصل", width: 18, numFmt: money },
        { key: "due", header: "المستحق", width: 18, numFmt: money },
        { key: "expenses", header: "المصروفات", width: 18, numFmt: money },
        { key: "net", header: "الصافي", width: 18, numFmt: money },
        { key: "count", header: "عدد العمليات", width: 14, align: "center" },
      ];

      const outstandingColumns: ExcelColumn[] = [
        { key: "caseTitle", header: "القضية", width: 32 },
        { key: "client", header: "الموكل", width: 24 },
        { key: "agreed", header: "المتفق عليه", width: 18, numFmt: money },
        { key: "paid", header: "المدفوع", width: 18, numFmt: money },
        { key: "remaining", header: "المتبقي", width: 18, numFmt: money },
        { key: "rate", header: "نسبة التحصيل", width: 16, numFmt: "0%", align: "center" },
      ];

      const outstandingRows: ExcelObjectRow[] = filteredCaseFinanceRows
        .filter((item) => item.remaining > 0)
        .map((item) => {
          const agreed = Number(item.agreed_fee_amount || 0);
          const paid = Number(item.paid_fee_amount || 0);
          return {
            caseTitle: item.title,
            client: item.clients?.name || "",
            agreed,
            paid,
            remaining: item.remaining,
            rate: agreed > 0 ? paid / agreed : 0,
          };
        });

      const unlinkedColumns: ExcelColumn[] = [
        { key: "amount", header: "المبلغ", width: 16, numFmt: money },
        { key: "type", header: "النوع", width: 14, align: "center" },
        { key: "status", header: "الحالة", width: 14, align: "center" },
        { key: "date", header: "التاريخ", width: 16, align: "center" },
        { key: "notes", header: "ملاحظات", width: 42 },
      ];

      const unlinkedRows: ExcelObjectRow[] = filteredPayments
        .filter((item) => !item.client_id && !item.case_id)
        .map((item) => ({
          amount: Number(item.amount || 0),
          type: paymentTypeLabel(item.payment_type),
          status: paymentStatusLabel(item.status),
          date: item.payment_date || item.created_at || "",
          notes: item.notes || "",
        }));

      addSummarySheet(
        workbook,
        exportedAt,
        viewMode,
        financialSummary,
        {
          transactions: filteredPayments.length,
          cases: filteredCaseFinanceRows.length,
          clients: filteredClientFinanceRows.length,
        }
      );

      addStyledExcelTableSheet(
        workbook,
        "Transactions",
        "جدول العمليات المالية",
        "كل العمليات المالية بعد تطبيق الفلاتر الحالية — منظم كجدول Excel قابل للفرز والفلترة.",
        transactionsColumns,
        transactionsRows,
        excelThemes.teal
      );

      addStyledExcelTableSheet(
        workbook,
        "Cases Summary",
        "ملخص القضايا المالي",
        "تحليل الأتعاب والمدفوع والمتبقي والحركات المالية لكل قضية.",
        casesColumns,
        casesRows,
        excelThemes.violet
      );

      addStyledExcelTableSheet(
        workbook,
        "Clients Summary",
        "ملخص الموكلين المالي",
        "تحليل مالي مجمع لكل موكل: قضايا، متفق، مدفوع، متبقي، مصروفات وصافي.",
        clientsColumns,
        clientsRows,
        excelThemes.blue
      );

      addStyledExcelTableSheet(
        workbook,
        "Monthly Summary",
        "ملخص شهري للحركة المالية",
        "تجميع شهري للمحصل والمستحق والمصروفات وصافي الحركة.",
        monthlyColumns,
        buildMonthlyExcelData(filteredPayments),
        excelThemes.amber
      );

      addStyledExcelTableSheet(
        workbook,
        "Outstanding Cases",
        "القضايا ذات المتبقيات",
        "القضايا التي ما زال عليها مبلغ متبقٍ للتحصيل.",
        outstandingColumns,
        outstandingRows,
        excelThemes.rose
      );

      addStyledExcelTableSheet(
        workbook,
        "Unlinked Payments",
        "عمليات غير مرتبطة",
        "عمليات مالية غير مرتبطة بموكل أو قضية وتحتاج مراجعة.",
        unlinkedColumns,
        unlinkedRows,
        excelThemes.rose
      );

      const buffer = await workbook.xlsx.writeBuffer();
      downloadExcelBuffer(buffer, `mizan-finance-premium-report-${todayISO()}.xlsx`);
      showSuccessMessage("تم تصدير ملف Excel بتصميم منظم وجداول احترافية.");
    } catch (err) {
      setError("تصدير Excel المتقدم يحتاج تثبيت مكتبة exceljs. شغّل: npm install exceljs");
    }
  }

  async function copyFinanceSummary() {
    const text = [
      "ملخص مالي - Mizan",
      `المتفق عليه: ${formatMoney(financialSummary.caseAgreed)}`,
      `المدفوع: ${formatMoney(financialSummary.casePaid)}`,
      `المتبقي: ${formatMoney(financialSummary.caseRemaining)}`,
      `المصروفات: ${formatMoney(financialSummary.expenses)}`,
      `الصافي: ${formatMoney(financialSummary.net)}`,
      `نسبة التحصيل: ${financialSummary.collectionRate}%`,
    ].join("\n");

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      showSuccessMessage("تم نسخ الملخص المالي.");
      return;
    }

    setError("المتصفح لا يدعم النسخ التلقائي.");
  }

  if (loading) {
    return <LoadingCard text="جاري تحميل الأتعاب والماليات..." />;
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Fees Workspace"
          title="إدارة الأتعاب والمصروفات"
          tone="blue"
          description="مركز مالي متقدم: عمليات، ملخص حسب القضية، ملخص حسب الموكل، تصدير Excel بتصميم احترافي وجداول، نسخ إيصال، وتحديث تلقائي لمدفوعات القضايا."
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowCreate((value) => !value)}
                className="h-10 rounded-[18px] bg-slate-900 px-4 text-xs font-black text-white shadow-sm transition hover:bg-slate-950"
              >
                {showCreate ? "إغلاق الإضافة" : "إضافة عملية"}
              </button>

              <button
                type="button"
                onClick={exportExcelWorkbook}
                className="h-10 rounded-[18px] bg-black px-4 text-xs font-black text-white shadow-sm transition hover:bg-zinc-800"
              >
                تصدير Excel احترافي
              </button>

              <button
                type="button"
                onClick={copyFinanceSummary}
                className="h-10 rounded-[18px] bg-slate-100 px-4 text-xs font-black text-slate-800 shadow-sm transition hover:bg-slate-200"
              >
                نسخ ملخص
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
          <SummaryCard
            label="المتفق عليه"
            value={formatMoney(financialSummary.caseAgreed)}
            hint={`تحصيل: ${financialSummary.collectionRate}%`}
            tone="blue"
          />
          <SummaryCard
            label="المدفوع"
            value={formatMoney(financialSummary.casePaid)}
            hint={`الشهر: ${formatMoney(financialSummary.monthCollected)}`}
            tone="teal"
          />
          <SummaryCard
            label="المتبقي"
            value={formatMoney(financialSummary.caseRemaining)}
            hint={`غير مدفوع مسجل: ${formatMoney(financialSummary.due)}`}
            tone="rose"
          />
          <SummaryCard
            label="صافي الحركة"
            value={formatMoney(financialSummary.net)}
            hint={`مصروفات: ${formatMoney(financialSummary.expenses)}`}
            tone="amber"
          />
        </section>

        <CollectionProgress
          collected={financialSummary.casePaid}
          agreed={financialSummary.caseAgreed}
          remaining={financialSummary.caseRemaining}
          unlinked={financialSummary.unlinkedAmount}
        />

        <ViewTabs viewMode={viewMode} setViewMode={setViewMode} />

        {showCreate ? (
          <form
            onSubmit={handleAddPayment}
            className="min-w-0 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.07)] backdrop-blur-3xl lg:p-5"
          >
            <CompactTitle
              title="إضافة عملية مالية"
              description="اربط العملية بقضية أو موكل. لو العملية أتعاب ومدفوعة/جزئية ومرتبطة بقضية، سيتم تحديث المدفوع داخل القضية تلقائيًا."
            />

            <PaymentForm
              form={form}
              setForm={setForm}
              clientOptions={clientOptions}
              caseOptions={caseOptions}
              onCaseChange={(value) => handleCaseChange(value, "create")}
              saving={saving}
              submitLabel={saving ? "جاري الحفظ..." : "حفظ العملية"}
            />
          </form>
        ) : null}

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[430px_1fr]">
          <section className="min-w-0 space-y-4">
            <QuickFilters quickFilter={quickFilter} setQuickFilter={setQuickFilter} />

            <FiltersPanel
              search={search}
              setSearch={setSearch}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              clientFilter={clientFilter}
              setClientFilter={setClientFilter}
              caseFilter={caseFilter}
              setCaseFilter={setCaseFilter}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
              dateFrom={dateFrom}
              setDateFrom={setDateFrom}
              dateTo={dateTo}
              setDateTo={setDateTo}
              sortBy={sortBy}
              setSortBy={setSortBy}
              clients={clients}
              allCaseOptions={allCaseOptions}
              onReset={resetFilters}
              showTransactionFilters={viewMode === "transactions"}
            />

            {viewMode === "transactions" ? (
              <PaymentsList
                filteredPayments={filteredPayments}
                selectedPaymentId={selectedPayment?.id || ""}
                onSelect={(id) => {
                  setSelectedPaymentId(id);
                  setEditingPaymentId("");
                }}
              />
            ) : null}

            {viewMode === "cases" ? (
              <CasesFinanceList
                rows={filteredCaseFinanceRows}
                selectedCaseId={selectedCaseFinance?.id || ""}
                onSelect={setSelectedCaseId}
              />
            ) : null}

            {viewMode === "clients" ? (
              <ClientsFinanceList
                rows={filteredClientFinanceRows}
                selectedClientId={selectedClientFinance?.id || ""}
                onSelect={setSelectedClientId}
              />
            ) : null}
          </section>

          {viewMode === "transactions" ? (
            <PaymentDetailsPanel
              selectedPayment={selectedPayment}
              editingPaymentId={editingPaymentId}
              editForm={editForm}
              setEditForm={setEditForm}
              clientOptions={clientOptions}
              caseOptions={caseOptions}
              onCaseChange={(value) => handleCaseChange(value, "edit")}
              savingEdit={savingEdit}
              deleting={deleting}
              markingPaidId={markingPaidId}
              startEditPayment={startEditPayment}
              cancelEdit={() => setEditingPaymentId("")}
              handleUpdatePayment={handleUpdatePayment}
              deletePayment={deletePayment}
              markPaymentAsPaid={markPaymentAsPaid}
              copyReceipt={copyReceipt}
            />
          ) : null}

          {viewMode === "cases" ? (
            <CaseFinanceDetails row={selectedCaseFinance} />
          ) : null}

          {viewMode === "clients" ? (
            <ClientFinanceDetails row={selectedClientFinance} />
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

function ViewTabs({
  viewMode,
  setViewMode,
}: {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}) {
  const tabs: { value: ViewMode; label: string; hint: string }[] = [
    { value: "transactions", label: "العمليات", hint: "كل القيود المالية" },
    { value: "cases", label: "حسب القضية", hint: "تحليل كل قضية" },
    { value: "clients", label: "حسب الموكل", hint: "تحليل كل موكل" },
  ];

  return (
    <section className="rounded-[24px] border border-white/70 bg-white/70 p-2 shadow-[0_12px_35px_rgba(0,0,0,0.05)] backdrop-blur-3xl">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {tabs.map((tab) => {
          const active = viewMode === tab.value;

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setViewMode(tab.value)}
              className={`rounded-[20px] px-4 py-3 text-right transition ${
                active ? "bg-slate-900 text-white shadow-sm" : "bg-white/70 text-black hover:bg-white"
              }`}
            >
              <p className="text-sm font-black">{tab.label}</p>
              <p className="mt-1 text-[11px] font-bold opacity-75">{tab.hint}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function QuickFilters({
  quickFilter,
  setQuickFilter,
}: {
  quickFilter: QuickFilter;
  setQuickFilter: (filter: QuickFilter) => void;
}) {
  const items: { value: QuickFilter; label: string }[] = [
    { value: "all", label: "الكل" },
    { value: "collected", label: "محصل" },
    { value: "due", label: "مستحق" },
    { value: "expenses", label: "مصروفات" },
    { value: "unlinked", label: "غير مرتبط" },
  ];

  return (
    <section className="min-w-0 rounded-[28px] border border-white/70 bg-white/75 p-3 shadow-[0_18px_55px_rgba(0,0,0,0.06)] backdrop-blur-3xl">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const active = quickFilter === item.value;

          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setQuickFilter(item.value)}
              className={`rounded-2xl px-3 py-2 text-[11px] font-black transition ${
                active
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white/80 text-zinc-700 hover:bg-white"
              }`}
            >
              {item.label}
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
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
  clientFilter,
  setClientFilter,
  caseFilter,
  setCaseFilter,
  dateFilter,
  setDateFilter,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  sortBy,
  setSortBy,
  clients,
  allCaseOptions,
  onReset,
  showTransactionFilters,
}: {
  search: string;
  setSearch: (value: string) => void;
  typeFilter: "all" | PaymentType;
  setTypeFilter: (value: "all" | PaymentType) => void;
  statusFilter: "all" | PaymentStatus;
  setStatusFilter: (value: "all" | PaymentStatus) => void;
  clientFilter: string;
  setClientFilter: (value: string) => void;
  caseFilter: string;
  setCaseFilter: (value: string) => void;
  dateFilter: "all" | "today" | "month" | "undated";
  setDateFilter: (value: "all" | "today" | "month" | "undated") => void;
  dateFrom: string;
  setDateFrom: (value: string) => void;
  dateTo: string;
  setDateTo: (value: string) => void;
  sortBy: "newest" | "oldest" | "amount" | "case";
  setSortBy: (value: "newest" | "oldest" | "amount" | "case") => void;
  clients: ClientLite[];
  allCaseOptions: { value: string; label: string }[];
  onReset: () => void;
  showTransactionFilters: boolean;
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
          placeholder="بحث بالمبلغ، الموكل، القضية، الملاحظات..."
          className="h-10 w-full min-w-0 rounded-[16px] border border-black/10 bg-white/85 px-3 text-xs font-bold text-black outline-none placeholder:text-zinc-400 focus:ring-4 focus:ring-slate-400/10"
        />

        {showTransactionFilters ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <CompactSelect
                value={typeFilter}
                onChange={(value) => setTypeFilter(value as "all" | PaymentType)}
              >
                <option value="all">كل الأنواع</option>
                <option value="fee">أتعاب</option>
                <option value="expense">مصروفات</option>
              </CompactSelect>

              <CompactSelect
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as "all" | PaymentStatus)}
              >
                <option value="all">كل الحالات</option>
                <option value="paid">مدفوع</option>
                <option value="unpaid">غير مدفوع</option>
                <option value="partial">جزئي</option>
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
                value={dateFilter}
                onChange={(value) => setDateFilter(value as "all" | "today" | "month" | "undated")}
              >
                <option value="all">كل التواريخ</option>
                <option value="today">اليوم</option>
                <option value="month">هذا الشهر</option>
                <option value="undated">بدون تاريخ</option>
              </CompactSelect>

              <CompactSelect
                value={sortBy}
                onChange={(value) => setSortBy(value as "newest" | "oldest" | "amount" | "case")}
              >
                <option value="newest">الأحدث</option>
                <option value="oldest">الأقدم</option>
                <option value="amount">الأكبر مبلغًا</option>
                <option value="case">اسم القضية</option>
              </CompactSelect>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <MiniField label="من تاريخ" value={dateFrom} onChange={setDateFrom} type="date" />
              <MiniField label="إلى تاريخ" value={dateTo} onChange={setDateTo} type="date" />
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            <CompactSelect value={clientFilter} onChange={setClientFilter}>
              <option value="all">كل الموكلين</option>
              <option value="none">بدون موكل</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </CompactSelect>
          </div>
        )}
      </div>
    </section>
  );
}

function PaymentsList({
  filteredPayments,
  selectedPaymentId,
  onSelect,
}: {
  filteredPayments: PaymentRow[];
  selectedPaymentId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="min-w-0 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)] backdrop-blur-3xl">
      <div className="mb-4 flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-black text-black">قائمة العمليات</h2>
          <p className="text-xs font-bold text-zinc-500">{filteredPayments.length} نتيجة</p>
        </div>
      </div>

      {filteredPayments.length === 0 ? (
        <EmptyState
          title="لا توجد عمليات مالية"
          description="أضف عملية جديدة أو غيّر البحث والفلترة."
        />
      ) : (
        <div className="max-h-[780px] space-y-2 overflow-y-auto pr-1">
          {filteredPayments.map((item) => {
            const selected = selectedPaymentId === item.id;

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
                      {formatMoney(Number(item.amount || 0))}
                    </h3>
                    <p className="mt-1 truncate text-xs font-bold text-zinc-600">
                      {item.cases?.title || item.clients?.name || "غير مرتبط"}
                    </p>
                    <p className="mt-1 truncate text-[11px] font-bold text-zinc-500">
                      {formatDate(item.payment_date || item.created_at)}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={item.payment_type === "fee" ? "teal" : "amber"}>
                      {paymentTypeLabel(item.payment_type)}
                    </Badge>
                    <Badge tone={paymentStatusTone(item.status)}>
                      {paymentStatusLabel(item.status)}
                    </Badge>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Mini label="الموكل" value={item.clients?.name || "—"} />
                  <Mini label="القضية" value={item.cases?.title || "—"} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CasesFinanceList({
  rows,
  selectedCaseId,
  onSelect,
}: {
  rows: CaseFinanceRow[];
  selectedCaseId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="min-w-0 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)] backdrop-blur-3xl">
      <h2 className="mb-1 text-base font-black text-black">تحليل القضايا</h2>
      <p className="mb-4 text-xs font-bold text-zinc-500">{rows.length} قضية</p>

      {rows.length === 0 ? (
        <EmptyState title="لا توجد قضايا" description="لا توجد قضايا مطابقة للبحث." />
      ) : (
        <div className="max-h-[780px] space-y-2 overflow-y-auto pr-1">
          {rows.map((item) => {
            const selected = selectedCaseId === item.id;
            const percent =
              Number(item.agreed_fee_amount || 0) > 0
                ? Math.min(Math.round((Number(item.paid_fee_amount || 0) / Number(item.agreed_fee_amount || 0)) * 100), 100)
                : 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`w-full rounded-[22px] border p-3 text-right transition ${
                  selected ? "border-slate-300 bg-slate-100/90 ring-4 ring-slate-400/10" : "border-black/5 bg-white/80 hover:bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black text-black">{item.title}</h3>
                    <p className="mt-1 truncate text-xs font-bold text-zinc-600">{item.clients?.name || "بدون موكل"}</p>
                  </div>
                  <Badge tone={item.remaining > 0 ? "rose" : "teal"}>{percent}%</Badge>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full rounded-full bg-slate-900" style={{ width: `${percent}%` }} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Mini label="متبقي" value={formatMoney(item.remaining)} />
                  <Mini label="حركة" value={String(item.movement)} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ClientsFinanceList({
  rows,
  selectedClientId,
  onSelect,
}: {
  rows: ClientFinanceRow[];
  selectedClientId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="min-w-0 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)] backdrop-blur-3xl">
      <h2 className="mb-1 text-base font-black text-black">تحليل الموكلين</h2>
      <p className="mb-4 text-xs font-bold text-zinc-500">{rows.length} موكل</p>

      {rows.length === 0 ? (
        <EmptyState title="لا يوجد موكلين" description="لا يوجد موكلين مطابقين للبحث." />
      ) : (
        <div className="max-h-[780px] space-y-2 overflow-y-auto pr-1">
          {rows.map((item) => {
            const selected = selectedClientId === item.id;
            const percent =
              item.agreed > 0 ? Math.min(Math.round((item.paid / item.agreed) * 100), 100) : 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`w-full rounded-[22px] border p-3 text-right transition ${
                  selected ? "border-slate-300 bg-slate-100/90 ring-4 ring-slate-400/10" : "border-black/5 bg-white/80 hover:bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black text-black">{item.name}</h3>
                    <p className="mt-1 truncate text-xs font-bold text-zinc-600">{item.phone || "بدون رقم"}</p>
                  </div>
                  <Badge tone={item.remaining > 0 ? "rose" : "teal"}>{percent}%</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Mini label="قضايا" value={String(item.cases.length)} />
                  <Mini label="متبقي" value={formatMoney(item.remaining)} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PaymentForm({
  form,
  setForm,
  clientOptions,
  caseOptions,
  onCaseChange,
  saving,
  submitLabel,
}: {
  form: PaymentFormState;
  setForm: Dispatch<SetStateAction<PaymentFormState>>;
  clientOptions: { value: string; label: string }[];
  caseOptions: { value: string; label: string }[];
  onCaseChange: (value: string) => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <div className="space-y-4">
      <FormSection title="بيانات العملية">
        <SelectField
          label="النوع"
          value={form.payment_type}
          onChange={(value: string) =>
            setForm((prev) => ({ ...prev, payment_type: value as PaymentType }))
          }
          options={[
            { value: "fee", label: "أتعاب" },
            { value: "expense", label: "مصروفات" },
          ]}
        />

        <SelectField
          label="الحالة"
          value={form.status}
          onChange={(value: string) =>
            setForm((prev) => ({ ...prev, status: value as PaymentStatus }))
          }
          options={[
            { value: "paid", label: "مدفوع" },
            { value: "unpaid", label: "غير مدفوع" },
            { value: "partial", label: "جزئي" },
          ]}
        />

        <Field
          label="المبلغ"
          value={form.amount}
          onChange={(value: string) => setForm((prev) => ({ ...prev, amount: value }))}
          type="number"
          required
        />

        <Field
          label="تاريخ العملية"
          value={form.payment_date}
          onChange={(value: string) =>
            setForm((prev) => ({ ...prev, payment_date: value }))
          }
          type="date"
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

      {form.payment_type === "fee" && (form.status === "paid" || form.status === "partial") && form.case_id ? (
        <div className="rounded-[18px] bg-slate-100 p-3 text-xs font-black leading-6 text-slate-800">
          سيتم تحديث المدفوع داخل القضية تلقائيًا بقيمة هذه العملية.
        </div>
      ) : null}

      <TextareaField
        label="ملاحظات"
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

function PaymentDetailsPanel({
  selectedPayment,
  editingPaymentId,
  editForm,
  setEditForm,
  clientOptions,
  caseOptions,
  onCaseChange,
  savingEdit,
  deleting,
  markingPaidId,
  startEditPayment,
  cancelEdit,
  handleUpdatePayment,
  deletePayment,
  markPaymentAsPaid,
  copyReceipt,
}: {
  selectedPayment: PaymentRow | null;
  editingPaymentId: string;
  editForm: PaymentFormState;
  setEditForm: Dispatch<SetStateAction<PaymentFormState>>;
  clientOptions: { value: string; label: string }[];
  caseOptions: { value: string; label: string }[];
  onCaseChange: (value: string) => void;
  savingEdit: boolean;
  deleting: boolean;
  markingPaidId: string;
  startEditPayment: (item: PaymentRow) => void;
  cancelEdit: () => void;
  handleUpdatePayment: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  deletePayment: (item: PaymentRow) => Promise<void>;
  markPaymentAsPaid: (item: PaymentRow) => Promise<void>;
  copyReceipt: (item: PaymentRow) => Promise<void>;
}) {
  if (!selectedPayment) {
    return (
      <div className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
        <EmptyState
          title="اختر عملية"
          description="اختر عملية مالية من القائمة لعرض التفاصيل."
        />
      </div>
    );
  }

  const isEditing = editingPaymentId === selectedPayment.id;
  const caseRemaining = selectedPayment.cases
    ? Math.max(
        Number(selectedPayment.cases.agreed_fee_amount || 0) -
          Number(selectedPayment.cases.paid_fee_amount || 0),
        0
      )
    : 0;

  return (
    <section className="min-w-0 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)] backdrop-blur-3xl lg:p-5 xl:sticky xl:top-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="mb-2 inline-flex rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-black text-white">
            ملف العملية المالية
          </p>
          <h2 className="break-words text-xl font-black text-black lg:text-2xl">
            {formatMoney(Number(selectedPayment.amount || 0))}
          </h2>
          <p className="mt-1 break-words text-xs font-bold text-zinc-600">
            {paymentTypeLabel(selectedPayment.payment_type)} —{" "}
            {paymentStatusLabel(selectedPayment.status)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isEditing ? (
            <SmallButton tone="amber" onClick={() => startEditPayment(selectedPayment)}>
              تعديل
            </SmallButton>
          ) : (
            <SmallButton tone="zinc" onClick={cancelEdit}>
              إلغاء
            </SmallButton>
          )}

          {selectedPayment.status !== "paid" ? (
            <SmallButton tone="teal" onClick={() => markPaymentAsPaid(selectedPayment)}>
              {markingPaidId === selectedPayment.id ? "تحديث..." : "Mark Paid"}
            </SmallButton>
          ) : null}

          <SmallButton tone="blue" onClick={() => copyReceipt(selectedPayment)}>
            نسخ إيصال
          </SmallButton>

          <SmallButton tone="rose" onClick={() => deletePayment(selectedPayment)}>
            {deleting ? "حذف..." : "حذف"}
          </SmallButton>

          {selectedPayment.client_id ? (
            <Link
              href={`/clients/${selectedPayment.client_id}`}
              className="rounded-2xl bg-black px-3 py-2 text-[11px] font-black text-white"
            >
              ملف الموكل
            </Link>
          ) : null}

          {selectedPayment.case_id ? (
            <Link
              href="/cases"
              className="rounded-2xl bg-slate-900 px-3 py-2 text-[11px] font-black text-white"
            >
              صفحة القضايا
            </Link>
          ) : null}
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleUpdatePayment}>
          <PaymentForm
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
              <Badge tone={selectedPayment.payment_type === "fee" ? "teal" : "amber"}>
                {paymentTypeLabel(selectedPayment.payment_type)}
              </Badge>
            </Info>

            <Info label="الحالة">
              <Badge tone={paymentStatusTone(selectedPayment.status)}>
                {paymentStatusLabel(selectedPayment.status)}
              </Badge>
            </Info>

            <Info label="التاريخ">
              <ResponsiveText>
                {formatDate(selectedPayment.payment_date || selectedPayment.created_at)}
              </ResponsiveText>
            </Info>

            <Info label="المبلغ">
              <ResponsiveText>{formatMoney(Number(selectedPayment.amount || 0))}</ResponsiveText>
            </Info>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Info label="الموكل">
              {selectedPayment.client_id ? (
                <Link
                  href={`/clients/${selectedPayment.client_id}`}
                  className="font-black text-slate-700 hover:underline"
                >
                  {selectedPayment.clients?.name || "فتح ملف الموكل"}
                </Link>
              ) : (
                <ResponsiveText>غير مرتبط بموكل</ResponsiveText>
              )}
            </Info>

            <Info label="القضية">
              <ResponsiveText>{selectedPayment.cases?.title || "غير مرتبط بقضية"}</ResponsiveText>
            </Info>
          </div>

          {selectedPayment.cases ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Info label="أتعاب القضية">
                <ResponsiveText>
                  {formatMoney(Number(selectedPayment.cases.agreed_fee_amount || 0))}
                </ResponsiveText>
              </Info>

              <Info label="مدفوع القضية">
                <ResponsiveText>
                  {formatMoney(Number(selectedPayment.cases.paid_fee_amount || 0))}
                </ResponsiveText>
              </Info>

              <Info label="متبقي القضية">
                <ResponsiveText>{formatMoney(caseRemaining)}</ResponsiveText>
              </Info>
            </div>
          ) : null}

          <Info label="ملاحظات">
            <ResponsiveText>{selectedPayment.notes}</ResponsiveText>
          </Info>
        </div>
      )}
    </section>
  );
}

function CaseFinanceDetails({ row }: { row: CaseFinanceRow | null }) {
  if (!row) {
    return (
      <div className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
        <EmptyState title="اختر قضية" description="اختر قضية من القائمة لعرض التحليل المالي." />
      </div>
    );
  }

  const percent =
    Number(row.agreed_fee_amount || 0) > 0
      ? Math.min(Math.round((Number(row.paid_fee_amount || 0) / Number(row.agreed_fee_amount || 0)) * 100), 100)
      : 0;

  return (
    <section className="rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)] lg:p-5 xl:sticky xl:top-6">
      <p className="mb-2 inline-flex rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-black text-white">
        تحليل القضية
      </p>
      <h2 className="text-xl font-black text-black">{row.title}</h2>
      <p className="mt-1 text-xs font-bold text-zinc-600">{row.clients?.name || "بدون موكل"}</p>

      <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Info label="متفق">
          <ResponsiveText>{formatMoney(Number(row.agreed_fee_amount || 0))}</ResponsiveText>
        </Info>
        <Info label="مدفوع">
          <ResponsiveText>{formatMoney(Number(row.paid_fee_amount || 0))}</ResponsiveText>
        </Info>
        <Info label="متبقي">
          <Badge tone={row.remaining > 0 ? "rose" : "teal"}>{formatMoney(row.remaining)}</Badge>
        </Info>
        <Info label="تحصيل">
          <Badge tone={percent >= 100 ? "teal" : "amber"}>{percent}%</Badge>
        </Info>
      </div>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full bg-slate-900" style={{ width: `${percent}%` }} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Info label="حركة محصلة">
          <ResponsiveText>{formatMoney(row.collected)}</ResponsiveText>
        </Info>
        <Info label="مستحق مسجل">
          <ResponsiveText>{formatMoney(row.due)}</ResponsiveText>
        </Info>
        <Info label="مصروفات">
          <ResponsiveText>{formatMoney(row.expenses)}</ResponsiveText>
        </Info>
      </div>

      <RelatedMovements payments={row.payments} />
    </section>
  );
}

function ClientFinanceDetails({ row }: { row: ClientFinanceRow | null }) {
  if (!row) {
    return (
      <div className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
        <EmptyState title="اختر موكل" description="اختر موكل من القائمة لعرض التحليل المالي." />
      </div>
    );
  }

  const percent = row.agreed > 0 ? Math.min(Math.round((row.paid / row.agreed) * 100), 100) : 0;

  return (
    <section className="rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)] lg:p-5 xl:sticky xl:top-6">
      <p className="mb-2 inline-flex rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-black text-white">
        تحليل الموكل
      </p>
      <h2 className="text-xl font-black text-black">{row.name}</h2>
      <p className="mt-1 text-xs font-bold text-zinc-600">{row.phone || "بدون رقم"}</p>

      <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Info label="قضايا">
          <ResponsiveText>{row.cases.length}</ResponsiveText>
        </Info>
        <Info label="متفق">
          <ResponsiveText>{formatMoney(row.agreed)}</ResponsiveText>
        </Info>
        <Info label="مدفوع">
          <ResponsiveText>{formatMoney(row.paid)}</ResponsiveText>
        </Info>
        <Info label="متبقي">
          <Badge tone={row.remaining > 0 ? "rose" : "teal"}>{formatMoney(row.remaining)}</Badge>
        </Info>
      </div>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full bg-slate-900" style={{ width: `${percent}%` }} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Info label="حركة محصلة">
          <ResponsiveText>{formatMoney(row.collected)}</ResponsiveText>
        </Info>
        <Info label="مستحق مسجل">
          <ResponsiveText>{formatMoney(row.due)}</ResponsiveText>
        </Info>
        <Info label="مصروفات">
          <ResponsiveText>{formatMoney(row.expenses)}</ResponsiveText>
        </Info>
      </div>

      <RelatedMovements payments={row.payments} />
    </section>
  );
}

function RelatedMovements({ payments }: { payments: PaymentRow[] }) {
  return (
    <section className="mt-5 rounded-[22px] bg-zinc-50/80 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-black text-black">آخر الحركات</h3>
        <Badge tone="zinc">{payments.length}</Badge>
      </div>

      {payments.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-black/10 bg-white/70 p-4 text-center text-xs font-black text-zinc-500">
          لا توجد حركات مالية.
        </div>
      ) : (
        <div className="space-y-2">
          {payments.slice(0, 8).map((item) => (
            <div key={item.id} className="rounded-[18px] bg-white/80 p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-black">{formatMoney(Number(item.amount || 0))}</p>
                  <p className="mt-1 text-[11px] font-bold text-zinc-500">
                    {formatDate(item.payment_date || item.created_at)}
                  </p>
                </div>
                <Badge tone={paymentStatusTone(item.status)}>{paymentStatusLabel(item.status)}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CollectionProgress({
  collected,
  agreed,
  remaining,
  unlinked,
}: {
  collected: number;
  agreed: number;
  remaining: number;
  unlinked: number;
}) {
  const percent = agreed > 0 ? Math.min(Math.round((collected / agreed) * 100), 100) : 0;

  return (
    <section className="rounded-[24px] border border-white/70 bg-white/70 p-4 shadow-[0_12px_35px_rgba(0,0,0,0.05)] backdrop-blur-3xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-black text-black">مؤشر التحصيل</h2>
          <p className="mt-1 text-xs font-bold text-zinc-500">
            تم تحصيل {formatMoney(collected)} من أصل {formatMoney(agreed)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={remaining <= 0 && agreed > 0 ? "teal" : "amber"}>{percent}%</Badge>
          {unlinked > 0 ? <Badge tone="rose">غير مرتبط: {formatMoney(unlinked)}</Badge> : null}
        </div>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-slate-900 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
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
  tone: "teal" | "blue" | "rose" | "amber";
}) {
  const tones = {
    teal: "bg-slate-100 text-slate-800",
    blue: "bg-slate-100 text-slate-800",
    rose: "bg-rose-50 text-rose-800",
    amber: "bg-slate-100 text-slate-800",
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

function MiniField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black text-zinc-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        className="h-10 w-full rounded-[16px] border border-black/10 bg-white/85 px-3 text-xs font-bold text-black outline-none"
      />
    </label>
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
  tone: "amber" | "rose" | "zinc" | "teal" | "blue";
  onClick: () => void;
}) {
  const tones = {
    amber: "bg-slate-100 text-slate-800 hover:bg-amber-200",
    rose: "bg-red-50 text-red-700 hover:bg-red-100",
    zinc: "bg-zinc-100 text-black hover:bg-zinc-200",
    teal: "bg-slate-100 text-slate-800 hover:bg-slate-200",
    blue: "bg-slate-100 text-slate-800 hover:bg-slate-200",
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

export default function FeesPage() {
  return (
    <RequireRole allowedRoles={["admin"]}>
      <FeesPageContent />
    </RequireRole>
  );
}

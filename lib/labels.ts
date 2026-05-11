import type {
  CaseStatus,
  ClientType,
  CourtCategory,
  DocumentType,
  LitigationDegree,
} from "@/lib/types";

export const clientTypeLabels: Record<ClientType, string> = {
  individual: "فرد",
  company: "شركة",
};

export const courtCategoryLabels: Record<CourtCategory, string> = {
  civil: "مدني",
  criminal: "جنائي / جنح",
  family: "أحوال شخصية / أسرة",
  economic: "اقتصادي",
  administrative: "إداري / مجلس الدولة",
  labor: "عمالي",
  commercial: "تجاري",
  rent: "إيجارات",
  execution: "تنفيذ",
  other: "أخرى",
};

export const litigationDegreeLabels: Record<LitigationDegree, string> = {
  first_instance: "أول درجة",
  appeal: "استئناف",
  cassation: "نقض",
  execution: "تنفيذ",
  other: "أخرى",
};

export const caseStatusLabels: Record<CaseStatus, string> = {
  open: "مفتوحة",
  postponed: "مؤجلة",
  judgment_reserved: "محجوزة للحكم",
  judgment_issued: "صدر حكم",
  closed: "مغلقة",
  archived: "أرشيف",
};

export const documentTypeLabels: Record<DocumentType, string> = {
  power_of_attorney: "توكيل",
  national_id: "بطاقة رقم قومي",
  commercial_register: "سجل تجاري",
  tax_card: "بطاقة ضريبية",
  contract: "عقد",
  claim_statement: "صحيفة دعوى",
  memo: "مذكرة",
  court_notice: "إعلان / إنذار",
  judgment: "حكم",
  appeal: "استئناف",
  cassation: "نقض",
  expert_report: "تقرير خبير",
  receipt: "إيصال",
  other: "أخرى",
};

export const governorates = [
  "القاهرة",
  "الجيزة",
  "الإسكندرية",
  "الدقهلية",
  "البحر الأحمر",
  "البحيرة",
  "الفيوم",
  "الغربية",
  "الإسماعيلية",
  "المنوفية",
  "المنيا",
  "القليوبية",
  "الوادي الجديد",
  "السويس",
  "أسوان",
  "أسيوط",
  "بني سويف",
  "بورسعيد",
  "دمياط",
  "الشرقية",
  "جنوب سيناء",
  "كفر الشيخ",
  "مطروح",
  "الأقصر",
  "قنا",
  "شمال سيناء",
  "سوهاج",
];

export function formatMoney(value: number) {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "غير محدد";

  try {
    return new Intl.DateTimeFormat("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function formatFileSize(bytes?: number | null) {
  if (!bytes) return "غير معروف";

  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;

  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export const taskStatusLabels = {
  todo: "مطلوبة",
  in_progress: "قيد التنفيذ",
  done: "تمت",
  cancelled: "ملغاة",
} as const;

export const taskPriorityLabels = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  urgent: "عاجلة",
} as const;

export type ClientType = "individual" | "company";

export type CaseStatus =
  | "open"
  | "postponed"
  | "judgment_reserved"
  | "judgment_issued"
  | "closed"
  | "archived";

export type CourtCategory =
  | "civil"
  | "criminal"
  | "family"
  | "economic"
  | "administrative"
  | "labor"
  | "commercial"
  | "rent"
  | "execution"
  | "other";

export type LitigationDegree =
  | "first_instance"
  | "appeal"
  | "cassation"
  | "execution"
  | "other";

export type DocumentType =
  | "power_of_attorney"
  | "national_id"
  | "commercial_register"
  | "tax_card"
  | "contract"
  | "claim_statement"
  | "memo"
  | "court_notice"
  | "judgment"
  | "appeal"
  | "cassation"
  | "expert_report"
  | "receipt"
  | "other";

export type Client = {
  id: string;
  user_id: string;
  name: string;
  client_type: ClientType;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  national_id: string | null;
  passport_number: string | null;
  commercial_register: string | null;
  tax_card_number: string | null;
  address: string | null;
  governorate: string | null;
  legal_capacity: string | null;
  occupation: string | null;
  company_representative: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Case = {
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
  agreed_fee_amount: number | null;
  paid_fee_amount: number | null;
  fee_notes: string | null;
  last_decision: string | null;
  required_action: string | null;
  judgment_summary: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  clients?: Pick<Client, "id" | "name" | "phone" | "client_type"> | null;
};

export type DocumentRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  case_id: string | null;
  title: string;
  document_type: DocumentType;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string;
  notes: string | null;
  created_at: string;
  clients?: Pick<Client, "id" | "name"> | null;
  cases?: Pick<Case, "id" | "title" | "case_number" | "case_year"> | null;
};

export type Hearing = {
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

export type Payment = {
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

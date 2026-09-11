/**
 * Shared CRM constants + types for the frontend.
 *
 * Mirrors the backend contract in jewellarifyerp-backend/src/crm — stage names,
 * lead sources and the paginated list envelope. These are UX helpers only; the
 * backend is the source of truth and re-validates every value.
 */

/* ------------------------------------------------------------------ */
/* Opportunity stages                                                  */
/* ------------------------------------------------------------------ */
export const OPPORTUNITY_STAGES = [
  "prospecting",
  "qualification",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

/** Stages a client may set directly (open pipeline). `won` / `lost` go via /win /lose. */
export const OPEN_OPPORTUNITY_STAGES = [
  "prospecting",
  "qualification",
  "proposal",
  "negotiation",
] as const;

export const OPPORTUNITY_STAGE_LABELS: Record<OpportunityStage, string> = {
  prospecting: "Prospecting",
  qualification: "Qualification",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export const OPPORTUNITY_STAGE_BADGE: Record<OpportunityStage, BadgeVariant> = {
  prospecting: "outline",
  qualification: "secondary",
  proposal: "secondary",
  negotiation: "default",
  won: "default",
  lost: "destructive",
};

/* ------------------------------------------------------------------ */
/* Lead sources (shared by leads + opportunities)                      */
/* ------------------------------------------------------------------ */
export const LEAD_SOURCES = [
  "walk_in",
  "referral",
  "instagram",
  "facebook",
  "website",
  "whatsapp",
  "phone",
  "exhibition",
  "advertisement",
  "other",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "unqualified",
  "converted",
  "lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Statuses a client may set directly via create/update (convert/qualify have endpoints). */
export const LEAD_OPEN_STATUSES = ["new", "contacted", "qualified", "unqualified", "lost"] as const;

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  unqualified: "Unqualified",
  converted: "Converted",
  lost: "Lost",
};

export const LEAD_STATUS_BADGE: Record<LeadStatus, BadgeVariant> = {
  new: "default",
  contacted: "secondary",
  qualified: "default",
  unqualified: "outline",
  converted: "default",
  lost: "destructive",
};

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  walk_in: "Walk-in",
  referral: "Referral",
  instagram: "Instagram",
  facebook: "Facebook",
  website: "Website",
  whatsapp: "WhatsApp",
  phone: "Phone",
  exhibition: "Exhibition",
  advertisement: "Advertisement",
  other: "Other",
};

export function sourceLabel(s: string | null | undefined): string {
  if (!s) return "—";
  return LEAD_SOURCE_LABELS[s] ?? s;
}

/* ------------------------------------------------------------------ */
/* Lead qualification (Phase 3)                                        */
/*                                                                    */
/* A SEPARATE axis from `status` above. NULL == not yet assessed.      */
/* `nurture` has no matching `status` value on purpose — a nurtured    */
/* lead keeps whatever open status it already had.                     */
/* ------------------------------------------------------------------ */
export const QUALIFICATION_STATUSES = ["qualified", "nurture", "disqualified"] as const;
export type QualificationStatus = (typeof QUALIFICATION_STATUSES)[number];

export const QUALIFICATION_STATUS_LABELS: Record<QualificationStatus, string> = {
  qualified: "Qualified",
  nurture: "Nurture",
  disqualified: "Disqualified",
};

export const QUALIFICATION_STATUS_BADGE: Record<QualificationStatus, BadgeVariant> = {
  qualified: "default",
  nurture: "secondary",
  disqualified: "destructive",
};

/** Structured (BANT-style) qualification fields — mirror the backend whitelist. */
export const QUALIFICATION_AUTHORITY = ["decision_maker", "influencer", "none", "unknown"] as const;
export const QUALIFICATION_NEED = ["high", "medium", "low", "unknown"] as const;
export const QUALIFICATION_TIMELINE = [
  "immediate",
  "1_3_months",
  "3_6_months",
  "6_plus_months",
  "unknown",
] as const;

export const QUALIFICATION_AUTHORITY_LABELS: Record<string, string> = {
  decision_maker: "Decision maker",
  influencer: "Influencer",
  none: "No authority",
  unknown: "Unknown",
};
export const QUALIFICATION_NEED_LABELS: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  unknown: "Unknown",
};
export const QUALIFICATION_TIMELINE_LABELS: Record<string, string> = {
  immediate: "Immediate",
  "1_3_months": "1–3 months",
  "3_6_months": "3–6 months",
  "6_plus_months": "6+ months",
  unknown: "Unknown",
};

export interface QualificationData {
  budget?: string;
  authority?: string;
  need?: string;
  timeline?: string;
  interest?: string;
  objections?: string;
}

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */
export const TASK_STATUSES = ["open", "in_progress", "completed", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Statuses settable via create/update — `completed` goes through /complete. */
export const TASK_OPEN_STATUSES = ["open", "in_progress", "cancelled"] as const;

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_RELATED_TYPES = ["lead", "opportunity", "customer"] as const;
export type TaskRelatedType = (typeof TASK_RELATED_TYPES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const TASK_STATUS_BADGE: Record<TaskStatus, BadgeVariant> = {
  open: "default",
  in_progress: "secondary",
  completed: "outline",
  cancelled: "destructive",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const TASK_PRIORITY_BADGE: Record<TaskPriority, BadgeVariant> = {
  low: "outline",
  medium: "secondary",
  high: "default",
  urgent: "destructive",
};

export interface Task {
  id: string;
  _id?: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  relatedType: TaskRelatedType | null;
  relatedId: string | null;
  branchId: string | null;
  assignedTo: string | null;
  createdBy: string | null;
  completedAt: string | null;
  completedBy: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Query-string builder for list endpoints                             */
/* ------------------------------------------------------------------ */
/**
 * Turn a params object into a query string, dropping empty / null / undefined
 * values. Returns a bare string with no leading "?".
 */
export function toQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    sp.set(key, String(value));
  }
  return sp.toString();
}

/* ------------------------------------------------------------------ */
/* Response shapes                                                     */
/* ------------------------------------------------------------------ */
export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PipelineStage {
  stage: OpportunityStage;
  count: number;
  amount: number;
}

export interface PipelineSummary {
  stages: PipelineStage[];
  open: { count: number; amount: number };
  won: PipelineStage;
  lost: PipelineStage;
}

export interface Opportunity {
  id: string;
  _id?: string;
  title: string;
  stage: OpportunityStage;
  amount: number | null;
  probability: number | null;
  source: string | null;
  notes: string | null;
  branchId: string | null;
  customerId: string | null;
  leadId: string | null;
  assignedTo: string | null;
  createdBy: string | null;
  expectedCloseDate: string | null;
  wonAt: string | null;
  lostAt: string | null;
  lostReason: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  _id?: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  source: string | null;
  status: LeadStatus;
  notes: string | null;
  branchId: string | null;
  assignedTo: string | null;
  createdBy: string | null;
  customerId: string | null;
  convertedCustomerId: string | null;
  qualifiedAt: string | null;
  convertedAt: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Phase 3 — structured qualification
  qualificationStatus: QualificationStatus | null;
  qualificationScore: number | null;
  qualificationNotes: string | null;
  qualificationData: QualificationData | null;
  qualifiedBy: string | null;
  disqualifiedAt: string | null;
  disqualifiedReason: string | null;
  nurtureUntil: string | null;
}

export type CrmActivityType =
  | "note"
  | "call"
  | "email"
  | "meeting"
  | "whatsapp"
  | "system"
  | "stage_change"
  | "assignment";

export interface CrmActivity {
  id: string;
  _id?: string;
  entityType: "lead" | "opportunity" | "customer" | "task";
  entityId: string;
  type: CrmActivityType | string;
  body: string | null;
  data?: Record<string, unknown> | null;
  actorUserId: string | null;
  createdAt: string;
}

export interface CrmUser {
  id: string;
  name: string;
  username?: string;
  role?: string;
  crmRole?: string | null;
}

export interface CrmBranch {
  id: string;
  name: string;
  code?: string | null;
}

/** Shape of GET /api/crm/me. */
export interface CrmMe {
  user: { id: string; username: string; name: string; role: string };
  crmRole: string | null;
  permissions: string[];
  hasCrmAccess: boolean;
  branchIds: string[];
  branchScope: "restricted" | "shop_wide";
}

/** Shape of GET /api/crm/dashboard. */
export interface CrmDashboard {
  leads: {
    total: number;
    new: number;
    contacted: number;
    qualified: number;
    unqualified: number;
    converted: number;
    lost: number;
    last30: number;
  };
  opportunities: {
    open: number;
    won: number;
    lost: number;
    openValue: number;
    wonValue: number;
    wonValue30: number;
  };
  tasks: {
    pending: number;
    overdue: number;
    dueToday: number;
    completed30: number;
  };
  recentActivity: CrmActivity[];
}

/** ₹ formatter shared by every CRM screen. */
export function crmMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return "₹" + Number(n).toLocaleString("en-IN");
}

/**
 * Resolve a `?customerId=` deep-link against a loaded customer list, matching
 * on either `_id` or `id` (ERP rows expose both). Returns the row or null.
 * Shared by the Customers 360 route so the behaviour is unit-testable.
 */
export function matchCustomerRow<T extends { _id?: string | null; id?: string | null }>(
  rows: readonly T[],
  wantedId: string | null | undefined,
): T | null {
  if (!wantedId) return null;
  return rows.find((c) => c._id === wantedId || c.id === wantedId) ?? null;
}

import { describe, it, expect } from "vitest";
import {
  toQuery,
  crmMoney,
  sourceLabel,
  matchCustomerRow,
  OPPORTUNITY_STAGES,
  OPEN_OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGE_BADGE,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_BADGE,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  QUALIFICATION_STATUSES,
  QUALIFICATION_STATUS_LABELS,
  QUALIFICATION_STATUS_BADGE,
  QUALIFICATION_AUTHORITY,
  QUALIFICATION_NEED,
  QUALIFICATION_TIMELINE,
  QUALIFICATION_AUTHORITY_LABELS,
  QUALIFICATION_NEED_LABELS,
  QUALIFICATION_TIMELINE_LABELS,
} from "@/lib/crm";

describe("toQuery", () => {
  it("serialises truthy values and drops empty/null/undefined", () => {
    const q = toQuery({ page: 1, limit: 25, q: "ram", status: "", branch_id: null, x: undefined });
    const sp = new URLSearchParams(q);
    expect(sp.get("page")).toBe("1");
    expect(sp.get("limit")).toBe("25");
    expect(sp.get("q")).toBe("ram");
    expect(sp.has("status")).toBe(false);
    expect(sp.has("branch_id")).toBe(false);
    expect(sp.has("x")).toBe(false);
  });

  it("returns a bare string with no leading ?", () => {
    expect(toQuery({ a: "b" }).startsWith("?")).toBe(false);
  });

  it("keeps 0 out (falsy) but keeps explicit strings", () => {
    // current contract: empty-string/null/undefined dropped; 0 is stringified
    expect(new URLSearchParams(toQuery({ n: 0 })).get("n")).toBe("0");
  });
});

describe("crmMoney", () => {
  it("formats INR and handles nullish", () => {
    expect(crmMoney(null)).toBe("—");
    expect(crmMoney(undefined)).toBe("—");
    expect(crmMoney(0)).toBe("₹0");
    expect(crmMoney(1234567)).toBe("₹12,34,567");
  });
});

describe("sourceLabel", () => {
  it("maps known sources, passes through unknown, dashes nullish", () => {
    expect(sourceLabel("walk_in")).toBe("Walk-in");
    expect(sourceLabel("some_custom_source")).toBe("some_custom_source");
    expect(sourceLabel(null)).toBe("—");
  });
});

describe("matchCustomerRow (Customer 360 deep-link)", () => {
  const rows = [
    { _id: "c1", id: "c1", name: "A" },
    { _id: "c2", id: "c2", name: "B" },
    { id: "c3", name: "C" }, // only id
  ];

  it("matches on _id", () => {
    expect(matchCustomerRow(rows, "c2")?.name).toBe("B");
  });
  it("matches on id when _id absent", () => {
    expect(matchCustomerRow(rows, "c3")?.name).toBe("C");
  });
  it("returns null for unknown id / nullish", () => {
    expect(matchCustomerRow(rows, "nope")).toBeNull();
    expect(matchCustomerRow(rows, null)).toBeNull();
    expect(matchCustomerRow(rows, undefined)).toBeNull();
    expect(matchCustomerRow([], "c1")).toBeNull();
  });
});

describe("CRM constant tables stay consistent with the backend enums", () => {
  it("opportunity stages: 6 total, 4 open, all labelled + badged", () => {
    expect([...OPPORTUNITY_STAGES]).toEqual([
      "prospecting", "qualification", "proposal", "negotiation", "won", "lost",
    ]);
    expect([...OPEN_OPPORTUNITY_STAGES]).toEqual([
      "prospecting", "qualification", "proposal", "negotiation",
    ]);
    for (const s of OPPORTUNITY_STAGES) {
      expect(OPPORTUNITY_STAGE_LABELS[s]).toBeTruthy();
      expect(OPPORTUNITY_STAGE_BADGE[s]).toBeTruthy();
    }
  });

  it("lead statuses fully labelled + badged", () => {
    expect([...LEAD_STATUSES]).toEqual([
      "new", "contacted", "qualified", "unqualified", "converted", "lost",
    ]);
    for (const s of LEAD_STATUSES) {
      expect(LEAD_STATUS_LABELS[s]).toBeTruthy();
      expect(LEAD_STATUS_BADGE[s]).toBeTruthy();
    }
  });

  it("task statuses + priorities fully labelled", () => {
    expect([...TASK_STATUSES]).toEqual(["open", "in_progress", "completed", "cancelled"]);
    expect([...TASK_PRIORITIES]).toEqual(["low", "medium", "high", "urgent"]);
    for (const s of TASK_STATUSES) expect(TASK_STATUS_LABELS[s]).toBeTruthy();
    for (const p of TASK_PRIORITIES) expect(TASK_PRIORITY_LABELS[p]).toBeTruthy();
  });

  it("qualification statuses fully labelled + badged (matches backend enum)", () => {
    expect([...QUALIFICATION_STATUSES]).toEqual(["qualified", "nurture", "disqualified"]);
    for (const s of QUALIFICATION_STATUSES) {
      expect(QUALIFICATION_STATUS_LABELS[s]).toBeTruthy();
      expect(QUALIFICATION_STATUS_BADGE[s]).toBeTruthy();
    }
  });

  it("qualification BANT option sets mirror the backend whitelist", () => {
    expect([...QUALIFICATION_AUTHORITY]).toEqual(["decision_maker", "influencer", "none", "unknown"]);
    expect([...QUALIFICATION_NEED]).toEqual(["high", "medium", "low", "unknown"]);
    expect([...QUALIFICATION_TIMELINE]).toEqual([
      "immediate", "1_3_months", "3_6_months", "6_plus_months", "unknown",
    ]);
    for (const v of QUALIFICATION_AUTHORITY) expect(QUALIFICATION_AUTHORITY_LABELS[v]).toBeTruthy();
    for (const v of QUALIFICATION_NEED) expect(QUALIFICATION_NEED_LABELS[v]).toBeTruthy();
    for (const v of QUALIFICATION_TIMELINE) expect(QUALIFICATION_TIMELINE_LABELS[v]).toBeTruthy();
  });
});

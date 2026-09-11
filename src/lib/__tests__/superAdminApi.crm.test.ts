import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ tenantSession: null }),
  getStoredTenantToken: () => null,
  getStoredSuperAdminToken: () => "sa-test-token",
}));

import { superAdminAPI } from "@/lib/api";

type Call = { url: string; method: string; body: any; auth: string | null };
let calls: Call[] = [];

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, opts: any = {}) => {
      calls.push({
        url,
        method: opts.method ?? "GET",
        body: opts.body ? JSON.parse(opts.body) : undefined,
        auth: opts.headers?.Authorization ?? opts.headers?.authorization ?? null,
      });
      return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) } as Response;
    }),
  );
});

describe("superAdminAPI.crm client — URL / method / auth wiring", () => {
  it("GET endpoints hit /api/superadmin/crm/* with the super-admin bearer token", async () => {
    await superAdminAPI.crm.shops();
    await superAdminAPI.crm.dashboard();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET /api/superadmin/crm/shops",
      "GET /api/superadmin/crm/dashboard",
    ]);
    expect(calls.every((c) => c.auth === "Bearer sa-test-token")).toBe(true);
  });

  it("cross-shop lists have no :shopId in the URL", async () => {
    await superAdminAPI.crm.leads.list("limit=50");
    await superAdminAPI.crm.opportunities.list();
    await superAdminAPI.crm.tasks.list();
    expect(calls.map((c) => c.url)).toEqual([
      "/api/superadmin/crm/leads?limit=50",
      "/api/superadmin/crm/opportunities",
      "/api/superadmin/crm/tasks",
    ]);
  });

  it("per-shop lead actions embed :shopId in the path", async () => {
    await superAdminAPI.crm.leads.get("shopA", "l1");
    await superAdminAPI.crm.leads.create("shopA", { name: "Asha" });
    await superAdminAPI.crm.leads.assign("shopA", "l1", { assignedTo: "u2" });
    await superAdminAPI.crm.leads.qualify("shopA", "l1", { outcome: "qualified" });
    await superAdminAPI.crm.leads.promote("shopA", "l1", {});
    await superAdminAPI.crm.leads.convert("shopA", "l1");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET /api/superadmin/crm/leads/shopA/l1",
      "POST /api/superadmin/crm/leads/shopA",
      "POST /api/superadmin/crm/leads/shopA/l1/assign",
      "POST /api/superadmin/crm/leads/shopA/l1/qualify",
      "POST /api/superadmin/crm/leads/shopA/l1/promote",
      "POST /api/superadmin/crm/leads/shopA/l1/convert",
    ]);
    expect(calls[1].body).toEqual({ name: "Asha" });
  });

  it("per-shop opportunity stage/win/lose embed :shopId", async () => {
    await superAdminAPI.crm.opportunities.pipeline();
    await superAdminAPI.crm.opportunities.stage("shopA", "o1", { stage: "proposal" });
    await superAdminAPI.crm.opportunities.win("shopA", "o1");
    await superAdminAPI.crm.opportunities.lose("shopA", "o1", { reason: "budget" });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET /api/superadmin/crm/opportunities/pipeline",
      "POST /api/superadmin/crm/opportunities/shopA/o1/stage",
      "POST /api/superadmin/crm/opportunities/shopA/o1/win",
      "POST /api/superadmin/crm/opportunities/shopA/o1/lose",
    ]);
  });

  it("per-shop task complete/assign/update embed :shopId", async () => {
    await superAdminAPI.crm.tasks.complete("shopA", "t1");
    await superAdminAPI.crm.tasks.assign("shopA", "t1", { assignedTo: "u3" });
    await superAdminAPI.crm.tasks.get("shopA", "t1");
    await superAdminAPI.crm.tasks.update("shopA", "t1", { title: "New title" });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST /api/superadmin/crm/tasks/shopA/t1/complete",
      "POST /api/superadmin/crm/tasks/shopA/t1/assign",
      "GET /api/superadmin/crm/tasks/shopA/t1",
      "PATCH /api/superadmin/crm/tasks/shopA/t1",
    ]);
    expect(calls[3].body).toEqual({ title: "New title" });
  });

  it("opportunity activities/timeline embed :shopId", async () => {
    await superAdminAPI.crm.opportunities.activities("shopA", "o1");
    await superAdminAPI.crm.opportunities.addActivity("shopA", "o1", { body: "sent proposal", type: "email" });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET /api/superadmin/crm/opportunities/shopA/o1/activities",
      "POST /api/superadmin/crm/opportunities/shopA/o1/activities",
    ]);
    expect(calls[1].body).toEqual({ body: "sent proposal", type: "email" });
  });

  it("users picker is scoped to one shop", async () => {
    await superAdminAPI.crm.users("shopA");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(["GET /api/superadmin/crm/users/shopA"]);
  });

  it("lead activities/timeline embed :shopId", async () => {
    await superAdminAPI.crm.leads.activities("shopA", "l1");
    await superAdminAPI.crm.leads.addActivity("shopA", "l1", { body: "called", type: "call" });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET /api/superadmin/crm/leads/shopA/l1/activities",
      "POST /api/superadmin/crm/leads/shopA/l1/activities",
    ]);
    expect(calls[1].body).toEqual({ body: "called", type: "call" });
  });

  it("demos: cross-shop list has no :shopId, per-shop actions embed :shopId", async () => {
    await superAdminAPI.crm.demos.list("limit=50");
    await superAdminAPI.crm.demos.get("shopA", "d1");
    await superAdminAPI.crm.demos.create("shopA", { leadId: "l1", scheduledAt: "2026-01-01T10:00:00Z" });
    await superAdminAPI.crm.demos.assign("shopA", "d1", { assignedTo: "u1" });
    await superAdminAPI.crm.demos.complete("shopA", "d1", { outcome: "interested" });
    await superAdminAPI.crm.demos.cancel("shopA", "d1", { reason: "rescheduled" });
    await superAdminAPI.crm.demos.activities("shopA", "d1");
    await superAdminAPI.crm.demos.addActivity("shopA", "d1", { body: "note" });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET /api/superadmin/crm/demos?limit=50",
      "GET /api/superadmin/crm/demos/shopA/d1",
      "POST /api/superadmin/crm/demos/shopA",
      "POST /api/superadmin/crm/demos/shopA/d1/assign",
      "POST /api/superadmin/crm/demos/shopA/d1/complete",
      "POST /api/superadmin/crm/demos/shopA/d1/cancel",
      "GET /api/superadmin/crm/demos/shopA/d1/activities",
      "POST /api/superadmin/crm/demos/shopA/d1/activities",
    ]);
    expect(calls[4].body).toEqual({ outcome: "interested" });
  });

  it("quotations: byOpportunity + per-shop CRUD + status transitions", async () => {
    await superAdminAPI.crm.quotations.byOpportunity("shopA", "o1");
    await superAdminAPI.crm.quotations.create("shopA", { opportunityId: "o1", title: "Q1" });
    await superAdminAPI.crm.quotations.get("shopA", "q1");
    await superAdminAPI.crm.quotations.update("shopA", "q1", { title: "Q1 revised" });
    await superAdminAPI.crm.quotations.send("shopA", "q1");
    await superAdminAPI.crm.quotations.accept("shopA", "q1");
    await superAdminAPI.crm.quotations.reject("shopA", "q1");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET /api/superadmin/crm/quotations/by-opportunity/shopA/o1",
      "POST /api/superadmin/crm/quotations/shopA",
      "GET /api/superadmin/crm/quotations/shopA/q1",
      "PATCH /api/superadmin/crm/quotations/shopA/q1",
      "POST /api/superadmin/crm/quotations/shopA/q1/send",
      "POST /api/superadmin/crm/quotations/shopA/q1/accept",
      "POST /api/superadmin/crm/quotations/shopA/q1/reject",
    ]);
    expect(calls[1].body).toEqual({ opportunityId: "o1", title: "Q1" });
  });
});

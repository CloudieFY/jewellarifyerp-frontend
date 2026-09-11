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

  it("per-shop task complete/assign embed :shopId", async () => {
    await superAdminAPI.crm.tasks.complete("shopA", "t1");
    await superAdminAPI.crm.tasks.assign("shopA", "t1", { assignedTo: "u3" });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST /api/superadmin/crm/tasks/shopA/t1/complete",
      "POST /api/superadmin/crm/tasks/shopA/t1/assign",
    ]);
  });
});

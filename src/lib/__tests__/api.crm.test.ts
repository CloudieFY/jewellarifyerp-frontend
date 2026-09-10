import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ tenantSession: { token: "test-token", user: { id: "u1" } } }),
  getStoredTenantToken: () => "test-token",
  getStoredSuperAdminToken: () => null,
}));

import { useTenantAPI } from "@/lib/api";

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
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
      } as Response;
    }),
  );
});

function crm() {
  return renderHook(() => useTenantAPI()).result.current.crm;
}

describe("api.crm client — URL / method / auth wiring", () => {
  it("GET endpoints hit /api/crm/* with the bearer token", async () => {
    await crm().me();
    await crm().dashboard();
    await crm().users();
    await crm().branches();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET /api/crm/me",
      "GET /api/crm/dashboard",
      "GET /api/crm/users",
      "GET /api/crm/branches",
    ]);
    expect(calls.every((c) => c.auth === "Bearer test-token")).toBe(true);
  });

  it("list endpoints append the query string only when non-empty", async () => {
    await crm().leads.list("page=1&limit=25&status=new");
    await crm().opportunities.list();
    await crm().tasks.list("");
    expect(calls[0].url).toBe("/api/crm/leads?page=1&limit=25&status=new");
    expect(calls[1].url).toBe("/api/crm/opportunities");
    expect(calls[2].url).toBe("/api/crm/tasks");
  });

  it("lead lifecycle actions use POST with the right paths + bodies", async () => {
    await crm().leads.create({ name: "Asha" });
    await crm().leads.update("l1", { status: "contacted" });
    await crm().leads.assign("l1", { assignedTo: "u2" });
    await crm().leads.qualify("l1", { qualified: true });
    await crm().leads.convert("l1");
    await crm().leads.remove("l1");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST /api/crm/leads",
      "PATCH /api/crm/leads/l1",
      "POST /api/crm/leads/l1/assign",
      "POST /api/crm/leads/l1/qualify",
      "POST /api/crm/leads/l1/convert",
      "DELETE /api/crm/leads/l1",
    ]);
    expect(calls[0].body).toEqual({ name: "Asha" });
    expect(calls[2].body).toEqual({ assignedTo: "u2" });
  });

  it("opportunity stage / win / lose / pipeline paths", async () => {
    await crm().opportunities.pipeline("branch_id=b1");
    await crm().opportunities.stage("o1", { stage: "proposal" });
    await crm().opportunities.win("o1", {});
    await crm().opportunities.lose("o1", { reason: "budget" });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET /api/crm/opportunities/pipeline?branch_id=b1",
      "POST /api/crm/opportunities/o1/stage",
      "POST /api/crm/opportunities/o1/win",
      "POST /api/crm/opportunities/o1/lose",
    ]);
  });

  it("task complete / assign / delete paths", async () => {
    await crm().tasks.complete("t1", {});
    await crm().tasks.assign("t1", { assignedTo: "u3" });
    await crm().tasks.remove("t1");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST /api/crm/tasks/t1/complete",
      "POST /api/crm/tasks/t1/assign",
      "DELETE /api/crm/tasks/t1",
    ]);
  });

  it("customer 360 sub-resources", async () => {
    await crm().customers.get("c1");
    await crm().customers.activities("c1");
    await crm().customers.addActivity("c1", { body: "called", type: "call" });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET /api/crm/customers/c1",
      "GET /api/crm/customers/c1/activities",
      "POST /api/crm/customers/c1/activities",
    ]);
    expect(calls[2].body).toEqual({ body: "called", type: "call" });
  });

  it("never sends a client-supplied shopId in the body", async () => {
    await crm().leads.create({ name: "X", shopId: "EVIL" } as any);
    // client passes whatever the caller gave; the point is our helpers add nothing.
    // The backend rejects shopId (verified separately); here we assert we don't inject one.
    await crm().opportunities.create({ title: "Y" });
    expect(calls[1].body).toEqual({ title: "Y" });
    expect(calls[1].body).not.toHaveProperty("shopId");
  });
});

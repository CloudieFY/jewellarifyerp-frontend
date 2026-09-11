import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const dashboardFn = vi.fn();
const leadsListFn = vi.fn();
const leadGetFn = vi.fn();
const leadActivitiesFn = vi.fn();
const leadAddActivityFn = vi.fn();
const usersFn = vi.fn();
const oppPipelineFn = vi.fn();
const oppListFn = vi.fn();
const oppGetFn = vi.fn();
const oppActivitiesFn = vi.fn();
const tasksListFn = vi.fn();
const taskGetFn = vi.fn();
const demosListFn = vi.fn();
const demoGetFn = vi.fn();
const demoActivitiesFn = vi.fn();
const quotationsByOpportunityFn = vi.fn();

vi.mock("@/lib/api", () => ({
  superAdminAPI: {
    crm: {
      dashboard: () => dashboardFn(),
      users: (shopId: string) => usersFn(shopId),
      leads: {
        list: () => leadsListFn(),
        get: (shopId: string, id: string) => leadGetFn(shopId, id),
        activities: (shopId: string, id: string) => leadActivitiesFn(shopId, id),
        addActivity: (shopId: string, id: string, body: any) => leadAddActivityFn(shopId, id, body),
        qualify: vi.fn(),
        assign: vi.fn(),
        promote: vi.fn(),
        convert: vi.fn(),
      },
      opportunities: {
        pipeline: () => oppPipelineFn(),
        list: () => oppListFn(),
        get: (shopId: string, id: string) => oppGetFn(shopId, id),
        activities: (shopId: string, id: string) => oppActivitiesFn(shopId, id),
        addActivity: vi.fn(),
        assign: vi.fn(),
        stage: vi.fn(),
        win: vi.fn(),
        lose: vi.fn(),
      },
      tasks: {
        list: () => tasksListFn(),
        get: (shopId: string, id: string) => taskGetFn(shopId, id),
        complete: vi.fn(),
        create: vi.fn(),
        assign: vi.fn(),
        update: vi.fn(),
      },
      demos: {
        list: () => demosListFn(),
        get: (shopId: string, id: string) => demoGetFn(shopId, id),
        activities: (shopId: string, id: string) => demoActivitiesFn(shopId, id),
        addActivity: vi.fn(),
        assign: vi.fn(),
        complete: vi.fn(),
        cancel: vi.fn(),
        create: vi.fn(),
      },
      quotations: {
        byOpportunity: (shopId: string, oppId: string) => quotationsByOpportunityFn(shopId, oppId),
        create: vi.fn(),
        send: vi.fn(),
        accept: vi.fn(),
        reject: vi.fn(),
      },
    },
  },
}));

import SuperAdminCrmDashboardPage from "@/routes/superadmin/crm/dashboard";
import SuperAdminCrmLeadsPage from "@/routes/superadmin/crm/leads";
import SuperAdminCrmLeadDetailsPage from "@/routes/superadmin/crm/lead-details";
import SuperAdminCrmPipelinePage from "@/routes/superadmin/crm/pipeline";
import SuperAdminCrmOpportunityDetailsPage from "@/routes/superadmin/crm/opportunity-details";
import SuperAdminCrmTasksPage from "@/routes/superadmin/crm/tasks";
import SuperAdminCrmTaskDetailsPage from "@/routes/superadmin/crm/task-details";
import SuperAdminCrmDemosPage from "@/routes/superadmin/crm/demos";
import SuperAdminCrmDemoDetailsPage from "@/routes/superadmin/crm/demo-details";

describe("Super Admin CRM pages — cross-shop smoke tests", () => {
  it("dashboard shows the by-shop rollup with shop names", async () => {
    dashboardFn.mockResolvedValue({
      leads: { total: 5, new: 1, contacted: 1, qualified: 1, unqualified: 0, converted: 1, lost: 1, last30: 2 },
      opportunities: { open: 2, won: 1, lost: 0, openValue: 1000, wonValue: 500, wonValue30: 500 },
      tasks: { pending: 3, overdue: 1, dueToday: 0, completed30: 2 },
      byShop: [{ shopId: "s1", shopName: "Acme Jewellers", leadCount: 3, openOpportunityCount: 1, wonValue: 500 }],
      recentActivity: [{ id: "a1", shopName: "Acme Jewellers", body: "Lead created" }],
    });
    render(<SuperAdminCrmDashboardPage />);
    await waitFor(() => expect(screen.getByText("Acme Jewellers")).toBeInTheDocument());
    expect(screen.getByText("5")).toBeInTheDocument(); // total leads stat
  });

  it("leads page lists cross-shop rows with a Shop column", async () => {
    leadsListFn.mockResolvedValue({
      data: [{ id: "l1", shopId: "s1", shopName: "Acme Jewellers", name: "Test Lead", phone: "999", source: "walk_in", status: "new", createdAt: new Date().toISOString() }],
      page: 1, limit: 50, total: 1, totalPages: 1,
    });
    render(<MemoryRouter><SuperAdminCrmLeadsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Test Lead")).toBeInTheDocument());
    expect(screen.getByText("Acme Jewellers")).toBeInTheDocument();
  });

  it("pipeline page shows stage summary and open opportunities across shops", async () => {
    oppPipelineFn.mockResolvedValue({
      stages: [{ stage: "prospecting", count: 2, amount: 10000 }],
      open: { count: 2, amount: 10000 },
      won: { stage: "won", count: 0, amount: 0 },
      lost: { stage: "lost", count: 0, amount: 0 },
    });
    oppListFn.mockResolvedValue({
      data: [{ id: "o1", shopId: "s1", shopName: "Acme Jewellers", title: "Big Deal", stage: "prospecting", amount: 10000, expectedCloseDate: null }],
      page: 1, limit: 50, total: 1, totalPages: 1,
    });
    render(<MemoryRouter><SuperAdminCrmPipelinePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Big Deal")).toBeInTheDocument());
    expect(screen.getByText("Acme Jewellers")).toBeInTheDocument();
  });

  it("tasks page lists cross-shop tasks with a Complete action", async () => {
    tasksListFn.mockResolvedValue({
      data: [{ id: "t1", shopId: "s1", shopName: "Acme Jewellers", title: "Follow up", priority: "medium", status: "open", dueAt: null }],
      page: 1, limit: 50, total: 1, totalPages: 1,
    });
    render(<MemoryRouter><SuperAdminCrmTasksPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Follow up")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Complete/i })).toBeInTheDocument();
  });

  it("lead details page loads the lead, its activities, follow-ups and the shop's users", async () => {
    leadGetFn.mockResolvedValue({
      id: "l1", name: "Test Lead", phone: "999", email: null, source: "walk_in", status: "new",
      qualificationStatus: null, assignedTo: null,
    });
    leadActivitiesFn.mockResolvedValue({ data: [{ id: "a1", type: "note", body: "First contact", createdAt: new Date().toISOString() }], total: 1 });
    tasksListFn.mockResolvedValue({ data: [{ id: "t1", title: "Call back", status: "open" }], page: 1, limit: 50, total: 1, totalPages: 1 });
    usersFn.mockResolvedValue([{ id: "u1", name: "Priya" }]);

    render(
      <MemoryRouter initialEntries={["/superadmin/crm/leads/s1/l1"]}>
        <Routes>
          <Route path="/superadmin/crm/leads/:shopId/:id" element={<SuperAdminCrmLeadDetailsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("Test Lead")).toBeInTheDocument());
    expect(leadGetFn).toHaveBeenCalledWith("s1", "l1");
    expect(leadActivitiesFn).toHaveBeenCalledWith("s1", "l1");
    expect(usersFn).toHaveBeenCalledWith("s1");
    expect(screen.getByText("First contact")).toBeInTheDocument();
    expect(screen.getByText("Call back")).toBeInTheDocument();
    // the assignee <Select> only mounts its options once opened (Radix portal) —
    // the fetch-and-wire-up is what matters here, already asserted above via usersFn.
  });

  it("opportunity details page loads the opportunity, its activities and follow-ups", async () => {
    oppGetFn.mockResolvedValue({
      id: "o1", title: "Big Deal", stage: "prospecting", amount: 10000, probability: 40,
      leadId: null, customerId: null, assignedTo: null, expectedCloseDate: null,
    });
    oppActivitiesFn.mockResolvedValue({ data: [{ id: "a1", type: "email", body: "Sent proposal", createdAt: new Date().toISOString() }], total: 1 });
    tasksListFn.mockResolvedValue({ data: [{ id: "t1", title: "Chase signature", status: "open" }], page: 1, limit: 50, total: 1, totalPages: 1 });
    usersFn.mockResolvedValue([{ id: "u1", name: "Priya" }]);
    quotationsByOpportunityFn.mockResolvedValue([{ id: "q1", title: "Initial Quote", amount: 5000, status: "draft", validUntil: null }]);

    render(
      <MemoryRouter initialEntries={["/superadmin/crm/opportunities/s1/o1"]}>
        <Routes>
          <Route path="/superadmin/crm/opportunities/:shopId/:id" element={<SuperAdminCrmOpportunityDetailsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("Big Deal")).toBeInTheDocument());
    expect(oppGetFn).toHaveBeenCalledWith("s1", "o1");
    expect(oppActivitiesFn).toHaveBeenCalledWith("s1", "o1");
    expect(quotationsByOpportunityFn).toHaveBeenCalledWith("s1", "o1");
    expect(screen.getByText("Sent proposal")).toBeInTheDocument();
    expect(screen.getByText("Chase signature")).toBeInTheDocument();
    expect(screen.getByText("Initial Quote")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Send$/i })).toBeInTheDocument();
  });

  it("task details page loads the task and lets it be edited", async () => {
    taskGetFn.mockResolvedValue({
      id: "t1", title: "Chase signature", description: null, status: "open", priority: "medium",
      dueAt: null, relatedType: null, relatedId: null, assignedTo: null, completedAt: null,
    });
    usersFn.mockResolvedValue([{ id: "u1", name: "Priya" }]);

    render(
      <MemoryRouter initialEntries={["/superadmin/crm/tasks/s1/t1"]}>
        <Routes>
          <Route path="/superadmin/crm/tasks/:shopId/:id" element={<SuperAdminCrmTaskDetailsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByDisplayValue("Chase signature")).toBeInTheDocument());
    expect(taskGetFn).toHaveBeenCalledWith("s1", "t1");
    expect(screen.getByRole("button", { name: /Mark Complete/i })).toBeInTheDocument();
  });

  it("demos page lists cross-shop rows with a Shop column", async () => {
    demosListFn.mockResolvedValue({
      data: [{ id: "d1", shopId: "s1", shopName: "Acme Jewellers", scheduledAt: new Date().toISOString(), mode: "in_store", status: "scheduled", outcome: null }],
      page: 1, limit: 50, total: 1, totalPages: 1,
    });
    render(<MemoryRouter><SuperAdminCrmDemosPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Acme Jewellers")).toBeInTheDocument());
    expect(screen.getByText("in_store")).toBeInTheDocument();
  });

  it("demo details page loads the demo, its linked lead/opportunity, activities and follow-ups", async () => {
    demoGetFn.mockResolvedValue({
      id: "d1", scheduledAt: new Date().toISOString(), status: "scheduled", mode: "video_call",
      outcome: null, nextAction: null, notes: null, leadId: "l1", opportunityId: "o1", customerId: null, assignedTo: null,
    });
    demoActivitiesFn.mockResolvedValue({ data: [{ id: "a1", type: "call", body: "Reminded customer", createdAt: new Date().toISOString() }], total: 1 });
    tasksListFn.mockResolvedValue({ data: [{ id: "t1", title: "Send catalog", status: "open" }], page: 1, limit: 50, total: 1, totalPages: 1 });
    usersFn.mockResolvedValue([{ id: "u1", name: "Priya" }]);
    leadGetFn.mockResolvedValue({ id: "l1", name: "Linked Lead" });
    oppGetFn.mockResolvedValue({ id: "o1", title: "Linked Opportunity" });

    render(
      <MemoryRouter initialEntries={["/superadmin/crm/demos/s1/d1"]}>
        <Routes>
          <Route path="/superadmin/crm/demos/:shopId/:id" element={<SuperAdminCrmDemoDetailsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(demoGetFn).toHaveBeenCalledWith("s1", "d1"));
    expect(demoActivitiesFn).toHaveBeenCalledWith("s1", "d1");
    await waitFor(() => expect(screen.getByText("Reminded customer")).toBeInTheDocument());
    expect(screen.getByText("Send catalog")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Linked Lead")).toBeInTheDocument());
    expect(screen.getByText("Linked Opportunity")).toBeInTheDocument();
  });
});

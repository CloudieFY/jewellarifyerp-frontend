import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const dashboardFn = vi.fn();
const leadsListFn = vi.fn();
const oppPipelineFn = vi.fn();
const oppListFn = vi.fn();
const tasksListFn = vi.fn();

vi.mock("@/lib/api", () => ({
  superAdminAPI: {
    crm: {
      dashboard: () => dashboardFn(),
      leads: { list: () => leadsListFn() },
      opportunities: { pipeline: () => oppPipelineFn(), list: () => oppListFn() },
      tasks: { list: () => tasksListFn(), complete: vi.fn() },
    },
  },
}));

import SuperAdminCrmDashboardPage from "@/routes/superadmin/crm/dashboard";
import SuperAdminCrmLeadsPage from "@/routes/superadmin/crm/leads";
import SuperAdminCrmPipelinePage from "@/routes/superadmin/crm/pipeline";
import SuperAdminCrmTasksPage from "@/routes/superadmin/crm/tasks";

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
      data: [{ id: "l1", shopName: "Acme Jewellers", name: "Test Lead", phone: "999", source: "walk_in", status: "new", createdAt: new Date().toISOString() }],
      page: 1, limit: 50, total: 1, totalPages: 1,
    });
    render(<SuperAdminCrmLeadsPage />);
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
      data: [{ id: "o1", shopName: "Acme Jewellers", title: "Big Deal", stage: "prospecting", amount: 10000, expectedCloseDate: null }],
      page: 1, limit: 50, total: 1, totalPages: 1,
    });
    render(<SuperAdminCrmPipelinePage />);
    await waitFor(() => expect(screen.getByText("Big Deal")).toBeInTheDocument());
    expect(screen.getByText("Acme Jewellers")).toBeInTheDocument();
  });

  it("tasks page lists cross-shop tasks with a Complete action", async () => {
    tasksListFn.mockResolvedValue({
      data: [{ id: "t1", shopId: "s1", shopName: "Acme Jewellers", title: "Follow up", priority: "medium", status: "open", dueAt: null }],
      page: 1, limit: 50, total: 1, totalPages: 1,
    });
    render(<SuperAdminCrmTasksPage />);
    await waitFor(() => expect(screen.getByText("Follow up")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Complete/i })).toBeInTheDocument();
  });
});

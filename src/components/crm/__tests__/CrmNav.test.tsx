import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const canFn = vi.fn();
vi.mock("@/components/crm/Can", () => ({
  useCan: () => canFn,
}));

import { CrmNav } from "@/components/crm/CrmNav";

const renderNav = () =>
  render(
    <MemoryRouter initialEntries={["/crm/leads"]}>
      <CrmNav />
    </MemoryRouter>,
  );

beforeEach(() => canFn.mockReset());

describe("CrmNav — permission-gated section nav", () => {
  it("shows every tab when the user can view everything", () => {
    canFn.mockReturnValue(true);
    renderNav();
    for (const label of ["Dashboard", "Leads", "Pipeline", "Opportunities", "Tasks", "Customers"]) {
      expect(screen.getByRole("link", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("hides tabs the user lacks the matching *.view permission for", () => {
    // deny lead.view + report.view; allow the rest
    canFn.mockImplementation((entity: string, action: string) => {
      if (action !== "view") return false;
      if (entity === "lead") return false;
      if (entity === "report") return false;
      return true; // opportunity.view, task.view, customer.view
    });
    renderNav();
    expect(screen.queryByRole("link", { name: /Dashboard/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Leads/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pipeline/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Opportunities/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tasks/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Customers/ })).toBeInTheDocument();
  });

  it("renders nothing when the user can view no CRM section", () => {
    canFn.mockReturnValue(false);
    const { container } = renderNav();
    expect(container.querySelector("nav")).toBeNull();
  });

  it("wires each tab to its CRM route", () => {
    canFn.mockReturnValue(true);
    renderNav();
    expect(screen.getByRole("link", { name: /Leads/ })).toHaveAttribute("href", "/crm/leads");
    expect(screen.getByRole("link", { name: /Pipeline/ })).toHaveAttribute("href", "/crm/pipeline");
    expect(screen.getByRole("link", { name: /Customers/ })).toHaveAttribute("href", "/customers");
  });
});

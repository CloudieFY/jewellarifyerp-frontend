import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const useCrmMe = vi.fn();
vi.mock("@/components/crm/Can", () => ({
  useCrmMe: () => useCrmMe(),
}));

import { CrmGuard } from "@/components/crm/CrmGuard";

function renderAt(entry = "/crm/leads") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/crm/leads" element={<CrmGuard><div>CRM CONTENT</div></CrmGuard>} />
        <Route path="/dashboard" element={<div>ERP DASHBOARD</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => useCrmMe.mockReset());

describe("CrmGuard — /crm/* access gate", () => {
  it("shows a loading state while /api/crm/me is in flight (no redirect flash)", () => {
    useCrmMe.mockReturnValue({ isLoading: true, data: undefined });
    renderAt();
    expect(screen.queryByText("CRM CONTENT")).not.toBeInTheDocument();
    expect(screen.queryByText("ERP DASHBOARD")).not.toBeInTheDocument();
    expect(screen.getByText(/Loading/)).toBeInTheDocument();
  });

  it("redirects to /dashboard when the user has no CRM access", () => {
    useCrmMe.mockReturnValue({ isLoading: false, data: { hasCrmAccess: false, permissions: [] } });
    renderAt();
    expect(screen.getByText("ERP DASHBOARD")).toBeInTheDocument();
    expect(screen.queryByText("CRM CONTENT")).not.toBeInTheDocument();
  });

  it("renders the CRM screen when the user has CRM access", () => {
    useCrmMe.mockReturnValue({ isLoading: false, data: { hasCrmAccess: true, permissions: ["lead.view"] } });
    renderAt();
    expect(screen.getByText("CRM CONTENT")).toBeInTheDocument();
  });

  it("fails open (renders children) if /api/crm/me errored — backend still 403s every call", () => {
    useCrmMe.mockReturnValue({ isLoading: false, data: undefined, isError: true });
    renderAt();
    expect(screen.getByText("CRM CONTENT")).toBeInTheDocument();
  });
});

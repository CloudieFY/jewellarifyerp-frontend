import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/*  Mocks: drive Can/useCan purely through a fake GET /api/crm/me      */
/* ------------------------------------------------------------------ */
const meFn = vi.fn();
vi.mock("@/lib/api", () => ({
  useTenantAPI: () => ({ crm: { me: meFn } }),
}));

let mockSession: any = { token: "t", user: { id: "u1", role: "operator" } };
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ tenantSession: mockSession }),
}));

import { useCan, useHasCrmAccess, Can } from "@/components/crm/Can";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function CanProbe({ entity, action }: { entity: string; action: string }) {
  const can = useCan();
  return <span data-testid="out">{String(can(entity, action))}</span>;
}
function AccessProbe() {
  return <span data-testid="access">{String(useHasCrmAccess())}</span>;
}

beforeEach(() => {
  meFn.mockReset();
  mockSession = { token: "t", user: { id: "u1", role: "operator" } };
});

describe("useCan — driven by /api/crm/me permissions", () => {
  it("grants an exact <entity>.<action> permission", async () => {
    meFn.mockResolvedValue({
      user: { id: "u1", role: "operator" },
      permissions: ["lead.view", "lead.create"],
      hasCrmAccess: true,
      branchIds: [],
    });
    render(<CanProbe entity="lead" action="view" />, { wrapper });
    await waitFor(() => expect(screen.getByTestId("out").textContent).toBe("true"));
  });

  it("denies an action the user does not hold", async () => {
    meFn.mockResolvedValue({
      user: { id: "u1", role: "operator" },
      permissions: ["lead.view"],
      hasCrmAccess: true,
      branchIds: [],
    });
    render(<CanProbe entity="lead" action="delete" />, { wrapper });
    await waitFor(() => expect(meFn).toHaveBeenCalled());
    // operator with a non-empty perm list and no owner fallback → denied
    await waitFor(() => expect(screen.getByTestId("out").textContent).toBe("false"));
  });

  it("honours an <entity>.* wildcard", async () => {
    meFn.mockResolvedValue({
      user: { id: "u1", role: "operator" },
      permissions: ["opportunity.*"],
      hasCrmAccess: true,
      branchIds: [],
    });
    render(<CanProbe entity="opportunity" action="win" />, { wrapper });
    await waitFor(() => expect(screen.getByTestId("out").textContent).toBe("true"));
  });

  it("honours the global * permission", async () => {
    meFn.mockResolvedValue({
      user: { id: "u1", role: "owner" },
      permissions: ["*"],
      hasCrmAccess: true,
      branchIds: [],
    });
    render(<CanProbe entity="task" action="delete" />, { wrapper });
    await waitFor(() => expect(screen.getByTestId("out").textContent).toBe("true"));
  });

  it("owner is optimistically allowed while /api/crm/me is still loading", async () => {
    mockSession = { token: "t", user: { id: "u1", role: "owner" } };
    meFn.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<CanProbe entity="lead" action="delete" />, { wrapper });
    await waitFor(() => expect(screen.getByTestId("out").textContent).toBe("true"));
  });

  it("non-owner with no session permissions is denied while loading (fails closed)", async () => {
    mockSession = { token: "t", user: { id: "u1", role: "operator" } };
    meFn.mockImplementation(() => new Promise(() => {}));
    render(<CanProbe entity="lead" action="view" />, { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByTestId("out").textContent).toBe("false");
  });
});

describe("useHasCrmAccess", () => {
  it("true when /api/crm/me says hasCrmAccess", async () => {
    meFn.mockResolvedValue({ user: { id: "u1", role: "operator" }, permissions: ["lead.view"], hasCrmAccess: true, branchIds: [] });
    render(<AccessProbe />, { wrapper });
    await waitFor(() => expect(screen.getByTestId("access").textContent).toBe("true"));
  });

  it("false when /api/crm/me says no access", async () => {
    meFn.mockResolvedValue({ user: { id: "u1", role: "operator" }, permissions: [], hasCrmAccess: false, branchIds: [] });
    render(<AccessProbe />, { wrapper });
    await waitFor(() => expect(screen.getByTestId("access").textContent).toBe("false"));
  });
});

describe("<Can>", () => {
  it("renders children only when permitted, else fallback", async () => {
    meFn.mockResolvedValue({ user: { id: "u1", role: "operator" }, permissions: ["lead.create"], hasCrmAccess: true, branchIds: [] });
    render(
      <>
        <Can entity="lead" action="create"><span>NEW-LEAD-BTN</span></Can>
        <Can entity="lead" action="delete" fallback={<span>NO-DELETE</span>}><span>DEL-BTN</span></Can>
      </>,
      { wrapper },
    );
    await waitFor(() => expect(screen.getByText("NEW-LEAD-BTN")).toBeInTheDocument());
    expect(screen.queryByText("DEL-BTN")).not.toBeInTheDocument();
    expect(screen.getByText("NO-DELETE")).toBeInTheDocument();
  });
});

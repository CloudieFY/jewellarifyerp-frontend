import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import { LanguageProvider } from "@/context/LanguageContext";
import "@/lib/i18n";
import LoginPage from "./routes/login";
import DashboardPage from "./routes/index";
import LandingPage from "./routes/LandingPage";
import BillingPage from "./routes/billing";
import SalesPage from "./routes/sales";
import DuesPage from "./routes/dues";
import InventoryPage from "./routes/inventory";
import CatalogPage from "./routes/catalog";
import CustomersPage from "./routes/customers";
import SuppliersPage from "./routes/suppliers";
import KarigarsPage from "./routes/karigars";
import KarigarTasksPage from "./routes/karigar-tasks";
import GirviPage from "./routes/girvi";
import ForwardedShopsPage from "./routes/forwarded-shops";
import ExpensesPage from "./routes/expenses";
import PurchasesPage from "./routes/purchases";
import OrdersPage from "./routes/orders";
import RepairsPage from "./routes/repairs";
import GoldRatesPage from "./routes/gold-rates";
import CalculatorPage from "./routes/calculator";
import ReportsPage from "./routes/reports";
import GstReportPage from "./routes/gst-report";
import EmployeesPage from "./routes/employees";
import NotificationsPage from "./routes/notifications";
import ProfilePage from "./routes/profile";
import InvoiceDesignerPage from "./routes/invoice-designer";
import LedgerPage from "./routes/ledger";
import BalanceSheetPage from "./routes/balance-sheet";

import SuperAdminLoginPage from "./routes/superadmin-login";
import SuperAdminDashboardPage from "./routes/superadmin-dashboard";
import SuperAdminDemoRequestsPage from "./routes/superadmin-demo-requests";
import AboutPage from "./routes/AboutPage";
import GirviFeaturePage from "./routes/GirviFeaturePage";
import ContactPage from "./routes/ContactPage";
import PrivacyPolicyPage from "./routes/PrivacyPolicyPage";
import TermsAndConditionsPage from "./routes/TermsAndConditionsPage";
import ProductViewerPage from "./routes/ProductViewerPage";
import InvoiceViewerPage from "./routes/InvoiceViewerPage";
import { NotFoundPage } from "./routes/NotFoundPage";
import { SuperAdminLayout } from "./components/SuperAdminLayout";

import { isRouteAllowed } from "@/lib/subscriptionModules";
import { AccessDenied } from "@/components/AccessDenied";

/**
 * A guard wrapper component to enforce page-level subscription permissions.
 */
function SubscriptionRouteGuard({
  route,
  element,
  pageName,
}: {
  route: string;
  element: React.ReactElement;
  pageName?: string;
}) {
  const { tenantSession } = useAuth();
  const plan = tenantSession?.shop?.plan;
  const allowedPages = tenantSession?.shop?.allowedPages;
  const allowedModules = tenantSession?.shop?.allowedModules;

  if (!isRouteAllowed(route, plan, allowedPages, allowedModules)) {
    return <AccessDenied pageName={pageName || "This Feature"} />;
  }

  return element;
}

/**
 * The main application component that handles routing.
 * It uses the AuthContext to decide whether to show the login page
 * or the main application content.
 */
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <LanguageProvider>
        <Routes>
          {/* Public-facing routes */}
          <Route path="/" element={<PublicRouteWrapper><LandingPage /></PublicRouteWrapper>} />
          <Route path="/login" element={<PublicRouteWrapper><LoginPage /></PublicRouteWrapper>} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/features/girvi" element={<GirviFeaturePage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditionsPage />} />
          <Route path="/view-product/:dbName/:inventoryId" element={<ProductViewerPage />} />
          <Route path="/v/:inventoryId" element={<ProductViewerPage />} />
          <Route path="/v-bill/:invoiceId" element={<InvoiceViewerPage />} />
          <Route path="/view-invoice/:dbName/:invoiceId" element={<InvoiceViewerPage />} />

          {/* Super Admin Aliases & Routes */}
          <Route path="/superadmin/login" element={<SuperAdminLoginPage />} />
          <Route path="/super-admin-login" element={<Navigate to="/superadmin/login" replace />} />
          <Route path="/superadmin-login" element={<Navigate to="/superadmin/login" replace />} />
          <Route path="/super-admin" element={<Navigate to="/superadmin/login" replace />} />
          <Route path="/admin-login" element={<Navigate to="/superadmin/login" replace />} />
          <Route
            path="/superadmin/*"
            element={
              <SuperAdminProtectedRoute>
                <Routes>
                  <Route element={<SuperAdminLayout />}>
                    <Route path="/" element={<SuperAdminDashboardPage />} />
                    <Route path="/demo-requests" element={<SuperAdminDemoRequestsPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Routes>
              </SuperAdminProtectedRoute>
            }
          />

          {/* Tenant (Shop) Routes */}
          <Route
            path="/*"
            element={
              <TenantProtectedRoute>
                <Routes>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/billing" element={<SubscriptionRouteGuard route="/billing" pageName="Billing POS" element={<BillingPage />} />} />
                  <Route path="/estimate" element={<SubscriptionRouteGuard route="/billing" pageName="Billing POS" element={<BillingPage />} />} />
                  <Route path="/sales" element={<SubscriptionRouteGuard route="/sales" pageName="Sales Invoices" element={<SalesPage />} />} />
                  <Route path="/dues" element={<SubscriptionRouteGuard route="/dues" pageName="Customer Dues" element={<DuesPage />} />} />
                  <Route path="/inventory" element={<SubscriptionRouteGuard route="/inventory" pageName="Stock & Tag Management" element={<InventoryPage />} />} />
                  <Route path="/catalog" element={<SubscriptionRouteGuard route="/catalog" pageName="Product Catalog" element={<CatalogPage />} />} />
                  <Route path="/customers" element={<SubscriptionRouteGuard route="/customers" pageName="Customer Directory" element={<CustomersPage />} />} />
                  <Route path="/suppliers" element={<SubscriptionRouteGuard route="/suppliers" pageName="Suppliers & Wholesale" element={<SuppliersPage />} />} />
                  <Route path="/karigars" element={<SubscriptionRouteGuard route="/karigars" pageName="Karigars & Artisans" element={<KarigarsPage />} />} />
                  <Route path="/karigar-tasks" element={<SubscriptionRouteGuard route="/karigar-tasks" pageName="Karigar Tasks & Work Slips" element={<KarigarTasksPage />} />} />
                  <Route path="/girvi" element={<SubscriptionRouteGuard route="/girvi" pageName="Girvi Pawn Loans" element={<GirviPage />} />} />
                  <Route path="/forwarded-shops" element={<SubscriptionRouteGuard route="/forwarded-shops" pageName="Forwarded Shops / B2B" element={<ForwardedShopsPage />} />} />
                  <Route path="/expenses" element={<SubscriptionRouteGuard route="/expenses" pageName="Showroom Expenses" element={<ExpensesPage />} />} />
                  <Route path="/purchases" element={<SubscriptionRouteGuard route="/purchases" pageName="Purchases & Stock In" element={<PurchasesPage />} />} />
                  <Route path="/orders" element={<SubscriptionRouteGuard route="/orders" pageName="Custom Customer Orders" element={<OrdersPage />} />} />
                  <Route path="/repairs" element={<SubscriptionRouteGuard route="/repairs" pageName="Repairs & Servicing" element={<RepairsPage />} />} />
                  <Route path="/gold-rates" element={<SubscriptionRouteGuard route="/gold-rates" pageName="Live Gold & Silver Rates" element={<GoldRatesPage />} />} />
                  <Route path="/calculator" element={<SubscriptionRouteGuard route="/calculator" pageName="Rate Calculator" element={<CalculatorPage />} />} />
                  <Route path="/reports" element={<SubscriptionRouteGuard route="/reports" pageName="Analytics & Reports" element={<ReportsPage />} />} />
                  <Route path="/gst-report" element={<SubscriptionRouteGuard route="/gst-report" pageName="GST Tax Reports" element={<GstReportPage />} />} />
                  <Route path="/employees" element={<SubscriptionRouteGuard route="/employees" pageName="Staff & Employees" element={<EmployeesPage />} />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/invoice-designer" element={<SubscriptionRouteGuard route="/invoice-designer" pageName="Invoice Designer" element={<InvoiceDesignerPage />} />} />
                  <Route path="/ledger" element={<SubscriptionRouteGuard route="/ledger" pageName="Daily Cash Ledger" element={<LedgerPage />} />} />
                  <Route path="/balance-sheet" element={<SubscriptionRouteGuard route="/balance-sheet" pageName="Balance Sheet" element={<BalanceSheetPage />} />} />
                  <Route path="*" element={<NotFoundPage insideTenant={true} />} />
                </Routes>
              </TenantProtectedRoute>
            }
          />
        </Routes>
        <Toaster richColors />
      </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

/**
 * A component to protect tenant routes. If the user is not logged in,
 * it renders the LoginPage. Otherwise, it renders the child routes.
 */
function TenantProtectedRoute({ children }: { children: React.ReactNode }) {
  const { tenantSession } = useAuth();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // This effect gives the AuthProvider a moment to load the session from localStorage
    setIsChecking(false);
  }, []);

  if (isChecking) {
    return <div>Loading...</div>; // Or a proper spinner component
  }

  if (!tenantSession) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/**
 * A wrapper for public routes. If the user is already logged in,
 * it redirects them to the dashboard.
 */
function PublicRouteWrapper({ children }: { children: React.ReactElement }) {
  const { tenantSession, isLoading } = useAuth();

  if (isLoading) {
    return <div className="h-screen w-screen flex items-center justify-center">Loading...</div>;
  }

  if (tenantSession) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
/**
 * A component to protect super admin routes. If the super admin is not
 * logged in, it redirects to the super admin login page.
 */
function SuperAdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { superAdminSession, isLoading } = useAuth();

  if (isLoading) {
    return <div className="h-screen w-screen flex items-center justify-center">Loading...</div>;
  }

  if (!superAdminSession) {
    return <Navigate to="/superadmin/login" replace />;
  }

  return <>{children}</>;
}

export default App;
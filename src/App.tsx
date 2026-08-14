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
import { SuperAdminLayout } from "./components/SuperAdminLayout";

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

          {/* Super Admin Routes */}
          <Route path="/superadmin/login" element={<SuperAdminLoginPage />} />
          <Route
            path="/superadmin/*"
            element={
              <SuperAdminProtectedRoute>
                <Routes>
                  <Route element={<SuperAdminLayout />}>
                    <Route path="/" element={<SuperAdminDashboardPage />} />
                    <Route path="/demo-requests" element={<SuperAdminDemoRequestsPage />} />
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
                  <Route path="/billing" element={<BillingPage />} />
                  <Route path="/sales" element={<SalesPage />} />
                  <Route path="/dues" element={<DuesPage />} />
                  <Route path="/inventory" element={<InventoryPage />} />
                  <Route path="/catalog" element={<CatalogPage />} />
                  <Route path="/customers" element={<CustomersPage />} />
                  <Route path="/suppliers" element={<SuppliersPage />} />
                  <Route path="/karigars" element={<KarigarsPage />} />
                  <Route path="/karigar-tasks" element={<KarigarTasksPage />} />
                  <Route path="/girvi" element={<GirviPage />} />
                  <Route path="/forwarded-shops" element={<ForwardedShopsPage />} />
                  <Route path="/expenses" element={<ExpensesPage />} />
                  <Route path="/purchases" element={<PurchasesPage />} />
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/repairs" element={<RepairsPage />} />
                  <Route path="/gold-rates" element={<GoldRatesPage />} />
                  <Route path="/calculator" element={<CalculatorPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/gst-report" element={<GstReportPage />} />
                  <Route path="/employees" element={<EmployeesPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/invoice-designer" element={<InvoiceDesignerPage />} />
                  <Route path="/ledger" element={<LedgerPage />} />
                  <Route path="/balance-sheet" element={<BalanceSheetPage />} />
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
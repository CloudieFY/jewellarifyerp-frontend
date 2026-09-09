export type SubscriptionPlanType = 'spark' | 'hero' | 'prime' | 'custom' | 'trial' | 'basic' | 'standard' | 'premium';

export interface AppSubPage {
  id: string;
  name: string;
  route: string;
  description: string;
}

export interface AppModule {
  id: string;
  name: string;
  description: string;
  pages: AppSubPage[];
}

export const APP_MODULES: AppModule[] = [
  {
    id: "dashboard_core",
    name: "Dashboard & Core Tools",
    description: "Main dashboard overview, notifications, rate calculator & gold rate management",
    pages: [
      { id: "dashboard", name: "Dashboard Overview", route: "/dashboard", description: "Main dashboard KPIs and charts" },
      { id: "notifications", name: "Notifications & Alerts", route: "/notifications", description: "Stock, due, ready order & repair notifications" },
      { id: "calculator", name: "Rate Calculator", route: "/calculator", description: "Jewellery weight & purity rate calculator" },
      { id: "gold_rates", name: "Live Gold & Silver Rates", route: "/gold-rates", description: "Daily metal rates configuration" },
    ],
  },
  {
    id: "sales_billing",
    name: "Sales & Billing (POS)",
    description: "POS billing screen, sales invoices, custom orders, and invoice template customization",
    pages: [
      { id: "billing", name: "Billing & Estimate POS", route: "/billing", description: "Fast billing & estimate invoice creation" },
      { id: "sales", name: "Sales History & Invoices", route: "/sales", description: "Search, print & return sales invoices" },
      { id: "orders", name: "Custom Customer Orders", route: "/orders", description: "Order booking, tracking & status updates" },
      { id: "invoice_designer", name: "Custom Invoice Designer", route: "/invoice-designer", description: "Design printable invoice layouts" },
    ],
  },
  {
    id: "inventory_stock",
    name: "Inventory & Stock",
    description: "Product catalog, tag inventory, stock levels, and item categories",
    pages: [
      { id: "catalog", name: "Product Catalog", route: "/catalog", description: "Visual item showcase & category catalog" },
      { id: "inventory", name: "Stock & Tag Management", route: "/inventory", description: "Add/edit items, tag printing, stock counts" },
    ],
  },
  {
    id: "people_directory",
    name: "People & Directory",
    description: "Customer management, staff access, suppliers, karigar contacts, and shop profile",
    pages: [
      { id: "customers", name: "Customer Management", route: "/customers", description: "Customer list, purchase history & dues" },
      { id: "employees", name: "Staff & Employees", route: "/employees", description: "Employee login accounts & permissions" },
      { id: "suppliers", name: "Suppliers & Wholesale", route: "/suppliers", description: "Vendor contacts & purchase tracking" },
      { id: "karigars", name: "Karigars & Artisans", route: "/karigars", description: "Goldsmith profiles & balance accounts" },
      { id: "profile", name: "Shop Profile Settings", route: "/profile", description: "Showroom details, GSTIN & print headers" },
    ],
  },
  {
    id: "operations_repairs",
    name: "Operations & Repair Jobs",
    description: "Jewellery repair tracking and karigar job slip assignments",
    pages: [
      { id: "repairs", name: "Repairs & Job Cards", route: "/repairs", description: "Item repair intake, cost & status" },
      { id: "karigar_tasks", name: "Karigar Tasks & Work Slips", route: "/karigar-tasks", description: "Issue metal/raw gold to karigars for orders" },
    ],
  },
  {
    id: "finance_accounting",
    name: "Finance, Ledger & Reports",
    description: "Purchases, expenses, girvi pawn loans, daily cash ledger, GST & balance sheet",
    pages: [
      { id: "purchases", name: "Purchases & Stock In", route: "/purchases", description: "Record metal/jewellery vendor purchases" },
      { id: "expenses", name: "Showroom Expenses", route: "/expenses", description: "Track daily operational expenses" },
      { id: "dues", name: "Customer Dues & Udhaar", route: "/dues", description: "Pending payment collection & reminders" },
      { id: "girvi", name: "Girvi Pawn Loan Management", route: "/girvi", description: "Pawn mortgage loans, interest & releases" },
      { id: "forwarded_shops", name: "Forwarded Shops / B2B", route: "/forwarded-shops", description: "B2B shop approvals & forwarded stock" },
      { id: "reports", name: "Analytics & Business Reports", route: "/reports", description: "Sales, profit & stock report analytics" },
      { id: "ledger", name: "Daily Cash Ledger", route: "/ledger", description: "Rojmel cash & bank transaction register" },
      { id: "balance_sheet", name: "Balance Sheet & Trial Balance", route: "/balance-sheet", description: "Financial statement & trial balance" },
      { id: "gst_report", name: "GST Tax Reports & GSTR1", route: "/gst-report", description: "GST calculation & tax filing reports" },
    ],
  },
];

// Helper: GetAllPages Flat Array
export const ALL_APP_PAGES: AppSubPage[] = APP_MODULES.flatMap((m) => m.pages);

// Map Plan Tier -> Default Allowed Page IDs
export const PLAN_DEFAULT_PAGES: Record<string, string[]> = {
  spark: [
    "dashboard",
    "notifications",
    "calculator",
    "gold_rates",
    "billing",
    "sales",
    "catalog",
    "inventory",
    "customers",
    "employees",
    "dues",
    "reports",
    "ledger",
    "profile",
  ],
  hero: [
    "dashboard",
    "notifications",
    "calculator",
    "gold_rates",
    "billing",
    "sales",
    "orders",
    "catalog",
    "inventory",
    "customers",
    "employees",
    "suppliers",
    "karigars",
    "repairs",
    "karigar_tasks",
    "purchases",
    "expenses",
    "dues",
    "girvi",
    "reports",
    "ledger",
    "profile",
  ],
  prime: ALL_APP_PAGES.map((p) => p.id),
  trial: ALL_APP_PAGES.map((p) => p.id),
  // Legacy mappings
  basic: [
    "dashboard",
    "notifications",
    "calculator",
    "gold_rates",
    "billing",
    "sales",
    "catalog",
    "inventory",
    "customers",
    "employees",
    "dues",
    "reports",
    "ledger",
    "profile",
  ],
  standard: [
    "dashboard",
    "notifications",
    "calculator",
    "gold_rates",
    "billing",
    "sales",
    "orders",
    "catalog",
    "inventory",
    "customers",
    "employees",
    "suppliers",
    "karigars",
    "repairs",
    "karigar_tasks",
    "purchases",
    "expenses",
    "dues",
    "girvi",
    "reports",
    "ledger",
    "profile",
  ],
  premium: ALL_APP_PAGES.map((p) => p.id),
};

// Map Plan Tier -> Default Allowed Module IDs
export const PLAN_DEFAULT_MODULES: Record<string, string[]> = {
  spark: ["dashboard_core", "sales_billing", "inventory_stock", "people_directory", "finance_accounting"],
  hero: ["dashboard_core", "sales_billing", "inventory_stock", "people_directory", "operations_repairs", "finance_accounting"],
  prime: APP_MODULES.map((m) => m.id),
  trial: APP_MODULES.map((m) => m.id),
  basic: ["dashboard_core", "sales_billing", "inventory_stock", "people_directory", "finance_accounting"],
  standard: ["dashboard_core", "sales_billing", "inventory_stock", "people_directory", "operations_repairs", "finance_accounting"],
  premium: APP_MODULES.map((m) => m.id),
};

/**
 * Get default allowed pages for a plan (e.g. spark, hero, prime)
 */
export function getDefaultPagesForPlan(plan: string): string[] {
  const normalized = (plan || "spark").toLowerCase();
  return PLAN_DEFAULT_PAGES[normalized] || PLAN_DEFAULT_PAGES.spark;
}

/**
 * Get default allowed modules for a plan
 */
export function getDefaultModulesForPlan(plan: string): string[] {
  const normalized = (plan || "spark").toLowerCase();
  return PLAN_DEFAULT_MODULES[normalized] || PLAN_DEFAULT_MODULES.spark;
}

/**
 * Get the minimum subscription tier required for a page (Spark, Hero, or Prime)
 */
export function getPageDefaultTier(pageId: string): 'spark' | 'hero' | 'prime' {
  if (PLAN_DEFAULT_PAGES.spark.includes(pageId)) return 'spark';
  if (PLAN_DEFAULT_PAGES.hero.includes(pageId)) return 'hero';
  return 'prime';
}

/**
 * Check if a route/page is allowed given a shop's plan, allowedPages, and allowedModules arrays
 */
export function isRouteAllowed(
  route: string,
  plan?: string,
  allowedPages?: string[],
  allowedModules?: string[]
): boolean {
  // Always allowed system routes
  if (["/dashboard", "/login", "/profile"].includes(route)) {
    return true;
  }

  const effectivePlan = (plan || "spark").toLowerCase();

  // PRIME, PREMIUM & TRIAL SUBSCRIPTION PLAN: 100% of all modules and pages are always accessible
  if (effectivePlan === "prime" || effectivePlan === "premium" || effectivePlan === "trial") {
    return true;
  }

  // Find corresponding page definition
  const pageDef = ALL_APP_PAGES.find(
    (p) => p.route === route || route.startsWith(p.route + "/")
  );

  if (!pageDef) {
    // Unknown page route - default to true
    return true;
  }

  // If explicit allowedPages is provided on the shop record, check against it
  if (allowedPages && allowedPages.length > 0) {
    return allowedPages.includes(pageDef.id);
  }

  // If explicit allowedModules is provided on the shop record, check against module ID
  if (allowedModules && allowedModules.length > 0) {
    const parentModule = APP_MODULES.find((m) => m.pages.some((p) => p.id === pageDef.id));
    if (parentModule) {
      return allowedModules.includes(parentModule.id);
    }
  }

  // Fallback to plan default pages
  const defaultPages = getDefaultPagesForPlan(effectivePlan);
  return defaultPages.includes(pageDef.id);
}

/**
 * Metadata info about plans for UI presentation
 */
export const PLAN_METADATA: Record<
  string,
  { name: string; badge: string; color: string; desc: string; iconBg: string }
> = {
  spark: {
    name: "Spark Plan",
    badge: "Spark Tier",
    color: "bg-amber-100 text-amber-800 border-amber-300",
    iconBg: "bg-amber-500",
    desc: "Essential GST Billing, POS, Multi-User staff access, Inventory, Catalogue, Daily Cash Ledger, Reports & Rate Calculator.",
  },
  hero: {
    name: "Hero Plan",
    badge: "Hero Tier",
    color: "bg-indigo-100 text-indigo-800 border-indigo-300",
    iconBg: "bg-indigo-600",
    desc: "All Spark features PLUS Girvi Pawn Loans, Karigar Dashboard & Tasks, Custom Orders, Repairs, Purchases, Suppliers & Expense Tracker.",
  },
  prime: {
    name: "Prime Plan",
    badge: "Prime Tier",
    color: "bg-emerald-100 text-emerald-800 border-emerald-300",
    iconBg: "bg-emerald-600",
    desc: "Complete enterprise suite with Costing & Optimization (Balance Sheet, GST Reports, B2B Forwarded Shops & Custom Invoice Designer).",
  },
  custom: {
    name: "Custom Plan",
    badge: "Custom Tier",
    color: "bg-purple-100 text-purple-800 border-purple-300",
    iconBg: "bg-purple-600",
    desc: "Tailored plan with custom module and page selections selected by Super Admin.",
  },
  trial: {
    name: "Free Trial (30 Days)",
    badge: "30-Day Trial",
    color: "bg-blue-100 text-blue-900 border-blue-300",
    iconBg: "bg-blue-600",
    desc: "30-day evaluation trial with 100% Prime plan full module access. Requires upgrade after 30 days.",
  },
  basic: {
    name: "Basic Plan",
    badge: "Basic",
    color: "bg-blue-100 text-blue-800 border-blue-300",
    iconBg: "bg-blue-600",
    desc: "Standard retail features.",
  },
  standard: {
    name: "Standard Plan",
    badge: "Standard",
    color: "bg-cyan-100 text-cyan-800 border-cyan-300",
    iconBg: "bg-cyan-600",
    desc: "Mid-level multi-feature setup.",
  },
  premium: {
    name: "Premium Plan",
    badge: "Premium",
    color: "bg-amber-100 text-amber-900 border-amber-400",
    iconBg: "bg-amber-600",
    desc: "Full featured tier.",
  },
};

import { Footer, Nav, MobileMenu, WhatsAppButton } from "./LandingPage";
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  ShieldCheck,
  Lock,
  Database,
  EyeOff,
  Mail,
  MapPin,
  FileText,
  Camera,
  Trash2,
  Hammer,
  Layers,
  ShoppingBag,
  Wrench,
  Truck,
  Wallet,
  Scale,
  UserCheck
} from "lucide-react";

export default function PrivacyPolicyPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const lastUpdated = "August 5, 2026";

  const sections = [
    { id: "intro", title: "1. Software Purpose & Platform Overview", icon: ShieldCheck },
    { id: "isolation", title: "2. Multi-Tenant Architecture & Isolation", icon: Database },
    { id: "flow-auth", title: "3. Flow 1: Registration & Staff Authentication", icon: UserCheck },
    { id: "flow-inventory", title: "4. Flow 2: Inventory & Barcode Tagging", icon: Layers },
    { id: "flow-pos", title: "5. Flow 3: POS Counter Billing & Invoicing", icon: ShoppingBag },
    { id: "flow-girvi", title: "6. Flow 4: Girvi Gold Loan & Pawn Engine", icon: EyeOff },
    { id: "flow-karigar", title: "7. Flow 5: Karigar Workshop & Loss Tracking", icon: Hammer },
    { id: "flow-repairs", title: "8. Flow 6: Custom Orders & Repair Service", icon: Wrench },
    { id: "flow-purchases", title: "9. Flow 7: Supplier Wholesale & Purchases", icon: Truck },
    { id: "flow-expenses", title: "10. Flow 8: Shop Expenses & Cash Balancing", icon: Wallet },
    { id: "flow-reports", title: "11. Flow 9: Balance Sheet & GST Reports", icon: Scale },
    { id: "permissions", title: "12. Mobile Hardware Permissions", icon: Camera },
    { id: "security", title: "13. Data Security & Encryption", icon: Lock },
    { id: "deletion", title: "14. Account & Data Deletion Policy", icon: Trash2 },
    { id: "contact", title: "15. Developer Contact & DPO", icon: Mail },
  ];

  return (
    <div className="bg-[#FAF8F5] font-sans text-slate-900 antialiased selection:bg-[#FA8112]/20 selection:text-[#FA8112]">
      <Helmet>
        <title>Comprehensive Privacy Policy & Step-by-Step System Workflows | JewellarifyERP</title>
        <meta
          name="description"
          content="Complete step-by-step breakdown of every operational flow, data processing step, and privacy safeguards in JewellarifyERP Android App & Web Software."
        />
      </Helmet>

      <Nav onOpenMobileMenu={() => setMobileMenuOpen(true)} />
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <WhatsAppButton />

      {/* HERO SECTION */}
      <div className="relative border-b border-amber-200/60 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent pt-12 pb-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#FA8112]">
            <ShieldCheck className="h-4 w-4" /> Full Operational Disclosure & Play Console Compliant
          </span>
          <h1 className="mt-4 font-serif text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            JewellarifyERP System Workflows & Privacy Policy
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Detailed step-by-step technical and operational documentation of every feature, module, data collection point, and workflow in <strong className="text-slate-900">JewellarifyERP</strong> by <strong className="text-slate-900">CloudieFY Technologies</strong>.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-slate-500">
            <span>Last Updated: {lastUpdated}</span>
            <span>•</span>
            <span>System Version 3.2</span>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT WITH STICKY INDEX */}
      <main className="py-12 sm:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            
            {/* STICKY QUICK-NAV SIDEBAR */}
            <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
              <div className="rounded-3xl border border-amber-200/80 bg-white p-6 shadow-sm max-h-[80vh] overflow-y-auto">
                <h3 className="font-serif text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-[#FA8112]" /> Workflow Index
                </h3>
                <nav className="space-y-1">
                  {sections.map((sec) => (
                    <a
                      key={sec.id}
                      href={`#${sec.id}`}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-amber-50 hover:text-[#FA8112] transition-colors"
                    >
                      <sec.icon className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-[#FA8112]" />
                      <span className="truncate">{sec.title}</span>
                    </a>
                  ))}
                </nav>
              </div>

              {/* HIGHLIGHT CALLOUT CARD */}
              <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-[#2A1706] to-slate-900 p-6 text-white border border-amber-900/50 shadow-xl space-y-3">
                <div className="flex items-center gap-2 text-[#FA8112] text-xs font-extrabold uppercase tracking-wider">
                  <Lock className="h-4 w-4" /> Zero Third-Party Monetization
                </div>
                <h4 className="font-serif text-base font-bold text-white">Your Showroom Data Is Yours</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Every weight entry, customer phone number, Girvi loan ticket, and Karigar metal balance is cryptographically isolated and never shared with advertisers.
                </p>
                <div className="pt-2 border-t border-amber-900/40 text-[11px] text-amber-200/80">
                  DPO Email: <a href="mailto:cloudiefyy@gmail.com" className="underline font-mono">cloudiefyy@gmail.com</a>
                </div>
              </div>
            </aside>

            {/* DETAILED POLICY SECTIONS */}
            <div className="lg:col-span-8 space-y-10">

              {/* 1. INTRODUCTION & SCOPE */}
              <section id="intro" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">1. Software Purpose & Platform Overview</h2>
                </div>
                <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                  <p>
                    <strong className="text-slate-900">JewellarifyERP</strong> is an end-to-end ERP (Enterprise Resource Planning) and POS (Point of Sale) solution engineered specifically for jewellery showrooms, bullion wholesalers, Girvi (pledged gold loan) shops, and Karigar artisan workshops.
                  </p>
                  <p>
                    This document explicitly details how data moves through every single workflow in both the Android mobile application and the cloud web platform operated by <strong className="text-slate-900">CloudieFY Technologies</strong>.
                  </p>
                </div>
              </section>

              {/* 2. MULTI-TENANT ISOLATION */}
              <section id="isolation" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <Database className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">2. Multi-Tenant Architecture & Data Isolation</h2>
                </div>
                <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                  <p>
                    Our platform uses strict <strong className="text-slate-900">Multi-Tenant Isolation</strong>.
                  </p>
                  <ul className="list-disc list-inside space-y-2 pl-2 text-slate-700">
                    <li><strong>Cryptographic Tenant Keys:</strong> Every record created is bound to a unique <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-amber-800">shopId</code> token.</li>
                    <li><strong>Zero Inter-Shop Visibility:</strong> Competitors and other registered showrooms cannot query, view, or export your stock tags, sales receipts, or customer phone numbers.</li>
                    <li><strong>Role-Based Staff Permissions (RBAC):</strong> Admin, Staff, Operator, and Karigar user roles determine access levels to sensitive billing, inventory edits, or loan records.</li>
                  </ul>
                </div>
              </section>

              {/* 3. FLOW 1: SUPERADMIN PROVISIONING, USER ID & PASS CREATION & APP LOGIN */}
              <section id="flow-auth" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">3. Flow 1: SuperAdmin User Provisioning, Credentials & Login</h2>
                </div>
                <p className="text-slate-600 text-sm">How SuperAdmin provisions showroom accounts, how User IDs and Passwords are generated, and how users access the software:</p>
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 text-xs space-y-1">
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span className="h-5 w-5 rounded-full bg-[#FA8112] text-white flex items-center justify-center text-[10px]">1</span>
                      SuperAdmin Account Provisioning & Credentials Creation
                    </div>
                    <p className="text-slate-600 pl-7">
                      The platform System SuperAdmin generates and assigns the official login credentials for each showroom user. The SuperAdmin creates:
                    </p>
                    <ul className="list-disc list-inside pl-7 pt-1 space-y-1 text-slate-700 font-medium">
                      <li><strong>Shop ID (Shop Slug):</strong> Unique tenant showroom identifier (e.g. <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-amber-800">yash-jewellers</code>).</li>
                      <li><strong>SuperAdmin-Generated User ID / Username:</strong> Designated login username.</li>
                      <li><strong>SuperAdmin-Generated Password:</strong> Secure initial login password assigned to the showroom user.</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 text-xs space-y-1">
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span className="h-5 w-5 rounded-full bg-[#FA8112] text-white flex items-center justify-center text-[10px]">2</span>
                      Showroom Admin Staff & Karigar Credential Provisioning
                    </div>
                    <p className="text-slate-600 pl-7">
                      Inside the showroom portal, the Showroom Admin can additionally create internal User Accounts (User ID / Username), set roles (Staff, Operator, Karigar), and issue passwords for counter staff and Karigar artisans.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 text-xs space-y-1">
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span className="h-5 w-5 rounded-full bg-[#FA8112] text-white flex items-center justify-center text-[10px]">3</span>
                      User Mobile App & Web Login Procedure
                    </div>
                    <p className="text-slate-600 pl-7">
                      Users open the JewellarifyERP mobile application or web portal and sign in using the credentials provided by SuperAdmin / Admin:
                    </p>
                    <ul className="list-disc list-inside pl-7 pt-1 space-y-1 text-slate-700 font-medium">
                      <li><strong>Shop Staff Sign In:</strong> Enter <em>Shop ID</em> + <em>Username</em> + <em>Password</em>.</li>
                      <li><strong>Karigar Portal Sign In:</strong> Select Karigar Login tab and enter <em>Karigar Username</em> + <em>Password</em>.</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900 text-white text-xs space-y-1.5 border border-slate-800">
                    <div className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">Notice for Google Play Console App Reviewers:</div>
                    <p className="text-slate-300 leading-relaxed">
                      Self-registration (open public user signup) is intentionally disabled on the mobile app login screen. JewellarifyERP is a controlled enterprise B2B SaaS platform. All User IDs, Passwords, and Shop IDs are created and issued directly by the SuperAdmin / Admin to ensure strict multi-tenant data protection and prevent unauthorized access to sensitive jewellery inventories and loan ledgers.
                    </p>
                  </div>
                </div>
              </section>

              {/* 4. FLOW 2: INVENTORY & BARCODE TAGGING */}
              <section id="flow-inventory" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <Layers className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">4. Flow 2: Inventory Stock & Barcode Tagging</h2>
                </div>
                <p className="text-slate-600 text-sm">Step-by-step process of ornament stock entry, weight calculation, and barcode generation:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900">Step A: Category & Purity Selection</div>
                    <p className="text-slate-600">Select ornament type (Rings, Bangles, Chains, Coins, Silver) and Karat purity (24K 999, 22K 916, 18K 750, 14K, 925 Silver).</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900">Step B: Weight & Charges Entry</div>
                    <p className="text-slate-600">Record Gross Weight (g), Stone Weight (g), Net Gold Weight (g), Wastage %, and Making Charges (Per Gram or Flat ₹).</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900">Step C: Barcode Printing & Scan</div>
                    <p className="text-slate-600">Generate unique SKU barcode tags. Use camera barcode scanner on mobile to instantly pull up ornament details.</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900">Step D: Real-Time Valuation</div>
                    <p className="text-slate-600">Automatically recalculate total inventory valuation whenever daily 24K gold or silver market rates update.</p>
                  </div>
                </div>
              </section>

              {/* 5. FLOW 3: POS BILLING & INVOICING */}
              <section id="flow-pos" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">5. Flow 3: POS Counter Billing & Invoicing</h2>
                </div>
                <p className="text-slate-600 text-sm">How sales counter transactions and receipts are processed:</p>
                <ol className="list-decimal list-inside space-y-2 text-xs text-slate-700 pl-2">
                  <li><strong>Barcode Scan / Item Add:</strong> Staff scans item barcode or selects SKU from catalog. Price auto-calculates as: <code className="bg-amber-50 text-amber-900 px-1 py-0.5 rounded font-mono">(Net Weight × Rate) + Stone Cost + Making Charges + Hallmark Fee</code>.</li>
                  <li><strong>Customer Profile Attach:</strong> Capture Customer Name, Mobile Number, GSTIN (for B2B), and Address.</li>
                  <li><strong>Multi-Mode Payment Settlement:</strong> Accept Cash, UPI QR Code, Credit/Debit Card, Bank Transfer, Customer Reward Points, or Old Gold/Silver Metal Exchange trade-in.</li>
                  <li><strong>GST Invoice & Printing:</strong> Compute 3% GST (CGST+SGST or IGST) and generate thermal 3-inch/4-inch POS receipt or official A4 PDF bill.</li>
                  <li><strong>WhatsApp Digital Receipt:</strong> Automatically dispatch PDF invoice link to buyer's WhatsApp number via Meta API.</li>
                </ol>
              </section>

              {/* 6. FLOW 4: GIRVI GOLD LOAN ENGINE */}
              <section id="flow-girvi" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <EyeOff className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">6. Flow 4: Girvi (Pledged Gold Loan) & Pawn Engine</h2>
                </div>
                <p className="text-slate-600 text-sm">Complete lifecycle of gold loan pledges, interest calculations, and releases:</p>
                <div className="space-y-3 text-xs text-slate-700">
                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                    <strong>1. Borrower & Ornament Entry:</strong> Capture Borrower Name, Mobile, Aadhaar ID, Address, Item Description, Gross/Net Weight, and Purity.
                  </div>
                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                    <strong>2. Photo Capture:</strong> Use device camera to capture and store photograph of pledged gold/silver ornaments attached to ticket.
                  </div>
                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                    <strong>3. Loan Terms & Disbursement:</strong> Disburse Principal Amount (₹), set Monthly Interest Rate (%), compounding frequency (Monthly/Daily), and print Girvi pawn ticket.
                  </div>
                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                    <strong>4. Interest Servicing & Partial Payments:</strong> Issue interest payment receipts and update outstanding principal balance.
                  </div>
                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                    <strong>5. Final Release / Forwarded Girvi:</strong> Record full loan closure, generate release receipt, or track items forwarded to external financier shops.
                  </div>
                </div>
              </section>

              {/* 7. FLOW 5: KARIGAR WORKSHOP */}
              <section id="flow-karigar" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <Hammer className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">7. Flow 5: Karigar Workshop & Metal Loss Tracking</h2>
                </div>
                <p className="text-slate-600 text-sm">Tracking raw gold metal issued to artisans and finished ornament returns:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <strong>Raw Metal Issue:</strong> Weigh and issue 24K gold/fine silver bars or scrap metal to Karigar with digital issue voucher.
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <strong>Finished Ornament Return:</strong> Receive handcrafted item, weigh gross/net weight, and record Karigar wage charges.
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <strong>Loss / Wastage Accounting:</strong> Compare allowed vs actual metal loss (ghat/tap) and credit/debit Karigar metal ledger.
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <strong>Karigar Balance Ledger:</strong> Maintain running balance of pure metal (grams) and cash (₹) owed to or by Karigars.
                  </div>
                </div>
              </section>

              {/* 8. FLOW 6: REPAIRS & ORDERS */}
              <section id="flow-repairs" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <Wrench className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">8. Flow 6: Custom Orders & Repair Job Slips</h2>
                </div>
                <div className="space-y-2 text-xs text-slate-700">
                  <p><strong>Custom Order Booking:</strong> Capture customer design preference, target gold weight, advance deposit (cash/gold), and promised delivery date.</p>
                  <p><strong>Repair Job Entry:</strong> Record broken ornament description, issue weight, estimated repair charges, and job slip printout.</p>
                  <p><strong>Status Tracking:</strong> Track order lifecycle: <em>Booked → In Workshop → Ready for Counter → Delivered to Customer</em>.</p>
                </div>
              </section>

              {/* 9. FLOW 7: SUPPLIERS & PURCHASES */}
              <section id="flow-purchases" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <Truck className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">9. Flow 7: Wholesale Purchases & Supplier Ledgers</h2>
                </div>
                <div className="space-y-2 text-xs text-slate-700">
                  <p><strong>Wholesale Invoice Entry:</strong> Record bulk stock purchases from gold manufacturers, including gross weight, purity, fine gold value, and GST invoice number.</p>
                  <p><strong>Supplier Fine Gold & Cash Balance:</strong> Maintain dual ledger tracking fine gold metal balance (grams) and cash balance (₹) payable to wholesale suppliers.</p>
                </div>
              </section>

              {/* 10. FLOW 8: EXPENSES & CASH BALANCING */}
              <section id="flow-expenses" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">10. Flow 8: Shop Expenses & Daily Cash Counter</h2>
                </div>
                <div className="space-y-2 text-xs text-slate-700">
                  <p><strong>Expense Voucher Entry:</strong> Categorize daily showroom expenses (Staff Salary, Rent, Tea/Snacks, Electricity, Transport) with expense notes.</p>
                  <p><strong>Daily Cash Counter Balancing:</strong> Real-time formula: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">Opening Cash + Sales Cash Received - Expenses - Cash Out = Closing Counter Cash Balance</code>.</p>
                </div>
              </section>

              {/* 11. FLOW 9: REPORTS & BALANCE SHEET */}
              <section id="flow-reports" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <Scale className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">11. Flow 9: Balance Sheet & GST Tax Filing</h2>
                </div>
                <div className="space-y-2 text-xs text-slate-700">
                  <p><strong>Double-Entry Balance Sheet:</strong> Computes Total Assets (Live Stock Value + Cash + Girvi Principal Receivables + Customer Dues) vs Liabilities (Supplier Metal Balances + Advances + Capital).</p>
                  <p><strong>GST Tax Reports:</strong> Generates GSTR-1 and GSTR-3B monthly tax summaries with HSN 7113 breakdown.</p>
                  <p><strong>One-Click Excel Export:</strong> Export stock catalogs, sales ledgers, customer directories, and Girvi registers anytime in XLSX or CSV format.</p>
                </div>
              </section>

              {/* 12. HARDWARE PERMISSIONS */}
              <section id="permissions" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <Camera className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">12. Mobile Hardware Permissions Declared</h2>
                </div>
                <div className="space-y-3 text-xs text-slate-700">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="font-bold text-slate-900 uppercase">Camera Permission (<code className="font-mono text-amber-800 text-[11px]">android.permission.CAMERA</code>)</div>
                    <p className="text-slate-600 mt-1">Required exclusively when scanning item barcodes or capturing photos of pledged gold ornaments under Girvi loans.</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="font-bold text-slate-900 uppercase">Storage & Media Access</div>
                    <p className="text-slate-600 mt-1">Required to save tax invoice PDFs, print receipts, and store catalog photos locally on your device.</p>
                  </div>
                </div>
              </section>

              {/* 13. SECURITY & ENCRYPTION */}
              <section id="security" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <Lock className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">13. Security & Encryption Standards</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center text-xs">
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
                    <div className="font-extrabold text-[#FA8112] text-lg">256-bit SSL/TLS</div>
                    <div className="text-slate-600 mt-1">Encrypted transport</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
                    <div className="font-extrabold text-[#FA8112] text-lg">AES-256</div>
                    <div className="text-slate-600 mt-1">Encrypted storage</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
                    <div className="font-extrabold text-[#FA8112] text-lg">Cloud Backups</div>
                    <div className="text-slate-600 mt-1">Automated daily snapshots</div>
                  </div>
                </div>
              </section>

              {/* 14. ACCOUNT & DATA DELETION */}
              <section id="deletion" className="rounded-3xl border border-red-200/80 bg-red-50/30 p-8 shadow-xs space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                    <Trash2 className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">14. Account & Data Deletion Request (Google Play Safety)</h2>
                </div>
                <div className="space-y-3 text-slate-700 text-xs">
                  <p className="text-sm">In compliance with Google Play Store User Data policies, showroom owners can request permanent deletion of their account and databases:</p>
                  <div className="rounded-2xl bg-white p-5 border border-red-200 space-y-2">
                    <div className="font-bold text-slate-900 text-xs uppercase">Step-by-step deletion request:</div>
                    <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                      <li>Send an email to <a href="mailto:cloudiefyy@gmail.com" className="font-bold text-[#FA8112] underline">cloudiefyy@gmail.com</a> from your registered owner email address.</li>
                      <li>Subject line: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-red-700">Data Deletion Request - [Your Shop Name]</code>.</li>
                      <li>Include your Shop ID slug and registered owner mobile number.</li>
                    </ol>
                    <p className="text-slate-500 pt-2 border-t border-slate-100">
                      All inventory tags, sales receipts, customer records, Girvi pledges, and login credentials will be permanently deleted from active servers within 7 business days.
                    </p>
                  </div>
                </div>
              </section>

              {/* 15. DEVELOPER CONTACT */}
              <section id="contact" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <Mail className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">15. Developer Contact & Data Protection Officer</h2>
                </div>
                <div className="rounded-2xl bg-amber-50/70 p-5 border border-amber-100 space-y-2 text-xs">
                  <div className="font-bold text-slate-900 text-base">CloudieFY Technologies</div>
                  <div className="font-medium text-slate-700">Developer & Data Protection Officer: Himanshu Patel</div>
                  <div className="text-slate-600 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-[#FA8112]" /> Email: <a href="mailto:cloudiefyy@gmail.com" className="font-semibold text-slate-900 underline">cloudiefyy@gmail.com</a>
                  </div>
                  <div className="text-slate-600 flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-[#FA8112] shrink-0 mt-0.5" />
                    <span>Address: 108 Orange Business Park Bhawarkua, Indore, MP 452001, India</span>
                  </div>
                </div>
              </section>

            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
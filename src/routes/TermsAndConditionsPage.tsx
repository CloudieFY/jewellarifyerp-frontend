import { Footer, Nav, MobileMenu, WhatsAppButton } from "./LandingPage";
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  FileText,
  ShieldCheck,
  Lock,
  Scale,
  CreditCard,
  AlertTriangle,
  Database,
  Layers,
  Mail,
  MapPin,
  CheckCircle2,
  Globe
} from "lucide-react";

export default function TermsAndConditionsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const lastUpdated = "July 30, 2026";

  const sections = [
    { id: "acceptance", title: "1. Acceptance of Terms", icon: CheckCircle2 },
    { id: "license", title: "2. SaaS License & Access", icon: Layers },
    { id: "accounts", title: "3. Account & Staff Roles", icon: Lock },
    { id: "billing", title: "4. Subscription & Billing", icon: CreditCard },
    { id: "rates", title: "5. Metal Rate Disclaimer", icon: Scale },
    { id: "girvi", title: "6. Girvi & Pledged Assets", icon: ShieldCheck },
    { id: "data", title: "7. Data Ownership & SLA", icon: Database },
    { id: "ip", title: "8. Intellectual Property", icon: Globe },
    { id: "liability", title: "9. Limitation of Liability", icon: AlertTriangle },
    { id: "termination", title: "10. Termination & Grace", icon: FileText },
    { id: "governing", title: "11. Governing Law & Address", icon: MapPin },
  ];

  return (
    <div className="bg-[#FAF8F5] font-sans text-slate-900 antialiased selection:bg-[#FA8112]/20 selection:text-[#FA8112]">
      <Helmet>
        <title>Terms & Conditions | jewellarifyerp - Service Agreement</title>
        <meta
          name="description"
          content="Review the terms and conditions governing the use of jewellarifyerp SaaS cloud POS, inventory ledgers, Girvi loan modules, and multi-tenant services."
        />
      </Helmet>

      <Nav onOpenMobileMenu={() => setMobileMenuOpen(true)} />
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <WhatsAppButton />

      {/* HERO SECTION */}
      <div className="relative border-b border-amber-200/60 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent pt-12 pb-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#FA8112]">
            <FileText className="h-4 w-4" /> Official Master Service Agreement
          </span>
          <h1 className="mt-4 font-serif text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            Terms & Conditions of Service
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            These Terms govern your subscription and use of <strong className="text-slate-900">jewellarifyerp</strong> cloud POS, inventory tag ledgers, Girvi loan software, and multi-showroom management platform.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
            <span>Effective Date: {lastUpdated}</span>
            <span className="mx-2">•</span>
            <span>Applicable to all Showrooms & Subscribers</span>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT WITH SIDEBAR NAVIGATION */}
      <main className="py-12 sm:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

            {/* STICKY QUICK-NAV SIDEBAR */}
            <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
              <div className="rounded-3xl border border-amber-200/80 bg-white p-6 shadow-sm">
                <h3 className="font-serif text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-[#FA8112]" /> Agreement Sections
                </h3>
                <nav className="space-y-1">
                  {sections.map((sec) => (
                    <a
                      key={sec.id}
                      href={`#${sec.id}`}
                      className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-amber-50 hover:text-[#FA8112] transition-colors"
                    >
                      <sec.icon className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-[#FA8112]" />
                      <span>{sec.title}</span>
                    </a>
                  ))}
                </nav>
              </div>

              {/* HIGHLIGHT CALLOUT CARD */}
              <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-[#2A1706] to-slate-900 p-6 text-white border border-amber-900/50 shadow-xl">
                <div className="flex items-center gap-2 text-[#FA8112] text-xs font-extrabold uppercase tracking-wider mb-2">
                  <ShieldCheck className="h-4 w-4" /> GST & Domain Compliance
                </div>
                <h4 className="font-serif text-base font-bold text-white mb-2">Built For Indian Jewellery Trade</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Our calculations follow standard Indian GST tax structures, 24K/22K/18K Karat touch conversions, stone weight deductions, and hallmark fee rules.
                </p>
              </div>
            </aside>

            {/* DETAILED AGREEMENT SECTIONS */}
            <div className="lg:col-span-8 space-y-12">

              {/* 1. ACCEPTANCE OF TERMS */}
              <section id="acceptance" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">1. Acceptance of Terms</h2>
                </div>
                <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                  <p>
                    By creating an account, accessing, or subscribing to <strong className="text-slate-900">jewellarifyerp</strong> ("Platform"), you ("Subscriber", "Showroom Owner", or "Merchant") agree to be bound by these Terms and Conditions ("Agreement").
                  </p>
                  <p>
                    If you are entering into this Agreement on behalf of a showroom, partnership firm, or corporate entity, you represent that you have full legal authority to bind such entity.
                  </p>
                </div>
              </section>

              {/* 2. SAAS LICENSE & ACCESS */}
              <section id="license" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <Layers className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">2. SaaS License & Multi-Tenant Access</h2>
                </div>
                <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                  <p>
                    Subject to your active subscription plan, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the software for your internal showroom billing and inventory management.
                  </p>
                  <ul className="list-disc list-inside space-y-2 pl-2 text-slate-700">
                    <li><strong>Multi-Tenant Isolation:</strong> Your showroom operates inside a dedicated isolated tenant space mapped to your shop ID.</li>
                    <li><strong>No Software Sale:</strong> You acquire a subscription right to use our cloud software; no title or intellectual property ownership is transferred.</li>
                  </ul>
                </div>
              </section>

              {/* 3. ACCOUNT & STAFF ROLES */}
              <section id="accounts" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <Lock className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">3. User Accounts & Staff Role Management</h2>
                </div>
                <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                  <p>
                    You are solely responsible for maintaining the confidentiality of your login credentials and staff access tokens.
                  </p>
                  <ul className="list-disc list-inside space-y-2 pl-2 text-slate-700">
                    <li><strong>Staff Permissions:</strong> As showroom admin, you assign staff roles (Billing Cashier, Stock Manager, Girvi Vault Officer).</li>
                    <li><strong>Audit Logs:</strong> All transactions, discount overrides, and stock edits performed by your staff are logged under their user session for internal auditing.</li>
                  </ul>
                </div>
              </section>

              {/* 4. SUBSCRIPTION & BILLING */}
              <section id="billing" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">4. Subscription Plans & Payments</h2>
                </div>
                <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                  <p>
                    Subscription fees are billed in advance on a monthly or annual cycle based on your chosen tier (Starter, Pro, Enterprise).
                  </p>
                  <ul className="list-disc list-inside space-y-2 pl-2 text-slate-700">
                    <li><strong>Taxes:</strong> Fees are exclusive of applicable Indian GST (18%) which will be itemized on your subscription invoice.</li>
                    <li><strong>Renewal & Upgrades:</strong> Subscriptions renew automatically unless canceled before the next billing date.</li>
                  </ul>
                </div>
              </section>

              {/* 5. METAL RATE DISCLAIMER */}
              <section id="rates" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <Scale className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">5. Metal Rate & Calculation Disclaimer</h2>
                </div>
                <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                  <p>
                    jewellarifyerp provides automated 24K gold and silver market rate sync feeds for showroom billing convenience.
                  </p>
                  <div className="rounded-2xl bg-amber-50/70 p-4 border border-amber-100 text-xs text-slate-700 font-medium">
                    ⚠️ <strong>Merchant Override Authority:</strong> Showroom billing operators retain ultimate authority to set, adjust, or override gold rates, making charges, stone deductions, and discount percentages before printing final customer GST invoices.
                  </div>
                </div>
              </section>

              {/* 6. GIRVI LOANS */}
              <section id="girvi" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">6. Girvi & Pledged Asset Governance</h2>
                </div>
                <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                  <p>
                    The <strong className="text-slate-900">Girvi Loan Module</strong> provides digital record-keeping for pledged gold ornaments, borrower details, photo attachments, and interest ledgers.
                  </p>
                  <p>
                    Merchants are solely responsible for ensuring their pledge lending practices comply with local state money-lending laws, interest rate caps, and pawn shop licensing requirements. jewellarifyerp acts strictly as a software recording engine and is not a financial lender or escrow agent.
                  </p>
                </div>
              </section>

              {/* 7. DATA OWNERSHIP & SLA */}
              <section id="data" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <Database className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">7. Data Ownership & Uptime SLA</h2>
                </div>
                <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                  <p>
                    You maintain complete 100% ownership of your showroom data. We target <strong className="text-slate-900">99.99% Cloud Service Uptime</strong> backed by automated daily cloud database backups.
                  </p>
                </div>
              </section>

              {/* 8. INTELLECTUAL PROPERTY */}
              <section id="ip" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <Globe className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">8. Intellectual Property</h2>
                </div>
                <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                  <p>
                    All software code, UI interfaces, branding, graphics, database architecture, and trademark assets related to jewellarifyerp remain the exclusive property of jewellarifyerp. Reverse engineering, scraping, or redistributing the platform source code is strictly prohibited.
                  </p>
                </div>
              </section>

              {/* 9. LIMITATION OF LIABILITY */}
              <section id="liability" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">9. Limitation of Liability</h2>
                </div>
                <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                  <p>
                    To the maximum extent permitted by law, jewellarifyerp shall not be liable for indirect, consequential, or punitive damages, or loss of profits arising from internet outages, hardware barcode scanner malfunctions, or incorrect data input by showroom staff.
                  </p>
                </div>
              </section>

              {/* 10. TERMINATION */}
              <section id="termination" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <FileText className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">10. Termination & Data Grace Period</h2>
                </div>
                <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                  <p>
                    Upon subscription cancellation or non-renewal, we provide a <strong className="text-slate-900">30-Day Grace Period</strong> during which you can log in and export your complete stock records and sales ledgers in Excel format before tenant archiving.
                  </p>
                </div>
              </section>

              {/* 11. GOVERNING LAW & ADDRESS */}
              <section id="governing" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">11. Governing Law & Head Office Contact</h2>
                </div>
                <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                  <p>
                    These Terms are governed by the laws of India. Any legal disputes shall be subject to the exclusive jurisdiction of the courts in Indore, Madhya Pradesh, India.
                  </p>
                  <div className="rounded-2xl bg-amber-50/70 p-4 border border-amber-100 space-y-2 mt-4">
                    <div className="font-bold text-slate-900 text-sm">jewellarifyerp Legal & Compliance Team</div>
                    <div className="text-xs text-slate-600 flex items-center gap-2">
                      <Mail className="h-4 w-4 text-[#FA8112]" /> Email: cloudiefyy@gmail.com
                    </div>
                    <div className="text-xs text-slate-600 flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-[#FA8112] shrink-0 mt-0.5" />
                      <span>Head Office: 108 Orange Business Park Bhawarkua, Indore, MP 452001, India</span>
                    </div>
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
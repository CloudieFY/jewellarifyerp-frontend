import { Footer, Nav, MobileMenu, WhatsAppButton } from "./LandingPage";
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  ShieldCheck,
  Lock,
  Database,
  EyeOff,
  CheckCircle2,
  MessageSquare,
  FileSpreadsheet,
  Mail,
  MapPin,
  FileText
} from "lucide-react";

export default function PrivacyPolicyPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const lastUpdated = "July 30, 2026";

  const sections = [
    { id: "intro", title: "1. Introduction & Scope", icon: ShieldCheck },
    { id: "isolation", title: "2. Multi-Tenant Data Isolation", icon: Database },
    { id: "collection", title: "3. Information We Collect", icon: FileText },
    { id: "usage", title: "4. How We Use Your Data", icon: CheckCircle2 },
    { id: "security", title: "5. Security & Encryption", icon: Lock },
    { id: "girvi", title: "6. Girvi & Ledger Confidentiality", icon: EyeOff },
    { id: "whatsapp", title: "7. WhatsApp & Third-Party APIs", icon: MessageSquare },
    { id: "export", title: "8. Data Ownership & Export", icon: FileSpreadsheet },
    { id: "contact", title: "9. Contact Data Protection Officer", icon: Mail },
  ];

  return (
    <div className="bg-[#FAF8F5] font-sans text-slate-900 antialiased selection:bg-[#FA8112]/20 selection:text-[#FA8112]">
      <Helmet>
        <title>Privacy Policy | jewellarifyerp - Data Protection & Security</title>
        <meta
          name="description"
          content="Learn how jewellarifyerp safeguards your jewellery showroom data, Girvi loan ledgers, and customer records with bank-grade multi-tenant security."
        />
      </Helmet>

      <Nav onOpenMobileMenu={() => setMobileMenuOpen(true)} />
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <WhatsAppButton />

      {/* HERO SECTION */}
      <div className="relative border-b border-amber-200/60 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent pt-12 pb-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#FA8112]">
            <ShieldCheck className="h-4 w-4" /> Data Privacy & Trust Guarantee
          </span>
          <h1 className="mt-4 font-serif text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            Privacy Policy & Data Security
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            At <strong className="text-slate-900">jewellarifyerp</strong>, we treat your showroom inventory, Karat purity ledgers, Girvi pledged records, and billing data with uncompromising confidentiality and bank-grade isolation.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
            <span>Last Updated: {lastUpdated}</span>
            <span className="mx-2">•</span>
            <span>Version 2.4 (Enterprise GDPR & DPDP Compliant)</span>
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
                  <FileText className="h-5 w-5 text-[#FA8112]" /> Policy Sections
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
                  <Lock className="h-4 w-4" /> 100% Data Ownership
                </div>
                <h4 className="font-serif text-base font-bold text-white mb-2">Your Data Belongs Only To You</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  We never sell, monetize, or aggregate your showroom sales or customer records. You can export your full database ledgers anytime in Excel or PDF format.
                </p>
              </div>
            </aside>

            {/* DETAILED POLICY SECTIONS */}
            <div className="lg:col-span-8 space-y-12">

              {/* 1. INTRODUCTION */}
              <section id="intro" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">1. Introduction & Scope</h2>
                </div>
                <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                  <p>
                    Welcome to <strong className="text-slate-900">jewellarifyerp</strong> ("we", "us", or "our"). We provide a dedicated cloud-based Enterprise Resource Planning (ERP) platform and Point of Sale (POS) software specifically engineered for retail jewellery showrooms, wholesalers, Girvi gold loan providers, and manufacturers.
                  </p>
                  <p>
                    This Privacy Policy details how we collect, process, store, and protect information provided by showroom owners, staff members, superadmins, and customers interacting with our web application and mobile tools.
                  </p>
                </div>
              </section>

              {/* 2. MULTI-TENANT ISOLATION */}
              <section id="isolation" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <Database className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">2. Multi-Tenant Database Isolation</h2>
                </div>
                <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                  <p>
                    Every showroom registered on jewellarifyerp operates within a strict <strong className="text-slate-900">Multi-Tenant Isolated Architecture</strong>.
                  </p>
                  <ul className="list-disc list-inside space-y-2 pl-2 text-slate-700">
                    <li><strong>Cryptographic Tenant Keys:</strong> All database queries are automatically scoped to your unique shop ID (<code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-amber-800">shopId</code>).</li>
                    <li><strong>Zero Competitor Access:</strong> No other showroom, competitor, or unauthorized staff member can view or query your inventory tags, daily sales, or supplier rates.</li>
                    <li><strong>Role-Based Access Control (RBAC):</strong> Inside your showroom, you control exactly which staff members have access to billing, inventory edits, or financial ledgers.</li>
                  </ul>
                </div>
              </section>

              {/* 3. INFORMATION WE COLLECT */}
              <section id="collection" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <FileText className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">3. Information We Collect</h2>
                </div>
                <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                  <p>To deliver seamless POS billing, inventory management, and GST tax calculations, we collect:</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="rounded-2xl bg-amber-50/50 p-4 border border-amber-100">
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide mb-1.5">Showroom Profile Data</h4>
                      <p className="text-xs text-slate-600">Shop name, GSTIN number, registered owner name, contact phone, email address, showroom location, and official invoice logo.</p>
                    </div>
                    
                    <div className="rounded-2xl bg-amber-50/50 p-4 border border-amber-100">
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide mb-1.5">Operational Inventory Data</h4>
                      <p className="text-xs text-slate-600">Gold/silver ornament weight (gross/net weight), stone weight deductions, Karat purity (24K, 22K, 18K), barcode tag IDs, and wastage percentages.</p>
                    </div>

                    <div className="rounded-2xl bg-amber-50/50 p-4 border border-amber-100">
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide mb-1.5">Sales & Customer Records</h4>
                      <p className="text-xs text-slate-600">Counter sales invoices, WhatsApp receipt phone numbers, payment mode split (cash/UPI/card/metal exchange), and customer reward points.</p>
                    </div>

                    <div className="rounded-2xl bg-amber-50/50 p-4 border border-amber-100">
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide mb-1.5">Girvi Pledged Loan Data</h4>
                      <p className="text-xs text-slate-600">Pledged gold/silver ornament photos, loan principal amounts, agreed monthly interest rates, borrower contacts, and settlement receipts.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* 4. HOW WE USE YOUR DATA */}
              <section id="usage" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">4. How We Use Your Data</h2>
                </div>
                <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                  <p>Your data is used strictly to power your showroom operations:</p>
                  <ul className="space-y-2.5">
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-[#FA8112] shrink-0 mt-0.5" />
                      <span><strong>POS Billing & GST Calculations:</strong> Generating official GST tax invoices, hallmark fee breakdowns, and daily sales summaries.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-[#FA8112] shrink-0 mt-0.5" />
                      <span><strong>Real-time Rate Synchronization:</strong> Auto-recalculating inventory valuations whenever 24K gold or silver market rates shift.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-[#FA8112] shrink-0 mt-0.5" />
                      <span><strong>WhatsApp Receipt Dispatch:</strong> Delivering digital PDF invoices directly to your buyers upon checkout.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-[#FA8112] shrink-0 mt-0.5" />
                      <span><strong>Technical Assistance:</strong> Assisting you via phone or remote screen sharing when you request customer support.</span>
                    </li>
                  </ul>
                </div>
              </section>

              {/* 5. SECURITY & ENCRYPTION */}
              <section id="security" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <Lock className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">5. Security & Encryption Standards</h2>
                </div>
                <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                  <p>We deploy rigorous bank-grade security protocols to protect your records:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
                      <div className="font-extrabold text-[#FA8112] text-lg">256-bit SSL/TLS</div>
                      <div className="text-xs text-slate-600 mt-1">Encrypted in transit</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
                      <div className="font-extrabold text-[#FA8112] text-lg">AES-256</div>
                      <div className="text-xs text-slate-600 mt-1">Encrypted at rest</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
                      <div className="font-extrabold text-[#FA8112] text-lg">Daily Backups</div>
                      <div className="text-xs text-slate-600 mt-1">Automated cloud snapshots</div>
                    </div>
                  </div>
                </div>
              </section>

              {/* 6. GIRVI CONFIDENTIALITY */}
              <section id="girvi" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <EyeOff className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">6. Girvi & Ledger Confidentiality</h2>
                </div>
                <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                  <p>
                    We recognize that pledged gold loan records (<strong className="text-slate-900">Girvi</strong>) are sensitive financial assets.
                  </p>
                  <p>
                    All pledged item photographs, borrower identities, principal balances, and interest rates are encrypted and accessible exclusively by your showroom admin account. Our system administrators cannot view unencrypted pledge asset images without your explicit support authorization.
                  </p>
                </div>
              </section>

              {/* 7. WHATSAPP & THIRD-PARTY APIS */}
              <section id="whatsapp" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">7. WhatsApp & Third-Party Integrations</h2>
                </div>
                <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                  <p>
                    When sending digital receipts via WhatsApp, phone numbers and bill PDFs are transmitted securely through standard Meta WhatsApp APIs.
                  </p>
                  <p>
                    We do not store or sell your buyers' phone numbers for third-party marketing or spam campaigns.
                  </p>
                </div>
              </section>

              {/* 8. DATA EXPORT */}
              <section id="export" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">8. Data Ownership & Export Rights</h2>
                </div>
                <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                  <p>
                    You retain 100% full ownership of your data at all times. If you choose to migrate or discontinue service, you can export your entire stock catalog, customer directory, and financial ledgers in Excel or CSV format with a single click.
                  </p>
                </div>
              </section>

              {/* 9. CONTACT DPO */}
              <section id="contact" className="rounded-3xl border border-amber-200/60 bg-white p-8 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#FA8112] flex items-center justify-center font-bold">
                    <Mail className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">9. Contact Data Protection Officer</h2>
                </div>
                <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                  <p>
                    If you have questions regarding this Privacy Policy or wish to request data audits, contact our Data Protection Officer:
                  </p>
                  <div className="rounded-2xl bg-amber-50/70 p-4 border border-amber-100 space-y-2">
                    <div className="font-bold text-slate-900 text-sm">jewellarifyerp Security Team</div>
                    <div className="text-xs text-slate-600 flex items-center gap-2">
                      <Mail className="h-4 w-4 text-[#FA8112]" /> Email: cloudiefyy@gmail.com
                    </div>
                    <div className="text-xs text-slate-600 flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-[#FA8112] shrink-0 mt-0.5" />
                      <span>Address: 108 Orange Business Park Bhawarkua, Indore, MP 452001, India</span>
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
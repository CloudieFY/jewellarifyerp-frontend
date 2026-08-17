import {
  Star, Shield, Cloud, Database, Lock, Activity, KeyRound,
  Zap, Wifi, Smartphone, FileCheck2, ScanBarcode, QrCode, Users2, ServerCog, Users,
  BadgeIndianRupee, Hammer, Wrench,
  BarChart3, Wallet, BookOpen, Bell, LayoutGrid, ShoppingCart,
  Package, TrendingUp, Sparkles, Instagram, Linkedin, Loader2,
  ChevronDown, Menu, X, ArrowRight, ShieldCheck, Gem, Award, CheckCircle2
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { publicAPI } from "@/lib/api";

/* ───────────────────────── NAV ───────────────────────── */

export function Nav({ onOpenMobileMenu }: { onOpenMobileMenu: () => void }) {
  const navLinks = [
    { label: "Home", href: "/" },
    { label: "Features", href: "/#features" },
    { label: "Girvi Loan", href: "/features/girvi" },
    { label: "About Us", href: "/about" },
    { label: "Contact", href: "/contact" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-amber-100/60 bg-white/90 text-slate-800 backdrop-blur-xl shadow-xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 border border-amber-200/80 shadow-xs transition group-hover:scale-105">
            <img src="/logo.png" alt="jewellarifyerp Logo" className="h-7 w-7 object-contain" />
          </div>
          <div className="leading-tight">
            <div className="font-serif text-xl font-bold tracking-tight text-slate-900">
              jewellarifyerp
            </div>
            <div className="-mt-0.5 text-[9px] font-bold tracking-[0.25em] text-[#FA8112]">
              JEWELLERY ERP
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium lg:flex">
          {navLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-slate-600 transition hover:text-[#FA8112] font-semibold"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#FA8112]/40 hover:text-[#FA8112] sm:inline-flex shadow-xs"
          >
            Login
          </Link>
          <DemoRequestModal>
            <Button className="hidden rounded-xl bg-[#FA8112] px-5 py-2 text-sm font-semibold text-white shadow-md shadow-[#FA8112]/20 transition hover:bg-[#FA8112]/90 hover:shadow-lg md:inline-flex cursor-pointer">
              Book Demo
            </Button>
          </DemoRequestModal>
          <button
            onClick={onOpenMobileMenu}
            className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 lg:hidden"
            aria-label="Open Navigation Menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>
    </header>
  );
}

/* ───────────────────────── MOBILE MENU ───────────────────────── */

export function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navLinks = [
    { label: "Home", href: "/" },
    { label: "Features", href: "/#features" },
    { label: "Girvi Loan", href: "/features/girvi" },
    { label: "About Us", href: "/about" },
    { label: "Contact", href: "/contact" },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" aria-hidden="true" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-xs bg-white p-6 shadow-2xl text-slate-900 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Logo" className="h-8 w-8 object-contain" />
              <span className="font-serif text-lg font-bold">jewellarifyerp</span>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-col gap-y-2">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={onClose}
                className="block py-2.5 px-3 rounded-lg text-base font-semibold text-slate-700 hover:bg-amber-50 hover:text-[#FA8112] transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 flex flex-col gap-3">
          <Link
            to="/login"
            onClick={onClose}
            className="w-full text-center rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Login to Dashboard
          </Link>
          <DemoRequestModal>
            <Button className="w-full rounded-xl bg-[#FA8112] py-3 text-sm font-semibold text-white shadow-md shadow-[#FA8112]/20">
              Request Free Demo
            </Button>
          </DemoRequestModal>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── HERO SECTION ───────────────────────── */

function Hero() {
  return (
    <section id="home" className="relative overflow-hidden bg-linear-to-b from-amber-50/80 via-[#FAF3E1]/40 to-white py-16 lg:py-24">
      {/* Glow Effects */}
      <div aria-hidden="true" className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full bg-amber-300/20 blur-[130px]" />
      <div aria-hidden="true" className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-orange-400/15 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-12">
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FA8112]/30 bg-white/90 px-4 py-2 text-xs sm:text-sm font-semibold text-[#FA8112] shadow-sm backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-[#FA8112]" />
              <span>India's Premier Jewellery ERP & Cloud POS</span>
            </div>

            <h1 className="font-serif text-4xl sm:text-6xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
              Streamline Billing, Inventory & Girvi with{" "}
              <span className="bg-linear-to-r from-[#FA8112] via-[#E86D00] to-[#B85000] bg-clip-text text-transparent">
                Milligram Precision
              </span>
            </h1>

            <p className="text-base sm:text-xl leading-relaxed text-slate-600 max-w-2xl">
              An all-in-one cloud management software designed for retail showrooms, wholesalers, and manufacturers. Manage POS sales, metal rate fluctuations, Karigar ledgers, and gold loans effortlessly.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <DemoRequestModal>
                <Button size="lg" className="rounded-xl bg-[#FA8112] px-8 py-6 text-base font-semibold text-white shadow-lg shadow-[#FA8112]/25 transition hover:bg-[#FA8112]/90 hover:scale-[1.02] cursor-pointer">
                  Request a Free Demo <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </DemoRequestModal>

              <a
                href="#features"
                className="rounded-xl border border-slate-300 bg-white px-7 py-3.5 text-base font-semibold text-slate-700 shadow-xs backdrop-blur-md transition hover:bg-slate-50 hover:text-slate-900"
              >
                Explore Modules
              </a>
            </div>

            {/* Hero Benefit Badges */}
            <div className="pt-6 flex flex-wrap items-center gap-3 border-t border-slate-200/80">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100/70 px-3 py-1.5 text-xs font-bold text-slate-800 border border-amber-200/60">
                <Zap className="h-3.5 w-3.5 text-[#FA8112]" /> 30-Second POS Billing
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-orange-100/70 px-3 py-1.5 text-xs font-bold text-slate-800 border border-orange-200/60">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#FA8112]" /> WhatsApp Digital Receipts
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100/70 px-3 py-1.5 text-xs font-bold text-slate-800 border border-amber-200/60">
                <ShieldCheck className="h-3.5 w-3.5 text-[#FA8112]" /> Vault-Grade Security
              </span>
            </div>
          </div>

          {/* Right Hero Image / Live Card Mockup */}
          <div className="lg:col-span-5 relative flex justify-center">
            <div className="relative w-full max-w-lg rounded-3xl border border-amber-200/80 bg-white p-3 shadow-2xl shadow-amber-900/10">
              <img
                src="/dashboard.png"
                alt="Jewellarify ERP Dashboard Preview"
                className="w-full rounded-2xl border border-slate-100 object-cover shadow-xs transition duration-500 hover:scale-[1.02]"
              />

              {/* Floating Sales Badge */}
              <div className="absolute -top-6 -left-6 rounded-2xl bg-slate-900 text-white p-4 shadow-xl border border-slate-700 hidden sm:flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#FA8112]/20 flex items-center justify-center text-[#FA8112]">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium">Today's Showroom Sales</div>
                  <div className="text-base font-extrabold text-white">₹8,45,230</div>
                </div>
              </div>

              {/* Floating Gold Rate Badge */}
              <div className="absolute -bottom-6 -right-6 rounded-2xl bg-white p-4 shadow-xl border border-amber-200 hidden sm:flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center text-[#FA8112]">
                  <Gem className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">24K Gold Rate Sync</div>
                  <div className="text-base font-extrabold text-emerald-600">₹9,845 / gram</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── SECTION WRAPPER ───────────────────────── */

const Section = ({ id, children, className = "" }: { id: string; children: ReactNode; className?: string }) => (
  <section id={id} className={`py-16 sm:py-24 ${className}`}>
    <div className="mx-auto max-w-7xl px-6 lg:px-8">{children}</div>
  </section>
);

const SectionTitle = ({ title, subtitle, badge }: { title: string; subtitle: string; badge?: string }) => (
  <div className="mx-auto max-w-3xl text-center mb-12 sm:mb-16">
    {badge && (
      <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#FA8112] mb-3">
        {badge}
      </span>
    )}
    <h2 className="font-serif text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">{title}</h2>
    <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">{subtitle}</p>
  </div>
);

/* ───────────────────────── SHOWROOM IMPACT HIGHLIGHTS ───────────────────────── */

function ShowroomImpactHighlights() {
  const highlights = [
    {
      icon: Zap,
      title: "30-Second POS Billing",
      desc: "Instant barcode scan, automatic karat purity conversion & 1-click GST invoices.",
      stat: "70% Faster Checkout",
    },
    {
      icon: ShieldCheck,
      title: "Milligram Precision",
      desc: "Zero-error calculation engine for fine gold, silver, and diamond stone weight.",
      stat: "100% Accuracy",
    },
    {
      icon: BadgeIndianRupee,
      title: "Automated Girvi Loan",
      desc: "Pledged gold item records, photo ledgers & compound interest calculations.",
      stat: "Zero Paperwork",
    },
  ];

  return (
    <div className="bg-gradient-to-r from-slate-950 via-[#2A1706] to-slate-900 py-12 text-white border-y border-amber-900/40 relative overflow-hidden">
      <div aria-hidden="true" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[500px] rounded-full bg-[#FA8112]/15 blur-[120px]" />
      
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {highlights.map((h, i) => (
            <div key={i} className="flex items-start gap-4 rounded-2xl bg-white/5 p-6 border border-white/10 backdrop-blur-md transition hover:bg-white/10 hover:border-[#FA8112]/50">
              <div className="h-12 w-12 rounded-xl bg-[#FA8112] text-white flex items-center justify-center shrink-0 shadow-lg shadow-[#FA8112]/30">
                <h.icon className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-lg font-bold text-white">{h.title}</h3>
                  <span className="text-[10px] font-extrabold text-[#FA8112] bg-[#FA8112]/20 px-2 py-0.5 rounded-full border border-[#FA8112]/30">
                    {h.stat}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed font-normal">{h.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── WHY CHOOSE ───────────────────────── */

function WhyChoose() {
  const features = [
    { icon: Zap, title: "Fast POS Billing", desc: "Issue GST bills in under 30 seconds" },
    { icon: Cloud, title: "Cloud Architecture", desc: "Access showroom metrics from anywhere" },
    { icon: Wifi, title: "Offline Sync Mode", desc: "Never stop billing even without internet" },
    { icon: Smartphone, title: "Mobile Dashboard", desc: "Real-time reports on iOS and Android" },
    { icon: FileCheck2, title: "GST Ready", desc: "Automatic tax splits & HSN compliance" },
    { icon: ScanBarcode, title: "Barcode & RFID", desc: "Instant stock lookup & bulk audit" },
    { icon: QrCode, title: "QR WhatsApp Bills", desc: "Digital receipts sent directly to customers" },
    { icon: Users2, title: "Multi-User Roles", desc: "Granular access for counter staff & managers" },
    { icon: ServerCog, title: "Auto Vault Backups", desc: "Encrypted daily cloud backup" },
    { icon: Database, title: "Isolated Database", desc: "Dedicated storage per shop tenant" },
    { icon: KeyRound, title: "Secure Login", desc: "Two-factor auth and IP restriction" },
    { icon: BarChart3, title: "Executive Analytics", desc: "Profit, stock velocity, and Karigar ledgers" },
  ];

  return (
    <Section id="features" className="bg-white">
      <SectionTitle
        badge="Engineered for Jewellers"
        title="Why Top Jewellers Prefer jewellarifyerp"
        subtitle="Designed specifically for the unique demands of retail jewellery, Girvi loans, Karigar wastage, and multi-branch inventory."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((f) => (
          <div
            key={f.title}
            className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/50 p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:border-[#FA8112]/40 hover:shadow-xl"
          >
            <div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100/70 text-[#FA8112] transition-colors group-hover:bg-[#FA8112] group-hover:text-white">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-serif text-lg font-bold text-slate-900">{f.title}</h3>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ───────────────────────── CORE FEATURE SHOWCASE ───────────────────────── */

function CoreFeatures() {
  const features = [
    {
      title: "Real-Time Precious Metal Inventory",
      desc: "Track gold, silver, and diamond inventory with net weight, gross weight, stone weight, and Karat purity breakdown down to the milligram.",
      bullets: [
        "Track item-wise stock in real-time across categories, trays, and vaults.",
        "Automatic stock deductions post POS sales, repairs, and branch transfers.",
        "Smart alerts for low stock, dead inventory, and re-order thresholds.",
      ],
      img: "/inventory.png",
      imgAlt: "Inventory Management Dashboard",
    },
    {
      title: "Customer & Scheme Management",
      desc: "Build lasting customer relationships with complete purchase history, scheme tracking, and automated birthday/anniversary reminders.",
      bullets: [
        "Detailed customer profiles with Karat preference and credit limits.",
        "Manage monthly Gold Savings Schemes with automatic installment tracking.",
        "Automated WhatsApp greetings and promotional offers.",
      ],
      img: "/customer.png",
      imgAlt: "Customer Management Dashboard",
    },
    {
      title: "Smart Digital Catalogue & Barcoding",
      desc: "Generate custom barcode tags for ornaments and build shareable digital catalogues with AI background removal.",
      bullets: [
        "Print custom jewellery tags with metal purity, weight, and QR codes.",
        "AI-powered background removal for crisp product photography.",
        "Instant digital catalog sharing on WhatsApp and website.",
      ],
      img: "/catalog.png",
      imgAlt: "Smart Catalog",
    },
    {
      title: "Smart Telemetry & Business Alerts",
      desc: "Never miss crucial business events. Receive instant notifications for gold rate spikes, overdue Girvi loans, and daily counter reconciliations.",
      bullets: [
        "Real-time gold rate updates & automated price recalculations.",
        "Automated WhatsApp & SMS reminders for payment dues.",
        "Daily counter closure and cash drawer balance verification.",
      ],
      img: "/alert.png",
      imgAlt: "Smart Alerts",
    },
  ];

  return (
    <Section id="core-features" className="bg-linear-to-b from-slate-50 via-amber-50/20 to-slate-50 py-24">
      <SectionTitle
        badge="Complete Operational Control"
        title="Everything You Need to Run a Modern Showroom"
        subtitle="Manage billing, inventory, customer schemes, Karigar work, Girvi gold loans, and accounting from a unified cloud console."
      />

      <div className="mx-auto mt-16 max-w-7xl space-y-24">
        {features.map((feature, index) => {
          const reverse = index % 2 !== 0;

          return (
            <div key={feature.title} className="grid items-center gap-12 lg:grid-cols-12">
              {/* IMAGE */}
              <div className={`${reverse ? "lg:order-2 lg:col-span-6" : "lg:order-1 lg:col-span-6"} flex justify-center`}>
                <div className="relative rounded-3xl border border-amber-200/80 bg-white p-3 shadow-2xl shadow-slate-300/60">
                  <img
                    src={feature.img}
                    alt={feature.imgAlt}
                    className="w-full max-w-md rounded-2xl object-cover transition duration-500 hover:scale-[1.02]"
                  />
                </div>
              </div>

              {/* CONTENT */}
              <div className={`${reverse ? "lg:order-1 lg:col-span-6" : "lg:order-2 lg:col-span-6"} space-y-6`}>
                <h3 className="font-serif text-2xl sm:text-4xl font-bold text-slate-900 leading-snug">
                  {feature.title}
                </h3>

                <p className="text-base sm:text-lg leading-relaxed text-slate-600">
                  {feature.desc}
                </p>

                <ul className="space-y-3.5 pt-2">
                  {feature.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#FA8112]" />
                      <span className="text-slate-700 text-sm sm:text-base font-medium">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ───────────────────────── MODULE OVERVIEW ───────────────────────── */

function ModuleOverview() {
  const modules = [
    { icon: LayoutGrid, name: "Dashboard" },
    { icon: ShoppingCart, name: "POS Billing" },
    { icon: BadgeIndianRupee, name: "Girvi Loans" },
    { icon: Package, name: "Inventory" },
    { icon: ScanBarcode, name: "Barcode Printing" },
    { icon: TrendingUp, name: "Gold Rate Sync" },
    { icon: Users, name: "Customer CRM" },
    { icon: Hammer, name: "Karigar Ledger" },
    { icon: Sparkles, name: "Digital Catalog" },
    { icon: Wrench, name: "Repairs & Jobs" },
    { icon: BookOpen, name: "Daily Udhari Ledger" },
    { icon: BarChart3, name: "GST Reports" },
    { icon: Bell, name: "WhatsApp Alerts" },
    { icon: Wallet, name: "Expenses" },
    { icon: Lock, name: "Role Security" },
  ];

  return (
    <Section id="modules" className="bg-white">
      <SectionTitle
        badge="Modular ERP Architecture"
        title="Comprehensive Suite of Jewellery Modules"
        subtitle="Activate the modules your showroom needs today and seamlessly expand as you open new branches."
      />
      <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-3 md:grid-cols-5">
        {modules.map((m) => (
          <div
            key={m.name}
            className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 transition-all duration-300 hover:bg-white hover:border-[#FA8112]/40 hover:shadow-lg hover:-translate-y-1"
          >
            <div className="h-12 w-12 rounded-xl bg-amber-100/80 text-[#FA8112] flex items-center justify-center">
              <m.icon className="h-6 w-6" />
            </div>
            <span className="text-sm font-bold text-slate-800">{m.name}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ───────────────────────── SECURITY ───────────────────────── */

function Security() {
  const highlights = [
    { icon: Shield, title: "SSL Encryption", desc: "Bank-grade TLS/SSL encryption for every API call and transaction." },
    { icon: Cloud, title: "Daily Cloud Vault", desc: "Automated daily cloud backups stored in redundant data centers." },
    { icon: Database, title: "Isolated Tenant Database", desc: "Complete data separation guarantees zero cross-shop data leaks." },
    { icon: Users2, title: "Role-Based Access", desc: "Define granular staff permissions for sales, inventory, and ledger." },
    { icon: Activity, title: "Audit Trail Logging", desc: "Complete activity log tracking edits, discounts, and deletions." },
    { icon: Lock, title: "Two-Factor Auth", desc: "Encrypted password hashing and biometric login compatibility." },
  ];

  return (
    <Section id="security" className="bg-slate-900 text-white rounded-3xl my-8">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#FA8112] mb-3">
          <ShieldCheck className="h-4 w-4 text-[#FA8112]" /> Bank-Grade Infrastructure
        </span>
        <h2 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-white">
          Uncompromised Security & Data Vault
        </h2>
        <p className="mt-4 text-base sm:text-lg text-slate-300">
          Your inventory and financial ledgers are protected by military-grade multi-tenant architecture.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {highlights.map((h) => (
          <div key={h.title} className="rounded-2xl border border-slate-800 bg-slate-800/50 p-6 backdrop-blur-md">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#FA8112] text-white shadow-lg shadow-[#FA8112]/20">
              <h.icon className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-serif text-xl font-bold text-white">{h.title}</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">{h.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ───────────────────────── TESTIMONIALS ───────────────────────── */

function Testimonials() {
  const reviews = [
    {
      name: "Ramesh Soni",
      shop: "Arihant Jewellers, Jaipur",
      review: "jewellarifyerp transformed our showroom billing. Fast barcode scanning, accurate gold rate conversion, and instant WhatsApp bills have won our customers' trust.",
      initials: "RS"
    },
    {
      name: "Priya Mehta",
      shop: "Mehta & Sons, Mumbai",
      review: "The Girvi loan and Karigar wastage module is brilliant. We track pledged gold items and Karigar balances effortlessly without manual ledger errors.",
      initials: "PM"
    },
    {
      name: "Ankit Verma",
      shop: "Verma Diamonds, Surat",
      review: "Managing 3 showrooms used to be chaotic. With jewellarifyerp's cloud sync, I monitor real-time stock transfers and daily sales from my smartphone.",
      initials: "AV"
    },
  ];

  return (
    <Section id="testimonials" className="bg-white">
      <SectionTitle
        badge="Customer Stories"
        title="Trusted by Premier Jewellers Across India"
        subtitle="Discover why leading retail jewellers rely on jewellarifyerp for daily showroom operations."
      />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {reviews.map((r) => (
          <div
            key={r.name}
            className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-slate-50/60 p-8 shadow-xs transition hover:shadow-xl hover:border-amber-200"
          >
            <div>
              <div className="flex text-amber-400 mb-4" role="img" aria-label="5 out of 5 stars">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <blockquote className="text-base sm:text-lg leading-relaxed text-slate-700 font-medium">
                &ldquo;{r.review}&rdquo;
              </blockquote>
            </div>

            <figcaption className="mt-8 flex items-center gap-4 pt-4 border-t border-slate-200/60">
              <div className="h-11 w-11 rounded-full bg-[#FA8112] text-white flex items-center justify-center font-bold font-serif text-base">
                {r.initials}
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">{r.name}</div>
                <div className="text-xs text-slate-500">{r.shop}</div>
              </div>
            </figcaption>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ───────────────────────── FAQ ───────────────────────── */

function Faq() {
  const faqs = [
    {
      q: "Is my showroom data secure and isolated?",
      a: "Yes, completely. We utilize enterprise multi-tenant database isolation. Your inventory, sales logs, and customer records are physically segregated in encrypted cloud vaults."
    },
    {
      q: "Can I use jewellarifyerp offline during internet outages?",
      a: "Yes! Our POS billing module includes offline sync capability. You can continue issuing invoices during local network dropouts, and data will auto-sync once connected."
    },
    {
      q: "Does it support GST calculation and HSN codes?",
      a: "Yes, jewellarifyerp is 100% GST compliant. It computes GST splits (CGST/SGST/IGST), handles making charges, hallmark fees, and generates GSTR-compatible reports."
    },
    {
      q: "Can I import my existing customer and stock data?",
      a: "Yes, our onboarding team provides free data migration assistance to seamlessly import your Excel/CSV records, customer ledgers, and barcode tags."
    },
  ];

  return (
    <Section id="faq" className="bg-slate-50">
      <SectionTitle
        badge="Got Questions?"
        title="Frequently Asked Questions"
        subtitle="Everything you need to know about setting up jewellarifyerp for your showroom."
      />
      <div className="mx-auto max-w-3xl space-y-4">
        {faqs.map((faq) => (
          <details key={faq.q} className="group rounded-2xl border border-slate-200 bg-white p-6 transition shadow-xs">
            <summary className="flex cursor-pointer items-center justify-between gap-4">
              <h3 className="font-serif text-lg font-bold text-slate-900">{faq.q}</h3>
              <ChevronDown className="h-5 w-5 shrink-0 text-slate-500 transition group-open:rotate-180" />
            </summary>
            <p className="mt-4 text-sm sm:text-base leading-relaxed text-slate-600">{faq.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

/* ───────────────────────── FINAL CTA ───────────────────────── */

function FinalCta() {
  return (
    <section id="trial" className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-[#2A1706] py-20 sm:py-24 text-white">
      <div aria-hidden="true" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[600px] rounded-full bg-[#FA8112]/20 blur-[140px]" />
      
      <div className="relative mx-auto max-w-5xl px-6 text-center lg:px-8">
        <Award className="mx-auto h-12 w-12 text-[#FA8112] mb-4" />
        <h2 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-white">
          Ready to Elevate Your Jewellery Business?
        </h2>
        <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto">
          Experience the future of Jewellery ERP software. Schedule your free personalized demo today.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <DemoRequestModal>
            <Button size="lg" className="rounded-xl bg-[#FA8112] px-8 py-6 text-base font-semibold text-white shadow-xl shadow-[#FA8112]/30 transition hover:bg-[#FA8112]/90 hover:scale-105 cursor-pointer">
              Schedule Free Live Demo <ArrowRight className="ml-1 h-5 w-5" />
            </Button>
          </DemoRequestModal>
          <Link
            to="/contact"
            className="rounded-xl border border-slate-700 bg-slate-800/80 px-8 py-3.5 text-base font-semibold text-white backdrop-blur-md transition hover:bg-slate-700"
          >
            Contact Sales
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── FOOTER ───────────────────────── */

export function Footer() {
  const links = {
    Product: [
      { name: "Home", href: "/" },
      { name: "Features", href: "/#features" },
      { name: "Girvi Module", href: "/features/girvi" },
    ],
    Company: [
      { name: "About Us", href: "/about" },
      { name: "Contact Us", href: "/contact" },
    ],
    Legal: [
      { name: "Privacy Policy", href: "/privacy-policy" },
      { name: "Terms & Conditions", href: "/terms-and-conditions" },
    ],
  };

  const socials = [
    { name: "Instagram", href: "https://www.instagram.com/jewellarifyerp/", icon: Instagram },
    { name: "LinkedIn", href: "https://www.linkedin.com/company/cloudiefy/", icon: Linkedin },
  ];

  return (
    <footer id="contact" className="bg-slate-950 text-slate-400 border-t border-slate-800">
      <div className="mx-auto max-w-7xl px-6 pb-8 pt-16 sm:pt-20 lg:px-8 lg:pt-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Brand Column */}
          <div className="max-w-md">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white p-1.5 flex items-center justify-center">
                <img src="/logo.png" alt="jewellarifyerp Logo" className="h-7 w-7 object-contain" />
              </div>
              <div className="leading-tight">
                <div className="font-serif text-2xl font-bold text-white">jewellarifyerp</div>
                <div className="-mt-0.5 text-[9px] font-bold tracking-[0.25em] text-[#FA8112]">
                  JEWELLERY ERP
                </div>
              </div>
            </div>
            <p className="mt-6 text-sm sm:text-base leading-relaxed text-slate-400">
              The premier cloud-based ERP solution built specifically for jewellery retailers, Girvi loan operations, and multi-showroom chains across India.
            </p>
            <div className="mt-8 flex space-x-6">
              {socials.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-[#FA8112] transition-colors"
                >
                  <span className="sr-only">{s.name}</span>
                  <s.icon className="h-6 w-6" />
                </a>
              ))}
            </div>
          </div>

          {/* Links Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
            <div>
              <h3 className="text-sm font-bold tracking-wider uppercase text-white">Product</h3>
              <ul role="list" className="mt-6 space-y-3.5">
                {links.Product.map((l) => (
                  <li key={l.name}>
                    <a href={l.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                      {l.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wider uppercase text-white">Company</h3>
              <ul role="list" className="mt-6 space-y-3.5">
                {links.Company.map((l) => (
                  <li key={l.name}>
                    <a href={l.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                      {l.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wider uppercase text-white">Legal</h3>
              <ul role="list" className="mt-6 space-y-3.5">
                {links.Legal.map((l) => (
                  <li key={l.name}>
                    <a href={l.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                      {l.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-16 border-t border-slate-800 pt-8 sm:mt-20 lg:mt-24 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} jewellarifyerp Technologies. All Rights Reserved.
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Built with precision for jewellery retailers</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ───────────────────────── WHATSAPP FLOATING BUTTON ───────────────────────── */

export function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/919691365052?text=Hello!%20I'm%20looking%20for%20a%20Jewellery%20Management%20Software.%0APlease%20contact%20me%20with%20the%20demo%20and%20subscription%20plans."
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-xl transition-transform hover:scale-110 active:scale-95"
      aria-label="Chat with us on WhatsApp"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.894 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01s-.521.074-.792.372c-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
      </svg>
    </a>
  );
}

/* ───────────────────────── DEMO REQUEST MODAL ───────────────────────── */

export function DemoRequestModal({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const initialFormState = { name: "", shopName: "", phone: "", email: "", address: "" };
  const [form, setForm] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.shopName || !form.phone) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setIsSubmitting(true);
    try {
      await publicAPI.demoRequests.create(form);
      toast.success("Demo request submitted! We will contact you shortly.");
      setOpen(false);
      setForm(initialFormState);
    } catch (error) {
      toast.error("Failed to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md border-amber-100 bg-white">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-bold text-slate-900">Book a Personalized Live Demo</DialogTitle>
          <DialogDescription className="text-slate-600 text-sm">
            Fill out your details below and our jewellery domain team will contact you within 15 minutes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label htmlFor="name" className="text-xs font-bold uppercase text-slate-700">Full Name *</Label>
            <Input id="name" value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })} className="mt-1" placeholder="e.g. Rajesh Soni" required />
          </div>
          <div>
            <Label htmlFor="shopName" className="text-xs font-bold uppercase text-slate-700">Showroom / Shop Name *</Label>
            <Input id="shopName" value={form.shopName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, shopName: e.target.value })} className="mt-1" placeholder="e.g. Soni Jewellers" required />
          </div>
          <div>
            <Label htmlFor="phone" className="text-xs font-bold uppercase text-slate-700">Phone Number *</Label>
            <Input id="phone" value={form.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, phone: e.target.value })} className="mt-1" placeholder="9000000000" required />
          </div>
          <div>
            <Label htmlFor="email" className="text-xs font-bold uppercase text-slate-700">Email Address</Label>
            <Input id="email" type="email" value={form.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, email: e.target.value })} className="mt-1" placeholder="e.g. info@sonijewellers.com" />
          </div>
          <div>
            <Label htmlFor="address" className="text-xs font-bold uppercase text-slate-700">City / Location</Label>
            <Input id="address" value={form.address} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, address: e.target.value })} className="mt-1" placeholder="e.g. Jaipur, Rajasthan" />
          </div>
          <DialogFooter className="pt-2">
            <Button type="submit" disabled={isSubmitting} className="w-full bg-[#FA8112] hover:bg-[#FA8112]/90 text-white font-bold py-3 rounded-xl shadow-md">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Submit Demo Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── MAIN LANDING PAGE ───────────────────────── */

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <div className="bg-white font-sans text-slate-900 antialiased selection:bg-[#FA8112]/20 selection:text-[#FA8112]">
      <Nav onOpenMobileMenu={() => setMobileMenuOpen(true)} />
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <WhatsAppButton />
      <main>
        <Hero />
        <ShowroomImpactHighlights />
        <WhyChoose />
        <CoreFeatures />
        <ModuleOverview />
        <Security />
        <Testimonials />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
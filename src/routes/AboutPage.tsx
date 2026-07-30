import {
  Target,
  ShieldCheck,
  Award,
  Sparkles,
  Gem,
  CheckCircle2,
  HeartHandshake,
  ArrowRight,
  Lock,
  Scale,
  Zap,
  Star,
  BadgeCheck,
  ChevronRight,
  Layers,
  ShoppingCart,
  BadgeIndianRupee,
  Hammer
} from "lucide-react";
import { Footer, Nav, MobileMenu, WhatsAppButton, DemoRequestModal } from "./LandingPage";
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Section = ({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) => (
  <section id={id} className={`py-16 sm:py-24 ${className}`}>
    <div className="mx-auto max-w-7xl px-6 lg:px-8">{children}</div>
  </section>
);

export default function AboutPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const values = [
    {
      icon: Scale,
      title: "Milligram Precision",
      description:
        "Jewellery demands exactness. Our calculation engine handles karat purities, wastage percentages, and multi-currency billing down to the milligram.",
      badge: "Zero Error Engine"
    },
    {
      icon: Lock,
      title: "Vault-Grade Security",
      description:
        "Your business data is stored with multi-tenant isolation, encrypted backups, and granular role permissions so your trade secrets remain safe.",
      badge: "ISO Standard Protocols"
    },
    {
      icon: Zap,
      title: "30-Second Billing",
      description:
        "Designed for lightning-fast showroom checkout. Scan barcode tags, apply gold rates automatically, generate GST invoices, and send WhatsApp receipts.",
      badge: "Ultra-Fast Checkout"
    },
    {
      icon: HeartHandshake,
      title: "Jeweller-Centric Support",
      description:
        "We don't just provide software; we partner in your growth. From initial data migration to staff training, our team stands by you 24/7.",
      badge: "White-Glove Service"
    },
  ];

  const softwareServices = [
    {
      icon: ShoppingCart,
      title: "Retail Showroom POS & Billing",
      target: "Single Showrooms & Retail Chains",
      features: [
        "30-second POS checkout with automatic 24K/22K gold rate conversion",
        "Net weight, stone deduction, making charges, and hallmark fee calculation",
        "Instant GST invoice generation & automated WhatsApp digital receipts"
      ],
      badge: "Retail Solution"
    },
    {
      icon: BadgeIndianRupee,
      title: "Girvi & Gold Loan Management",
      target: "Pledged Asset Lenders & Pawn Operations",
      features: [
        "Pledged ornament records with high-res photo uploads and barcode tags",
        "Customizable monthly/daily interest rates & compound interest engine",
        "Partial settlements, full closures, and market liability forwarding"
      ],
      badge: "Finance Module"
    },
    {
      icon: Hammer,
      title: "Karigar & Manufacturing Ledger",
      target: "Goldsmiths, Craftsmen & Wholesale Units",
      features: [
        "Raw metal issue and return tracking down to the milligram",
        "Karat touch purity ledger & automated wastage percentage calculations",
        "Real-time job card progress and repair status tracking"
      ],
      badge: "Craftsman Suite"
    },
    {
      icon: Layers,
      title: "Enterprise Multi-Branch Cloud",
      target: "Multi-Store Chains & Franchise Networks",
      features: [
        "Centralized real-time stock visibility across all showrooms and vaults",
        "Inter-branch stock transfers with approval workflows and audit trails",
        "Role-based staff permissions, 2FA, and executive analytics dashboards"
      ],
      badge: "Enterprise Platform"
    }
  ];

  return (
    <div className="bg-[#FAF8F5] font-sans text-[#1E293B] antialiased selection:bg-[#FA8112]/20 selection:text-[#FA8112]">
      <Helmet>
        <title>About Us | jewellarifyerp - Empowering Jewellery Retailers</title>
        <meta
          name="description"
          content="Learn about jewellarifyerp, the premier cloud ERP software built for jewellery retail, Girvi loan management, inventory tracking, and GST billing."
        />
      </Helmet>

      <Nav onOpenMobileMenu={() => setMobileMenuOpen(true)} />
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <WhatsAppButton />

      <main>
        {/* HERO SECTION */}
        <section className="relative overflow-hidden bg-linear-to-b from-amber-50/80 via-[#FAF3E1]/50 to-[#FAF8F5] pt-16 pb-24 sm:pt-24 sm:pb-32">
          {/* Ambient Decorative Glow Effects */}
          <div aria-hidden="true" className="absolute top-0 right-1/4 -z-10 h-[500px] w-[500px] rounded-full bg-amber-300/20 blur-[130px]" />
          <div aria-hidden="true" className="absolute bottom-10 left-10 -z-10 h-[400px] w-[400px] rounded-full bg-orange-400/15 blur-[120px]" />

          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              {/* Top Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-[#FA8112]/25 bg-white/80 px-4 py-2 text-xs sm:text-sm font-semibold text-[#FA8112] shadow-sm backdrop-blur-md transition hover:border-[#FA8112]/40">
                <Gem className="h-4 w-4 animate-spin-slow text-[#FA8112]" />
                <span>Crafting Digital Excellence for Jewellery Pioneers</span>
              </div>

              {/* Title */}
              <h1 className="mt-8 font-serif text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 leading-[1.15]">
                Bridging Ancient Craftsmanship with{" "}
                <span className="bg-linear-to-r from-[#FA8112] via-[#E86D00] to-[#B85000] bg-clip-text text-transparent">
                  Modern Cloud Tech
                </span>
              </h1>

              {/* Subtitle */}
              <p className="mt-6 text-lg sm:text-xl leading-relaxed text-slate-600 max-w-3xl mx-auto font-normal">
                jewellarifyerp was created with a single vision: to free jewellers from outdated software and manual ledgers by offering a beautifully designed, lightning-fast cloud ERP tailored specifically for gold, silver, and diamond trade.
              </p>

              {/* Action Buttons */}
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <DemoRequestModal>
                  <Button size="lg" className="rounded-xl bg-[#FA8112] px-8 py-6 text-base font-semibold text-white shadow-lg shadow-[#FA8112]/25 transition-all hover:bg-[#FA8112]/90 hover:scale-[1.02] cursor-pointer">
                    Book a Free Demo <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </DemoRequestModal>
                <a
                  href="#story"
                  className="rounded-xl border border-slate-300 bg-white/80 px-7 py-3.5 text-base font-semibold text-slate-700 shadow-xs backdrop-blur-md transition hover:bg-slate-50 hover:text-slate-900"
                >
                  Our Story
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* OUR STORY & MISSION */}
        <Section id="story">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left Narrative */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-lg bg-orange-100/70 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#FA8112]">
                <Target className="w-3.5 h-3.5" /> Our Purpose & Origin
              </div>
              <h2 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
                Designed specifically for the intricacies of the Jewellery Trade
              </h2>
              <p className="text-base sm:text-lg leading-relaxed text-slate-600">
                Unlike generic accounting tools, jewellery management demands deep domain understanding—calculating net weight vs gross weight, tracking wastage, managing metal rates that update continuously, issuing hallmark certificates, and tracking pledged Girvi loans.
              </p>
              <p className="text-base sm:text-lg leading-relaxed text-slate-600">
                We spent months shadowing top retail jewellers and karigars across India to build a system that feels natural, eliminates costly human errors, and delivers executive-grade control over inventory and cash flows.
              </p>

              {/* Highlights checklist */}
              <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  "Multi-Metal Support (Gold, Silver, Platinum)",
                  "Automatic Metal Rate Invoicing & GST",
                  "Barcode Tagging & RFID Compatibility",
                  "Integrated Girvi Loan & Interest Engine",
                  "Karigar Issue & Wastage Ledger",
                  "WhatsApp Customer Invoice Sharing"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[#FA8112]" />
                    <span className="text-sm font-medium text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Visual Card */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto rounded-3xl border border-amber-200/80 bg-white p-4 shadow-2xl shadow-amber-900/10">
                <img
                  src="/dashboard.png"
                  alt="jewellarifyerp Dashboard Preview"
                  className="rounded-2xl border border-slate-100 object-cover shadow-inner w-full"
                />
                
                {/* Floating Badge 1 */}
                <div className="absolute -bottom-6 -left-6 rounded-2xl bg-slate-900 text-white p-4 shadow-xl border border-slate-700 hidden sm:flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#FA8112]/20 flex items-center justify-center text-[#FA8112]">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-medium">Enterprise Security</div>
                    <div className="text-sm font-bold text-white">100% Isolated Data</div>
                  </div>
                </div>

                {/* Floating Badge 2 */}
                <div className="absolute -top-6 -right-6 rounded-2xl bg-white p-4 shadow-xl border border-amber-100 hidden sm:flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center text-[#FA8112]">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Daily Operations</div>
                    <div className="text-sm font-bold text-slate-900">Zero Maintenance Needed</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* CORE PILLARS & VALUES */}
        <section className="bg-linear-to-b from-[#FAF8F5] via-amber-50/40 to-[#FAF8F5] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#FA8112]">
                <Award className="h-3.5 w-3.5" /> What Sets Us Apart
              </span>
              <h2 className="mt-4 font-serif text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">
                Built on Pillars of Precision, Trust & Innovation
              </h2>
              <p className="mt-4 text-base sm:text-lg text-slate-600">
                Every feature in jewellarifyerp is engineered with uncompromising standards to safeguard your profitability and showroom operations.
              </p>
            </div>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {values.map((v, i) => (
                <div
                  key={i}
                  className="group relative flex flex-col justify-between rounded-3xl border border-amber-200/60 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-[#FA8112]/40"
                >
                  <div>
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-[#FA8112] border border-amber-100 transition-colors group-hover:bg-[#FA8112] group-hover:text-white">
                      <v.icon className="h-7 w-7" />
                    </div>
                    <h3 className="mt-6 font-serif text-xl font-bold text-slate-900">{v.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{v.description}</p>
                  </div>
                  <div className="mt-6 border-t border-slate-100 pt-4 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#FA8112] bg-orange-50 px-2.5 py-1 rounded-md">{v.badge}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* COMPREHENSIVE SOFTWARE SOLUTIONS WE SERVE */}
        <Section>
          <div className="mx-auto max-w-4xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#FA8112]">
              <Sparkles className="h-3.5 w-3.5" /> What We Serve & Deliver
            </span>
            <h2 className="mt-4 font-serif text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">
              End-to-End Solutions for Every Jewellery Business
            </h2>
            <p className="mt-4 text-slate-600 text-base sm:text-lg max-w-2xl mx-auto">
              From retail billing counters to Girvi pledge vaults and Karigar manufacturing workshops, discover how jewellarifyerp powers your operations.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
            {softwareServices.map((s, idx) => (
              <div
                key={idx}
                className="group relative flex flex-col justify-between rounded-3xl border border-amber-200/70 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-[#FA8112]/40"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-[#FA8112] border border-amber-100 transition-colors group-hover:bg-[#FA8112] group-hover:text-white">
                      <s.icon className="h-7 w-7" />
                    </div>
                    <span className="text-xs font-bold text-[#FA8112] bg-orange-50 px-3 py-1 rounded-full border border-orange-200/60">
                      {s.badge}
                    </span>
                  </div>

                  <h3 className="mt-6 font-serif text-2xl font-bold text-slate-900">{s.title}</h3>
                  <div className="mt-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Serving: {s.target}
                  </div>

                  <ul className="mt-6 space-y-3">
                    {s.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#FA8112] mt-0.5" />
                        <span className="text-sm text-slate-600 font-medium leading-snug">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* CUSTOMER TESTIMONIAL SPOTLIGHT */}
        <section className="bg-amber-50/60 py-20 border-y border-amber-200/50">
          <div className="mx-auto max-w-5xl px-6 lg:px-8 text-center">
            <div className="flex justify-center gap-1 text-amber-500 mb-6">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-6 w-6 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <blockquote className="font-serif text-2xl sm:text-3xl font-semibold text-slate-900 leading-snug">
              &ldquo;jewellarifyerp replaced three fragmented systems in our showroom. Billing time was cut in half, and our Girvi loan management is now 100% automated and error-free.&rdquo;
            </blockquote>
            <div className="mt-8 flex items-center justify-center gap-4">
              <div className="h-12 w-12 rounded-full bg-[#FA8112] text-white flex items-center justify-center font-bold text-lg font-serif">
                JS
              </div>
              <div className="text-left">
                <div className="font-bold text-slate-900">Rajesh Jewellers</div>
                <div className="text-xs text-slate-500">Multi-Showroom Retailer, MP</div>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CALL TO ACTION */}
        <section className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-[#2A1706] py-20 sm:py-24 text-white">
          <div aria-hidden="true" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[600px] rounded-full bg-[#FA8112]/20 blur-[140px]" />
          
          <div className="relative mx-auto max-w-5xl px-6 text-center lg:px-8">
            <BadgeCheck className="mx-auto h-12 w-12 text-[#FA8112] mb-4" />
            <h2 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-white">
              Ready to Modernize Your Jewellery Business?
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto">
              Join 500+ successful jewellers who trust jewellarifyerp for billing, inventory, Girvi, and accounting. Get started today with a personalized live demo.
            </p>

            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <DemoRequestModal>
                <Button size="lg" className="rounded-xl bg-[#FA8112] px-8 py-6 text-base font-semibold text-white shadow-xl shadow-[#FA8112]/30 transition hover:bg-[#FA8112]/90 hover:scale-105 cursor-pointer">
                  Schedule Free Live Demo <ChevronRight className="ml-1 h-5 w-5" />
                </Button>
              </DemoRequestModal>
              <Link
                to="/contact"
                className="rounded-xl border border-slate-700 bg-slate-800/80 px-8 py-3.5 text-base font-semibold text-white backdrop-blur-md transition hover:bg-slate-700"
              >
                Contact Sales Team
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
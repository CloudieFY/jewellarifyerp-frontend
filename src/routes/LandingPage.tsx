import {
  Check, Star, Shield, Cloud, Database, Lock, Activity, KeyRound,
  Zap, Wifi, Smartphone, FileCheck2, ScanBarcode, QrCode, Users2, ServerCog, Users, ShoppingBag,
  ReceiptText, Truck, BadgeIndianRupee, Hammer, Wrench,
  Coins, BarChart3, Calculator, Wallet, BookOpen, Bell, LayoutGrid, ShoppingCart,
  ClipboardList, Package, TrendingUp, Sparkles, Instagram, Linkedin, Loader2,
  ChevronDown, Menu, X,
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
  const links = ["Home", "Features", "Modules", "Contact"];
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 text-[#222222] backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <a href="#" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="jewellarifyerp Logo" className="h-10 w-10 object-contain" />
          <div className="leading-tight">
            <div className="font-serif text-xl font-semibold">
              jewellarifyerp
            </div>
            <div className="-mt-0.5 text-[10px] tracking-[0.25em] text-[#FA8112]">JEWELLERY ERP</div>
          </div>
        </a>
        <nav className="hidden items-center gap-7 text-sm font-medium lg:flex">
          {links.map((l) => (
            <a key={l} href={
              l === 'Contact' ? '/contact' :
              `/${l === 'Home' ? '' : '#' + l.toLowerCase()}`
            } className="text-[#222222]/80 transition hover:text-[#FA8112]">
              {l}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login" className="hidden rounded-md px-4 py-2 text-sm font-semibold text-[#222222]/80 transition hover:text-[#FA8112] sm:inline-flex">
            Login
          </Link>
          <DemoRequestModal>
            <Button className="hidden rounded-md bg-[#FA8112] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#FA8112]/90 md:inline-flex animate-pulse">Book Demo</Button>
          </DemoRequestModal>
          <button onClick={onOpenMobileMenu} className="p-2 rounded-md text-[#222222]/80 lg:hidden">
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>
    </header>
  );
}

/* ───────────────────────── HERO ───────────────────────── */

export function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const links = ["Home", "Features", "Modules", "Contact"];
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" aria-hidden="true" onClick={onClose}></div>
      <div className="fixed top-0 right-0 h-full w-full max-w-xs bg-[#FAF3E1] p-6 shadow-xl text-[#222222]">
        <div className="flex items-center justify-between mb-8">
          <div className="font-serif text-xl font-semibold">jewellarifyerp</div>
          <button onClick={onClose} className="p-2 rounded-md text-[#222222]/80">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="flex flex-col gap-y-4">
          {links.map((l) => (
            <a key={l} href={
              l === 'Contact' ? '/contact' :
              `/${l === 'Home' ? '' : '#' + l.toLowerCase()}`
            } onClick={onClose} className="block py-2 text-lg font-medium hover:text-[#FA8112] transition-colors">
              {l}
            </a>
          ))}
          <div className="border-t border-[#222222]/10 pt-6 mt-4 flex flex-col gap-4">
            <Link to="/login" className="text-lg font-medium hover:text-[#FA8112] transition-colors">Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
   <section
  id="home"
  className="relative overflow-hidden bg-linear-to-br from-white via-amber-50 to-[#FAF3E1]/40"
>
  {/* Background Glow */}
  <div className="absolute -top-32 right-0 h-150 w-150 rounded-full bg-[#FA8112]/10 blur-[120px]" />
  <div className="absolute bottom-0 left-0 h-87.5 w-87.5 rounded-full bg-[#FA8112]/5 blur-[100px]" />

  <div className="relative mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">

    <div className="grid items-center gap-16 lg:grid-cols-2">

      {/* Left Content */}
      <div>

        <span className="inline-flex items-center rounded-full border border-[#FA8112]/20 bg-[#FA8112]/10 px-4 py-2 text-sm font-semibold text-[#FA8112]">
          ✨ India's Smart Jewellery ERP
        </span>

        <h1 className="mt-8 font-serif text-5xl font-bold leading-tight text-[#222222] lg:text-7xl">
          All-in-One ERP for
          <span className="block text-[#FA8112]">
            Your Jewellery Business
          </span>
        </h1>

        <p className="mt-8 max-w-xl text-xl leading-9 text-[#555]">
          Manage Billing, Inventory, Catalog, Barcode, CRM,
          Karigar, Repairs, Girvi, Reports and Accounting
          from one powerful cloud dashboard.
        </p>

        <div className="mt-10 flex flex-wrap gap-5">

          <DemoRequestModal>
            <Button size="lg" className="rounded-xl bg-[#FA8112] px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-[#FA8112]/30 transition hover:bg-[#FA8112]/90 hover:shadow-xl animate-pulse">
              Request a Free Demo
            </Button>
          </DemoRequestModal>

        </div>

        {/* Stats */}

        <div className="mt-12 grid grid-cols-3 gap-6">

          <div>
            <h3 className="text-3xl font-bold text-[#222]">
              10+
            </h3>
            <p className="text-sm text-gray-500">
              Jewellers Trust Us
            </p>
          </div>

          <div>
            <h3 className="text-3xl font-bold text-[#222]">
              99.9%
            </h3>
            <p className="text-sm text-gray-500">
              Cloud Uptime
            </p>
          </div>

          <div>
            <h3 className="text-3xl font-bold text-[#222]">
              24×7
            </h3>
            <p className="text-sm text-gray-500">
              Support
            </p>
          </div>

        </div>

      </div>

      {/* Right Dashboard */}

      <div className="relative flex justify-center">

        {/* Glow */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-130 w-130 rounded-full bg-[#FA8112]/15 blur-[110px]" />
        </div>

        {/* Floating Card */}
        <div className="absolute -top-8 -left-6 z-20 hidden rounded-xl bg-white/80 backdrop-blur-md p-4 shadow-xl lg:block">
          <p className="text-xs text-gray-500">
            Today's Sales
          </p>
          <h3 className="text-2xl font-bold text-[#FA8112]">
            ₹8,45,230
          </h3>
        </div>

        <div className="absolute -bottom-8 -right-6 z-20 hidden rounded-xl bg-white p-4 shadow-xl lg:block">
          <p className="text-xs text-gray-500">
            Gold Rate
          </p>
          <h3 className="text-2xl font-bold text-green-600">
            ₹9,845/g
          </h3>
        </div>

        {/* Dashboard */}

        <img
          src="/dashboard.png"
          alt="Jewellarify ERP Dashboard"
          className="
            relative
            z-10
            w-full max-w-237.5
            rounded-3xl
            border
            border-[#FA8112]/15
            bg-white
            shadow-[0_40px_120px_rgba(250,129,18,0.18)]
            ring-1
            ring-black/5
            transition-transform
            duration-500
            hover:-translate-y-2
          "
        />

      </div>

    </div>

  </div>
</section>
  );
}

/* ───────────────────────── SECTIONS ──────────────────────── */

const Section = ({ id, children, className = "" }: { id: string; children: ReactNode; className?: string }) => (
  <section id={id} className={`py-20 sm:py-28 ${className}`}>
    <div className="mx-auto max-w-7xl px-6 lg:px-8">{children}</div>
  </section>
);

const SectionTitle = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="mx-auto max-w-3xl text-center mb-12 sm:mb-16">
    <h2 className="font-serif text-4xl font-bold tracking-tight text-[#222222] sm:text-5xl">{title}</h2>
    <p className="mt-4 text-lg text-[#222222]/70">{subtitle}</p>
  </div>
);

function TrustedBy() {
  const stats = [
    { value: "500+", label: "Jewellery Shops" },
    { value: "20+", label: "Cities" },
    { value: "99.9%", label: "Uptime" },
    { value: "Secure", label: "Cloud Infrastructure" },
    { value: "24x7", label: "Customer Support" },
  ];
  return (
    <div className="bg-amber-50">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid grid-cols-2 gap-y-8 text-center md:grid-cols-5">
          {stats.map((stat) => (
            <div key={stat.label} className="mx-auto flex max-w-xs flex-col gap-y-2">
              <dt className="text-base leading-7 text-[#222222]/70">{stat.label}</dt>
              <dd className="order-first font-serif text-4xl font-bold tracking-tight text-[#FA8112]">{stat.value}</dd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WhyChoose() {
  const features = [
    { icon: Zap, title: "Fast POS Billing" }, { icon: Cloud, title: "Cloud Based" },
    { icon: Wifi, title: "Offline Mode" }, { icon: Smartphone, title: "Mobile App" },
    { icon: FileCheck2, title: "GST Ready" }, { icon: ScanBarcode, title: "Barcode Support" },
    { icon: QrCode, title: "QR Code Support" }, { icon: Users2, title: "Multi User" },
    { icon: ServerCog, title: "Automatic Backup" }, { icon: Database, title: "Separate Database" },
    { icon: KeyRound, title: "Secure Login" }, { icon: BarChart3, title: "Premium Reports" },
  ];
  return (
    <Section id="features" className="bg-white">
      <SectionTitle title="Why Choose jewellarifyerp?" subtitle="An all-in-one Jewellery ERP designed to simplify every aspect of your business management, from retail to manufacturing." />
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition-all hover:bg-white hover:shadow-md hover:-translate-y-1">
            <f.icon className="h-5 w-5 text-[#FA8112]" />
            <span className="font-medium text-[#222222]">{f.title}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function CoreFeatures() {
  const features = [
    {
      title: "Inventory Management",
      desc: "Track your precious metal inventory in real-time with accurate weight calculations. Monitor stock levels, manage transfers, and maintain detailed records of all your valuable assets.",
      bullets: [
        "Track item-wise stock in real-time across categories and locations.",
        "Get alerts for low stock, fast-moving, and dead inventory.",
        "Auto-stock updates after billing, returns, and transfers.",
      ],
      img: "/inventory.png",
      imgAlt: "Inventory Management Dashboard",
    },
    {
      title: "Customer Management",
      desc: "Build lasting relationships with comprehensive customer profiles, purchase history, and loyalty program management.",
      bullets: [
        "Maintain customer profiles with purchase history.",
        "Track schemes, birthdays and loyalty points.",
        "Create targeted offers and promotions.",
      ],
      img: "/customer.png",
      imgAlt: "Customer Management Dashboard",
    },
    {
      title: "Smart Catalog",
      desc: "Create beautiful jewellery catalogues with AI-powered background removal, watermarking and pricing.",
      bullets: [
        "AI background remover.",
        "Bulk watermark & pricing.",
        "Sync catalog with website & mobile app.",
      ],
      img: "/catalog.png",
      imgAlt: "Smart Catalog",
    },
    {
      title: "Smart Alerts",
      desc: "Never miss important business updates with automatic reminders and notifications.",
      bullets: [
        "Low stock alerts.",
        "WhatsApp & SMS notifications.",
        "Payment & birthday reminders.",
      ],
      img: "/alert.png",
      imgAlt: "Smart Alerts",
    },
  ];

  return (
    <Section
      id="core-features"
      className="bg-slate-50 py-24"
    >
      <SectionTitle
        title="Control Your Full Jewellery Business from One Dashboard"
        subtitle="Jewellarify ERP is a complete jewellery management software that helps retailers, wholesalers and manufacturers manage billing, inventory, customers, karigar work, gold schemes, CRM, mobile app and multi-branch operations from one place."
      />

      <div className="mx-auto mt-20 max-w-7xl space-y-28">
        {features.map((feature, index) => {
          const reverse = index % 2 !== 0;

          return (
            <div
              key={feature.title}
              className="grid items-center gap-16 lg:grid-cols-2"
            >
              {/* IMAGE */}

              <div
                className={`${
                  reverse ? "lg:order-1" : "lg:order-2"
                } flex justify-center`}
              >
                <div className="overflow-hidden rounded-2xl bg-white p-4 shadow-2xl shadow-slate-300/50">
                  <img
                    src={feature.img}
                    alt={feature.imgAlt}
                    className="w-full max-w-md rounded-xl object-cover transition duration-500 hover:scale-105"
                  />
                </div>
              </div>

              {/* CONTENT */}

              <div
                className={`${
                  reverse ? "lg:order-2" : "lg:order-1"
                } max-w-xl`}
              >
                <h3 className="mb-6 text-3xl font-bold text-gray-900">
                  {feature.title}
                </h3>

                <p className="mb-6 leading-8 text-gray-600">
                  {feature.desc}
                </p>

                <ul className="space-y-4">
                  {feature.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-start gap-3"
                    >
                      <Check className="mt-1 h-5 w-5 text-[#F59E0B]" />

                      <span className="text-gray-700">
                        {bullet}
                      </span>
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

function ModuleOverview() {
  const modules = [
    { icon: LayoutGrid, name: "Dashboard" }, { icon: Bell, name: "Notifications" },
    { icon: Calculator, name: "Calculator" }, { icon: ShoppingCart, name: "POS Billing" },
    { icon: ReceiptText, name: "Sales" }, { icon: ClipboardList, name: "Orders" },
    { icon: Sparkles, name: "Catalogue" }, { icon: Package, name: "Products" },
    { icon: TrendingUp, name: "Gold Rates" }, { icon: Users, name: "Customers" },
    { icon: Users2, name: "Employees" }, { icon: Truck, name: "Suppliers" },
    { icon: Hammer, name: "Karigars" }, { icon: Wrench, name: "Repairs" },
    { icon: ClipboardList, name: "Karigar Tasks" }, { icon: ShoppingBag, name: "Purchases" },
    { icon: Wallet, name: "Expenses" }, { icon: Coins, name: "Customer Dues" },
    { icon: BadgeIndianRupee, name: "Gold Loans" }, { icon: BarChart3, name: "Reports" },
    { icon: BookOpen, name: "Daily Ledger" },
  ];
  return (
    <Section id="modules" className="bg-white">
      <SectionTitle title="A Complete Suite of Modules" subtitle="Cloudiefy is built with a modular architecture, allowing you to use what you need and scale as you grow." />
      <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {modules.map((m) => (
          <div key={m.name} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 transition-all hover:bg-white hover:shadow-md hover:-translate-y-1">
            <m.icon className="h-6 w-6 text-[#FA8112]" />
            <span className="text-sm font-medium text-[#222222]">{m.name}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Security() {
  const highlights = [
    { icon: Shield, title: "SSL Encryption", desc: "All data transfer is secured with industry-standard SSL encryption." },
    { icon: Cloud, title: "Daily Cloud Backup", desc: "Your data is automatically backed up to a secure cloud location every day." },
    { icon: Database, title: "Separate Database Per Shop", desc: "Complete data isolation ensures your information is never accessible by others." },
    { icon: Users2, title: "Role-Based Permissions", desc: "Control exactly what each user can see and do within the software." },
    { icon: Activity, title: "Audit Logs", desc: "Track important actions performed by users for accountability." },
    { icon: Lock, title: "Secure Authentication", desc: "Industry-standard password hashing and session management protect your accounts." },
  ];
  return (
    <Section id="security" className="bg-slate-50">
      <SectionTitle title="Enterprise-Grade Security" subtitle="Your data is your most valuable asset. We protect it with multiple layers of security, so you can have peace of mind." />
      <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {highlights.map((h) => (
          <div key={h.title} className="flex flex-col items-center text-center">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-[#FA8112] text-white shadow-lg shadow-[#FA8112]/20">
              <h.icon className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-serif text-lg font-semibold text-[#222222]">{h.title}</h3>
            <p className="mt-1 text-[#222222]/70">{h.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Testimonials() {
  const reviews = [
    { name: "Ramesh Soni", shop: "Arihant Jewellers, Jaipur", review: "Cloudiefy has transformed our billing process. It's fast, reliable, and the cloud access is a game-changer for managing my shop remotely." },
    { name: "Priya Mehta", shop: "Mehta & Sons, Mumbai", review: "The karigar management module is fantastic. We can now track every job from start to finish, which has improved our efficiency by at least 30%." },
    { name: "Ankit Verma", shop: "Verma Diamonds, Surat", review: "As a multi-branch business, the enterprise plan is perfect. The separate database for each shop gives us security and peace of mind. Support is also very responsive." },
  ];
  return (
    <Section id="testimonials" className="bg-white">
      <SectionTitle title="Loved by Jewellers Across the Country" subtitle="Don't just take our word for it. Here's what our customers have to say." />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {reviews.map((r) => (
          <div key={r.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-8">
            <div className="flex text-[#FA8112]" role="img" aria-label="5 out of 5 stars">{[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 shrink-0" fill="currentColor" />)}</div>
            <blockquote className="mt-6 text-lg leading-8 tracking-tight text-[#222222]">
              <p>“{r.review}”</p>
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-x-4">
              <div>
                <div className="font-semibold text-[#222222]">{r.name}</div>
                <div className="text-[#222222]/70">{r.shop}</div>
              </div>
            </figcaption>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Faq() {
  const faqs = [
    { q: "Is my data secure?", a: "Yes, absolutely. We use enterprise-grade security, including SSL encryption, daily backups, and a separate, isolated database for every single shop. Your data is physically separated from everyone else's." },
    { q: "Can I use it offline?", a: "Yes! Our desktop application has an offline mode that allows you to continue working without an internet connection. Your data will sync automatically once you're back online." },
    { q: "Does it support GST?", a: "Yes, our GST Edition is fully compliant with all Indian GST regulations, including HSN codes, tax calculations, and automated report generation." },
    { q: "Can I migrate existing data?", a: "Yes, we offer data migration services to help you import your existing customers, inventory, and other data into Cloudiefy. Contact our support team for assistance." },
  ];
  return (
    <Section id="faq" className="bg-slate-50">
      <SectionTitle title="Frequently Asked Questions" subtitle="Have questions? We've got answers. If you can't find what you're looking for, feel free to contact us." />
      <div className="mx-auto max-w-3xl space-y-4">
        {faqs.map((faq) => (
          <details key={faq.q} className="group rounded-lg border border-slate-200 bg-white p-6 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-4">
              <h2 className="font-medium text-[#222222]">{faq.q}</h2>
              <ChevronDown className="h-5 w-5 shrink-0 text-[#222222]/70 transition group-open:rotate-180" />
            </summary>
            <p className="mt-4 leading-relaxed text-[#222222]/70">{faq.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

function FinalCta() {
  return (
    <Section id="trial" className="bg-white">
      <div className="relative isolate overflow-hidden bg-[#FA8112] px-6 py-24 text-center shadow-2xl sm:rounded-3xl sm:px-16">
        <h2 className="mx-auto max-w-2xl font-serif text-4xl font-bold tracking-tight text-white sm:text-5xl">Ready to Digitize Your Jewellery Business?</h2>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-white/90">Start your free trial today and experience the future of jewellery management with Cloudiefy.</p>
        
      </div>
    </Section>
  );
}

export function Footer() {
  const links = {
    Product: [{ name: "Home", href: "/" }, { name: "Features", href: "/#features" }, { name: "Girvi Module", href: "/features/girvi" }],
    Company: [{ name: "About Us", href: "/about" }, { name: "Contact Us", href: "/contact" }],
    Legal: [{ name: "Privacy Policy", href: "/privacy-policy" }, { name: "Terms & Conditions", href: "/terms-and-conditions" }],
  };
  const socials = [
    // { name: "Facebook", href: "#", icon: Facebook },
    { name: "Instagram", href: "https://www.instagram.com/jewellarifyerp/", icon: Instagram },
    { name: "LinkedIn", href: "https://www.linkedin.com/company/cloudiefy/", icon: Linkedin },
    // { name: "YouTube", href: "#", icon: Youtube },
  ];
  return (
    <footer id="contact" className="bg-[#222222] text-[#FAF3E1]">
      <div className="mx-auto max-w-7xl px-6 pb-8 pt-16 sm:pt-20 lg:px-8 lg:pt-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Left Side: Brand and Contact */}
          <div className="max-w-md">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="jewellarifyerp Logo" className="h-12 w-12 object-contain bg-white p-1.5 rounded-lg" />
              <div className="leading-tight">
                <div className="font-serif text-2xl font-semibold">jewellarifyerp</div>
                <div className="-mt-0.5 text-[10px] tracking-[0.25em] text-[#FA8112]">JEWELLERY ERP</div>
              </div>
            </div>
            <p className="mt-6 text-base leading-7 text-[#FAF3E1]/70">The complete, cloud-based ERP for modern jewellers in India.</p>
            <div className="mt-8 flex space-x-6">
              {socials.map((s) => <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer" className="text-[#FAF3E1]/70 hover:text-[#FA8112]"><span className="sr-only">{s.name}</span><s.icon className="h-6 w-6" /></a>)}
            </div>
          </div>

          {/* Right Side: Links */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
            <div>
              <h3 className="text-sm font-semibold leading-6 text-white">Product</h3>
              <ul role="list" className="mt-6 space-y-4">
                {links.Product.map((l) => <li key={l.name}><a href={l.href} className="text-sm leading-6 text-[#FAF3E1]/70 hover:text-white">{l.name}</a></li>)}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold leading-6 text-white">Company</h3>
              <ul role="list" className="mt-6 space-y-4">
                {links.Company.map((l) => <li key={l.name}><a href={l.href} className="text-sm leading-6 text-[#FAF3E1]/70 hover:text-white">{l.name}</a></li>)}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold leading-6 text-white">Legal</h3>
              <ul role="list" className="mt-6 space-y-4">
                {links.Legal.map((l) => <li key={l.name}><a href={l.href} className="text-sm leading-6 text-[#FAF3E1]/70 hover:text-white">{l.name}</a></li>)}
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-16 border-t border-[#FAF3E1]/10 pt-8 sm:mt-20 lg:mt-24">
          <p className="text-xs leading-5 text-[#FAF3E1]/70">&copy; {new Date().getFullYear()} jewellarifyerp Technologies. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/9691365052?text=Hello!%20I'm%20looking%20for%20a%20Jewellery%20Management%20Software.%0APlease%20contact%20me%20with%20the%20demo%20and%20subscription%20plans."
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 grid h-16 w-16 place-items-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 animate-bounce"
    >
      <span className="sr-only">Chat on WhatsApp</span>
      {/* Official WhatsApp Icon */}
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.894 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01s-.521.074-.792.372c-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
    </a>
  );
}

export function DemoRequestModal({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", shopName: "", phone: "", email: "", address: "" });
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
      setForm({ name: "", shopName: "", phone: "", email: "", address: "" });
    } catch (error) {
      toast.error("Failed to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>Book a Live Demo</DialogTitle>
          <DialogDescription>
            Fill out the form below and our team will contact you to schedule a personalized demo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name *</Label>
            <Input id="name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="shopName" className="text-right">Shop Name *</Label>
            <Input id="shopName" value={form.shopName} onChange={e => setForm({...form, shopName: e.target.value})} className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="phone" className="text-right">Phone *</Label>
            <Input id="phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="address" className="text-right">Address</Label>
            <Input id="address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="col-span-3" />
          </div>
          <DialogFooter><Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit Request</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <div className="bg-white font-sans text-[#222222]">
      <Nav onOpenMobileMenu={() => setMobileMenuOpen(true)} />
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <WhatsAppButton />
      <main>
        <Hero />
        <TrustedBy />
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
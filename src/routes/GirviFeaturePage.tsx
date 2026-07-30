import { Landmark, ArrowRightLeft, Users, FileText, CheckCircle } from "lucide-react";
import { Footer, Nav, MobileMenu, WhatsAppButton } from "./LandingPage";
import { useState } from "react";

const Section = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <section className={`py-16 sm:py-24 ${className}`}>
    <div className="mx-auto max-w-7xl px-6 lg:px-8">{children}</div>
  </section>
);

const features = [
  { icon: Landmark, title: "Secure Pledging & Records", description: "Easily create new loan records with detailed item descriptions, weights, and images. Maintain a complete and secure history of all pledged items." },
  { icon: CheckCircle, title: "Automated Interest Calculation", description: "Set custom interest rates and periods (monthly or daily) with support for compound interest, eliminating manual calculation errors." },
  { icon: Users, title: "Integrated Customer Management", description: "Maintain detailed records of all loan customers, including their complete loan history, right within their main customer profile." },
  { icon: FileText, title: "Settlement & Closure", description: "Manage full and partial payments with detailed transaction logs. Formally close loans upon full settlement with proper documentation." },
  { icon: ArrowRightLeft, title: "Forwarding Management", description: "Track items forwarded to other shops for loans. Our system handles separate interest calculations and settlement tracking for forwarded items, giving you a clear view of your market liabilities." },
  { icon: FileText, title: "Detailed Reporting", description: "Generate reports on active loans, total principal out, accrued interest, and more, giving you a complete financial overview of your Girvi operations." },
];

export default function GirviFeaturePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <div className="bg-[#FAF3E1] font-sans text-[#222222]">
      <Nav onOpenMobileMenu={() => setMobileMenuOpen(true)} />
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <WhatsAppButton />
      <main>
        <Section>
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#FA8112]/10 px-4 py-1.5 text-sm font-semibold text-[#FA8112] border border-[#FA8112]/20">
              <Landmark className="w-4 h-4" /> Girvi Module
            </div>
            <h1 className="mt-6 font-serif text-5xl font-bold tracking-tight text-[#222222] sm:text-6xl">
              Powerful Girvi & Gold Loan Management
            </h1>
            <p className="mt-6 text-lg leading-8 text-[#222222]/70">
              Simplify every aspect of your gold and silver loan operations. From pledging items to calculating interest and managing settlements, jewellarifyerp provides a secure and efficient solution.
            </p>
          </div>

          <img src="/girvi.png" alt="Banner showing gold jewellery and loan documents" className="mt-16 rounded-3xl border border-[#222222]/10 shadow-2xl shadow-[#FA8112]/10 w-full max-w-6xl mx-auto" />

          <div className="mt-24 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="flex flex-col items-center text-center">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-[#FA8112]/10 border border-[#FA8112]/20 text-[#FA8112]"><feature.icon className="h-7 w-7" /></div>
                <h3 className="mt-5 font-serif text-xl font-semibold text-[#222222]">{feature.title}</h3>
                <p className="mt-2 text-base text-[#222222]/70">{feature.description}</p>
              </div>
            ))}
          </div>
        </Section>
      </main>
      <Footer />
    </div>
  );
}
import { Building, Users, Target } from "lucide-react";
import { Footer, Nav, MobileMenu, WhatsAppButton } from "./LandingPage";
import { useState } from "react";
import { Helmet } from "react-helmet-async";

const Section = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <section className={`py-16 sm:py-24 ${className}`}>
    <div className="mx-auto max-w-7xl px-6 lg:px-8">{children}</div>
  </section>
);

export default function AboutPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <div className="bg-white font-sans text-[#222222]">
      <Helmet>
        <title>About Us - jewellarifyerp</title>
        <meta name="description" content="Learn about the team and vision behind jewellarifyerp, a company dedicated to revolutionizing the jewellery business with cutting-edge ERP software." />
      </Helmet>
      <Nav onOpenMobileMenu={() => setMobileMenuOpen(true)} />
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <WhatsAppButton />
      <main>
        <Section>
          <div className="text-center">
            <h1 className="font-serif text-5xl font-bold tracking-tight text-[#222222] sm:text-7xl">About Us</h1>
            <p className="mt-6 text-lg leading-8 text-[#222222]/70 max-w-3xl mx-auto">
              We are a team of passionate developers and industry experts dedicated to revolutionizing the jewellery business with cutting-edge technology.
            </p>
          </div>

          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div className="space-y-4">
              <Building className="w-12 h-12 mx-auto text-[#FA8112]" />
              <h3 className="text-2xl font-serif font-semibold">Our Company</h3>
              <p className="text-[#222222]/70">Founded in 2020, our mission is to empower jewellers with the tools they need to succeed in the digital age.</p>
            </div>
            <div className="space-y-4">
              <Users className="w-12 h-12 mx-auto text-[#FA8112]" />
              <h3 className="text-2xl font-serif font-semibold">Our Team</h3>
              <p className="text-[#222222]/70">Our diverse team brings together expertise in software engineering, UI/UX design, and the jewellery industry.</p>
            </div>
            <div className="space-y-4">
              <Target className="w-12 h-12 mx-auto text-[#FA8112]" />
              <h3 className="text-2xl font-serif font-semibold">Our Vision</h3>
              <p className="text-[#222222]/70">To be the leading provider of jewellery management software, known for innovation, reliability, and customer-centricity.</p>
            </div>
          </div>
        </Section>
      </main>
      <Footer />
    </div>
  );
}
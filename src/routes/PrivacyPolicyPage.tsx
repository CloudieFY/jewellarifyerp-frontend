import { Footer, Nav, MobileMenu, WhatsAppButton } from "./LandingPage";
import { useState } from "react";
import { Helmet } from "react-helmet-async";

const Section = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <section className={`py-12 sm:py-20 ${className}`}>
    <div className="mx-auto max-w-7xl px-6 lg:px-8">{children}</div>
  </section>
);

const PolicySection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-10">
    <h2 className="font-serif text-3xl font-bold text-[#222222] mb-4 border-b-2 border-[#FA8112] pb-2">{title}</h2>
    <div className="space-y-4 text-[#222222]/80 leading-relaxed">{children}</div>
  </div>
);

export default function PrivacyPolicyPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <div className="bg-white font-sans text-[#222222]">
      <Helmet>
        <title>Privacy Policy - jewellarifyerp</title>
        <meta name="description" content="Learn how jewellarifyerp collects, uses, and protects your personal and business data. Your privacy is our priority." />
      </Helmet>
      <Nav onOpenMobileMenu={() => setMobileMenuOpen(true)} />
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <WhatsAppButton />
      <main>
        <Section>
          <div className="prose prose-lg max-w-4xl mx-auto text-[#222222]/80">
            <h1>Privacy Policy</h1>
            <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="max-w-4xl mx-auto mt-12">
            <PolicySection title="1. Introduction">
              <p>Welcome to jewellarifyerp. We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our software.</p>
            </PolicySection>

            <PolicySection title="2. Information We Collect">
              <p>We may collect personal information that you provide to us, such as your name, email address, phone number, and business details. We also collect data related to your use of our software, such as inventory data, sales records, and customer information, which is stored in your shop's isolated database.</p>
            </PolicySection>

            <PolicySection title="3. How We Use Your Information">
              <p>We use the information we collect to:</p>
              <ul className="list-disc list-inside space-y-2 pl-4">
                <li>Provide, operate, and maintain our software</li>
                <li>Improve, personalize, and expand our software</li>
                <li>Understand and analyze how you use our software</li>
                <li>Develop new products, services, features, and functionality</li>
                <li>Communicate with you, either directly or through one of our partners, including for customer service, to provide you with updates and other information relating to the software, and for marketing and promotional purposes</li>
                <li>Process your transactions</li>
                <li>Find and prevent fraud</li>
              </ul>
            </PolicySection>

            <PolicySection title="4. Data Security">
              <p>We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.</p>
            </PolicySection>
          </div>
        </Section>
      </main>
      <Footer />
    </div>
  );
}
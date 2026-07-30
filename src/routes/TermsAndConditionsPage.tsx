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

export default function TermsAndConditionsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <div className="bg-white font-sans text-[#222222]">
      <Helmet>
        <title>Terms and Conditions - jewellarifyerp</title>
        <meta name="description" content="Read the terms and conditions for using the jewellarifyerp software and services." />
      </Helmet>
      <Nav onOpenMobileMenu={() => setMobileMenuOpen(true)} />
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <WhatsAppButton />
      <main>
        <Section>
          <div className="prose prose-lg max-w-4xl mx-auto text-[#222222]/80">
            <h1>Terms and Conditions</h1>
            <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-GB')}</p>
          </div>
          <div className="max-w-4xl mx-auto mt-12">
            <PolicySection title="1. Agreement to Terms">
              <p>By using our software, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use the software.</p>
            </PolicySection>

            <PolicySection title="2. Use of the Software">
              <p>We grant you a limited, non-exclusive, non-transferable, revocable license to use the jewellarifyerp software for your internal business purposes, subject to your subscription plan and these terms.</p>
            </PolicySection>

            <PolicySection title="3. User Responsibilities">
              <p>You are responsible for all activity that occurs under your account, including the accuracy of the data you input. You agree to maintain the security of your account credentials and to notify us immediately of any unauthorized use.</p>
            </PolicySection>

            <PolicySection title="4. Limitation of Liability">
              <p>In no event shall jewellarifyerp be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the software.</p>
            </PolicySection>
          </div>
        </Section>
      </main>
      <Footer />
    </div>
  );
}
import { Phone, Mail, MapPin } from "lucide-react";
import { Footer, Nav, MobileMenu, WhatsAppButton } from "./LandingPage";
import { useState } from "react";
import { Helmet } from "react-helmet-async";

const Section = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <section className={`py-16 sm:py-24 ${className}`}>
    <div className="mx-auto max-w-7xl px-6 lg:px-8">{children}</div>
  </section>
);

export default function ContactPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <div className="bg-white font-sans text-[#222222]">
      <Helmet>
        <title>Contact Us - jewellarifyerp</title>
        <meta name="description" content="Get in touch with the jewellarifyerp team. Contact us via phone, email, or visit our office for questions about our jewellery ERP software." />
      </Helmet>
      <Nav onOpenMobileMenu={() => setMobileMenuOpen(true)} />
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <WhatsAppButton />
      <main>
        <Section>
          <div className="text-center">
            <h1 className="font-serif text-5xl font-bold tracking-tight text-[#222222] sm:text-7xl">Contact Us</h1>
            <p className="mt-6 text-lg leading-8 text-[#222222]/70 max-w-3xl mx-auto">
              We'd love to hear from you. Whether you have a question about features, trials, or anything else, our team is ready to answer all your questions.
            </p>
          </div>

          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div className="space-y-4">
              <Phone className="w-12 h-12 mx-auto text-[#FA8112]" />
              <h3 className="text-2xl font-serif font-semibold">Phone</h3>
              <a href="tel:+916266782930" className="text-[#222222]/70 hover:text-[#FA8112] block">+91 6266782930</a>
              <a href="tel:+919691365052" className="text-[#222222]/70 hover:text-[#FA8112] block">+91 9691365052</a>
            </div>
            <div className="space-y-4">
              <Mail className="w-12 h-12 mx-auto text-[#FA8112]" />
              <h3 className="text-2xl font-serif font-semibold">Email</h3>
              <a href="mailto:support@jewellarifyerp.com" className="text-[#222222]/70 hover:text-[#FA8112]">support@jewellarifyerp.com</a>
            </div>
            <div className="space-y-4">
              <MapPin className="w-12 h-12 mx-auto text-[#FA8112]" />
              <h3 className="text-2xl font-serif font-semibold">Address</h3>
              <p className="text-[#222222]/70">108 Orange Business Park Bhawarkua,<br />Indore, Madhya Pradesh 452001</p>
            </div>
          </div>
        </Section>
      </main>
      <Footer />
    </div>
  );
}
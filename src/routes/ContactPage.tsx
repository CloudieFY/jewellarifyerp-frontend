import { Phone, Mail, MapPin, MessageSquare, ShieldCheck, CheckCircle2, Send, Loader2, ExternalLink, Sparkles, Building2 } from "lucide-react";
import { Footer, Nav, MobileMenu, WhatsAppButton } from "./LandingPage";
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { publicAPI } from "@/lib/api";

const Section = ({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) => (
  <section id={id} className={`py-16 sm:py-24 ${className}`}>
    <div className="mx-auto max-w-7xl px-6 lg:px-8">{children}</div>
  </section>
);

export default function ContactPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [form, setForm] = useState({ name: "", shopName: "", phone: "", email: "", address: "", message: "" });
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
      toast.success("Message sent! Our jewellery domain team will contact you within 15 minutes.");
      setForm({ name: "", shopName: "", phone: "", email: "", address: "", message: "" });
    } catch (error) {
      toast.error("Failed to send message. Please try calling us directly.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactMethods = [
    {
      icon: Phone,
      title: "Call Us Direct",
      desc: "Speak with our dedicated support team",
      lines: [
        { text: "+91 6266782930", href: "tel:+916266782930" },
        { text: "+91 9691365052", href: "tel:+919691365052" },
      ],
      badge: "24/7 Phone Support",
    },
    {
      icon: Mail,
      title: "Email Support",
      desc: "Send us your queries anytime",
      lines: [
        { text: "cloudiefyy@gmail.com", href: "mailto:cloudiefyy@gmail.com" },
      ],
      badge: "< 15 Min SLA Response",
    },
    {
      icon: MessageSquare,
      title: "WhatsApp Assistance",
      desc: "Chat directly for quick assistance & video demo",
      lines: [
        { text: "+91 9691365052 (Chat Now)", href: "https://wa.me/9691365052?text=Hello!%20I'd%20like%20to%20know%20more%20about%20jewellarifyerp." },
      ],
      badge: "Instant Chat",
    },
    {
      icon: MapPin,
      title: "Head Office",
      desc: "Visit our central experience center",
      lines: [
        { text: "108 Orange Business Park Bhawarkua, Indore, MP 452001", href: "https://maps.google.com/?q=Orange+Business+Park+Bhawarkua+Indore" },
      ],
      badge: "Experience Hub",
    },
  ];

  return (
    <div className="bg-[#FAF8F5] font-sans text-slate-900 antialiased selection:bg-[#FA8112]/20 selection:text-[#FA8112]">
      <Helmet>
        <title>Contact Us | jewellarifyerp - Expert Support & Showroom Demo</title>
        <meta
          name="description"
          content="Get in touch with the jewellarifyerp team. Contact us via phone (+91 6266782930), email, or visit our office in Indore for questions about our jewellery ERP software."
        />
      </Helmet>

      <Nav onOpenMobileMenu={() => setMobileMenuOpen(true)} />
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <WhatsAppButton />

      <main>
        {/* HERO BANNER */}
        <section className="relative overflow-hidden bg-linear-to-b from-amber-50/80 via-[#FAF3E1]/50 to-[#FAF8F5] pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div aria-hidden="true" className="absolute top-0 right-1/4 -z-10 h-[450px] w-[450px] rounded-full bg-amber-300/20 blur-[130px]" />
          <div aria-hidden="true" className="absolute bottom-0 left-10 -z-10 h-[350px] w-[350px] rounded-full bg-orange-400/15 blur-[120px]" />

          <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FA8112]/30 bg-white/90 px-4 py-2 text-xs sm:text-sm font-semibold text-[#FA8112] shadow-xs backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-[#FA8112]" />
              <span>We're Here to Empower Your Showroom</span>
            </div>

            <h1 className="mt-8 font-serif text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Get in Touch with Our{" "}
              <span className="bg-linear-to-r from-[#FA8112] via-[#E86D00] to-[#B85000] bg-clip-text text-transparent">
                Jewellery Domain Experts
              </span>
            </h1>

            <p className="mt-6 text-base sm:text-xl leading-relaxed text-slate-600 max-w-3xl mx-auto">
              Have questions about POS billing, Girvi gold loans, barcode tagging, or migrating data from your legacy software? Reach out to us anytime.
            </p>
          </div>
        </section>

        {/* CONTACT METHODS GRID */}
        <section className="-mt-12 relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {contactMethods.map((method, idx) => (
              <div
                key={idx}
                className="group relative flex flex-col justify-between rounded-3xl border border-amber-200/60 bg-white p-7 shadow-lg shadow-slate-200/50 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-[#FA8112]/40"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-[#FA8112] border border-amber-100 transition-colors group-hover:bg-[#FA8112] group-hover:text-white">
                      <method.icon className="h-6 w-6" />
                    </div>
                    <span className="text-[10px] font-bold text-[#FA8112] bg-orange-50 px-2.5 py-1 rounded-md">
                      {method.badge}
                    </span>
                  </div>

                  <h3 className="mt-6 font-serif text-xl font-bold text-slate-900">{method.title}</h3>
                  <p className="mt-1 text-xs text-slate-500 font-medium">{method.desc}</p>

                  <div className="mt-4 space-y-2">
                    {method.lines.map((line, i) => (
                      <a
                        key={i}
                        href={line.href}
                        target={line.href.startsWith("http") ? "_blank" : undefined}
                        rel={line.href.startsWith("http") ? "noopener noreferrer" : undefined}
                        className="block text-sm font-semibold text-slate-700 hover:text-[#FA8112] transition-colors leading-snug break-words"
                      >
                        {line.text}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* DUAL COLUMN: INTERACTIVE FORM & SUPPORT PROMISES */}
        <Section>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* Left Column: Form */}
            <div className="lg:col-span-7 rounded-3xl border border-amber-200/80 bg-white p-8 sm:p-10 shadow-xl shadow-amber-900/5">
              <div className="border-b border-slate-100 pb-6 mb-6">
                <span className="inline-flex items-center gap-2 rounded-lg bg-orange-100/70 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#FA8112]">
                  <Send className="w-3.5 h-3.5" /> Send Us a Message
                </span>
                <h2 className="mt-3 font-serif text-2xl sm:text-4xl font-bold tracking-tight text-slate-900">
                  How Can We Help Your Showroom Today?
                </h2>
                <p className="mt-2 text-sm sm:text-base text-slate-600">
                  Fill out the form below and our team will get in touch with you within 15 minutes.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <Label htmlFor="name" className="text-xs font-bold uppercase text-slate-700">
                      Full Name *
                    </Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="mt-1 rounded-xl"
                      placeholder="e.g. Rajesh Soni"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="shopName" className="text-xs font-bold uppercase text-slate-700">
                      Showroom / Shop Name *
                    </Label>
                    <Input
                      id="shopName"
                      value={form.shopName}
                      onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                      className="mt-1 rounded-xl"
                      placeholder="e.g. Soni Jewellers"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <Label htmlFor="phone" className="text-xs font-bold uppercase text-slate-700">
                      Phone Number *
                    </Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="mt-1 rounded-xl"
                      placeholder="9000000000"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="email" className="text-xs font-bold uppercase text-slate-700">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="mt-1 rounded-xl"
                      placeholder="e.g. info@sonijewellers.com"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="address" className="text-xs font-bold uppercase text-slate-700">
                    City / Location
                  </Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="mt-1 rounded-xl"
                    placeholder="e.g. Jaipur, Rajasthan"
                  />
                </div>

                <div>
                  <Label htmlFor="message" className="text-xs font-bold uppercase text-slate-700">
                    Your Requirements / Message
                  </Label>
                  <textarea
                    id="message"
                    rows={4}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-[#FA8112] focus:ring-1 focus:ring-[#FA8112] outline-none transition"
                    placeholder="Tell us about your showroom needs (e.g. POS billing, Girvi loans, Karigar ledger, data migration)..."
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-[#FA8112] py-6 text-base font-bold text-white shadow-lg shadow-[#FA8112]/20 hover:bg-[#FA8112]/90 cursor-pointer"
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Submit Inquiry"}
                </Button>
              </form>
            </div>

            {/* Right Column: Support SLA & Onboarding Promises */}
            <div className="lg:col-span-5 space-y-8">
              <div className="rounded-3xl border border-amber-200/60 bg-linear-to-b from-amber-50/60 to-white p-8 shadow-sm">
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#FA8112] mb-4">
                  <ShieldCheck className="h-4 w-4" /> White-Glove Onboarding
                </span>
                <h3 className="font-serif text-2xl font-bold text-slate-900">
                  Why Jewellers Trust Our Support
                </h3>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                  Transitioning to a new ERP shouldn't disrupt your daily counter billing. We stand by you every step of the way.
                </p>

                <div className="mt-6 space-y-4">
                  {[
                    { title: "15-Minute Guaranteed SLA Response", desc: "Speak directly with domain experts who understand karat purities and Girvi calculations." },
                    { title: "Free Zero-Downtime Data Migration", desc: "Our tech team imports your customer ledgers, stock data, and barcode inventory for free." },
                    { title: "Full Staff & Billing Counter Training", desc: "We train your counter staff on issuing 30-second GST invoices and managing WhatsApp receipts." },
                    { title: "24/7 Cloud Monitoring & Backups", desc: "Automatic daily backups ensure your trade secrets and financial records stay 100% safe." },
                  ].map((p, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-[#FA8112] mt-0.5" />
                      <div>
                        <div className="text-sm font-bold text-slate-900">{p.title}</div>
                        <div className="text-xs text-slate-600 mt-0.5">{p.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Office Location Card */}
              <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-[#FA8112]" />
                  </div>
                  <div>
                    <h4 className="font-serif text-lg font-bold text-slate-900">Head Office Location</h4>
                    <p className="text-xs text-slate-500">Central Experience Center & R&D Hub</p>
                  </div>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  108 Orange Business Park Bhawarkua,<br />
                  Indore, Madhya Pradesh 452001
                </p>

                <a
                  href="https://maps.google.com/?q=Orange+Business+Park+Bhawarkua+Indore"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-bold text-[#FA8112] hover:underline"
                >
                  Open in Google Maps <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
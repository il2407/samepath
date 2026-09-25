import type { Metadata } from "next";
import { Header } from "@/app/_marketing/Header";
import { Hero } from "@/app/_marketing/Hero";
import { WhySamePath } from "@/app/_marketing/WhySamePath";
import { HowItWorks } from "@/app/_marketing/HowItWorks";
import { Privacy } from "@/app/_marketing/Privacy";
import { Pricing } from "@/app/_marketing/Pricing";
import { Testimonials } from "@/app/_marketing/Testimonials";
import { Faq } from "@/app/_marketing/Faq";
import { FinalCta } from "@/app/_marketing/FinalCta";
import { Footer } from "@/app/_marketing/Footer";
import { ScrollProgressBar } from "@/shared/ui/ScrollProgressBar";
import { PRICING_ENABLED } from "@/shared/features";
import styles from "./_marketing/landing.module.css";

// Route-level metadata for the landing page specifically (title/description already
// come from the root layout — see src/app/layout.tsx — this only adds sharing-surface
// metadata that layout's sitewide defaults don't cover). No OG image: none exists in
// this repo, and inventing one would misrepresent the product on link previews.
export const metadata: Metadata = {
  openGraph: {
    title: "SamePath — אנשים בדרך שלך",
    description:
      "קהילה מקצועית דיסקרטית שמחברת אותך לאנשים ברמה שלך שמחפשים תפקיד דומה לשלך.",
    locale: "he_IL",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "SamePath — אנשים בדרך שלך",
    description:
      "קהילה מקצועית דיסקרטית שמחברת אותך לאנשים ברמה שלך שמחפשים תפקיד דומה לשלך.",
  },
};

export default function LandingPage() {
  return (
    <div className={styles.landing}>
      <ScrollProgressBar />
      <Header />
      <main>
        <Hero />
        <WhySamePath />
        <Privacy />
        <HowItWorks />
        {PRICING_ENABLED && <Pricing />}
        <Testimonials />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

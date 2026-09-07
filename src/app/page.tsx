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
import { MobileCta } from "@/app/_marketing/MobileCta";
import { ScrollProgressBar } from "@/shared/ui/ScrollProgressBar";

export default function LandingPage() {
  return (
    <>
      <ScrollProgressBar />
      <Header />
      <main>
        <Hero />
        <WhySamePath />
        <HowItWorks />
        <Privacy />
        <Pricing />
        <Testimonials />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <MobileCta />
    </>
  );
}

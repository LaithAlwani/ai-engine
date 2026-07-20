import { Hero } from "@/components/sections/hero";
import { PlatformTools } from "@/components/sections/platform-tools";
import { HowItWorks } from "@/components/sections/how-it-works";
import { WhyChooseUs } from "@/components/sections/why-choose-us";
import { Pricing } from "@/components/sections/pricing";
import { Faq } from "@/components/sections/faq";
import { ContactSection } from "@/components/sections/contact-section";

export default function HomePage() {
  return (
    <>
      <Hero />
      <PlatformTools />
      <HowItWorks />
      <WhyChooseUs />
      <Pricing />
      <Faq />
      <ContactSection />
    </>
  );
}

import { LPHeader } from '@/components/lp/LPHeader';
import { HeroSection } from '@/components/lp/HeroSection';

import { ProblemSection } from '@/components/lp/ProblemSection';
import { SolutionSection } from '@/components/lp/SolutionSection';
import { FeaturesSection } from '@/components/lp/FeaturesSection';
import { ProductHighlights } from '@/components/lp/ProductHighlights';
import { HowItWorksSection } from '@/components/lp/HowItWorksSection';
import { VideoPlaceholder } from '@/components/lp/VideoPlaceholder';
import { PricingPreview } from '@/components/lp/PricingPreview';
import { FAQSection } from '@/components/lp/FAQSection';
import { CTASection } from '@/components/lp/CTASection';
import { LPFooter } from '@/components/lp/LPFooter';

export default function LandingPage() {
  return (
    <main className="overflow-x-hidden">
      <LPHeader />
      <HeroSection />
      <ProductHighlights />
      <ProblemSection />
      <SolutionSection />
      <FeaturesSection />
      <HowItWorksSection />
      <VideoPlaceholder />
      <PricingPreview />
      <FAQSection />
      <CTASection />
      <LPFooter />
    </main>
  );
}

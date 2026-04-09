import { LPHeader } from '@/components/lp/LPHeader';
import { HeroSection } from '@/components/lp/HeroSection';
import { RealSampleSection } from '@/components/lp/RealSampleSection';
import { ProblemSection } from '@/components/lp/ProblemSection';
import { SolutionSection } from '@/components/lp/SolutionSection';
import { FeaturesSection } from '@/components/lp/FeaturesSection';
import { ProductHighlights } from '@/components/lp/ProductHighlights';
import { FounderSection } from '@/components/lp/FounderSection';
import { HowItWorksSection } from '@/components/lp/HowItWorksSection';
import { ThreeStepsSection } from '@/components/lp/ThreeStepsSection';
import { VideoPlaceholder } from '@/components/lp/VideoPlaceholder';
import { TestimonialsSection } from '@/components/lp/TestimonialsSection';
import { PricingPreview } from '@/components/lp/PricingPreview';
import { FAQSection } from '@/components/lp/FAQSection';
import { CTASection } from '@/components/lp/CTASection';
import { LPFooter } from '@/components/lp/LPFooter';

export default function LandingPage() {
  return (
    <main className="overflow-x-hidden">
      <LPHeader />
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <RealSampleSection />
      <ProductHighlights />
      <FeaturesSection />
      <FounderSection />
      <HowItWorksSection />
      <ThreeStepsSection />
      <VideoPlaceholder />
      <TestimonialsSection />
      <PricingPreview />
      <FAQSection />
      <CTASection />
      <LPFooter />
    </main>
  );
}

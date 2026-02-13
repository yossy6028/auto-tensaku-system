import { LPHeader } from '@/components/lp/LPHeader';
import { HeroSection } from '@/components/lp/HeroSection';
import { SocialProofBar } from '@/components/lp/SocialProofBar';
import { ProblemSection } from '@/components/lp/ProblemSection';
import { SolutionSection } from '@/components/lp/SolutionSection';
import { FeaturesSection } from '@/components/lp/FeaturesSection';
import { HowItWorksSection } from '@/components/lp/HowItWorksSection';
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
      <SocialProofBar />
      <ProblemSection />
      <SolutionSection />
      <FeaturesSection />
      <HowItWorksSection />
      <VideoPlaceholder />
      <TestimonialsSection />
      <PricingPreview />
      <FAQSection />
      <CTASection />
      <LPFooter />
    </main>
  );
}

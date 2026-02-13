import { LPHeader } from '@/components/lp/LPHeader';
import { HeroSection } from '@/components/lp/HeroSection';
import { ProblemSection } from '@/components/lp/ProblemSection';
import { SolutionSection } from '@/components/lp/SolutionSection';
import { FeaturesSection } from '@/components/lp/FeaturesSection';
import { HowItWorksSection } from '@/components/lp/HowItWorksSection';
import { VideoPlaceholder } from '@/components/lp/VideoPlaceholder';
import { PricingPreview } from '@/components/lp/PricingPreview';
import { TestimonialsSection } from '@/components/lp/TestimonialsSection';
import { CTASection } from '@/components/lp/CTASection';

export default function LandingPage() {
  return (
    <main className="overflow-x-hidden">
      <LPHeader />
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <FeaturesSection />
      <HowItWorksSection />
      <VideoPlaceholder />
      <PricingPreview />
      <TestimonialsSection />
      <CTASection />
    </main>
  );
}

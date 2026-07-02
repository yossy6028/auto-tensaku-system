import { LPHeader } from '@/components/lp/LPHeader';
import { HeroSection } from '@/components/lp/HeroSection';
import { TimeROISection } from '@/components/lp/TimeROISection';
import { RealSampleSection } from '@/components/lp/RealSampleSection';
import { DemoSection } from '@/components/lp/DemoSection';
import { ComparisonSection } from '@/components/lp/ComparisonSection';
import { HowItWorksSection } from '@/components/lp/HowItWorksSection';
import { PricingPreview } from '@/components/lp/PricingPreview';
import { FAQSection } from '@/components/lp/FAQSection';
import { CTASection } from '@/components/lp/CTASection';
import { LPFooter } from '@/components/lp/LPFooter';

export default function LandingPage() {
  return (
    <main className="overflow-x-hidden">
      <LPHeader />
      <HeroSection />
      <TimeROISection />
      <RealSampleSection />
      <DemoSection />
      <ComparisonSection />
      <HowItWorksSection />
      <PricingPreview />
      <FAQSection />
      <CTASection />
      <LPFooter />
    </main>
  );
}

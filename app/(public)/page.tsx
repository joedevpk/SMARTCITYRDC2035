import { LandingHero } from '@/components/landing/landing-hero';
import { LandingFeatures } from '@/components/landing/landing-features';
import { LandingMapSection } from '@/components/landing/landing-map-section';
import { LandingSections } from '@/components/landing/landing-sections';
import { LandingCta } from '@/components/landing/landing-cta';

export default function HomePage() {
  return (
    <>
      <LandingHero />
      <LandingSections />
      <LandingFeatures />
      <LandingMapSection />
      <LandingCta />
    </>
  );
}

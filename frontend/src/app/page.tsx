import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { SocialProof } from '@/components/landing/SocialProof';
import { Supports } from '@/components/landing/Supports';
import { Showcase } from '@/components/landing/Showcase';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Features } from '@/components/landing/Features';
import { UseCases } from '@/components/landing/UseCases';
import { Stats } from '@/components/landing/Stats';
import { Testimonials } from '@/components/landing/Testimonials';
import { Comparison } from '@/components/landing/Comparison';
import { TrustSignals } from '@/components/landing/TrustSignals';
import { Pricing } from '@/components/landing/Pricing';
import { FAQ } from '@/components/landing/FAQ';
import { CTA } from '@/components/landing/CTA';
import { Footer } from '@/components/landing/Footer';

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <SocialProof />
        <Supports />
        <Showcase />
        <HowItWorks />
        <Features />
        <UseCases />
        <Stats />
        <Testimonials />
        <Comparison />
        <TrustSignals />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  );
}

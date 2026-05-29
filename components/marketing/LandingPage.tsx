import Navbar from './Navbar'
import HeroSection from './HeroSection'
import StatsSection from './StatsSection'
import PartnersSection from './PartnersSection'
import ProgramsSection from './ProgramsSection'
import HowItWorksSection from './HowItWorksSection'
import PricingSection from './PricingSection'
import LocationSection from './LocationSection'
import CTASection from './CTASection'
import Footer from './Footer'

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <StatsSection />
      <PartnersSection />
      <ProgramsSection />
      <HowItWorksSection />
      <PricingSection />
      <LocationSection />
      <CTASection />
      <Footer />
    </div>
  )
}

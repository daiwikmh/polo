import { HeroSection } from "@/components/landing/HeroSection";
import { SignalsSection } from "@/components/landing/SignalsSection";
import { WorkSection } from "@/components/landing/WorkSection";
import { PrinciplesSection } from "@/components/landing/PrinciplesSection";
import { ColophonSection } from "@/components/landing/ColophonSection";
import { SideNav } from "@/components/landing/SideNav";

export default function Page() {
  return (
    <main className="relative min-h-screen">
      <SideNav />
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
      <div className="relative z-10">
        <HeroSection />
        <SignalsSection />
        <WorkSection />
        <PrinciplesSection />
        <ColophonSection />
      </div>
    </main>
  );
}

import { Header } from "@/components/layout/Header"
import { HeroSection } from "@/components/home/HeroSection"
import { StatsBar } from "@/components/home/StatsBar"
import { ModuleCards } from "@/components/home/ModuleCards"
import { DevOpsRoadmap } from "@/components/home/DevOpsRoadmap"
import { LearningPath } from "@/components/home/LearningPath"
import { InterviewPrep } from "@/components/home/InterviewPrep"
import { CTASection } from "@/components/home/CTASection"

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <StatsBar />
        <ModuleCards />
        <DevOpsRoadmap />
        <LearningPath />
        <InterviewPrep />
        <CTASection />
      </main>
    </>
  )
}

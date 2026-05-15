import React from "react";
import { DiaTextReveal } from "./ui/dia-text-reveal";
import { Button } from "./ui/button";
import { SendHorizontal } from "lucide-react";
import { Textarea } from "./ui/textarea";

export default function Hero() {
  return (
    <div className="text-foreground flex flex-col min-h-screen max-w-4xl mx-auto items-center justify-center space-y-10">
      <h1 className="text-center text-3xl font-semibold tracking-tight md:text-7xl">
        Learn to{" "}
        <DiaTextReveal
          repeat
          repeatDelay={1.2}
          text={["build faster", "ship smarter", "scale easier"]}
        />
      </h1>
      <section className="flex relative w-full">
        <Textarea placeholder="what do you to know?" />
        <Button className="absolute inset-y-0 right-0 ">
          <SendHorizontal />
        </Button>
      </section>
      <section className="mt-10 text-xl">
        <p>Autonomous AI Research Engine for Verifiable Trend Intelligence</p>
      </section>
    </div>
  );
}

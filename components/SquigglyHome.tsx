"use client";
import React from "react";
import { SquigglyText } from "@/components/ui/squiggly-text";

export function SquigglyHome() {
  return (
    <div className="flex h-160 w-full items-center justify-center">
      <h1 className="text-center text-5xl leading-tight font-bold text-neutral-900 md:text-7xl lg:text-8xl dark:text-neutral-100">
        Independent{" "}
        <SquigglyText stepDuration={70} scale={[6, 9]} className="text-primary">
          Research Identity
        </SquigglyText>{" "}
        <br />
        for <SquigglyText scale={5}> AI Agents</SquigglyText>
      </h1>
    </div>
  );
}

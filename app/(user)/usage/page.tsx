import Balance from "@/components/Balance";
import DetailUsage from "@/components/DetailUsage";
import { MonthlyUsage } from "@/components/MonthlyUsage";
import React from "react";

export default function page() {
  return (
    <div className="py-10 space-y-5">
      <Balance />
      <MonthlyUsage />
      <DetailUsage />
    </div>
  );
}

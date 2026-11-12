"use client";

import { useState } from "react";
import { currentMonthRange } from "@/components/DateRangeFilter";
import PeriodFilter from "@/components/PeriodFilter";
import PurchaseSummary from "@/components/PurchasesHistory/purchase-summary";

export default function PurchaseReport() {
  const [range, setRange] = useState(currentMonthRange);

  return (
    <div className="space-y-6">
      <section
        aria-label="Período del informe de compras"
        className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card"
      >
        <h2 className="mb-4 text-xl font-semibold text-dark dark:text-white">
          Período del informe
        </h2>
        <PeriodFilter value={range} onChange={setRange} />
      </section>
      <PurchaseSummary range={range} reloadToken={0} />
    </div>
  );
}

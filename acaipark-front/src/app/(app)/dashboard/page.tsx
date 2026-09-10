"use client";

import { useState } from "react";
import MonthFilter, { currentMonth, monthLastDay } from "@/components/MonthFilter";
import DateRangeFilter, { currentMonthRange, type DateRange } from "@/components/DateRangeFilter";
import DashboardCharts from "@/components/Dashboard/dashboard-charts";
import ControlPanel from "@/components/Dashboard/control-panel";

export default function Dashboard() {
  const [month, setMonth] = useState(currentMonth);
  const [range, setRange] = useState<DateRange>(currentMonthRange);
  return <>
    <MonthFilter value={month} onChange={(value) => { setMonth(value); setRange({ from: `${value}-01`, to: monthLastDay(value) }); }}>
      <DateRangeFilter value={range} onChange={setRange} onClear={() => { const value = currentMonth(); setMonth(value); setRange(currentMonthRange()); }} />
    </MonthFilter>
    <DashboardCharts key={`charts-${month}-${range.from}-${range.to}`} range={range} />
    <div className="mt-6"><ControlPanel key={`panel-${month}-${range.from}-${range.to}`} range={range} /></div>
  </>;
}

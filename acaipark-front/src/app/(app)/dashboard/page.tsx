"use client";

import { useState } from "react";
import MonthFilter, { currentMonth } from "@/components/MonthFilter";
import DashboardCharts from "@/components/Dashboard/dashboard-charts";
import ControlPanel from "@/components/Dashboard/control-panel";

export default function Dashboard() {
  const [month, setMonth] = useState(currentMonth);
  return <>
    <MonthFilter value={month} onChange={setMonth} />
    <DashboardCharts key={`charts-${month}`} month={month} />
    <div className="mt-6"><ControlPanel key={`panel-${month}`} month={month} /></div>
  </>;
}

"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function DailyPaymentMethodChart({
  cash,
  transfer,
  dataphone,
}: {
  cash: number;
  transfer: number;
  dataphone: number;
}) {
  const options: ApexOptions = {
    chart: { type: "bar", height: 300, toolbar: { show: false }, fontFamily: "inherit" },
    colors: ["#00d492", "#3c50e0", "#f59e0b"],
    plotOptions: { bar: { borderRadius: 5, distributed: true, columnWidth: "48%" } },
    dataLabels: { enabled: false },
    legend: { show: false },
    grid: { strokeDashArray: 5 },
    xaxis: { categories: ["Efectivo", "Transferencia", "Datáfono"], axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { formatter: (value) => money(value) } },
    tooltip: { y: { formatter: (value) => money(value) } },
  };

  return <Chart options={options} series={[{ name: "Ingresos", data: [cash, transfer, dataphone] }]} type="bar" height={300} />;
}

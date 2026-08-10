"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";

type PropsType = {
  data: {
    sales: { x: string; y: number }[];
    revenue: { x: string; y: number }[];
  };
};

const Chart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

export function WeeksProfitChart({ data }: PropsType) {
  const dayLabelMap: Record<string, string> = {
    Su: "Dom",
    Mo: "Lun",
    Tu: "Mar",
    We: "Mie",
    Th: "Jue",
    Fr: "Vie",
    Sa: "Sab",
    Sun: "Dom",
    Mon: "Lun",
    Tue: "Mar",
    Wed: "Mie",
    Thu: "Jue",
    Fri: "Vie",
    Sat: "Sab",
    Sunday: "Domingo",
    Monday: "Lunes",
    Tuesday: "Martes",
    Wednesday: "Miercoles",
    Thursday: "Jueves",
    Friday: "Viernes",
    Saturday: "Sabado",
  };

  const options: ApexOptions = {
    colors: ["#00d492", "#ff2056"],
    chart: {
      locales: [
        {
          name: "es",
          options: {
            shortDays: ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"],
          },
        },
      ],
      defaultLocale: "es",
      type: "bar",
      stacked: true,
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      },
    },

    responsive: [
      {
        breakpoint: 1536,
        options: {
          plotOptions: {
            bar: {
              borderRadius: 3,
              columnWidth: "25%",
            },
          },
        },
      },
    ],
    plotOptions: {
      bar: {
        horizontal: false,
        borderRadius: 3,
        columnWidth: "25%",
        borderRadiusApplication: "end",
        borderRadiusWhenStacked: "last",
      },
    },
    dataLabels: {
      enabled: false,
    },

    grid: {
      strokeDashArray: 5,
      xaxis: {
        lines: {
          show: false,
        },
      },
      yaxis: {
        lines: {
          show: true,
        },
      },
    },

    xaxis: {
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
      labels: {
        formatter: (value) => dayLabelMap[value] ?? value,
      },
    },
    legend: {
      position: "top",
      horizontalAlign: "left",
      fontFamily: "inherit",
      fontWeight: 500,
      fontSize: "14px",
      markers: {
        size: 9,
        shape: "circle",
      },
    },
    fill: {
      opacity: 1,
    },
  };
  return (
    <div className="-ml-3.5 mt-3">
      <Chart
        options={options}
        series={[
          {
            name: "Ingresos",
            data: data.sales,
          },
          {
            name: "Egresos",
            data: data.revenue,
          },
        ]}
        type="bar"
        height={370}
      />
    </div>
  );
}

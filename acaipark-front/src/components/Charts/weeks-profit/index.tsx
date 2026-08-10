import { PeriodPicker } from "@/components/period-picker";
import { cn } from "@/lib/utils";
import { getWeeksProfitData } from "@/services/charts.services";
import { WeeksProfitChart } from "./chart";

type PropsType = {
  timeFrame?: string;
  className?: string;
  title?: string;
  subtitle?: string;
  showPicker?: boolean;
};

export async function WeeksProfit({
  className,
  timeFrame,
  title,
  subtitle,
  showPicker = true,
}: PropsType) {
  const data = await getWeeksProfitData(timeFrame);

  return (
    <div
      className={cn(
        "rounded-[10px] bg-white px-7.5 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-body-2xlg font-bold text-dark dark:text-white">
            {title ?? `Profit ${timeFrame || "this week"}`}
          </h2>
          {subtitle ? <p className="text-sm text-body">{subtitle}</p> : null}
        </div>

        {showPicker ? (
          <PeriodPicker
            items={["this week", "last week"]}
            defaultValue={timeFrame || "this week"}
            sectionKey="weeks_profit"
          />
        ) : null}
      </div>

      <WeeksProfitChart data={data} />
    </div>
  );
}

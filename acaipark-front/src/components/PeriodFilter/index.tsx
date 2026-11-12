"use client";

import MonthFilter, { monthLastDay } from "@/components/MonthFilter";
import DateRangeFilter, {
  currentMonthRange,
  type DateRange,
} from "@/components/DateRangeFilter";

export default function PeriodFilter({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  return (
    <MonthFilter
      value={value.from.slice(0, 7)}
      onChange={(month) =>
        onChange({ from: `${month}-01`, to: monthLastDay(month) })
      }
    >
      <DateRangeFilter
        value={value}
        onChange={onChange}
        onClear={() => onChange(currentMonthRange())}
      />
    </MonthFilter>
  );
}

"use client";

import { currentMonth, monthLastDay } from "@/components/MonthFilter";

export type DateRange = { from: string; to: string };

export function currentMonthRange(): DateRange {
  const month = currentMonth();
  return { from: `${month}-01`, to: monthLastDay(month) };
}

export default function DateRangeFilter({ value, onChange, onClear }: { value: DateRange; onChange: (value: DateRange) => void; onClear: () => void }) {
  return <div className="flex flex-wrap items-end gap-3">
    <label className="flex flex-col gap-1 text-sm font-medium text-dark dark:text-white">Desde<input type="date" value={value.from} max={value.to} onChange={(event) => { if (event.target.value) onChange({ ...value, from: event.target.value }); }} className="rounded-md border border-stroke bg-transparent px-3 py-2 dark:border-dark-3" /></label>
    <label className="flex flex-col gap-1 text-sm font-medium text-dark dark:text-white">Hasta<input type="date" value={value.to} min={value.from} onChange={(event) => { if (event.target.value) onChange({ ...value, to: event.target.value }); }} className="rounded-md border border-stroke bg-transparent px-3 py-2 dark:border-dark-3" /></label>
    <button type="button" onClick={onClear} className="rounded border border-stroke px-3 py-2 text-sm text-dark dark:border-dark-3 dark:text-white">Limpiar filtros</button>
  </div>;
}

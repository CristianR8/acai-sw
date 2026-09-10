"use client";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);

export function currentMonth() { return dayjs().tz("America/Bogota").format("YYYY-MM"); }
export function monthLastDay(month: string) { return dayjs(`${month}-01`).endOf("month").format("YYYY-MM-DD"); }
export function initialDay(month: string) { return month === currentMonth() ? dayjs().tz("America/Bogota").format("YYYY-MM-DD") : `${month}-01`; }

export default function MonthFilter({ value, onChange }: { value: string; onChange: (month: string) => void }) {
  function move(amount: number) { onChange(dayjs(`${value}-01`).add(amount, "month").format("YYYY-MM")); }
  return <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-stroke bg-white p-4 dark:border-dark-3 dark:bg-gray-dark">
    <label className="flex flex-col gap-1 text-sm font-medium text-dark dark:text-white">Mes y año
      <input type="month" value={value} min="0001-01" max="9998-12" onChange={(event) => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) onChange(event.target.value); }} className="rounded-md border border-stroke bg-transparent px-3 py-2 dark:border-dark-3" />
    </label>
    <button type="button" onClick={() => move(-1)} aria-label="Mes anterior" className="rounded border border-stroke px-3 py-2">←</button>
    <button type="button" onClick={() => move(1)} aria-label="Mes siguiente" className="rounded border border-stroke px-3 py-2">→</button>
    <button type="button" onClick={() => onChange(currentMonth())} className="rounded border border-stroke px-3 py-2 text-sm">Mes actual</button>
    <p className="text-sm text-body">Toda la información corresponde al mes seleccionado.</p>
  </div>;
}

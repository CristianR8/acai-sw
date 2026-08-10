"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Reservation = {
  id: number;
  name: string;
  phone: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
};

type CalendarCell = {
  date: Date;
  inMonth: boolean;
};

type FormMessage =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | null;

const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const pad2 = (value: number) => String(value).padStart(2, "0");

const toDateKey = (value: Date) =>
  `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;

const buildCalendarCells = (year: number, month: number): CalendarCell[] => {
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const cells: CalendarCell[] = [];

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(year, month, i - startDay + 1);
    cells.push({ date, inMonth: date.getMonth() === month });
  }

  return cells;
};

const defaultFormValues = {
  name: "",
  phone: "",
  reservation_time: "19:00",
  party_size: "2",
};

const CalendarBox = () => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [editingReservationId, setEditingReservationId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<FormMessage>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formValues, setFormValues] = useState(defaultFormValues);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthLabel = `${monthNames[month]} ${year}`;
  const monthKey = `${year}-${pad2(month + 1)}`;

  const cells = useMemo(() => buildCalendarCells(year, month), [year, month]);

  const selectedReservation = useMemo(
    () => reservations.find((reservation) => reservation.id === editingReservationId) ?? null,
    [reservations, editingReservationId],
  );

  const loadReservations = useCallback(async () => {
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/reservations?month=${encodeURIComponent(monthKey)}`,
        { cache: "no-store" },
      );
      const data = (await response.json().catch(() => null)) as any;

      if (!response.ok) {
        setReservations([]);
        setErrorMessage(
          (typeof data?.message === "string" && data.message) ||
            (typeof data?.detail === "string" && data.detail) ||
            "No se pudieron cargar las reservas.",
        );
        return;
      }

      setReservations(Array.isArray(data) ? (data as Reservation[]) : []);
    } catch {
      setReservations([]);
      setErrorMessage("No se pudieron cargar las reservas.");
    }
  }, [monthKey]);

  useEffect(() => {
    void loadReservations();
  }, [loadReservations]);

  useEffect(() => {
    if (editingReservationId !== null) {
      const reservationStillExists = reservations.some(
        (reservation) => reservation.id === editingReservationId,
      );
      if (!reservationStillExists) {
        setEditingReservationId(null);
      }
      return;
    }

    const reservationForSelectedDate =
      reservations.find((reservation) => reservation.reservation_date === selectedDateKey) ??
      null;
    if (reservationForSelectedDate) {
      setEditingReservationId(reservationForSelectedDate.id);
    }
  }, [editingReservationId, reservations, selectedDateKey]);

  useEffect(() => {
    if (selectedReservation) {
      setFormValues({
        name: selectedReservation.name,
        phone: selectedReservation.phone,
        reservation_time: selectedReservation.reservation_time,
        party_size: String(selectedReservation.party_size),
      });
      return;
    }

    setFormValues(defaultFormValues);
  }, [selectedReservation?.id]);

  const goToPrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const now = new Date();
    const todayKey = toDateKey(now);
    setCurrentDate(now);
    setSelectedDateKey(todayKey);
    const todayReservation =
      reservations.find((reservation) => reservation.reservation_date === todayKey) ?? null;
    setEditingReservationId(todayReservation?.id ?? null);
    setFormMessage(null);
  };

  const handleDateClick = (cell: CalendarCell) => {
    const dateKey = toDateKey(cell.date);
    const reservationForDate =
      reservations.find((reservation) => reservation.reservation_date === dateKey) ?? null;
    setSelectedDateKey(dateKey);
    setEditingReservationId(reservationForDate?.id ?? null);
    setFormMessage(null);
    if (!cell.inMonth) {
      setCurrentDate(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1));
    }
  };

  const handleSaveReservation = async () => {
    const name = formValues.name.trim();
    const phone = formValues.phone.trim();
    const reservation_time = formValues.reservation_time.trim();
    const partySize = Number(formValues.party_size);

    if (!name || !phone || !selectedDateKey || !reservation_time || !Number.isFinite(partySize)) {
      setFormMessage({
        kind: "error",
        message: "Nombre, teléfono, fecha, hora y personas son requeridos.",
      });
      return;
    }
    if (partySize <= 0 || partySize > 50) {
      setFormMessage({
        kind: "error",
        message: "La cantidad de personas debe estar entre 1 y 50.",
      });
      return;
    }

    setIsSaving(true);
    setFormMessage(null);
    try {
      const payload = {
        name,
        phone,
        reservation_date: selectedDateKey,
        reservation_time,
        party_size: partySize,
      };
      const response = await fetch(
        selectedReservation
          ? `/api/reservations/${selectedReservation.id}`
          : "/api/reservations",
        {
          method: selectedReservation ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json().catch(() => null)) as any;
      if (!response.ok) {
        setFormMessage({
          kind: "error",
          message:
            (typeof data?.message === "string" && data.message) ||
            (typeof data?.detail === "string" && data.detail) ||
            "No se pudo guardar la reserva.",
        });
        return;
      }
      setFormMessage({
        kind: "success",
        message: selectedReservation
          ? "Reserva actualizada correctamente."
          : "Reserva creada correctamente.",
      });
      if (typeof data?.id === "number") {
        setEditingReservationId(data.id);
      }
      if (typeof data?.reservation_date === "string") {
        setSelectedDateKey(data.reservation_date);
      }
      await loadReservations();
    } catch {
      setFormMessage({ kind: "error", message: "Error guardando la reserva." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteReservation = async () => {
    if (!selectedReservation) return;
    const confirmed = window.confirm(
      `¿Eliminar la reserva de ${selectedReservation.name} del día ${selectedReservation.reservation_date}?`,
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setFormMessage(null);
    try {
      const response = await fetch(`/api/reservations/${selectedReservation.id}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as any;
      if (!response.ok) {
        setFormMessage({
          kind: "error",
          message:
            (typeof data?.message === "string" && data.message) ||
            (typeof data?.detail === "string" && data.detail) ||
            "No se pudo eliminar la reserva.",
        });
        return;
      }
      setEditingReservationId(null);
      setFormMessage({ kind: "success", message: "Reserva eliminada correctamente." });
      await loadReservations();
    } catch {
      setFormMessage({ kind: "error", message: "Error eliminando la reserva." });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="w-full max-w-full overflow-hidden rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="flex flex-col gap-3 border-b border-stroke px-4 py-4 dark:border-dark-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h4 className="text-base font-semibold text-dark dark:text-white sm:text-lg">{monthLabel}</h4>
            <p className="text-sm text-dark-5 dark:text-dark-6">Zona horaria: America/Bogota</p>
          </div>
          <div className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:flex sm:items-center">
            <button
              type="button"
              onClick={goToPrevMonth}
              className="rounded-md border border-stroke px-2 py-1.5 text-xs text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2 sm:px-3 sm:text-sm"
            >
              <span className="hidden sm:inline">Mes anterior</span>
              <span className="sm:hidden">Anterior</span>
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="rounded-md bg-primary px-2 py-1.5 text-xs text-white transition hover:bg-primary/90 sm:px-3 sm:text-sm"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={goToNextMonth}
              className="rounded-md border border-stroke px-2 py-1.5 text-xs text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2 sm:px-3 sm:text-sm"
            >
              <span className="hidden sm:inline">Mes siguiente</span>
              <span className="sm:hidden">Siguiente</span>
            </button>
          </div>
        </div>
        {errorMessage ? (
          <div className="border-b border-stroke px-4 py-2 text-sm text-danger dark:border-dark-3 sm:px-6">
            {errorMessage}
          </div>
        ) : null}
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[680px]">
          <thead>
            <tr className="grid grid-cols-7 rounded-t-[10px] bg-primary text-white">
              <th className="flex h-12 items-center justify-center rounded-tl-[10px] p-1 text-xs font-medium sm:h-15 sm:text-base xl:p-5">
                <span className="hidden sm:block"> Domingo </span>
                <span className="sm:hidden"> Dom </span>
              </th>
              <th className="flex h-12 items-center justify-center p-1 text-xs font-medium sm:h-15 sm:text-base xl:p-5">
                <span className="hidden sm:block"> Lunes </span>
                <span className="sm:hidden"> Lun </span>
              </th>
              <th className="flex h-12 items-center justify-center p-1 text-xs font-medium sm:h-15 sm:text-base xl:p-5">
                <span className="hidden sm:block"> Martes </span>
                <span className="sm:hidden"> Mar </span>
              </th>
              <th className="flex h-12 items-center justify-center p-1 text-xs font-medium sm:h-15 sm:text-base xl:p-5">
                <span className="hidden sm:block"> Miercoles </span>
                <span className="sm:hidden"> Mie </span>
              </th>
              <th className="flex h-12 items-center justify-center p-1 text-xs font-medium sm:h-15 sm:text-base xl:p-5">
                <span className="hidden sm:block"> Jueves </span>
                <span className="sm:hidden"> Jue </span>
              </th>
              <th className="flex h-12 items-center justify-center p-1 text-xs font-medium sm:h-15 sm:text-base xl:p-5">
                <span className="hidden sm:block"> Viernes </span>
                <span className="sm:hidden"> Vie </span>
              </th>
              <th className="flex h-12 items-center justify-center rounded-tr-[10px] p-1 text-xs font-medium sm:h-15 sm:text-base xl:p-5">
                <span className="hidden sm:block"> Sabado </span>
                <span className="sm:hidden"> Sab </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, rowIndex) => (
              <tr key={`row-${rowIndex}`} className="grid grid-cols-7">
                {cells.slice(rowIndex * 7, rowIndex * 7 + 7).map((cell, idx) => {
                  const dateKey = toDateKey(cell.date);
                  const reservation =
                    reservations.find((entry) => entry.reservation_date === dateKey) ?? null;
                  const isSelected = dateKey === selectedDateKey;
                  const isFirst = rowIndex === 0 && idx === 0;
                  const isLast = rowIndex === 5 && idx === 6;

                  return (
                    <td
                      key={dateKey}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleDateClick(cell)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleDateClick(cell);
                        }
                      }}
                      className={`relative h-16 border border-stroke p-1.5 transition hover:bg-gray-2 dark:border-dark-3 dark:hover:bg-dark-2 sm:h-20 sm:p-2 md:h-25 md:p-4 xl:h-31 ${
                        isFirst ? "rounded-tl-[10px]" : ""
                      } ${isLast ? "rounded-br-[10px]" : ""} ${
                        isSelected ? "ring-2 ring-primary ring-inset" : ""
                      }`}
                    >
                      <span
                        className={`font-medium ${
                          cell.inMonth
                            ? "text-dark dark:text-white"
                            : "text-dark-6 dark:text-dark-6"
                        }`}
                      >
                        {cell.date.getDate()}
                      </span>
                      {reservation ? (
                        <div className="mt-1 rounded-[5px] border-l-[3px] border-primary bg-gray-2 px-1.5 py-1 dark:bg-dark-2 sm:mt-2 sm:px-2">
                          <p className="truncate text-[10px] font-medium text-dark dark:text-white sm:text-xs">
                            {reservation.name}
                          </p>
                          <p className="text-[10px] text-dark-5 dark:text-dark-6 sm:text-xs">
                            {reservation.reservation_time} · {reservation.party_size} pers.
                          </p>
                        </div>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-lg font-semibold text-dark dark:text-white">
              {selectedReservation ? "Editar reserva" : "Nueva reserva"}
            </h4>
            <p className="text-sm text-dark-5 dark:text-dark-6">
              Fecha seleccionada: {selectedDateKey}
            </p>
          </div>
          {selectedReservation ? (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Reserva #{selectedReservation.id}
            </span>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-body-color dark:text-dark-6">
              Fecha
            </label>
            <input
              type="date"
              value={selectedDateKey}
              onChange={(event) => {
                setSelectedDateKey(event.target.value);
                setFormMessage(null);
              }}
              className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-body-color dark:text-dark-6">
              Hora
            </label>
            <input
              type="time"
              value={formValues.reservation_time}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, reservation_time: event.target.value }))
              }
              className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-body-color dark:text-dark-6">
              Nombre
            </label>
            <input
              value={formValues.name}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="Nombre completo"
              className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-body-color dark:text-dark-6">
              Teléfono
            </label>
            <input
              value={formValues.phone}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, phone: event.target.value }))
              }
              placeholder="Teléfono"
              className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-body-color dark:text-dark-6">
              Personas
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={formValues.party_size}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, party_size: event.target.value }))
              }
              className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={handleSaveReservation}
            disabled={isSaving || isDeleting}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isSaving
              ? "Guardando..."
              : selectedReservation
                ? "Actualizar reserva"
                : "Crear reserva"}
          </button>
          {selectedReservation ? (
            <button
              type="button"
              onClick={handleDeleteReservation}
              disabled={isSaving || isDeleting}
              className="w-full rounded-lg border border-red/60 px-4 py-2 text-sm font-semibold text-red hover:bg-red/10 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isDeleting ? "Eliminando..." : "Eliminar reserva"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setFormValues(defaultFormValues);
              setEditingReservationId(null);
              setFormMessage(null);
            }}
            disabled={isSaving || isDeleting}
            className="w-full rounded-lg border border-stroke px-4 py-2 text-sm font-semibold text-dark hover:bg-gray-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2 sm:w-auto"
          >
            Limpiar
          </button>
        </div>

        {formMessage ? (
          <div
            className={`mt-4 rounded-md border px-3 py-2 text-sm ${
              formMessage.kind === "success"
                ? "border-green-light bg-green-light-5 text-green-dark dark:border-green-light/40 dark:bg-green-light-5/10 dark:text-green-light"
                : "border-red-light bg-red-light-5 text-red dark:border-red-light/40 dark:bg-red-light-5/10 dark:text-red-light"
            }`}
          >
            {formMessage.message}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default CalendarBox;

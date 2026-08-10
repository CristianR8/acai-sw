"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { BellIcon } from "./icons";

type ReservationNotification = {
  id: number;
  name: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  created_at: string;
};

const getReservationExecutionTime = (reservation: ReservationNotification) =>
  new Date(`${reservation.reservation_date}T${reservation.reservation_time}`).getTime();

const formatReservationDate = (dateValue: string) => {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

export function Notification() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDotVisible, setIsDotVisible] = useState(true);
  const [reservations, setReservations] = useState<ReservationNotification[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const loadReservations = useCallback(async () => {
    try {
      const response = await fetch(`/api/reservations?t=${Date.now()}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          (typeof payload?.message === "string" && payload.message) ||
          "No se pudieron cargar las reservas";
        throw new Error(message);
      }

      const rawReservations = Array.isArray(payload) ? payload : [];
      const now = Date.now();
      const sanitizedReservations = rawReservations
        .filter((item): item is ReservationNotification => typeof item?.id === "number")
        .filter((item) => {
          const executionTime = getReservationExecutionTime(item);
          return Number.isFinite(executionTime) && executionTime >= now;
        })
        .sort((a, b) => {
          const executionA = getReservationExecutionTime(a);
          const executionB = getReservationExecutionTime(b);
          return executionA - executionB;
        });

      setReservations(sanitizedReservations);
      setErrorMessage(null);
    } catch (error) {
      setReservations([]);
      setErrorMessage(error instanceof Error ? error.message : "Error cargando reservas");
    }
  }, []);

  useEffect(() => {
    void loadReservations();
  }, [loadReservations]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void loadReservations();
  }, [isOpen, loadReservations]);

  const notificationCount = reservations.length;

  return (
    <Dropdown
      isOpen={isOpen}
      setIsOpen={(open) => {
        setIsOpen(open);
        if (open) {
          setIsDotVisible(false);
        }
      }}
    >
      <DropdownTrigger
        className="grid size-12 place-items-center rounded-full border bg-gray-2 text-dark outline-none hover:text-primary focus-visible:border-primary focus-visible:text-primary dark:border-dark-4 dark:bg-dark-3 dark:text-white dark:focus-visible:border-primary"
        aria-label="Ver reservas recientes"
      >
        <span className="relative">
          <BellIcon />

          {isDotVisible && notificationCount > 0 && (
            <span
              className={cn(
                "absolute right-0 top-0 z-1 size-2 rounded-full bg-red-light ring-2 ring-gray-2 dark:ring-dark-3",
              )}
            >
              <span className="absolute inset-0 -z-1 animate-ping rounded-full bg-red-light opacity-75" />
            </span>
          )}
        </span>
      </DropdownTrigger>

      <DropdownContent
        align={isMobile ? "end" : "center"}
        className="min-[350px]:min-w-[20rem] border border-stroke bg-white px-3.5 py-3 shadow-md dark:border-dark-3 dark:bg-gray-dark"
      >
        <div className="mb-2 flex items-center justify-between px-2 py-1.5">
          <span className="text-lg font-medium text-dark dark:text-white">Reservas</span>
          <span className="rounded-md bg-primary px-[9px] py-0.5 text-xs font-medium text-white">
            {notificationCount}
          </span>
        </div>

        {errorMessage ? (
          <p className="px-2 py-3 text-sm text-danger">{errorMessage}</p>
        ) : reservations.length === 0 ? (
          <p className="px-2 py-3 text-sm text-dark-5 dark:text-dark-6">
            No hay reservas para mostrar.
          </p>
        ) : (
          <ul className="max-h-[23rem] space-y-1.5 overflow-y-auto pr-1">
            {reservations.map((reservation) => (
              <li key={reservation.id} role="menuitem">
                <div className="rounded-lg px-2 py-2 hover:bg-gray-2 dark:hover:bg-dark-3">
                  <strong className="block text-sm font-medium text-dark dark:text-white">
                    {reservation.name}
                  </strong>
                  <span className="block text-sm font-medium text-dark-5 dark:text-dark-6">
                    {formatReservationDate(reservation.reservation_date)} {" · "}
                    {reservation.reservation_time} {" · "}
                    {reservation.party_size} pers.
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DropdownContent>
    </Dropdown>
  );
}

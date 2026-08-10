"use client";

import { cloneElement, type ReactElement, useId } from "react";

type TooltipProps = {
  label: string;
  children: ReactElement<any>;
  align?: "left" | "right" | "center";
};

export function Tooltip({ label, children, align = "right" }: TooltipProps) {
  const tooltipId = useId();

  const tooltipPosition =
    align === "left"
      ? "left-0"
      : align === "center"
        ? "left-1/2 -translate-x-1/2"
        : "right-0";

  return (
    <span className="relative inline-flex group">
      {cloneElement(children, {
        "data-tooltip-target": tooltipId,
        "aria-describedby": tooltipId,
      })}
      <span
        id={tooltipId}
        role="tooltip"
        className={
          `tooltip absolute bottom-full ${tooltipPosition} z-10 mb-2 invisible ` +
          "inline-block min-w-[140px] rounded-base bg-dark px-4 py-2 text-center text-sm font-medium text-white shadow-xs " +
          "opacity-0 transition-opacity duration-300 group-hover:visible group-hover:opacity-100 " +
          "dark:bg-white dark:text-dark"
        }
      >
        {label}
        <span className="tooltip-arrow" data-popper-arrow />
      </span>
    </span>
  );
}

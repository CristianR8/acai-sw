"use client";

import { type PropsWithChildren, useRef } from "react";

export function PointerScroll({ children }: PropsWithChildren) {
  const pointerY = useRef<number | null>(null);

  const interactiveTarget = (target: EventTarget | null) =>
    target instanceof Element && Boolean(target.closest("button, a, input, select, textarea, label, [role='dialog']"));

  return (
    <div
      className="min-h-screen touch-pan-y"
      onPointerDown={(event) => {
        if (event.pointerType === "touch" || interactiveTarget(event.target)) return;
        pointerY.current = event.clientY;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (pointerY.current === null) return;
        window.scrollBy({ top: pointerY.current - event.clientY, behavior: "auto" });
        pointerY.current = event.clientY;
      }}
      onPointerUp={() => { pointerY.current = null; }}
      onPointerCancel={() => { pointerY.current = null; }}
    >
      {children}
    </div>
  );
}

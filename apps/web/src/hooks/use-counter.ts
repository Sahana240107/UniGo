"use client";

// FILE LOCATION: apps/web/src/hooks/use-counter.ts
//
// Animates a number from 0 (or its previous value) up/down to `target` over
// `duration` ms using requestAnimationFrame + an ease-out curve.
// Re-triggers whenever `target` changes (e.g. after realtime refresh), so
// counters animate again when dynamic data updates.

import { useEffect, useRef, useState } from "react";

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function useCounter(target: number, duration = 1200, start = true) {
  const [val, setVal] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (!start) return;
    const from = fromRef.current;
    const diff = target - from;
    let startTime: number | null = null;
    let raf: number;

    const tick = (now: number) => {
      if (startTime === null) startTime = now;
      const p = Math.min(1, (now - startTime) / duration);
      const eased = easeOutCubic(p);
      setVal(from + diff * eased);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, start]);

  return val;
}
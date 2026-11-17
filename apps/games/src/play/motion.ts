import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

export const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Applies a state change as a view transition, so elements sharing a `view-transition-name`
 * (a tile and the clue it opens) grow into each other. Browsers without it just update.
 * Resolves once the page shows the new state.
 */
export const morph = (update: () => void): Promise<void> => {
  if (!("startViewTransition" in document) || prefersReducedMotion()) {
    flushSync(update);
    return Promise.resolve();
  }
  return document.startViewTransition(() => flushSync(update)).updateCallbackDone;
};

/** Counts towards `target` instead of jumping, so a score change is something you see. */
export function useCountTo(target: number, durationMs = 700) {
  const [shown, setShown] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    const from = current.current;
    if (from === target) return;
    // With reduced motion the first frame is also the last: the number just changes.
    const duration = prefersReducedMotion() ? 0 : durationMs;
    const startedAt = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration);
      const value = Math.round(from + (target - from) * (1 - (1 - progress) ** 3));
      current.current = value;
      setShown(value);
      if (progress < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return shown;
}

/** The latest change to `value`, with an id that is new for every change. */
export function useLastChange(value: number) {
  const [change, setChange] = useState<{ readonly amount: number; readonly id: number } | null>(
    null,
  );
  const previous = useRef(value);

  useEffect(() => {
    if (previous.current === value) return;
    const amount = value - previous.current;
    previous.current = value;
    setChange((last) => ({ amount, id: (last?.id ?? 0) + 1 }));
  }, [value]);

  return change;
}

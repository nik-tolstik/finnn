import { useEffect, useState } from "react";

interface UseCountUpOptions {
  duration?: number;
  start?: number;
  end: number;
  enabled?: boolean;
}

export function useCountUp({ duration = 1000, start = 0, end, enabled = true }: UseCountUpOptions) {
  const [count, setCount] = useState(start);

  useEffect(() => {
    if (!enabled || end === start) {
      setCount(end);
      return;
    }

    const startTime = Date.now();
    const difference = end - start;

    const updateCount = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const easeOutCubic = 1 - (1 - progress) ** 3;
      const current = start + difference * easeOutCubic;

      setCount(current);

      if (progress < 1) {
        requestAnimationFrame(updateCount);
      } else {
        setCount(end);
      }
    };

    const frameId = requestAnimationFrame(updateCount);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [start, end, duration, enabled]);

  return count;
}

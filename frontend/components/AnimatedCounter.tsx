'use client';
import { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  raw: string;
  color: string;
}

export function AnimatedCounter({ raw, color }: AnimatedCounterProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const started = useRef(false);

  const numMatch = raw.match(/\d+/);
  const target = numMatch ? parseInt(numMatch[0], 10) : null;
  const pre = numMatch ? raw.slice(0, numMatch.index) : '';
  const post = numMatch ? raw.slice((numMatch.index ?? 0) + (numMatch[0]?.length ?? 0)) : '';

  const [display, setDisplay] = useState(target !== null ? `${pre}0${post}` : raw);

  useEffect(() => {
    const el = ref.current;
    if (!el || target === null) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1400;
          const startTime = performance.now();

          const tick = (now: number) => {
            const t = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            setDisplay(`${pre}${Math.round(eased * target)}${post}`);
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          observer.unobserve(el);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, pre, post]);

  return (
    <p
      ref={ref}
      className="font-display text-3xl sm:text-4xl font-bold leading-none"
      style={{ color }}
    >
      {display}
    </p>
  );
}

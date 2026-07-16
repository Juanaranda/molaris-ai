'use client';
import { useEffect, useRef, CSSProperties, ReactNode } from 'react';

interface AnimateInProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  delay?: number;
  direction?: 'up' | 'left' | 'right' | 'none';
  threshold?: number;
}

export function AnimateIn({
  children,
  className = '',
  style,
  delay = 0,
  direction = 'up',
  threshold = 0,
}: AnimateInProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reveal = () => {
      el.style.opacity = '1';
      el.style.transform = 'translate(0,0)';
    };

    // El contenido nunca debe quedarse invisible: sin soporte de observer o con
    // movimiento reducido, se muestra de inmediato.
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || typeof IntersectionObserver === 'undefined') {
      reveal();
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer = setTimeout(reveal, delay);
          observer.unobserve(el);
        }
      },
      { threshold }
    );
    observer.observe(el);

    // Red de seguridad: si el observer nunca dispara (elemento más alto que el
    // viewport, layout tardío), revelamos igual en vez de dejarlo apagado.
    const failsafe = setTimeout(reveal, 2500 + delay);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
      clearTimeout(failsafe);
    };
  }, [delay, threshold]);

  const translateMap: Record<string, string> = {
    up: 'translateY(22px)',
    left: 'translateX(-22px)',
    right: 'translateX(22px)',
    none: 'none',
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: 0,
        transform: translateMap[direction],
        transition: `opacity 0.65s cubic-bezier(0.22,1,0.36,1), transform 0.65s cubic-bezier(0.22,1,0.36,1)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

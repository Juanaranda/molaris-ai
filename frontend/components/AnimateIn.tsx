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
  threshold = 0.12,
}: AnimateInProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            el.style.opacity = '1';
            el.style.transform = 'translate(0,0)';
          }, delay);
          observer.unobserve(el);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
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

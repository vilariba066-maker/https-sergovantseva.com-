'use client';
import { useEffect } from 'react';

export default function AnimateOnScroll() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.animate-hidden');
    if (!els.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const delay = Number(el.dataset.delay ?? 0) * 1000;
          setTimeout(() => el.classList.add('animate-visible'), delay);
          observer.unobserve(el);
        });
      },
      { threshold: 0.1 }
    );

    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return null;
}

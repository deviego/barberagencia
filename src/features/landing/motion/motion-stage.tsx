"use client";

import { useEffect, useRef } from "react";
import "./motion.css";

export type MotionDirection = "navalha" | "letreiro" | "cinema";

/**
 * Fase 1 (preview): aplica uma direção de movimento sobre a landing real, sem mudar a "/".
 * Melhoria progressiva: o HTML do servidor vem completo e visível. Só este JS marca como
 * "pendente" (escondido) o que está ABAIXO da dobra, e só se o usuário não pediu menos
 * movimento. Sem JS ou com reduced-motion, nada é escondido. O hero nunca é tocado.
 */
const REVEAL = [
  "main > section:not(#produto) > :not(.grid)", // blocos de título, tabela, FAQ, CTA
  "main > section:not(#produto) > .grid > *", // cards (com escalonamento)
  "footer > div > *",
].join(",");

export function MotionStage({ direction, children }: { direction: MotionDirection; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    const fold = window.innerHeight;
    const targets = Array.from(root.querySelectorAll<HTMLElement>(REVEAL)).filter(
      (el) => el.getBoundingClientRect().top > fold * 0.92
    );

    for (const el of targets) {
      const siblings = el.parentElement ? Array.from(el.parentElement.children) : [];
      const i = el.parentElement?.classList.contains("grid") ? siblings.indexOf(el) : 0;
      el.style.setProperty("--m-delay", `${Math.min(i, 5) * 70}ms`);
      el.classList.add("m-reveal", "m-pending");
    }
    root.dataset.motionReady = "1";

    const done = (e: TransitionEvent) => {
      const el = e.currentTarget as HTMLElement;
      if (e.target !== el || e.propertyName !== "opacity") return;
      el.classList.remove("m-reveal");
      el.classList.add("m-done");
      el.removeEventListener("transitionend", done);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.addEventListener("transitionend", done);
          el.classList.remove("m-pending");
          el.classList.add("m-in");
          io.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.01 }
    );
    targets.forEach((el) => io.observe(el));

    // Cinema: holofote dourado que segue o cursor nos cards de plano (só mouse/trackpad).
    let cleanupSpot = () => {};
    if (direction === "cinema" && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      const cards = Array.from(root.querySelectorAll<HTMLElement>("#planos .grid.items-stretch > div"));
      let raf = 0;
      const move = (ev: PointerEvent) => {
        const card = ev.currentTarget as HTMLElement;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const r = card.getBoundingClientRect();
          card.style.setProperty("--mx", `${ev.clientX - r.left}px`);
          card.style.setProperty("--my", `${ev.clientY - r.top}px`);
        });
      };
      cards.forEach((c) => c.addEventListener("pointermove", move));
      cleanupSpot = () => {
        cancelAnimationFrame(raf);
        cards.forEach((c) => c.removeEventListener("pointermove", move));
      };
    }

    return () => {
      io.disconnect();
      cleanupSpot();
    };
  }, [direction]);

  return (
    <div ref={ref} data-motion={direction}>
      {children}
    </div>
  );
}

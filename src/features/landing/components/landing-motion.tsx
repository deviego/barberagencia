"use client";

import { useEffect } from "react";

/**
 * Liga os efeitos da landing v2 (CSS em landing-v2.css). Não renderiza nada.
 * - `[data-reveal]`, `[data-type]`, `.lv2-bigmark-wrap`: ganham `data-in` ao entrar na tela.
 * - `[data-scroll]`: recebe `--p` (0 → 1) conforme sobe na tela (hero inclinado).
 * - `.lv2-journey`: recebe `data-step` com o passo ativo do scroll travado.
 * Com prefers-reduced-motion nada liga e a página fica estática (o texto já está todo no HTML).
 */
export function LandingMotion({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const vh = () => window.innerHeight || 800;

    // 1) Entradas: o que já está na tela fica visível antes de ligar o modo animado (sem piscar).
    const revealables = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal], [data-type], .lv2-bigmark-wrap"));
    for (const el of revealables) {
      if (el.getBoundingClientRect().top < vh() * 0.92) el.setAttribute("data-in", "");
    }
    root.classList.add("lv2-on");

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute("data-in", "");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    for (const el of revealables) if (!el.hasAttribute("data-in")) io.observe(el);

    // 2) Scroll: hero (--p) e jornada (data-step), num rAF só.
    const tilts = Array.from(root.querySelectorAll<HTMLElement>("[data-scroll]"));
    const journeys = Array.from(root.querySelectorAll<HTMLElement>(".lv2-journey"));
    let frame = 0;
    const update = () => {
      frame = 0;
      const h = vh();
      for (const el of tilts) {
        const top = el.getBoundingClientRect().top;
        const p = Math.min(1, Math.max(0, (h - top) / (h * 0.75)));
        el.style.setProperty("--p", p.toFixed(3));
      }
      for (const el of journeys) {
        const steps = Number(el.dataset.steps || 3);
        const r = el.getBoundingClientRect();
        const travel = Math.max(1, r.height - h);
        const progress = Math.min(0.999, Math.max(0, -r.top / travel));
        const step = String(Math.floor(progress * steps));
        if (el.dataset.step !== step) el.dataset.step = step;
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
      root.classList.remove("lv2-on");
    };
  }, [rootId]);

  return null;
}

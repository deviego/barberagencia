"use client";

import { useCallback, useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CONFIG_TABS, CONFIG_TAB_PARAM, configTabFromHash, isConfigTab, type ConfigTab } from "../config-tabs";

/**
 * Abas de Configurações (#136). Só organiza a tela: os painéis já chegam prontos do servidor.
 * - A aba fica na URL (?aba=<slug>); trocar de aba cria uma entrada no histórico, então o
 *   "voltar" do navegador volta para a aba anterior. Sem parâmetro, abre Unidade.
 * - Links antigos por âncora (#meu-plano, #contrato, #unidade) abrem a aba da seção e rolam até ela.
 * - Todos os painéis ficam montados (só escondidos): trocar de aba não perde o que foi digitado.
 */
export function ConfigTabs({ panels }: { panels: Record<ConfigTab, ReactNode> }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const fromUrl = params.get(CONFIG_TAB_PARAM);
  const active: ConfigTab = isConfigTab(fromUrl) ? fromUrl : "unidade";
  const tabRefs = useRef<Partial<Record<ConfigTab, HTMLButtonElement | null>>>({});

  // Link antigo só com âncora: põe a aba na URL (sem nova entrada no histórico) e mantém a âncora.
  useEffect(() => {
    const onHash = () => {
      const tab = configTabFromHash(window.location.hash);
      const current = new URLSearchParams(window.location.search).get(CONFIG_TAB_PARAM);
      if (!tab || current === tab) return;
      const next = new URLSearchParams(window.location.search);
      next.set(CONFIG_TAB_PARAM, tab);
      window.history.replaceState(window.history.state, "", `${pathname}?${next}${window.location.hash}`);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [pathname]);

  // Com a aba certa já visível, rola até a seção da âncora (o navegador procurou antes dela aparecer).
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id || configTabFromHash(`#${id}`) !== active) return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [active]);

  // No celular, a aba ativa fica à vista na faixa que rola na horizontal. Rola só a faixa:
  // scrollIntoView rolaria a página também e desfaria a rolagem até a âncora (#contrato).
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const strip = stripRef.current;
    const tab = tabRefs.current[active];
    if (!strip || !tab) return;
    const left = tab.offsetLeft; // a faixa é "relative": o offset já é medido a partir dela
    const right = left + tab.offsetWidth;
    if (left < strip.scrollLeft) strip.scrollTo({ left });
    else if (right > strip.scrollLeft + strip.clientWidth) strip.scrollTo({ left: right - strip.clientWidth });
  }, [active]);

  const select = useCallback(
    (tab: ConfigTab) => {
      if (tab === active) return;
      const next = new URLSearchParams(window.location.search);
      next.set(CONFIG_TAB_PARAM, tab);
      // Sem a âncora antiga: ela levaria a rolagem para outra aba.
      window.history.pushState(null, "", `${pathname}?${next}`);
    },
    [active, pathname],
  );

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = CONFIG_TABS.findIndex((t) => t.key === active);
    let to = -1;
    if (e.key === "ArrowRight") to = (i + 1) % CONFIG_TABS.length;
    else if (e.key === "ArrowLeft") to = (i - 1 + CONFIG_TABS.length) % CONFIG_TABS.length;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = CONFIG_TABS.length - 1;
    if (to < 0) return;
    e.preventDefault();
    const tab = CONFIG_TABS[to].key;
    select(tab);
    tabRefs.current[tab]?.focus();
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div
        ref={stripRef}
        className="relative -mx-4 min-w-0 overflow-x-auto px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          role="tablist"
          aria-label="Seções das configurações"
          onKeyDown={onKeyDown}
          className="flex w-max min-w-full gap-1 border-b border-border"
        >
          {CONFIG_TABS.map((t) => {
            const selected = t.key === active;
            return (
              <button
                key={t.key}
                ref={(el) => {
                  tabRefs.current[t.key] = el;
                }}
                type="button"
                role="tab"
                id={`config-tab-${t.key}`}
                aria-selected={selected}
                aria-controls={`config-panel-${t.key}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(t.key)}
                className={`-mb-px min-h-11 shrink-0 whitespace-nowrap border-b-2 px-3 text-caption font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                  selected ? "border-accent text-text" : "border-transparent text-text-muted hover:text-text"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {CONFIG_TABS.map((t) => (
        <div
          key={t.key}
          role="tabpanel"
          id={`config-panel-${t.key}`}
          aria-labelledby={`config-tab-${t.key}`}
          hidden={t.key !== active}
          // `hidden` sozinho perde para o `flex` do Tailwind: a classe também troca.
          className={t.key === active ? "flex flex-col gap-6" : "hidden"}
        >
          {panels[t.key]}
        </div>
      ))}
    </div>
  );
}

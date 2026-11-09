import { Minus, Plus } from "lucide-react";
import { FAQS } from "@/features/landing/content";
import { SEO_FAQS } from "@/features/seo/faq";

/**
 * FAQ em <details>/<summary>: todas as respostas vão no HTML do servidor (legíveis por buscadores e IAs sem JS),
 * abrir/fechar é nativo do navegador. Mesmo visual do acordeão anterior; a 1ª pergunta começa aberta.
 */
export function Faq() {
  const items = [...FAQS, ...SEO_FAQS.filter((s) => !FAQS.some((f) => f.q === s.q))];

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((f, i) => (
        <details
          key={f.q}
          open={i === 0}
          className="group rounded-md border border-border bg-surface transition-colors open:border-accent hover:border-accent"
        >
          <summary
            className="flex w-full cursor-pointer list-none items-center justify-between gap-4 py-[18px] text-left [&::-webkit-details-marker]:hidden"
            style={{ paddingLeft: 22, paddingRight: 22 }}
          >
            <h3 className="m-0 text-[15px] font-semibold text-text">{f.q}</h3>
            <Plus size={18} className="shrink-0 text-accent group-open:hidden" aria-hidden />
            <Minus size={18} className="hidden shrink-0 text-accent group-open:block" aria-hidden />
          </summary>
          <p className="m-0 px-[22px] pb-[18px] text-[14px] leading-[1.6] text-text-2">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

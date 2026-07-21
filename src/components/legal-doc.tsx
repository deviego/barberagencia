import { LEGAL_CONTACT, type LegalDocument } from "@/lib/legal/content";

export function LegalDoc({ doc }: { doc: LegalDocument }) {
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6">
      <header className="border-b border-border pb-5">
        <div className="text-overline uppercase text-text-muted">{doc.subtitle}</div>
        <h1 className="mt-1 font-display text-h1 uppercase leading-none text-text">{doc.title}</h1>
        <p className="mt-3 text-body text-text-2">{doc.intro}</p>
        <p className="mt-2 text-caption text-text-muted">
          Última atualização: {LEGAL_CONTACT.updatedAt}
        </p>
      </header>

      {doc.sections.map((s) => (
        <section key={s.title} className="flex flex-col gap-2">
          <h2 className="text-h5 font-semibold text-text">{s.title}</h2>
          {s.paragraphs.map((p, i) => (
            <p key={i} className="text-body leading-relaxed text-text-2">
              {p}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}

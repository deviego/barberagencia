import { buildContract, type ContractFields } from "../template";

export type SignatureInfo = {
  status: "PENDING" | "SIGNED";
  signedAt?: string | null;
  signedName?: string | null;
  signedIp?: string | null;
  signatureHash?: string | null;
  contractVersion?: string | null;
};

/** Documento do contrato renderizado (título, partes, cláusulas) + bloco de assinatura.
 *  Componente puro (sem estado) — usado no modal, em Configurações e no painel master. */
export function ContractDocument({
  fields,
  signature,
}: {
  fields: ContractFields;
  signature?: SignatureInfo;
}) {
  const { title, parties, sections } = buildContract(fields);
  const signedDate = signature?.signedAt
    ? new Date(signature.signedAt).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })
    : null;

  return (
    <article className="contract-print flex flex-col gap-4 text-body leading-relaxed text-text-2">
      <header className="text-center">
        <h2 className="text-h5 font-bold uppercase text-text">{title}</h2>
      </header>

      <section className="flex flex-col gap-2">
        <h3 className="text-overline uppercase text-text-muted">Das Partes</h3>
        {parties.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </section>

      {sections.map((s) => (
        <section key={`${s.n}-${s.title}`} className="flex flex-col gap-1.5">
          <h3 className="text-body font-bold text-text">
            {s.n ? `${s.n}. ` : ""}
            {s.title}
          </h3>
          {s.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      ))}

      {signature?.status === "SIGNED" && (
        <section className="mt-2 rounded-md border border-success-strong/40 bg-success-bg/40 p-4 text-caption">
          <div className="font-semibold text-success-strong">Contrato assinado eletronicamente</div>
          <div className="mt-1 flex flex-col gap-0.5 text-text-2">
            {signedDate && <span>Aceito em {signedDate}</span>}
            {signature.signedName && <span>Por: {signature.signedName}</span>}
            {signature.signedIp && <span>IP: {signature.signedIp}</span>}
            {signature.contractVersion && <span>Versão: {signature.contractVersion}</span>}
            {signature.signatureHash && (
              <span className="break-all">Hash: {signature.signatureHash}</span>
            )}
          </div>
        </section>
      )}
    </article>
  );
}

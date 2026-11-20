import { getTotemData } from "@/features/queue/data";
import { TotemKiosk } from "@/features/queue/components/totem-kiosk";
import { TOTEM_ERRORS } from "@/features/queue/totem-rules";

export const dynamic = "force-dynamic";

export default async function TotemPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const [{ slug }, { k }] = await Promise.all([params, searchParams]);
  const data = await getTotemData(slug, k ?? "");

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6 text-center">
        <div>
          <h1 className="text-h4 font-bold text-text">Totem indisponível</h1>
          {/* Chave antiga (#103), link inválido ou fila desligada: aviso neutro, sem dado da barbearia. */}
          <p className="mt-2 text-body text-text-2">{TOTEM_ERRORS.invalidTotem}</p>
        </div>
      </div>
    );
  }

  return (
    <TotemKiosk
      slug={slug}
      token={k ?? ""}
      name={data.name}
      pickBarber={data.pickBarber}
      planRequiresService={data.planRequiresService}
      services={data.services}
      barbers={data.barbers}
    />
  );
}

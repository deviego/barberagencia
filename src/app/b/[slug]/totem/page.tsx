import { getTotemData } from "@/features/queue/data";
import { TotemKiosk } from "@/features/queue/components/totem-kiosk";

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
          <p className="mt-2 text-body text-text-2">Link inválido ou fila não ativada. Verifique o link do totem nas configurações.</p>
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

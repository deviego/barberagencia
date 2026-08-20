import { notFound } from "next/navigation";
import { getTenantBySubdomain } from "@/lib/tenant/resolve";
import { getQueueBoard, getQueueConfig } from "@/features/queue/data";
import { PainelView } from "@/features/queue/components/painel-view";

export const dynamic = "force-dynamic";

export default async function PainelFilaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getTenantBySubdomain(slug);
  if (!tenant) notFound();

  const config = await getQueueConfig(tenant.id);
  if (!config.enabled) notFound();

  const board = await getQueueBoard(tenant.id);
  return (
    <PainelView
      name={tenant.name}
      serving={board.serving}
      waiting={board.waiting}
      lastDone={board.lastDone}
      lastCalled={board.lastCalled}
      doneCount={board.doneCount}
    />
  );
}

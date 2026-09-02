import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getDistributorForMaster } from "@/features/distributor/data";
import { getSaasBilling } from "@/features/billing/data";
import { MasterBillingPanel } from "@/features/billing/components/master-billing-panel";

export const dynamic = "force-dynamic";

export default async function DistributorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [d, billing] = await Promise.all([getDistributorForMaster(id), getSaasBilling(id)]);
  if (!d) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link href="/master/distribuidores" className="flex items-center gap-1.5 text-caption text-text-muted hover:text-text">
        <ArrowLeft size={15} /> Distribuidores
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-h3 font-bold text-text">{d.name}</h1>
            <Badge variant="accent">Distribuidor</Badge>
          </div>
          {d.phone && (
            <span className="mt-1 flex items-center gap-1.5 text-caption text-text-2">
              <Phone size={14} className="text-text-muted" /> {d.phone}
            </span>
          )}
        </div>
      </div>

      {billing && <MasterBillingPanel tenantId={d.id} billing={billing} />}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSupplierCatalog } from "@/features/orders/data";
import { SupplierShop } from "@/features/orders/components/supplier-shop";

export const dynamic = "force-dynamic";

export default async function SupplierCatalogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getSupplierCatalog(id);
  if (!data) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/fornecedores" className="flex w-fit items-center gap-1 text-caption text-text-muted hover:text-accent">
          <ArrowLeft size={14} /> Fornecedores
        </Link>
        <h1 className="text-h3 font-bold text-text">{data.supplier.name}</h1>
        <p className="text-caption text-text-muted">Monte o carrinho e envie o pedido. O distribuidor confirma e você acompanha o status.</p>
      </div>
      <SupplierShop distributorId={data.supplier.id} products={data.products} />
    </div>
  );
}

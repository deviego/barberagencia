import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ImportWizard } from "@/features/import/components/import-wizard";

export const dynamic = "force-dynamic";

export default async function ImportarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data: t } = await admin.from("tenants").select("name").eq("id", id).maybeSingle();
  if (!t) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/master/barbearias/${id}`} className="flex w-fit items-center gap-1.5 text-caption text-text-muted hover:text-text">
        <ArrowLeft size={15} /> {t.name as string}
      </Link>
      <div>
        <h1 className="text-h3 font-bold text-text">Importar dados</h1>
        <p className="text-caption text-text-muted">
          Traga clientes, produtos e serviços de outra plataforma (CSV ou Excel) para a base de <strong>{t.name as string}</strong>.
        </p>
      </div>
      <ImportWizard tenantId={id} tenantName={t.name as string} />
    </div>
  );
}

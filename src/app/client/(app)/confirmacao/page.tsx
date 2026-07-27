import { ConfirmacaoView } from "@/features/client/components/confirmacao-view";

export default async function ConfirmacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return <ConfirmacaoView appointmentId={id ?? null} />;
}

import { notFound } from "next/navigation";
import { RescheduleForm } from "@/features/client/components/reschedule-form";
import { getAppointmentForReschedule, getWorkingHours } from "@/features/client/data";

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

export default async function ReagendarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [appt, workingHours] = await Promise.all([getAppointmentForReschedule(id), getWorkingHours()]);
  if (!appt) notFound();

  const barber = one(appt.barbers as { name: string }[] | { name: string });
  const serviceName =
    one(appt.services as { name: string }[] | { name: string })?.name ??
    one(appt.combo_plans as { name: string }[] | { name: string })?.name ??
    "Corte";

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-h3 font-bold text-text">Reagendar</h1>
      <RescheduleForm
        appointmentId={appt.id as string}
        barberId={(appt.barber_id as string | null) ?? null}
        barberName={barber?.name ?? "Barbeiro"}
        serviceName={serviceName}
        currentStartAt={appt.start_at as string}
        workingHours={workingHours}
      />
    </div>
  );
}

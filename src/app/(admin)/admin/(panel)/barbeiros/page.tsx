import { CrudTable, type CrudColumn } from "@/features/admin/components/crud-table";
import { WorkingHoursPanel } from "@/features/admin/components/working-hours-panel";
import { getBarbers, getWorkingHours } from "@/features/admin/data";

const columns: CrudColumn[] = [
  { key: "name", label: "Nome" },
  { key: "active", label: "Status", format: "activeBadge" },
];

export default async function BarbeirosPage() {
  const [rows, workingHours] = await Promise.all([getBarbers(), getWorkingHours()]);
  return (
    <div className="flex flex-col gap-10">
      <CrudTable
        table="barbers"
        title="Barbeiros"
        newLabel="Novo barbeiro"
        rows={rows}
        searchKeys={["name"]}
        columns={columns}
        fields={[{ name: "name", label: "Nome completo" }]}
      />

      <WorkingHoursPanel
        barbers={rows as { id: string; name: string; active: boolean }[]}
        workingHours={workingHours as { barber_id: string; weekday: number; start_min: number; end_min: number }[]}
      />
    </div>
  );
}

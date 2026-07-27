import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/nav/logout-button";
import { PerfilForm } from "@/features/client/components/perfil-form";
import { ChildrenSection } from "@/features/client/components/children-section";
import type { Child } from "@/features/client/components/child-modal";
import { getProfile, getMyChildren } from "@/features/client/data";

export default async function PerfilPage() {
  const [data, children] = await Promise.all([getProfile(), getMyChildren()]);
  if (!data) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h3 font-bold text-text">Meu perfil</h1>
        <LogoutButton />
      </div>

      <PerfilForm
        userId={data.userId}
        fullName={data.fullName}
        phone={data.phone}
        email={data.email}
        avatarUrl={data.avatarUrl}
      />

      <ChildrenSection initial={children as Child[]} />
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/services/auth-service";

export function LogoutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        await signOut();
        router.push("/login");
      }}
    >
      <LogOut size={16} />
      Sair
    </Button>
  );
}

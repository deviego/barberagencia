"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { MobileNav } from "@/components/nav/mobile-nav";
import { LogoutButton } from "@/components/nav/logout-button";
import { MASTER_NAV } from "@/features/platform/nav";

/** Hambúrguer + menu deslizante do master (só no mobile). */
export function MasterMobileMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        className="flex rounded-md p-2 text-text-2 transition-colors hover:bg-accent-wash hover:text-accent md:hidden"
      >
        <Menu size={18} />
      </button>
      <MobileNav
        open={open}
        onClose={() => setOpen(false)}
        items={MASTER_NAV.map((i) => ({ href: i.href, label: i.label, icon: i.icon }))}
        pathname={pathname}
        rootHref="/master"
        title="barberagencia"
        footer={<LogoutButton variant="sidebar" />}
      />
    </>
  );
}

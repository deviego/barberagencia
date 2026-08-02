"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { FAQS } from "@/features/landing/content";

export function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <div className="flex flex-col gap-2.5">
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          <div
            key={f.q}
            className={`rounded-md border bg-surface transition-colors ${isOpen ? "border-accent" : "border-border hover:border-accent"}`}
          >
            <button
              type="button"
              onClick={() => setOpen((cur) => (cur === i ? -1 : i))}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-5.5 py-[18px] text-left"
              style={{ paddingLeft: 22, paddingRight: 22 }}
            >
              <span className="text-[15px] font-semibold text-text">{f.q}</span>
              {isOpen ? (
                <Minus size={18} className="shrink-0 text-accent" />
              ) : (
                <Plus size={18} className="shrink-0 text-accent" />
              )}
            </button>
            {isOpen && (
              <p className="px-[22px] pb-[18px] text-[14px] leading-[1.6] text-text-2">{f.a}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

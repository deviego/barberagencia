"use client";

import { useState } from "react";
import Image from "next/image";
import { DEVICES, type Device } from "@/features/landing/content";
import { Icon } from "@/features/landing/components/icon";

const CONTACT_SHADOW = "radial-gradient(ellipse at center, rgba(0,0,0,.55), transparent 72%)";

function Screen({ device }: { device: Device }) {
  return (
    <Image
      src={device.image}
      alt={`Print da plataforma — ${device.label}`}
      fill
      sizes="(max-width: 768px) 90vw, 1000px"
      className="object-cover"
      priority={device.id === "laptop"}
    />
  );
}

export function DeviceShowcase() {
  const [id, setId] = useState<Device["id"]>("laptop");
  const device = DEVICES.find((d) => d.id === id) ?? DEVICES[0];

  return (
    <div className="mx-auto mt-14 flex max-w-[1180px] flex-col items-center gap-6">
      {/* Abas */}
      <div className="flex gap-1.5 rounded-pill border border-border bg-surface p-1.5">
        {DEVICES.map((d) => {
          const active = d.id === id;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setId(d.id)}
              aria-pressed={active}
              className={`inline-flex items-center gap-2 rounded-pill px-5 py-2 text-[13px] font-semibold transition-colors ${
                active ? "bg-accent text-text-inverse" : "text-text-2 hover:text-accent"
              }`}
            >
              <Icon name={d.icon} size={15} />
              {d.label}
            </button>
          );
        })}
      </div>

      {/* Notebook */}
      {id === "laptop" && (
        <div className="relative flex w-full max-w-[1000px] flex-col items-center">
          <div className="pointer-events-none absolute inset-x-[8%] -bottom-6 h-[70px] rounded-[50%]" style={{ background: CONTACT_SHADOW, filter: "blur(26px)" }} />
          <div className="pointer-events-none absolute inset-x-[14%] bottom-[4%] top-[8%] rounded-[40px]" style={{ background: "var(--bb-accent)", opacity: 0.16, filter: "blur(72px)" }} />
          <div
            className="relative w-[92%] rounded-t-[14px] rounded-b-[4px]"
            style={{ border: "10px solid #262626", borderBottomWidth: 26, background: "#262626", boxShadow: "0 1px 0 0 rgba(255,255,255,.12) inset, 0 0 0 1px rgba(0,0,0,.75), 0 24px 48px -18px rgba(0,0,0,.85)" }}
          >
            <div className="absolute -top-[7px] left-1/2 h-[7px] w-[7px] -translate-x-1/2 rounded-full" style={{ background: "#3A3A3A" }} />
            <div className="absolute -bottom-[22px] left-1/2 -translate-x-1/2 font-display text-[11px] font-extrabold tracking-[0.18em]" style={{ color: "#4A4A4A" }}>
              BARBER
            </div>
            <div className="relative aspect-[16/10] overflow-hidden rounded-[5px] bg-inset">
              <Screen device={device} />
            </div>
          </div>
          <div
            className="relative flex h-[13px] w-full max-w-[1000px] items-start justify-center rounded-b-[10px]"
            style={{ background: "linear-gradient(180deg, #3A3A3A 0%, #262626 40%, #101010 100%)", boxShadow: "0 1px 0 0 rgba(255,255,255,.14) inset, 0 10px 20px -8px rgba(0,0,0,.9)" }}
          >
            <div className="h-[6px] w-[130px] rounded-b-[8px]" style={{ background: "linear-gradient(180deg, #1A1A1A, #0E0E0E)" }} />
          </div>
        </div>
      )}

      {/* Tablet */}
      {id === "tablet" && (
        <div className="relative flex w-full max-w-[620px]">
          <div className="pointer-events-none absolute inset-x-[6%] -bottom-[22px] h-[60px] rounded-[50%]" style={{ background: CONTACT_SHADOW, filter: "blur(24px)" }} />
          <div className="pointer-events-none absolute inset-x-[10%] bottom-[6%] top-[10%] rounded-[40px]" style={{ background: "var(--bb-accent)", opacity: 0.16, filter: "blur(64px)" }} />
          <div className="relative w-full rounded-[26px]" style={{ border: "14px solid #1C1C1C", background: "#1C1C1C", boxShadow: "0 1px 0 0 rgba(255,255,255,.10) inset, 0 0 0 1px rgba(0,0,0,.7), 0 24px 48px -18px rgba(0,0,0,.85)" }}>
            <div className="relative aspect-[4/3] overflow-hidden rounded-[12px] bg-inset">
              <Screen device={device} />
            </div>
          </div>
        </div>
      )}

      {/* Celular */}
      {id === "phone" && (
        <div className="relative flex w-[320px] max-w-full">
          <div className="pointer-events-none absolute inset-x-[6%] -bottom-5 h-[54px] rounded-[50%]" style={{ background: CONTACT_SHADOW, filter: "blur(22px)" }} />
          <div className="pointer-events-none absolute inset-x-[8%] bottom-[8%] top-[12%] rounded-[60px]" style={{ background: "var(--bb-accent)", opacity: 0.16, filter: "blur(60px)" }} />
          <div className="relative w-full rounded-[40px]" style={{ border: "11px solid #1C1C1C", background: "#1C1C1C", boxShadow: "0 1px 0 0 rgba(255,255,255,.10) inset, 0 0 0 1px rgba(0,0,0,.7), 0 24px 48px -18px rgba(0,0,0,.85)" }}>
            <div className="absolute left-1/2 top-3 z-[2] h-[22px] w-[92px] -translate-x-1/2 rounded-pill" style={{ background: "#1C1C1C" }} />
            <div className="relative aspect-[9/19.5] overflow-hidden rounded-[30px] bg-inset">
              <Screen device={device} />
            </div>
          </div>
        </div>
      )}

      <span className="text-[13px] text-text-muted">{device.caption}</span>
    </div>
  );
}

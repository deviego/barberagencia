"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { OtpInput } from "./otp-input";

export function OtpForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(42);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-7 shadow-lg">
      <OtpInput onComplete={setCode} />

      <button
        type="button"
        onClick={() => router.push("/")}
        disabled={code.length !== 6}
        className="rounded-md bg-accent py-3 text-body-lg font-bold text-text-inverse transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        Validar e entrar
      </button>

      <div className="text-center text-caption text-text-muted">
        Não recebeu?{" "}
        {seconds > 0 ? (
          <span className="tabular">
            Reenviar em {mm}:{ss}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setSeconds(42)}
            className="font-semibold text-accent hover:underline"
          >
            Reenviar código
          </button>
        )}
      </div>

      <Link
        href="/login"
        className="text-center text-caption text-text-muted hover:text-accent"
      >
        ← Voltar ao login
      </Link>
    </div>
  );
}

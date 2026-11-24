"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MailWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { resendContactEmailConfirmation, updateContactEmail } from "@/features/auth/contact-actions";
import { CONTACT_EMAIL_MESSAGES as MSG, type ContactEmailState } from "@/features/auth/contact-types";
import { CONTACT_SCREEN_COPY as COPY, type ContactLinkResult } from "@/features/auth/contact-screen-copy";


/**
 * E-mail de contato no perfil do cliente (#177): estado (confirmado ou pendente),
 * "Reenviar confirmação" e trocar/cadastrar o e-mail. O resultado do link do e-mail chega
 * em `linkResult` (vindo de `?contato=`).
 */
export function ContactEmailCard({
  state,
  linkResult,
}: {
  state: ContactEmailState;
  linkResult: ContactLinkResult;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState<"resend" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Link velho com o e-mail já confirmado: não há "Reenviar", então mostra o confirmado.
  const banner =
    linkResult && state.verified
      ? { tone: "success" as const, text: MSG.confirmed }
      : linkResult === "link-invalido" && state.email
        ? { tone: "danger" as const, text: MSG.invalidLink }
        : null;

  async function onResend() {
    setError(null);
    setNotice(null);
    setBusy("resend");
    try {
      const res = await resendContactEmailConfirmation();
      if (res.ok) setNotice(MSG.sent);
      else if (res.code === "NOT_SIGNED_IN") router.replace("/client/login");
      else setError(res.error);
    } catch {
      setError(MSG.failed);
    } finally {
      setBusy(null);
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setInvalid(false);
    const email = value.trim();
    if (!/.+@.+\..+/.test(email)) {
      setInvalid(true);
      setError(MSG.invalidEmail);
      return;
    }
    setBusy("save");
    try {
      const res = await updateContactEmail(email);
      if (res.ok) {
        setEditing(false);
        setValue("");
        setNotice(MSG.sent);
        router.refresh();
        return;
      }
      if (res.code === "NOT_SIGNED_IN") {
        router.replace("/client/login");
        return;
      }
      setInvalid(res.code === "INVALID_EMAIL");
      setError(res.error);
    } catch {
      setError(MSG.failed);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <div className="text-overline uppercase text-text-muted">E-mail</div>

      {banner && (
        <p
          role={banner.tone === "danger" ? "alert" : "status"}
          className={
            banner.tone === "success"
              ? "flex items-center gap-2 rounded-md border border-success bg-success-bg px-3 py-2.5 text-caption text-success-strong"
              : "rounded-md border border-danger bg-danger-bg px-3 py-2.5 text-caption text-danger"
          }
        >
          {banner.tone === "success" && <CheckCircle2 size={16} className="shrink-0" aria-hidden="true" />}
          {banner.text}
        </p>
      )}

      {state.email ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 break-all text-body font-semibold text-text">{state.email}</span>
          <Badge variant={state.verified ? "success" : "warning"}>
            {state.verified ? "Confirmado" : "Falta confirmar"}
          </Badge>
        </div>
      ) : (
        !editing && <p className="text-body text-text-2">{MSG.noEmail}</p>
      )}

      {state.email && !state.verified && !editing && (
        <p className="flex items-start gap-2 text-caption text-text-2">
          <MailWarning size={16} className="mt-0.5 shrink-0 text-warning-strong" aria-hidden="true" />
          {MSG.pending}
        </p>
      )}

      {notice && (
        <p role="status" className="text-caption text-success-strong">
          {notice}
        </p>
      )}

      {editing ? (
        <form onSubmit={onSave} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contato-email">{state.email ? "Novo e-mail" : "E-mail"}</Label>
            <Input
              id="contato-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="voce@email.com"
              error={invalid}
              aria-invalid={invalid || undefined}
              autoFocus
            />
            {state.verified && <p className="text-caption text-text-muted">{COPY.changeVerifiedHint}</p>}
          </div>
          {error && (
            <p role="alert" className="text-caption text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={busy === "save"}>
              Salvar e enviar link
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setValue("");
                setError(null);
                setInvalid(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <>
          {error && (
            <p role="alert" className="text-caption text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {state.email && !state.verified && (
              <Button type="button" loading={busy === "resend"} onClick={onResend}>
                Reenviar confirmação
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditing(true);
                setError(null);
                setNotice(null);
              }}
            >
              {state.email ? "Trocar e-mail" : "Cadastrar e-mail"}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

import "server-only";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/utils";
import { SUPPORT_WHATSAPP_DISPLAY } from "@/lib/contact";
import { sendEmail } from "./resend";
import { sendWhatsApp } from "./whatsapp";

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

const BRAND = "Barbearia Oliveira 01";

function emailShell(title: string, bodyHtml: string) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f4f1ec;padding:24px 0;">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6e0d6;">
      <tr><td style="background:#171412;padding:20px 28px;">
        <span style="color:#c8a24b;font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">${BRAND}</span>
      </td></tr>
      <tr><td style="padding:28px;">
        <h1 style="margin:0 0 12px;color:#171412;font-size:20px;">${title}</h1>
        ${bodyHtml}
      </td></tr>
      <tr><td style="padding:18px 28px;border-top:1px solid #eee7db;color:#8a8578;font-size:12px;line-height:1.7;">
        💈 Seg–Sáb 9h–20h · 2 primeiros domingos do mês 8h–12h<br/>
        📲 WhatsApp ${SUPPORT_WHATSAPP_DISPLAY}
      </td></tr>
    </table>
  </div>`;
}

/** Avisa o cliente (WhatsApp) que o atendimento foi iniciado. */
export async function notifyServiceStarted(appointmentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: appt } = await supabase
    .from("appointments")
    .select("start_at, tenant_id, clients(name, phone), services(name), combo_plans(name), barbers(name)")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt) return;
  const client = one(appt.clients as { name: string; phone: string | null }[] | { name: string; phone: string | null });
  const phone = client?.phone ?? null;
  if (!phone) return;
  const nome = (client?.name ?? "").split(" ")[0];
  const servico =
    one(appt.services as { name: string }[] | { name: string })?.name ??
    one(appt.combo_plans as { name: string }[] | { name: string })?.name ??
    "seu atendimento";
  const barber = one(appt.barbers as { name: string }[] | { name: string })?.name;
  const quando = format(new Date(appt.start_at as string), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });

  const msg =
    `✂️ *${BRAND}*\n` +
    `Olá${nome ? `, ${nome}` : ""}! *Seu atendimento foi iniciado.* 💈\n\n` +
    `📋 Serviço: *${servico}*\n` +
    `📅 ${quando}${barber ? ` · com ${barber}` : ""}\n\n` +
    `Quer aproveitar e adicionar mais algum serviço? É só avisar o seu barbeiro. 😉`;
  const w = await sendWhatsApp(phone, msg);
  await supabase.from("notification_log").insert({
    tenant_id: appt.tenant_id,
    channel: "whatsapp",
    template: "service_started",
    recipient: phone,
    status: w.ok ? "SENT" : w.skipped ? "SKIPPED" : "FAILED",
  });
}

/** Agradece o cliente (WhatsApp) ao fim do atendimento, lista os serviços e pede opinião. */
export async function notifyServiceFinished(appointmentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: appt } = await supabase
    .from("appointments")
    .select("tenant_id, clients(name, phone), appointment_items(name, qty, price_brl, covered_by_plan)")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt) return;
  const client = one(appt.clients as { name: string; phone: string | null }[] | { name: string; phone: string | null });
  const phone = client?.phone ?? null;
  if (!phone) return;
  const nome = (client?.name ?? "").split(" ")[0];
  const items = (appt.appointment_items as { name: string; qty: number; price_brl: number; covered_by_plan: boolean }[] | null) ?? [];
  const lista = items.map((i) => `• ${i.qty > 1 ? `${i.qty}x ` : ""}${i.name}`).join("\n");
  const total = items.reduce((s, i) => (i.covered_by_plan ? s : s + Number(i.price_brl) * i.qty), 0);

  const msg =
    `✂️ *${BRAND}*\n` +
    `${nome ? `${nome}, ` : ""}*muito obrigado pela preferência!* 🙏\n\n` +
    (lista ? `Serviços realizados:\n${lista}\n${total > 0 ? `Total: *${formatBRL(total)}*\n` : ""}\n` : "") +
    `O que você achou do atendimento? Sua opinião ajuda muito a gente a melhorar!\n\n` +
    `Volte sempre! ✂️🔥`;
  const w = await sendWhatsApp(phone, msg);
  await supabase.from("notification_log").insert({
    tenant_id: appt.tenant_id,
    channel: "whatsapp",
    template: "service_finished",
    recipient: phone,
    status: w.ok ? "SENT" : w.skipped ? "SKIPPED" : "FAILED",
  });
}

/** E-mail de boas-vindas ao novo cliente (após o cadastro). */
export async function notifyWelcome(email: string, name: string, tenantName: string) {
  if (!email) return;
  const nome = (name ?? "").split(" ")[0];
  const html = emailShell(
    `Bem-vindo${nome ? `, ${nome}` : ""}! ✂️`,
    `<p style="color:#4a453d;font-size:15px;line-height:1.6;">
       Que bom ter você na <strong>${tenantName}</strong>! Sua conta já está pronta.
     </p>
     <p style="color:#4a453d;font-size:15px;line-height:1.6;">
       Agende seu próximo corte, acompanhe seus pedidos e aproveite os planos. O pagamento é feito no
       local após o atendimento.
     </p>`
  );
  await sendEmail({ to: email, subject: `Bem-vindo à ${tenantName}`, html });
}

/** Avisa o cliente (e-mail) que o agendamento foi confirmado. Registra em notification_log. */
export async function notifyAppointmentConfirmed(appointmentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, start_at, tenant_id, clients(name, email, phone), services(name), combo_plans(name), barbers(name), appointment_items(price_brl, qty, covered_by_plan)")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt) return;

  const items = (appt.appointment_items as { price_brl: number; qty: number; covered_by_plan: boolean }[] | null) ?? [];
  const total = items.reduce((s, i) => (i.covered_by_plan ? s : s + Number(i.price_brl) * i.qty), 0);
  const valorTxt = items.length === 0 ? "" : total > 0 ? `${formatBRL(total)} (no local)` : "incluído no plano";

  const client = one(
    appt.clients as
      | { name: string; email: string | null; phone: string | null }[]
      | { name: string; email: string | null; phone: string | null }
  );
  const email = client?.email ?? null;
  const phone = client?.phone ?? null;

  const nome = (client?.name ?? "").split(" ")[0];
  const servico =
    one(appt.services as { name: string }[] | { name: string })?.name ??
    one(appt.combo_plans as { name: string }[] | { name: string })?.name ??
    "seu atendimento";
  const barber = one(appt.barbers as { name: string }[] | { name: string })?.name;
  const quando = format(new Date(appt.start_at as string), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });

  // E-mail (Resend)
  if (email) {
    const html = emailShell(
      "Agendamento confirmado ✂️",
      `<p style="color:#4a453d;font-size:15px;line-height:1.6;">
         Olá${nome ? `, ${nome}` : ""}! Seu horário está <strong>confirmado</strong>.
       </p>
       <p style="color:#4a453d;font-size:15px;line-height:1.6;">
         <strong>${servico}</strong>${valorTxt ? ` — ${valorTxt}` : ""}<br/>${quando}${barber ? ` · com ${barber}` : ""}
       </p>
       <p style="color:#8a8578;font-size:13px;line-height:1.6;">
         O pagamento é feito no local após o atendimento. Precisa remarcar? Cancele pelo app com ao menos
         10 minutos de antecedência ou avise no WhatsApp.
       </p>`
    );
    const r = await sendEmail({ to: email, subject: `Agendamento confirmado — ${BRAND}`, html });
    await supabase.from("notification_log").insert({
      tenant_id: appt.tenant_id,
      channel: "email",
      template: "appointment_confirmed",
      recipient: email,
      status: r.ok ? "SENT" : r.skipped ? "SKIPPED" : "FAILED",
    });
  }

  // WhatsApp automático (Z-API)
  if (phone) {
    const waMsg =
      `✂️ *${BRAND}*\n` +
      `Olá${nome ? `, ${nome}` : ""}! *Seu agendamento foi confirmado.*\n\n` +
      `📋 Serviço: *${servico}*\n` +
      (valorTxt ? `💰 Valor: *${valorTxt}*\n` : "") +
      `📅 ${quando}${barber ? ` · com ${barber}` : ""}\n\n` +
      `Pagamento feito no local após o atendimento. Precisa remarcar? Cancele pelo app com ao menos 10 minutos de antecedência.`;
    const w = await sendWhatsApp(phone, waMsg);
    await supabase.from("notification_log").insert({
      tenant_id: appt.tenant_id,
      channel: "whatsapp",
      template: "appointment_confirmed",
      recipient: phone,
      status: w.ok ? "SENT" : w.skipped ? "SKIPPED" : "FAILED",
    });
  }
}

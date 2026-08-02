import "server-only";
import { cache } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/utils";
import { paymentLabel } from "@/lib/payment";
import { sendEmail } from "./resend";
import { sendWhatsApp } from "./whatsapp";

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

type Brand = { name: string; phone: string | null };

/**
 * Marca da barbearia que DISPARA a mensagem (nome + telefone próprios) — via service-role.
 * Garante que cada barbearia comunica com a PRÓPRIA identidade (nunca a de outra).
 */
const brandFor = cache(async (tenantId: string | null | undefined): Promise<Brand> => {
  if (!tenantId) return { name: "Barbearia", phone: null };
  try {
    const admin = createSupabaseAdminClient();
    const [{ data: t }, { data: s }] = await Promise.all([
      admin.from("tenants").select("name").eq("id", tenantId).maybeSingle(),
      admin.from("tenant_settings").select("phone").eq("tenant_id", tenantId).maybeSingle(),
    ]);
    return { name: (t?.name as string) ?? "Barbearia", phone: (s?.phone as string) ?? null };
  } catch {
    return { name: "Barbearia", phone: null };
  }
});

/** Linha de contato para rodapés — usa o telefone da própria barbearia (ou some se não houver). */
function contatoLinha(brand: Brand) {
  return brand.phone ? ` Fale com a gente no WhatsApp ${brand.phone}.` : "";
}

/** Bloco "Descritivo" do plano para as mensagens de WhatsApp (formato do cliente). */
function planDescritivo(
  combo: { name: string; cuts: number; scope: string | null; price_brl: number },
  saldo: number,
  billingDay: number
) {
  const parts = (combo.scope ?? "")
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean);
  const linhas = parts.map((p, i) => (i === 0 ? `- ${p}` : `* ${p}`)).join("\n");
  return (
    `📋 *${combo.name}*\n` +
    (linhas ? `${linhas}\n` : "") +
    `💰 Mensalidade: *${formatBRL(combo.price_brl)}/mês* (a partir do 2º mês)\n` +
    `✂️ Saldo: *${saldo} cortes* gratuitos neste mês\n` +
    `📅 Renova todo dia ${billingDay}`
  );
}

function emailShell(title: string, bodyHtml: string, brand: Brand) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f4f1ec;padding:24px 0;">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6e0d6;">
      <tr><td style="background:#171412;padding:20px 28px;">
        <span style="color:#c8a24b;font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">${brand.name}</span>
      </td></tr>
      <tr><td style="padding:28px;">
        <h1 style="margin:0 0 12px;color:#171412;font-size:20px;">${title}</h1>
        ${bodyHtml}
      </td></tr>
      ${
        brand.phone
          ? `<tr><td style="padding:18px 28px;border-top:1px solid #eee7db;color:#8a8578;font-size:12px;line-height:1.7;">📲 WhatsApp ${brand.phone}</td></tr>`
          : ""
      }
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
  const brand = await brandFor(appt.tenant_id);
  const nome = (client?.name ?? "").split(" ")[0];
  const servico =
    one(appt.services as { name: string }[] | { name: string })?.name ??
    one(appt.combo_plans as { name: string }[] | { name: string })?.name ??
    "seu atendimento";
  const barber = one(appt.barbers as { name: string }[] | { name: string })?.name;
  const quando = format(new Date(appt.start_at as string), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });

  const msg =
    `✂️ *${brand.name}*\n` +
    `Olá${nome ? `, ${nome}` : ""}! *Seu atendimento foi iniciado.* 💈\n\n` +
    `📋 Serviço: *${servico}*\n` +
    `📅 ${quando}${barber ? ` · com ${barber}` : ""}\n\n` +
    `Quer aproveitar e adicionar mais algum serviço? É só avisar. 😉`;
  const w = await sendWhatsApp(phone, msg, appt.tenant_id);
  await supabase.from("notification_log").insert({
    tenant_id: appt.tenant_id,
    channel: "whatsapp",
    template: "service_started",
    recipient: phone,
    status: w.ok ? "SENT" : w.skipped ? "SKIPPED" : "FAILED",
  });
}

/** Avisa o cliente (WhatsApp) que um item foi adicionado ao seu pedido. */
export async function notifyServiceAdded(
  appointmentId: string,
  item: { kind: "service" | "product"; name: string; qty: number; priceBRL: number }
) {
  const supabase = await createSupabaseServerClient();
  const { data: appt } = await supabase
    .from("appointments")
    .select("start_at, tenant_id, clients(name, phone), barbers(name)")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt) return;
  const client = one(appt.clients as { name: string; phone: string | null }[] | { name: string; phone: string | null });
  const phone = client?.phone ?? null;
  if (!phone) return;
  const brand = await brandFor(appt.tenant_id);
  const nome = (client?.name ?? "").split(" ")[0];
  const barber = one(appt.barbers as { name: string }[] | { name: string })?.name;
  const quando = format(new Date(appt.start_at as string), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
  const titulo = item.kind === "product" ? "PRODUTO ADICIONADO" : "SERVIÇO ADICIONADO";
  const valor = item.priceBRL > 0 ? ` — *${formatBRL(item.priceBRL * item.qty)}* (no local)` : "";

  const msg =
    `✂️ *${brand.name}*\n` +
    `*${titulo}*\n\n` +
    `${nome ? `${nome}, ` : ""}adicionamos ao seu atendimento:\n` +
    `➕ *${item.qty > 1 ? `${item.qty}x ` : ""}${item.name}*${valor}\n\n` +
    `📅 ${quando}${barber ? ` · com ${barber}` : ""}\n` +
    `O pagamento é feito no local após o atendimento.`;
  const w = await sendWhatsApp(phone, msg, appt.tenant_id);
  await supabase.from("notification_log").insert({
    tenant_id: appt.tenant_id,
    channel: "whatsapp",
    template: "service_added",
    recipient: phone,
    status: w.ok ? "SENT" : w.skipped ? "SKIPPED" : "FAILED",
  });
}

/** Agradece o cliente (WhatsApp) ao fim do atendimento, lista os serviços e pede opinião. */
export async function notifyServiceFinished(appointmentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: appt } = await supabase
    .from("appointments")
    .select("tenant_id, clients(name, phone), appointment_items(name, qty, price_brl, covered_by_plan, added_later)")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt) return;
  const client = one(appt.clients as { name: string; phone: string | null }[] | { name: string; phone: string | null });
  const phone = client?.phone ?? null;
  if (!phone) return;
  const brand = await brandFor(appt.tenant_id);
  const nome = (client?.name ?? "").split(" ")[0];
  const items =
    (appt.appointment_items as
      | { name: string; qty: number; price_brl: number; covered_by_plan: boolean; added_later: boolean }[]
      | null) ?? [];
  const fmtList = (arr: typeof items) => arr.map((i) => `• ${i.qty > 1 ? `${i.qty}x ` : ""}${i.name}`).join("\n");
  const originais = items.filter((i) => !i.added_later);
  const adicionais = items.filter((i) => i.added_later);
  const total = items.reduce((s, i) => (i.covered_by_plan ? s : s + Number(i.price_brl) * i.qty), 0);

  const msg =
    `✂️ *${brand.name}*\n` +
    `${nome ? `${nome}, ` : ""}*muito obrigado pela preferência!* 🙏\n\n` +
    (originais.length ? `📋 Serviços:\n${fmtList(originais)}\n` : "") +
    (adicionais.length ? `\n➕ Adicionais:\n${fmtList(adicionais)}\n` : "") +
    (total > 0 ? `\n💰 Total pago: *${formatBRL(total)}*\n` : "") +
    `\nO que você achou do atendimento? Sua opinião ajuda muito a gente a melhorar!\n\n` +
    `Volte sempre! ✂️🔥`;
  const w = await sendWhatsApp(phone, msg, appt.tenant_id);
  await supabase.from("notification_log").insert({
    tenant_id: appt.tenant_id,
    channel: "whatsapp",
    template: "service_finished",
    recipient: phone,
    status: w.ok ? "SENT" : w.skipped ? "SKIPPED" : "FAILED",
  });
}

/** Avisa o cliente (WhatsApp) que a solicitação de assinatura foi recebida. */
export async function notifyPlanRequested(clientId: string, comboPlanId: string) {
  const supabase = await createSupabaseServerClient();
  const [{ data: client }, { data: combo }] = await Promise.all([
    supabase.from("clients").select("name, phone, tenant_id").eq("id", clientId).maybeSingle(),
    supabase.from("combo_plans").select("name, cuts, scope, price_brl").eq("id", comboPlanId).maybeSingle(),
  ]);
  const phone = client?.phone ?? null;
  if (!phone || !combo) return;
  const brand = await brandFor(client?.tenant_id);
  const nome = (client?.name ?? "").split(" ")[0];

  const msg =
    `✂️ *${brand.name}*\n` +
    `*SOLICITAÇÃO DE ASSINATURA*\n\n` +
    `${nome ? `${nome}, ` : ""}recebemos o seu pedido de contratação do *${combo.name}*.\n` +
    `Em breve você receberá a notificação com a confirmação. 💈\n\n` +
    `*Descritivo:*\n` +
    planDescritivo(
      combo as { name: string; cuts: number; scope: string | null; price_brl: number },
      combo.cuts as number,
      5
    );
  const w = await sendWhatsApp(phone, msg, client?.tenant_id ?? null);
  await supabase.from("notification_log").insert({
    tenant_id: client?.tenant_id ?? null,
    channel: "whatsapp",
    template: "plan_requested",
    recipient: phone,
    status: w.ok ? "SENT" : w.skipped ? "SKIPPED" : "FAILED",
  });
}

/** Confirma ao cliente (WhatsApp) que o plano foi ativado, com os detalhes. */
export async function notifyPlanSubscribed(clientId: string, comboPlanId: string) {
  const supabase = await createSupabaseServerClient();
  const [{ data: client }, { data: combo }, { data: sub }] = await Promise.all([
    supabase.from("clients").select("name, phone, tenant_id").eq("id", clientId).maybeSingle(),
    supabase.from("combo_plans").select("name, cuts, scope, price_brl").eq("id", comboPlanId).maybeSingle(),
    supabase
      .from("client_subscriptions")
      .select("saldo_cortes, billing_day")
      .eq("client_id", clientId)
      .eq("status", "ACTIVE")
      .maybeSingle(),
  ]);
  const phone = client?.phone ?? null;
  if (!phone || !combo) return;
  const brand = await brandFor(client?.tenant_id);
  const nome = (client?.name ?? "").split(" ")[0];

  const msg =
    `✂️ *${brand.name}*\n` +
    `*CONFIRMAÇÃO DE ASSINATURA*\n\n` +
    `${nome ? `${nome}, ` : ""}sua assinatura está *ativa!* 🎉\n\n` +
    planDescritivo(
      combo as { name: string; cuts: number; scope: string | null; price_brl: number },
      (sub?.saldo_cortes as number) ?? (combo.cuts as number),
      (sub?.billing_day as number) ?? 5
    ) +
    `\n\nÉ só agendar pelo app. Aproveite! 💈`;
  const w = await sendWhatsApp(phone, msg, client?.tenant_id ?? null);
  await supabase.from("notification_log").insert({
    tenant_id: client?.tenant_id ?? null,
    channel: "whatsapp",
    template: "plan_subscribed",
    recipient: phone,
    status: w.ok ? "SENT" : w.skipped ? "SKIPPED" : "FAILED",
  });
}

/** Avisa o cliente (WhatsApp) que um pedido de plano foi recusado pela barbearia. */
export async function notifyPlanRejected(clientId: string, comboPlanId: string | null, type: string) {
  const supabase = await createSupabaseServerClient();
  const [{ data: client }, { data: combo }] = await Promise.all([
    supabase.from("clients").select("name, phone, tenant_id").eq("id", clientId).maybeSingle(),
    comboPlanId
      ? supabase.from("combo_plans").select("name").eq("id", comboPlanId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const phone = client?.phone ?? null;
  if (!phone) return;
  const brand = await brandFor(client?.tenant_id);
  const nome = (client?.name ?? "").split(" ")[0];
  const plano = one(combo as { name: string }[] | { name: string } | null)?.name ?? "plano";

  const corpo =
    type === "CANCEL"
      ? `seu pedido de *cancelamento* não foi aprovado — sua assinatura continua ativa.`
      : type === "CHANGE"
        ? `seu pedido de *troca* para o *${plano}* não foi aprovado no momento.`
        : `seu pedido de *assinatura* do *${plano}* não foi aprovado no momento.`;

  const msg =
    `✂️ *${brand.name}*\n` +
    `*SOLICITAÇÃO NÃO APROVADA*\n\n` +
    `${nome ? `${nome}, ` : ""}${corpo}\n\n` +
    `Ficou com dúvida?${contatoLinha(brand)} 💈`;
  const w = await sendWhatsApp(phone, msg, client?.tenant_id ?? null);
  await supabase.from("notification_log").insert({
    tenant_id: client?.tenant_id ?? null,
    channel: "whatsapp",
    template: "plan_rejected",
    recipient: phone,
    status: w.ok ? "SENT" : w.skipped ? "SKIPPED" : "FAILED",
  });
}

/** Avisa o cliente (WhatsApp) que a assinatura foi cancelada. */
export async function notifyPlanCancelled(clientId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: client } = await supabase
    .from("clients")
    .select("name, phone, tenant_id")
    .eq("id", clientId)
    .maybeSingle();
  const phone = client?.phone ?? null;
  if (!phone) return;
  const brand = await brandFor(client?.tenant_id);
  const { data: sub } = await supabase
    .from("client_subscriptions")
    .select("combo_plans(name)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const plano = one(sub?.combo_plans as { name: string }[] | { name: string })?.name ?? "seu plano";
  const nome = (client?.name ?? "").split(" ")[0];

  const msg =
    `✂️ *${brand.name}*\n` +
    `*ASSINATURA CANCELADA*\n\n` +
    `${nome ? `${nome}, ` : ""}sua assinatura do *${plano}* foi cancelada.\n\n` +
    `Sentiremos sua falta! Quando quiser voltar, é só assinar de novo pelo app.${contatoLinha(brand)} 💈`;
  const w = await sendWhatsApp(phone, msg, client?.tenant_id ?? null);
  await supabase.from("notification_log").insert({
    tenant_id: client?.tenant_id ?? null,
    channel: "whatsapp",
    template: "plan_cancelled",
    recipient: phone,
    status: w.ok ? "SENT" : w.skipped ? "SKIPPED" : "FAILED",
  });
}

/** Avisa o cliente (WhatsApp) que um agendamento foi cancelado. */
export async function notifyAppointmentCancelled(appointmentId: string) {
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
  const brand = await brandFor(appt.tenant_id);
  const nome = (client?.name ?? "").split(" ")[0];
  const servico =
    one(appt.services as { name: string }[] | { name: string })?.name ??
    one(appt.combo_plans as { name: string }[] | { name: string })?.name ??
    "seu atendimento";
  const barber = one(appt.barbers as { name: string }[] | { name: string })?.name;
  const quando = format(new Date(appt.start_at as string), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });

  const msg =
    `✂️ *${brand.name}*\n` +
    `*AGENDAMENTO CANCELADO*\n\n` +
    `${nome ? `${nome}, ` : ""}seu agendamento foi cancelado.\n\n` +
    `📋 Serviço: *${servico}*\n` +
    `📅 ${quando}${barber ? ` · com ${barber}` : ""}\n\n` +
    `Quer marcar um novo horário? É só agendar pelo app. 💈`;
  const w = await sendWhatsApp(phone, msg, appt.tenant_id);
  await supabase.from("notification_log").insert({
    tenant_id: appt.tenant_id,
    channel: "whatsapp",
    template: "appointment_cancelled",
    recipient: phone,
    status: w.ok ? "SENT" : w.skipped ? "SKIPPED" : "FAILED",
  });
}

/** Avisa o cliente (WhatsApp) que uma reserva de produto foi cancelada. */
export async function notifyReservationCancelled(reservationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: res } = await supabase
    .from("product_reservations")
    .select("qty, tenant_id, clients(name, phone), products(name)")
    .eq("id", reservationId)
    .maybeSingle();
  if (!res) return;
  const client = one(res.clients as { name: string; phone: string | null }[] | { name: string; phone: string | null });
  const phone = client?.phone ?? null;
  if (!phone) return;
  const brand = await brandFor(res.tenant_id);
  const nome = (client?.name ?? "").split(" ")[0];
  const produto = one(res.products as { name: string }[] | { name: string })?.name ?? "produto";

  const msg =
    `✂️ *${brand.name}*\n` +
    `*RESERVA CANCELADA*\n\n` +
    `${nome ? `${nome}, ` : ""}sua reserva de *${res.qty}x ${produto}* foi cancelada.\n\n` +
    `Qualquer dúvida é só chamar.${contatoLinha(brand)} 💈`;
  const w = await sendWhatsApp(phone, msg, res.tenant_id);
  await supabase.from("notification_log").insert({
    tenant_id: res.tenant_id,
    channel: "whatsapp",
    template: "reservation_cancelled",
    recipient: phone,
    status: w.ok ? "SENT" : w.skipped ? "SKIPPED" : "FAILED",
  });
}

/** Convite para o cliente completar o cadastro (WhatsApp + e-mail com o link do portal). */
export async function notifyInvite(input: {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  tenantName: string;
  tenantId?: string | null;
  link: string;
}) {
  const supabase = await createSupabaseServerClient();
  const nome = (input.name ?? "").split(" ")[0];
  const brand: Brand = { name: input.tenantName, phone: (await brandFor(input.tenantId)).phone };

  if (input.phone) {
    const msg =
      `✂️ *${input.tenantName}*\n` +
      `*BEM-VINDO!*\n\n` +
      `${nome ? `${nome}, ` : ""}a ${input.tenantName} criou o seu acesso. 💈\n` +
      `Falta pouco: é só criar sua senha (seu nome e telefone já estão preenchidos).\n\n` +
      `👉 ${input.link}\n\n` +
      `O link vale por 48 horas.`;
    const w = await sendWhatsApp(input.phone, msg, input.tenantId ?? null);
    await supabase.from("notification_log").insert({
      tenant_id: input.tenantId ?? null,
      channel: "whatsapp",
      template: "invite",
      recipient: input.phone,
      status: w.ok ? "SENT" : w.skipped ? "SKIPPED" : "FAILED",
    });
  }

  if (input.email) {
    const html = emailShell(
      `Bem-vindo${nome ? `, ${nome}` : ""}! ✂️`,
      `<p style="color:#4a453d;font-size:15px;line-height:1.6;">
         A <strong>${input.tenantName}</strong> criou o seu acesso. Falta pouco: crie sua senha para
         agendar seus cortes (seu nome e telefone já estão preenchidos).
       </p>
       <p style="margin:18px 0;">
         <a href="${input.link}" style="background:#c8a24b;color:#171412;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px;display:inline-block;">Criar meu acesso</a>
       </p>
       <p style="color:#8a8578;font-size:13px;line-height:1.6;">O link vale por 48 horas. Se o botão não abrir: ${input.link}</p>`,
      brand
    );
    const r = await sendEmail({ to: input.email, subject: `Seu acesso na ${input.tenantName}`, html, fromName: input.tenantName });
    await supabase.from("notification_log").insert({
      tenant_id: input.tenantId ?? null,
      channel: "email",
      template: "invite",
      recipient: input.email,
      status: r.ok ? "SENT" : r.skipped ? "SKIPPED" : "FAILED",
    });
  }
}

/** E-mail (e WhatsApp) de boas-vindas ao novo cliente (após o cadastro). */
export async function notifyWelcome(
  email: string,
  name: string,
  tenantName: string,
  opts?: { phone?: string | null; link?: string | null; tenantId?: string | null }
) {
  const nome = (name ?? "").split(" ")[0];
  const brand: Brand = { name: tenantName, phone: (await brandFor(opts?.tenantId)).phone };

  if (email) {
    const html = emailShell(
      `Bem-vindo${nome ? `, ${nome}` : ""}! ✂️`,
      `<p style="color:#4a453d;font-size:15px;line-height:1.6;">
         Que bom ter você na <strong>${tenantName}</strong>! Sua conta já está pronta.
       </p>
       <p style="color:#4a453d;font-size:15px;line-height:1.6;">
         Agende seu próximo corte, acompanhe seus pedidos e aproveite os planos. O pagamento é feito no
         local após o atendimento.
       </p>
       ${opts?.link ? `<p style="margin:16px 0;"><a href="${opts.link}" style="background:#c8a24b;color:#171412;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px;display:inline-block;">Abrir o app</a></p>` : ""}`,
      brand
    );
    await sendEmail({ to: email, subject: `Bem-vindo à ${tenantName}`, html, fromName: tenantName });
  }

  if (opts?.phone) {
    const msg =
      `✂️ *${tenantName}*\n` +
      `*BEM-VINDO!* 🎉\n\n` +
      `${nome ? `${nome}, ` : ""}sua conta está pronta. Agende seu próximo corte, acompanhe seus pedidos e aproveite os planos.\n` +
      (opts.link ? `\n👉 ${opts.link}\n` : "") +
      `\nO pagamento é feito no local após o atendimento. 💈`;
    await sendWhatsApp(opts.phone, msg, opts?.tenantId ?? null);
  }
}

/** Avisa o cliente (WhatsApp) que o pedido de agendamento foi recebido e aguarda confirmação. */
export async function notifyAppointmentRequested(appointmentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: appt } = await supabase
    .from("appointments")
    .select("start_at, tenant_id, payment_method, clients(name, phone), services(name), combo_plans(name), barbers(name), children(name), appointment_items(price_brl, qty, covered_by_plan)")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt) return;
  const client = one(appt.clients as { name: string; phone: string | null }[] | { name: string; phone: string | null });
  const phone = client?.phone ?? null;
  if (!phone) return;
  const brand = await brandFor(appt.tenant_id);
  const nome = (client?.name ?? "").split(" ")[0];
  const servico =
    one(appt.services as { name: string }[] | { name: string })?.name ??
    one(appt.combo_plans as { name: string }[] | { name: string })?.name ??
    "seu atendimento";
  const barber = one(appt.barbers as { name: string }[] | { name: string })?.name;
  const child = one(appt.children as { name: string }[] | { name: string })?.name;
  const quando = format(new Date(appt.start_at as string), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
  const items = (appt.appointment_items as { price_brl: number; qty: number; covered_by_plan: boolean }[] | null) ?? [];
  const total = items.reduce((s, i) => (i.covered_by_plan ? s : s + Number(i.price_brl) * i.qty), 0);
  const valorTxt = items.length === 0 ? "" : total > 0 ? `${formatBRL(total)} (no local)` : "incluído no plano";
  const pagamento = appt.payment_method ? paymentLabel(appt.payment_method as string) : null;

  const msg =
    `✂️ *${brand.name}*\n` +
    `*SOLICITAÇÃO DE AGENDAMENTO*\n\n` +
    `${nome ? `${nome}, ` : ""}recebemos o seu pedido de agendamento! 📋\n` +
    `Ele está *aguardando a confirmação* da barbearia — em breve avisamos por aqui.\n\n` +
    `📋 Serviço: *${servico}*\n` +
    (child ? `👦 Criança: *${child}*\n` : "") +
    (valorTxt ? `💰 Valor: *${valorTxt}*\n` : "") +
    (pagamento ? `💳 Pagamento: *${pagamento}*\n` : "") +
    `📅 ${quando}${barber ? ` · com ${barber}` : ""}`;
  const w = await sendWhatsApp(phone, msg, appt.tenant_id);
  await supabase.from("notification_log").insert({
    tenant_id: appt.tenant_id,
    channel: "whatsapp",
    template: "appointment_requested",
    recipient: phone,
    status: w.ok ? "SENT" : w.skipped ? "SKIPPED" : "FAILED",
  });
}

/** Avisa o cliente (e-mail) que o agendamento foi confirmado. Registra em notification_log. */
export async function notifyAppointmentConfirmed(appointmentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, start_at, tenant_id, payment_method, clients(name, email, phone), services(name), combo_plans(name), barbers(name), children(name), appointment_items(price_brl, qty, covered_by_plan)")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt) return;
  const brand = await brandFor(appt.tenant_id);

  const items = (appt.appointment_items as { price_brl: number; qty: number; covered_by_plan: boolean }[] | null) ?? [];
  const total = items.reduce((s, i) => (i.covered_by_plan ? s : s + Number(i.price_brl) * i.qty), 0);
  const valorTxt = items.length === 0 ? "" : total > 0 ? `${formatBRL(total)} (no local)` : "incluído no plano";
  const pagamento = appt.payment_method ? paymentLabel(appt.payment_method as string) : null;

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
  const child = one(appt.children as { name: string }[] | { name: string })?.name;
  const quando = format(new Date(appt.start_at as string), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });

  // E-mail (Resend)
  if (email) {
    const html = emailShell(
      "Agendamento confirmado ✂️",
      `<p style="color:#4a453d;font-size:15px;line-height:1.6;">
         Olá${nome ? `, ${nome}` : ""}! Seu horário está <strong>confirmado</strong>.
       </p>
       <p style="color:#4a453d;font-size:15px;line-height:1.6;">
         <strong>${servico}</strong>${valorTxt ? ` — ${valorTxt}` : ""}${child ? `<br/>Criança: ${child}` : ""}<br/>${quando}${barber ? ` · com ${barber}` : ""}${pagamento ? `<br/>Pagamento: ${pagamento}` : ""}
       </p>
       <p style="color:#8a8578;font-size:13px;line-height:1.6;">
         O pagamento é feito no local após o atendimento. Precisa remarcar? Cancele pelo app com ao menos
         10 minutos de antecedência ou avise no WhatsApp.
       </p>`,
      brand
    );
    const r = await sendEmail({ to: email, subject: `Agendamento confirmado — ${brand.name}`, html, fromName: brand.name });
    await supabase.from("notification_log").insert({
      tenant_id: appt.tenant_id,
      channel: "email",
      template: "appointment_confirmed",
      recipient: email,
      status: r.ok ? "SENT" : r.skipped ? "SKIPPED" : "FAILED",
    });
  }

  // WhatsApp automático
  if (phone) {
    const waMsg =
      `✂️ *${brand.name}*\n` +
      `Olá${nome ? `, ${nome}` : ""}! *Seu agendamento foi confirmado.*\n\n` +
      `📋 Serviço: *${servico}*\n` +
      (child ? `👦 Criança: *${child}*\n` : "") +
      (valorTxt ? `💰 Valor: *${valorTxt}*\n` : "") +
      (pagamento ? `💳 Pagamento: *${pagamento}*\n` : "") +
      `📅 ${quando}${barber ? ` · com ${barber}` : ""}\n\n` +
      `Pagamento feito no local após o atendimento. Precisa remarcar? Cancele pelo app com ao menos 10 minutos de antecedência.`;
    const w = await sendWhatsApp(phone, waMsg, appt.tenant_id);
    await supabase.from("notification_log").insert({
      tenant_id: appt.tenant_id,
      channel: "whatsapp",
      template: "appointment_confirmed",
      recipient: phone,
      status: w.ok ? "SENT" : w.skipped ? "SKIPPED" : "FAILED",
    });
  }
}

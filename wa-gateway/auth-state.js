import { initAuthCreds, BufferJSON, proto } from "@whiskeysockets/baileys";

/**
 * Auth state do Baileys persistido no Supabase (tabela wa_sessions).
 * Guarda `creds` e o mapa de `keys` como JSON (com BufferJSON p/ os Buffers).
 * Sobrevive a restart/sono do host — não depende de disco.
 */
export async function makeSupabaseAuthState(supabase, tenantId) {
  const { data } = await supabase
    .from("wa_sessions")
    .select("creds, keys")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const revive = (v) => (v ? JSON.parse(JSON.stringify(v), BufferJSON.reviver) : null);
  const creds = revive(data?.creds) || initAuthCreds();
  const keys = revive(data?.keys) || {};

  async function persist() {
    // NUNCA deixa rejeitar: é usado como handler de evento (creds.update) e em keys.set.
    // No Node 22 uma promise rejeitada não tratada DERRUBA o processo — um hiccup de rede
    // com o Supabase durante o churn de sessão viraria queda do gateway inteiro.
    try {
      await supabase.from("wa_sessions").upsert({
        tenant_id: tenantId,
        creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
        keys: JSON.parse(JSON.stringify(keys, BufferJSON.replacer)),
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("[wa] persist falhou", tenantId, e?.message);
    }
  }

  const state = {
    creds,
    keys: {
      get: (type, ids) => {
        const cat = keys[type] || {};
        const out = {};
        for (const id of ids) {
          let val = cat[id];
          if (type === "app-state-sync-key" && val) {
            val = proto.Message.AppStateSyncKeyData.fromObject(val);
          }
          out[id] = val;
        }
        return out;
      },
      set: async (data) => {
        for (const type of Object.keys(data)) {
          keys[type] = keys[type] || {};
          for (const id of Object.keys(data[type])) {
            const val = data[type][id];
            if (val) keys[type][id] = val;
            else delete keys[type][id];
          }
        }
        await persist();
      },
    },
  };

  return { state, saveCreds: persist };
}

# Deploy do wa-gateway na Oracle Cloud (Always Free) — 24/7 sem custo

Objetivo: rodar o gateway do WhatsApp numa VM **Always Free** da Oracle, sempre
ligada, com HTTPS em `https://wa.barberagencia.com`, e apontar o app (Vercel) para ela.

Requisitos: Node 22, portas 80/443 abertas, um subdomínio apontando para a VM.

---

## 1. Criar a conta + a VM (Always Free)

1. Crie conta em https://www.oracle.com/cloud/free/ (pede cartão só para verificação —
   os recursos **Always Free** não são cobrados).
2. Console → **Compute → Instances → Create instance**:
   - **Image**: Ubuntu 22.04 (ou 24.04).
   - **Shape**: `VM.Standard.A1.Flex` (ARM Ampere) — no Always Free dá até 4 OCPU / 24 GB.
     Use **1 OCPU / 6 GB** (sobra). Se der "out of capacity", tente `VM.Standard.E2.1.Micro` (AMD).
   - **SSH keys**: cole sua chave pública (ou baixe a gerada).
   - Crie e anote o **Public IP**.

## 2. Abrir as portas (dois lugares)

**a) No console Oracle** — VCN → Security List da subnet → **Add Ingress Rules**
(Source `0.0.0.0/0`, TCP): portas **80** e **443** (a 22 já vem aberta).

**b) Na VM (iptables da imagem Ubuntu da Oracle bloqueia por padrão)** — via SSH:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## 3. Apontar o subdomínio

No seu provedor de DNS (onde está `barberagencia.com`), crie um registro:
```
A   wa   <IP_PUBLICO_DA_VM>
```
→ `wa.barberagencia.com` passa a apontar para a VM. (Espere propagar alguns minutos.)

## 4. Instalar Node 22 + git (na VM)

```bash
sudo apt-get update
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
node -v   # deve mostrar v22.x
```

## 5. Baixar o código e instalar dependências

O repo é privado — use um **Personal Access Token** do GitHub (Settings → Developer
settings → Tokens) com escopo `repo`:
```bash
cd ~
git clone https://<SEU_TOKEN>@github.com/deviego/barberagencia.git
cd barberagencia/wa-gateway
npm install
```

## 6. Configurar as variáveis de ambiente

Crie `~/barberagencia/wa-gateway/.env` (formato KEY=valor, sem aspas):
```bash
cat > ~/barberagencia/wa-gateway/.env <<'ENV'
WA_SERVICE_TOKEN=<mesmo token que está no Vercel>
SUPABASE_URL=https://tusfxbnnrypjtzqcvpov.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<sua service_role key>
PORT=8080
ENV
chmod 600 ~/barberagencia/wa-gateway/.env
```
> A `service_role` é a mesma do app (Supabase → Project Settings → API → service_role).
> O `WA_SERVICE_TOKEN` **precisa ser idêntico** ao do Vercel.

Teste rápido:
```bash
cd ~/barberagencia/wa-gateway
node --env-file=.env index.js &
sleep 3 && curl -s localhost:8080/health && echo && kill %1
```
Deve responder `{"ok":true,...}`.

## 7. Rodar como serviço (liga no boot, reinicia sozinho)

```bash
sudo tee /etc/systemd/system/wa-gateway.service >/dev/null <<'UNIT'
[Unit]
Description=WhatsApp Gateway (Baileys)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/barberagencia/wa-gateway
EnvironmentFile=/home/ubuntu/barberagencia/wa-gateway/.env
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now wa-gateway
sudo systemctl status wa-gateway --no-pager
curl -s localhost:8080/health && echo
```

## 8. HTTPS automático com Caddy (Let's Encrypt)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

sudo tee /etc/caddy/Caddyfile >/dev/null <<'CADDY'
wa.barberagencia.com {
    reverse_proxy localhost:8080
}
CADDY

sudo systemctl restart caddy
```
Caddy pega o certificado sozinho (precisa das portas 80/443 abertas e do DNS já apontando).
Teste: `curl -s https://wa.barberagencia.com/health` → `{"ok":true,...}`.

## 9. Apontar o app (Vercel) para o novo gateway

No Vercel → Projeto → **Settings → Environment Variables** (Production):
- `WA_SERVICE_URL` = `https://wa.barberagencia.com`
- `WA_SERVICE_TOKEN` = (o mesmo token do `.env` da VM)

**Redeploy** o projeto (Deployments → ⋯ → Redeploy) para valer.

## 10. Conectar o WhatsApp

No admin de uma barbearia → **Configurações → WhatsApp → Conectar** → leia o QR.
Aguarde ~15–20s após "conectado" antes do primeiro envio.

---

### Operação
- Logs: `journalctl -u wa-gateway -f`
- Reiniciar: `sudo systemctl restart wa-gateway`
- Atualizar o código: `cd ~/barberagencia && git pull && cd wa-gateway && npm install && sudo systemctl restart wa-gateway`
- As sessões ficam no Supabase (`wa_sessions`), então sobrevivem a restart/reboot (re-hidratação automática).

### Observações
- Na VM (sempre ligada) o keep-alive/auto-ping não é necessário — some a hibernação do Render.
- Mantenha a `.env` com `chmod 600`. Nunca comite a service_role.
- Se um dia trocar de host, é só atualizar `WA_SERVICE_URL` no Vercel.

#!/usr/bin/env bash
# DADOS DE TESTE do banco de homologação (staging): barbearias, distribuidores e usuários @example.test.
# Não aplica schema e não exige banco vazio. Um comando só, rodado no Terminal do macOS:
#
#   1. No Vercel, abra o banco de staging e clique em "Copy Snippet".
#   2. Na raiz do repositório:   bash scripts/staging-test-seed.sh
#
# A área de transferência vai direto para o Node por um pipe (memória). A senha do banco não é
# gravada em disco, não é impressa, não vira argumento de processo (ps) nem entra no histórico.
# No fim, com sucesso ou erro, a área de transferência é limpa. Apps de histórico de área de
# transferência (Raycast, Maccy, Alfred...) NÃO são alcançados: apague o item de lá também.
# Detalhes e guardas: scripts/staging-test-seed.mjs e STAGING.md.
set -euo pipefail
cd "$(dirname "$0")/.."

# A limpeza é armada ANTES de qualquer validação: toda saída, inclusive por argumento errado, limpa.
limpar() {
  if pbcopy </dev/null 2>/dev/null; then
    echo "Área de transferência limpa. Se você usa app de histórico de área de transferência (Raycast, Maccy, Alfred...), apague o snippet de lá também."
  else
    echo "✗ NÃO consegui limpar a área de transferência. Copie qualquer outro texto agora." >&2
  fi
}
trap limpar EXIT
trap 'exit 130' INT TERM HUP

for arg in "$@"; do
  case "$arg" in
    --local) ;;
    *) echo "✗ Opção desconhecida. Este comando não recebe URL nem senha como argumento." >&2; exit 1 ;;
  esac
done
for bin in pbpaste pbcopy node; do
  command -v "$bin" >/dev/null || { echo "✗ Não achei '$bin' (este comando roda no Terminal do macOS)." >&2; exit 1; }
done

pbpaste | node scripts/staging-test-seed.mjs "$@"

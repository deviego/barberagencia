#!/usr/bin/env bash
# PRIMEIRA CARGA do banco de staging. Um comando só, rodado pelo DIEGO no Terminal dele:
#
#   1. No Vercel, abra o banco de staging e clique em "Copy Snippet".
#   2. Na raiz do repositório:   bash scripts/staging-first-load.sh
#
# A área de transferência vai direto para o Node por um pipe (memória). A senha do banco não é
# gravada em disco, não é impressa, não vira argumento de processo (ps) nem entra no histórico.
# No fim, com sucesso ou erro, a área de transferência é limpa.
# Detalhes e guardas: scripts/staging-first-load.mjs e STAGING.md.
set -euo pipefail
cd "$(dirname "$0")/.."

for arg in "$@"; do
  case "$arg" in
    --local | --so-usuarios) ;;
    *) echo "✗ Opção desconhecida. Este comando não recebe URL nem senha como argumento." >&2; exit 1 ;;
  esac
done
for bin in pbpaste pbcopy node; do
  command -v "$bin" >/dev/null || { echo "✗ Não achei '$bin' (este comando roda no Terminal do macOS)." >&2; exit 1; }
done

limpar() {
  if pbcopy </dev/null 2>/dev/null; then
    echo "Área de transferência limpa."
  else
    echo "✗ NÃO consegui limpar a área de transferência. Copie qualquer outro texto agora." >&2
  fi
}
trap limpar EXIT
trap 'exit 130' INT TERM HUP

pbpaste | node scripts/staging-first-load.mjs "$@"

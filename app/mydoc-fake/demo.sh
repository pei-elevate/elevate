#!/usr/bin/env bash
# Demo of ELEV-50: inspection requests going from the fake MyDoc into Elevate, step by step.
#
# Needs the stack running with the seed loaded:
#   docker compose up -d --build
#   docker compose exec backend python -m api.seed
# Keep http://localhost/atribuidas open (profile "Empresa de inspeção") and reload it after
# each step. Run from the repository root: app/mydoc-fake/demo.sh
#
# DEMO_AUTO=1 skips the "press Enter" pauses.

set -euo pipefail

MYDOC=http://localhost:8001
ELEVATE=http://localhost/api
INSPECTION_USER=seed-inspection
WAIT_SECONDS=45 # A little more than MYDOC_POLL_SECONDS (30)

bold=$'\e[1m' dim=$'\e[2m' green=$'\e[32m' yellow=$'\e[33m' blue=$'\e[34m' reset=$'\e[0m'

step() { printf '\n%s━━ %s%s\n' "$bold$blue" "$1" "$reset"; }
say() { printf '%s\n' "$1"; }
ok() { printf '%s✔ %s%s\n' "$green" "$1" "$reset"; }
warn() { printf '%s! %s%s\n' "$yellow" "$1" "$reset"; }
pause() {
  if [[ "${DEMO_AUTO:-}" != 1 ]]; then
    read -rp "${dim}(Enter para continuar)${reset} " _
  fi
}

# --- Helpers ------------------------------------------------------------------------------

mydoc_list() {
  curl -sf "$MYDOC/registos" | python3 -c '
import json, sys
for r in json.load(sys.stdin):
    print("  {processo}  {registo}  {tipo_inspecao:<13}  {registado_em}".format(**r))'
}

mydoc_create() { # reference, type -> prints the new process number
  curl -sf -X POST "$MYDOC/registos" -H 'content-type: application/json' \
    -d "{\"registo\": \"$1\", \"tipo_inspecao\": \"$2\"}" |
    python3 -c 'import json, sys; print(json.load(sys.stdin)["processo"])'
}

elevate_requests() {
  curl -sf -H "X-User-Id: $INSPECTION_USER" "$ELEVATE/inspections/assigned"
}

elevate_summary() {
  elevate_requests | python3 -c '
import json, sys
rows = json.load(sys.stdin)
waiting = [r for r in rows if r["status"] == "awaiting_scheduling"]
print(f"  Por agendar no Elevate: {len(waiting)}")
for r in waiting:
    print("    {}  {}  {}".format(r["process_number"], r["elevator"]["internal_reference"], r["type"]))'
}

elevate_has() { # process number, elevator reference
  elevate_requests | python3 -c "
import json, sys
rows = json.load(sys.stdin)
sys.exit(0 if any(
    r['process_number'] == '$1' and r['elevator']['internal_reference'] == '$2' for r in rows
) else 1)"
}

wait_for_elevate() { # process number, elevator reference
  printf '  À espera do próximo ciclo do Elevate '
  for _ in $(seq "$WAIT_SECONDS"); do
    if elevate_has "$1" "$2"; then
      printf '\n'
      ok "$1 chegou ao Elevate"
      return 0
    fi
    printf '.'
    sleep 1
  done
  printf '\n'
  return 1
}

backend_log_since() { # seconds -> MyDoc lines of the backend log
  docker compose logs --since "${1}s" backend 2>/dev/null | grep 'api.mydoc' | sed 's/^backend-1  | /  /' || true
}

wait_for_log() { # text
  printf '  À espera do aviso no log '
  for _ in $(seq "$WAIT_SECONDS"); do
    if backend_log_since 120 | grep -q "$1"; then
      printf '\n'
      return 0
    fi
    printf '.'
    sleep 1
  done
  printf '\n'
}

# --- Demo ---------------------------------------------------------------------------------

curl -sf "$ELEVATE/health" >/dev/null || { warn "O Elevate não responde em $ELEVATE. Corre: docker compose up -d"; exit 1; }
curl -sf "$MYDOC/registos" >/dev/null || { warn "O MyDoc falso não responde em $MYDOC."; exit 1; }
elevate_requests >/dev/null || { warn "Sem utilizador $INSPECTION_USER. Corre: docker compose exec backend python -m api.seed"; exit 1; }

step "1. O que está hoje no MyDoc e no Elevate"
say "Pedidos registados no MyDoc (falso):"
mydoc_list
elevate_summary
pause

step "2. Um cidadão submete um pedido no MyNet e o MyDoc regista-o"
number=$(mydoc_create 01.05.0285 extraordinary)
ok "MyDoc registou o processo $number (elevador 01.05.0285, inspeção extraordinária)"
say "O Elevate ainda não sabe: vai perguntar ao MyDoc no próximo ciclo (30 s)."
wait_for_elevate "$number" 01.05.0285 || warn "Não chegou em ${WAIT_SECONDS}s. Vê: docker compose logs backend"
elevate_summary
say "${dim}→ No browser, em http://localhost/atribuidas (perfil 'Empresa de inspeção'), recarrega: o $number aparece 'Por agendar'.${reset}"
pause

step "3. Um pedido para um elevador que o Elevate ainda não conhece"
unknown=$(mydoc_create 01.05.9999 periodic)
ok "MyDoc registou o processo $unknown (elevador 01.05.9999)"
say "O pedido é verdadeiro, mas falta o elevador no Elevate: fica pendente e não se perde."
wait_for_log "$unknown"
backend_log_since 120 | grep "$unknown" || true
if elevate_has "$unknown" 01.05.9999; then warn "Entrou?!"; else ok "Não entrou no Elevate; volta a ser tentado a cada ciclo, com um só aviso."; fi
pause

step "4. Uma reinspeção pedida duas vezes para a mesma reprovação"
say "O 01.05.0231 reprovou e já tem a reinspeção 2026/0362 em aberto (seed)."
again=$(mydoc_create 01.05.0231 reinspection)
ok "MyDoc registou o processo $again (reinspeção do 01.05.0231)"
wait_for_log "$again"
backend_log_since 120 | grep "$again" || true
if elevate_has "$again" 01.05.0231; then warn "Entrou?!"; else ok "Não entrou: a empresa de inspeção continua a ver uma só reinspeção."; fi
say "O processo continua no MyDoc, onde a CMA trata os pedidos repetidos."
pause

step "5. O MyDoc vai abaixo"
docker compose stop mydoc >/dev/null 2>&1
ok "MyDoc parado"
wait_for_log "MyDoc unavailable"
backend_log_since 60 | grep "unavailable" | tail -1 || true
code=$(curl -s -o /dev/null -w '%{http_code}' "$ELEVATE/health")
ok "O Elevate continua a responder (health $code) e tenta de novo no ciclo seguinte."
pause

step "6. O MyDoc volta e não repete números"
docker compose start mydoc >/dev/null 2>&1
until curl -sf "$MYDOC/registos" >/dev/null; do sleep 1; done
ok "MyDoc de volta, com os pedidos guardados no volume:"
mydoc_list | tail -3
last=$(mydoc_create 01.05.0079 extraordinary)
ok "Novo pedido $last: número novo, sem reutilizar nenhum"
wait_for_elevate "$last" 01.05.0079 || true
elevate_summary

step "Fim"
say "Pedidos criados nesta demo: $number, $unknown, $again, $last."

#!/usr/bin/env bash
set -e

# ╔══════════════════════════════════════════════════════════════╗
# ║  STAN PLAYA SEGUNDO — Inicio Rápido (Linux/Mac/Git Bash)   ║
# ╚══════════════════════════════════════════════════════════════╝

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail()  { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

# ── Limpieza al salir ──
cleanup() {
  info "Deteniendo servicios..."
  kill $BACKEND_PID 2>/dev/null || true
  kill $DASHBOARD_PID 2>/dev/null || true
  ok "Servicios detenidos."
}
trap cleanup EXIT INT TERM

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   STAN PLAYA SEGUNDO — Inicio Rápido           ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Verificar Node.js ──
info "Verificando Node.js..."
if ! command -v node &>/dev/null; then
  fail "Node.js no está instalado. Instálalo desde https://nodejs.org"
fi
NODE_VER=$(node -v)
ok "Node.js $NODE_VER"

# ── 2. Verificar/Iniciar Docker (PostgreSQL + Redis) ──
if command -v docker &>/dev/null; then
  info "Docker detectado. Levantando PostgreSQL y Redis..."
  docker compose up -d 2>&1 || docker-compose up -d 2>&1 || warn "No se pudo iniciar Docker. Asegúrate de tener PostgreSQL corriendo."

  # Esperar a que PostgreSQL esté listo
  info "Esperando a que PostgreSQL esté listo..."
  for i in $(seq 1 30); do
    if docker exec stanplaya-postgres pg_isready -U postgres &>/dev/null 2>&1; then
      ok "PostgreSQL listo"
      break
    fi
    if [ "$i" -eq 30 ]; then
      warn "PostgreSQL no respondió. ¿Ya está corriendo?"
    fi
    sleep 1
  done
else
  warn "Docker no disponible. Asegúrate de tener PostgreSQL y Redis corriendo."
fi

# ── 3. Verificar .env ──
info "Verificando archivos .env..."
if [ ! -f backend/.env ]; then
  if [ -f backend/.env.example ]; then
    cp backend/.env.example backend/.env
    warn "backend/.env creado desde .env.example. REVISA y completa las variables."
  else
    fail "No existe backend/.env ni backend/.env.example. Crea backend/.env manualmente."
  fi
fi
if [ ! -f dashboard/.env ]; then
  if [ -f dashboard/.env.example ]; then
    cp dashboard/.env.example dashboard/.env
    warn "dashboard/.env creado desde .env.example. REVISA y completa las variables."
  else
    fail "No existe dashboard/.env ni dashboard/.env.example."
  fi
fi
ok "Archivos .env listos"

# ── 4. Instalar dependencias ──
info "Instalando dependencias del backend..."
cd backend || fail "No se encontró el directorio backend/"
npm install --silent
cd ..
ok "Backend listo"

info "Instalando dependencias del dashboard..."
cd dashboard && npm install --silent && cd ..
ok "Dashboard listo"

# ── 5. Base de datos ──
info "Generando Prisma Client..."
cd backend || fail "No se encontró el directorio backend/"
npx prisma generate
cd ..
ok "Prisma Client generado"

info "Ejecutando migraciones..."
cd backend || fail "No se encontró el directorio backend/"
npx prisma migrate dev --skip-generate 2>/dev/null || npx prisma db push --skip-generate
cd ..
ok "Base de datos actualizada"

echo ""
read -p "¿Ejecutar seed de PRUEBA? (s/n) [s]: " SEED_ANSWER
SEED_ANSWER=${SEED_ANSWER:-s}
if [ "$SEED_ANSWER" = "s" ] || [ "$SEED_ANSWER" = "S" ]; then
  info "Sembrando datos de prueba..."
  cd backend || fail "No se encontró el directorio backend/"
  npm run db:seed:test
  cd ..
  ok "Seed de prueba completado"
else
  info "Sembrando datos de producción..."
  cd backend || fail "No se encontró el directorio backend/"
  npm run db:seed
  cd ..
  ok "Seed de producción completado"
fi

# ── 6. Iniciar servicios ──
echo ""
info "Iniciando backend (puerto 4000)..."
cd backend || fail "No se encontró el directorio backend/"
npm run dev &
BACKEND_PID=$!
cd ..
sleep 3

info "Iniciando dashboard (puerto 3000)..."
cd dashboard || fail "No se encontró el directorio dashboard/"
npm run dev &
DASHBOARD_PID=$!
cd ..
sleep 3

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅  PROYECTO CORRIENDO                       ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  📦 Backend:  ${CYAN}http://localhost:4000${NC}           ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  🖥️  Dashboard: ${CYAN}http://localhost:3000${NC}           ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  📚 API Docs: ${CYAN}http://localhost:4000/api-docs${NC}    ${GREEN}║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  Presiona ${RED}Ctrl+C${NC} para detener todo             ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

wait

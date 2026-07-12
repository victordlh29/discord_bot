#!/bin/bash
# ============================================================
# deploy-bot.sh — Deploy automático a JustRunMy.app
#
# Uso:   ./deploy-bot.sh "mensaje del cambio"
# Ej:    ./deploy-bot.sh "fix XP por voz"
#
# ⚠️  Primero dale permisos: chmod +x deploy-bot.sh
# ============================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

if [ -z "$1" ]; then
  echo ""
  echo -e "${RED}❌ Error: faltó el mensaje del commit.${NC}"
  echo ""
  echo -e "${YELLOW}Uso:${NC} ./deploy-bot.sh \"mensaje descriptivo\""
  echo -e "${YELLOW}Ej:${NC}  ./deploy-bot.sh \"corregí bug de XP en misiones\""
  echo ""
  exit 1
fi

MENSAJE="$1"

# Verificar que estamos en la carpeta del proyecto
if [ ! -f "backend/Dockerfile" ]; then
  echo ""
  echo -e "${RED}❌ Error: No se encuentra backend/Dockerfile${NC}"
  echo -e "${YELLOW}Asegúrate de ejecutar este script desde la raíz del proyecto STAN_PLAYA_SEGUNDO${NC}"
  echo ""
  exit 1
fi

echo ""
echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  🚀 DESPLEGANDO A JUSTRUNMY.APP       ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Agregar todos los archivos ──
echo -e "${GREEN}[1/4]${NC} Agregando archivos..."
git add .
echo -e "  ✅ Archivos agregados"

# ── 2. Crear commit ──
echo -e "${GREEN}[2/4]${NC} Creando commit..."
git commit -m "$MENSAJE" 2>/dev/null || echo -e "  ${YELLOW}⚠️  No hay cambios nuevos (se usará el último commit)${NC}"
echo -e "  ✅ Commit listo"

# ── 3. Preguntar la URL de JustRunMy ──
echo -e "${GREEN}[3/4]${NC} Preparando push a JustRunMy.app..."
echo ""
echo -e "${YELLOW}Pega la URL que te dio JustRunMy.app:${NC}"
echo -e "(la que empieza con https://...@justrunmy.app/git/...)"
echo ""
read -p "> " JUSTRUNMY_URL

if [ -z "$JUSTRUNMY_URL" ]; then
  echo ""
  echo -e "${RED}❌ No ingresaste ninguna URL. Cancelando.${NC}"
  exit 1
fi

# ── 4. Hacer push a JustRunMy ──
echo -e "${GREEN}[4/4]${NC} Subiendo a JustRunMy.app..."
echo ""
git push "$JUSTRUNMY_URL" HEAD:deploy

if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  ✅  DESPLIEGUE EXITOSO               ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${CYAN}📊${NC} Revisa los logs en: https://justrunmy.app"
  echo ""
  echo -e "${YELLOW}💡 Sugerencia:${NC} También sube los cambios a GitHub:"
  echo -e "   git push origin main"
  echo ""
else
  echo ""
  echo -e "${RED}❌ Error al hacer push. Revisa el mensaje de arriba.${NC}"
  echo ""
  exit 1
fi

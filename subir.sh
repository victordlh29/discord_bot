#!/bin/bash
# ============================================================
# subir.sh — Sube cambios a GitHub en un solo comando
# Uso:   ./subir.sh "mensaje del cambio"
# Ej:    ./subir.sh "corregí bug de XP en voz"
# ============================================================

if [ -z "$1" ]; then
  echo ""
  echo "❌ Error: faltó el mensaje del commit."
  echo ""
  echo "Uso: ./subir.sh \"mensaje descriptivo\""
  echo "Ej:  ./subir.sh \"corregí bug de XP en misiones\""
  echo ""
  exit 1
fi

MENSAJE="$1"

echo ""
echo "📦 Subiendo cambios a GitHub..."
echo ""

# 1. Agregar todos los archivos modificados
git add .

# 2. Crear el commit
git commit -m "$MENSAJE"

# 3. Verificar que el commit se creó bien
if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Error al crear el commit. No hay cambios para subir."
  echo ""
  exit 1
fi

# 4. Hacer push (el pre-push hook corre los tests automáticamente)
git push

# 5. Verificar que el push fue exitoso
if [ $? -eq 0 ]; then
  echo ""
  echo "✅ CAMBIOS SUBIDOS A GITHUB con éxito."
  echo "   Mensaje: $MENSAJE"
  echo ""
  echo "📊 Ver el CI en: https://github.com/victordlh29/discord_bot/actions"
  echo ""
else
  echo ""
  echo "❌ Error al hacer push. Revisá los mensajes arriba."
  echo ""
  exit 1
fi

# ============================================================
# Dockerfile para STAN PLAYA SEGUNDO — Backend + Bot Discord
# Compatible con: JustRunMy.App, Railway, Render, cualquier Docker
# ============================================================

FROM node:24-slim

# Instalar FFmpeg + yt-dlp para música
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instalar yt-dlp para descarga de audio
RUN pip3 install --break-system-packages yt-dlp

WORKDIR /app

# Copiar dependencias primero (mejor cacheo de capas)
COPY package*.json ./
COPY prisma/ ./prisma/

RUN npm ci --only=production || npm ci

# Generar Prisma Client
RUN npx prisma generate

# Copiar el resto del código fuente
COPY . .

EXPOSE 4000

# tsx ejecuta TypeScript directamente (ideal para producción con Node 24)
CMD ["npx", "tsx", "src/index.ts"]

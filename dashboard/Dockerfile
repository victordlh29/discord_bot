# ============================================================
# Dockerfile para STAN PLAYA SEGUNDO — Dashboard (Next.js 16)
# Render.com — Free tier (o Starter)
# ============================================================

FROM node:24-slim AS builder

WORKDIR /app

# Copiar dependencias
COPY package*.json ./
RUN npm ci

# Copiar código fuente
COPY . .

# Construir Next.js (output standalone ya configurado en next.config.js)
RUN npm run build

# ============================================================
FROM node:24-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copiar solo lo necesario desde builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]

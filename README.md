<p align="center">
  <img src="https://img.shields.io/badge/status-active-brightgreen" alt="Status"/>
  <img src="https://img.shields.io/badge/node-24.11.1-brightgreen" alt="Node Version"/>
  <img src="https://img.shields.io/badge/tests-309%20passing-brightgreen" alt="Tests"/>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License"/>
</p>

<h1 align="center">🎮 STAN PLAYA SEGUNDO</h1>
<p align="center">
  <em>Gamification Discord Bot — XP, niveles, rangos, misiones, música y más</em>
</p>

<p align="center">
  <strong>Backend:</strong> Node.js + TypeScript + Express + Discord.js + Prisma (PostgreSQL)<br>
  <strong>Dashboard:</strong> Next.js 16 + React 19 + Tailwind CSS<br>
  <strong>Cache:</strong> Redis Cloud (con fallback automático a memoria)<br>
  <strong>Música:</strong> yt-dlp + FFmpeg + @discordjs/voice
</p>

---

## ✨ Funcionalidades

### 🎯 Sistema de Gamificación
| Feature | Descripción |
|---------|-------------|
| **XP por mensajes** | 5 brackets configurables según longitud del mensaje |
| **XP por voz** | Por minuto en canales de voz, con cooldown configurable |
| **Anti-spam** | Cooldown, palabras bloqueadas, detección de copy-paste |
| **Niveles** | Cálculo automático: `level = floor(sqrt(xp / 100)) + 1` |
| **Rangos** | CRUD completo, asignación automática, roles de Discord sincronizados |
| **Misiones** | 6 tipos (`send_messages`, `voice_minutes`, `xp_earned`, `level_up`, `daily_login`, `role_gift`) con 4 frecuencias (DAILY, WEEKLY, MONTHLY, ÚNICA) |
| **Eventos** | Competencias por tiempo limitado con Top 10 y rewards |
| **Leaderboard** | Rankings de XP, nivel y tiempo en voz |

### 🎵 Música en Discord
| Comando | Descripción |
|---------|-------------|
| `/play` | Busca en YouTube o reproduce URL directa |
| `/skip` | Salta a la siguiente canción |
| `/stop` | Detiene y limpia la cola |
| `/queue` | Muestra la cola actual |
| `/pause` / `/resume` | Pausa / Reanuda reproducción |
| `/nowplaying` | Muestra progreso con barra |
| `/volume` | Ajusta volumen (0-100) |
| `/remove` | Quita canción por posición |

### 🌐 Dashboard Web
Panel de administración completo con:
- **Inicio de sesión** — OAuth2 con Discord o login Super Admin
- **Control de Acceso** — Roles permitidos por servidor
- **Configuración** — Brackets de XP, canales, cooldown, palabras bloqueadas
- **Rangos** — CRUD con selector de roles y GIFs animados
- **Eventos** — CRUD con countdown en vivo
- **Misiones** — CRUD + progreso en tiempo real vía SSE
- **Usuarios** — Búsqueda, asignación/remoción de roles, reset de XP
- **Leaderboard** — XP, voz y nivel
- **Logs** — Historial paginado
- **Cosméticos** — CRUD
- **GIF Resolver** — Normaliza URLs de Tenor/GIPHY

### 🔒 Seguridad
- JWT con HttpOnly cookies + Doble autenticación (OAuth2 + Admin login)
- Rate limiting en 3 capas (Auth, API, Admin)
- Protección contra IDOR con `resolveGuildId()` centralizado
- LoginProtector: bloqueo por IP tras 5 intentos fallidos
- Zod validation en todas las rutas
- OAuth state parameter con SameSite cookie
- Transacciones Prisma atómicas (sin lost updates)
- SSE con límite de conexiones (5 por usuario)

---

## 🚀 Instalación Rápida

### Requisitos
- **Node.js** 24+
- **PostgreSQL** 16+
- **FFmpeg** (para música)
- **Redis** (opcional, con fallback a memoria)

### 1. Clonar e instalar
```bash
git clone https://github.com/victordlh29/discord_bot.git
cd discord_bot

# Backend
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npm run db:seed

# Dashboard
cd ../dashboard
cp .env.example .env
npm install
```

### 2. Configurar variables de entorno

**`backend/.env`:**
```env
DISCORD_BOT_TOKEN=tu_token_aqui
JWT_SECRET=clave_segura_aqui
API_KEY=api_key_compartida
DATABASE_URL=postgresql://user:pass@localhost:5432/stanplaya
DASHBOARD_URL=http://localhost:3000
SUPERADMIN_USER=admin
SUPERADMIN_PASSWORD=contraseña_segura
```

**`dashboard/.env`:**
```env
NEXT_PUBLIC_DISCORD_CLIENT_ID=tu_client_id
DISCORD_CLIENT_SECRET=tu_client_secret
NEXT_PUBLIC_DISCORD_REDIRECT_URI=http://localhost:3000/auth/callback
API_KEY=api_key_compartida
BACKEND_URL=http://localhost:4000
```

### 3. Iniciar

```bash
# Terminal 1 - Backend (puerto 4000)
cd backend && npm run dev

# Terminal 2 - Dashboard (puerto 3000)
cd dashboard && npm run dev
```

### 4. Scripts automáticos
- **Windows:** `start.bat` (doble clic)
- **Linux/Mac:** `./start.sh`

### 5. Discord Developer Portal
Registrar Redirect URI:
```
http://localhost:3000/auth/callback
```

---

## 🧪 Tests

```bash
# Backend (278 tests)
cd backend && npm test

# Dashboard (31 tests)
cd dashboard && npm test
```

**309 tests en total** — todos pasan ✅

---

## 🛠 Stack

```
Backend:
├── Node.js 24 + TypeScript
├── Express + Discord.js v14
├── Prisma ORM + PostgreSQL
├── Redis (opcional, fallback a memoria)
├── yt-dlp + FFmpeg (música)
└── Zod (validación)

Dashboard:
├── Next.js 16 + React 19
├── Tailwind CSS
├── Server-Sent Events (SSE)
└── Vitest (tests)
```

---

## 📁 Estructura del Proyecto

```
STAN_PLAYA_SEGUNDO/
├── backend/
│   ├── prisma/          # Schema + migraciones + seeds
│   ├── src/
│   │   ├── api/         # Rutas Express + middlewares
│   │   ├── bot/         # Bot Discord (comandos, eventos)
│   │   ├── core/        # Utilidades compartidas
│   │   └── modules/     # Módulos funcionales (XP, voz, misiones, etc.)
│   └── scripts/         # Utilidades de administración
├── dashboard/
│   └── src/
│       ├── app/         # Páginas Next.js
│       ├── components/  # Componentes React
│       └── lib/         # Utilidades (API, auth, SSE)
└── .github/workflows/   # CI/CD pipeline
```

---

## 🤖 Comandos de Discord (31)

| Categoría | Comandos |
|-----------|----------|
| **Configuración** | `/config` |
| **XP/Niveles** | `/setxp`, `/setvoicexp`, `/setcooldown`, `/xp`, `/rank`, `/profile` |
| **Rangos** | `/addrank`, `/editrank`, `/removerank` |
| **Misiones** | `/createmission`, `/editmission`, `/deletemission`, `/missions` |
| **Eventos** | `/createevent`, `/editevent`, `/delevent`, `/eventstatus` |
| **Leaderboard** | `/leaderboard`, `/top`, `/stats` |
| **Música** | `/play`, `/skip`, `/stop`, `/queue`, `/pause`, `/resume`, `/nowplaying`, `/volume`, `/remove` |
| **Utilidades** | `/dashboard` |

---

## 🔄 CI/CD

El proyecto cuenta con un pipeline de GitHub Actions que se ejecuta automáticamente en cada push a `main` o `develop`:

| Job | Pasos |
|-----|-------|
| **Backend** | `npm ci` → Prisma generate → Lint → TypeScript check → 278 tests |
| **Dashboard** | `npm ci` → Lint → TypeScript check → 31 tests |

---

## 📊 Estado

| Métrica | Valor |
|---------|-------|
| **Código** | ~33,000 líneas (150 archivos) |
| **Tests** | 309 (278 backend + 31 dashboard) |
| **Bugs corregidos** | 156 |
| **Seguridad** | ✅ 0 vulnerabilidades en dashboard, ⚠️ 10 en backend (file-type revertido) |
| **ESLint** | 0 errores, 0 warnings (backend + dashboard) |
| **Cobertura funcional** | 99% |

---

## 📄 Licencia

MIT

---

<p align="center">
  <sub>Hecho con ❤️ por <a href="https://github.com/victordlh29">victordlh29</a></sub>
  <br>
  <sub>🛡️ Protegido con pre-push hook — los tests se ejecutan antes de cada push</sub>
</p>

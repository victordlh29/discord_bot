@echo off
title STAN PLAYA SEGUNDO

echo.
echo ============================================
echo     STAN PLAYA SEGUNDO - Inicio Rapido
echo ============================================
echo.

:: ---- 1. Verificar Node.js ----
echo [INFO] Verificando Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [FAIL] Node.js no esta instalado. Instalalo desde https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js %NODE_VER%

:: ---- 2. Verificar .env ----
echo [INFO] Verificando archivos .env...
if not exist backend\.env (
    if exist backend\.env.example (
        copy backend\.env.example backend\.env >nul
        echo [WARN] backend\.env creado desde .env.example
        echo [WARN] REVISA y completa las variables antes de continuar
    ) else (
        echo [FAIL] No existe backend\.env ni backend\.env.example
        pause
        exit /b 1
    )
)
if not exist dashboard\.env (
    if exist dashboard\.env.example (
        copy dashboard\.env.example dashboard\.env >nul
        echo [WARN] dashboard\.env creado desde .env.example
        echo [WARN] REVISA y completa las variables antes de continuar
    ) else (
        echo [FAIL] No existe dashboard\.env ni dashboard\.env.example
        pause
        exit /b 1
    )
)
echo [OK] Archivos .env listos

:: ---- 3. Instalar dependencias ----
echo [INFO] Instalando dependencias del backend...
if not exist backend (
    echo [FAIL] Directorio backend\ no encontrado
    pause
    exit /b 1
)
cd backend
call npm install --silent
cd ..
echo [OK] Backend listo

echo [INFO] Instalando dependencias del dashboard...
if not exist dashboard (
    echo [FAIL] Directorio dashboard\ no encontrado
    pause
    exit /b 1
)
cd dashboard
call npm install --silent
cd ..
echo [OK] Dashboard listo

:: ---- 4. Base de datos ----
echo [INFO] Generando Prisma Client...
cd backend
call npx prisma generate
cd ..
echo [OK] Prisma Client generado

echo [INFO] Ejecutando migraciones...
if not exist backend (
    echo [FAIL] Directorio backend\ no encontrado
    pause
    exit /b 1
)
cd backend
echo [INFO] Intentando migrate dev...
call npx prisma migrate dev --skip-generate
if %errorlevel% neq 0 (
    echo [WARN] migrate dev fallo. Ejecutando db push como fallback...
    call npx prisma db push --skip-generate
)
cd ..
echo [OK] Base de datos actualizada

:: ---- 5. Seed ----
echo.
set /p SEED_ANSWER="Ejecutar seed de PRUEBA? (s/n) [s]: "
if "%SEED_ANSWER%"=="" set SEED_ANSWER=s
if /i "%SEED_ANSWER%"=="s" (
    echo [INFO] Sembrando datos de prueba...
    cd backend
    call npm run db:seed:test
    cd ..
    echo [OK] Seed de prueba completado
) else (
    echo [INFO] Sembrando datos de produccion...
    cd backend
    call npm run db:seed
    cd ..
    echo [OK] Seed de produccion completado
)

:: ---- 6. Iniciar servicios ----
echo.
echo [INFO] Iniciando backend (puerto 4000)...
start "Backend" cmd /c "cd backend && npm run dev"

echo [INFO] Iniciando dashboard (puerto 3000)...
start "Dashboard" cmd /c "cd dashboard && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo ============================================
echo     PROYECTO CORRIENDO
echo ============================================
echo   Backend:   http://localhost:4000
echo   Dashboard: http://localhost:3000
echo   API Docs:  http://localhost:4000/api-docs
echo ============================================
echo   Cierra las ventanas para detener servicios
echo ============================================
echo.

pause

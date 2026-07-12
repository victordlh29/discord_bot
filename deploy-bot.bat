@echo off
title Deploy Bot - JustRunMy.app

:: ==========================================
::  DEPLOY AUTOMATICO A JUSTRUNMY.APP
::  Usa un archivo .cache para recordar la URL
:: ==========================================

set CACHE_FILE="%USERPROFILE%\.justrunmy_url"

:: ---- Verificar que estamos en el proyecto ----
if not exist backend\Dockerfile (
    echo [ERROR] Ejecuta este .bat desde la carpeta STAN_PLAYA_SEGUNDO
    pause
    exit /b 1
)

:: ---- Preguntar la URL si no esta guardada ----
if not exist %CACHE_FILE% (
    echo ==========================================
    echo  PRIMERA VEZ - Configurar URL
    echo ==========================================
    echo.
    echo Pega la URL que te dio JustRunMy.app:
    echo (la que empieza con https://...@justrunmy.app/git/...)
    echo.
    set /p JUSTRUNMY_URL="URL: "
    if "%JUSTRUNMY_URL%"=="" (
        echo [ERROR] No ingresaste URL
        pause
        exit /b 1
    )
    >%CACHE_FILE% echo %JUSTRUNMY_URL%
    echo [OK] URL guardada. Proxima vez solo haz doble clic.
    echo.
) else (
    set /p JUSTRUNMY_URL=<%CACHE_FILE%
)

:: ---- Agregar archivos ----
echo [1/3] Agregando archivos...
git add .
echo   [OK]

:: ---- Commit ----
echo [2/3] Creando commit...
git commit -m "deploy automatico %DATE% %TIME%"
echo   [OK]

:: ---- Push ----
echo [3/3] Subiendo a JustRunMy.app...
git push "%JUSTRUNMY_URL%" HEAD:deploy

if %errorlevel% equ 0 (
    echo.
    echo ==========================================
    echo  [OK] BOT DESPLEGADO
    echo ==========================================
    echo.
    echo  Revisa los logs: https://justrunmy.app
    echo.
    echo  Sugerencia: git push origin main (para GitHub)
    echo.
) else (
    echo.
    echo [ERROR] Fallo el push. Revisa el mensaje arriba.
    echo.
)

pause

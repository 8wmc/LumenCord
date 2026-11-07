@echo off
title LumenCord - Build
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org & pause & exit /b 1)
echo [LumenCord] Setting up pnpm...
call npm install -g pnpm || (echo Failed to install pnpm & pause & exit /b 1)
echo [LumenCord] Installing dependencies...
call pnpm install --frozen-lockfile || (echo Failed to install dependencies & pause & exit /b 1)
echo [LumenCord] Building...
call pnpm buildStandalone || (echo Build failed & pause & exit /b 1)
echo.
echo [LumenCord] Done! The built files are in dist\desktop.
echo The installer is built separately by GitHub Actions after you push.
pause

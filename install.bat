@echo off
title LumenCord - Install
cd /d "%~dp0"
if not exist dist ( echo Run build.bat first. & pause & exit /b 1 )
echo [LumenCord] Close Discord fully before continuing.
pause
call pnpm inject
pause

@echo off
title LumenCord - Uninstall
cd /d "%~dp0"
echo [LumenCord] Close Discord fully, then choose Uninstall in the window that opens.
pause
call pnpm uninject
pause

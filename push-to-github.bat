@echo off
title LumenCord - Upload to GitHub
cd /d "%~dp0"
where git >nul 2>nul || (echo Git is not installed. Get it from https://git-scm.com & pause & exit /b 1)
if not exist .git (
    git init -b main
    git remote add origin https://github.com/8wmc/LumenCord.git
    rem Stack this version on top of what is already on GitHub instead of clashing with it.
    git fetch origin main 2>nul && git reset --soft origin/main
)
git add -A
git commit -m "LumenCord update" || echo Nothing new to commit.
echo [LumenCord] Uploading... a GitHub sign-in window may pop up the first time.
git push -u origin main || (echo Upload failed. & pause & exit /b 1)
echo.
echo [LumenCord] Uploaded! GitHub is now building LumenCord and the installer.
echo Check progress at https://github.com/8wmc/LumenCord/actions
pause

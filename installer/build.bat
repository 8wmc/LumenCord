@echo off
title LumenCord Installer - Build
rem Optional: GitHub builds the installer for you automatically.
rem Only use this if you want to build it on your own PC.
rem Needs MSYS2 from https://www.msys2.org installed to C:\msys64
cd /d "%~dp0"
if not exist C:\msys64\usr\bin\bash.exe (echo MSYS2 not found. Install it from https://www.msys2.org & pause & exit /b 1)
C:\msys64\usr\bin\bash.exe -lc "pacman -S --needed --noconfirm git make mingw-w64-x86_64-gcc mingw-w64-x86_64-SDL2 mingw-w64-x86_64-go"
C:\msys64\usr\bin\bash.exe -lc "cd '%CD:\=/%' && export PATH=/mingw64/bin:$PATH GOROOT=/mingw64/lib/go GOPATH=/mingw64 && go install github.com/tc-hib/go-winres@v0.3.3 && make GUI=1 VERSION=Unknown"
if exist build\LumenCordInstaller.exe (echo Done! Your installer is in the build folder.) else (echo Build failed, check the messages above.)
pause

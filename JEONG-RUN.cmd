@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title JEONG

if not exist ".env.local" (
  echo Google setup is not complete.
  echo Run JEONG-SETUP-AND-RUN.cmd first.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  call npm.cmd install
)

start "JEONG Server" cmd.exe /c "cd /d ""%~dp0"" && npm.cmd run dev"
timeout /t 7 /nobreak >nul
start "" "http://localhost:3000"

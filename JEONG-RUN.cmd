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

powershell -NoProfile -Command "try { $c=New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1',3000); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 (
  echo JEONG is already running. Opening the browser only.
  start "" "http://localhost:3000/dashboard"
  exit /b 0
)

if not exist "node_modules\" (
  echo Installing JEONG for the first time...
  call npm.cmd install
  if errorlevel 1 (
    echo Installation failed.
    pause
    exit /b 1
  )
)

if not exist ".next\BUILD_ID" (
  echo Preparing the optimized JEONG build...
  call npm.cmd run build
  if errorlevel 1 (
    echo Build failed. Run JEONG-CHECK.cmd and review the error.
    pause
    exit /b 1
  )
)

start "JEONG Server" cmd.exe /k "cd /d ""%~dp0"" && npm.cmd run start"
timeout /t 5 /nobreak >nul
start "" "http://localhost:3000/dashboard"
